import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { cellToBoundary } from "h3-js";
import "leaflet/dist/leaflet.css";
import type { ApiClient } from "../api/adminApi";

// ─── Marker for the partner's GPS location ────────────────────────────────────
const partnerIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const INACTIVE_COLOR = "#94a3b8";

interface Hub {
  _id: string;
  name: string;
  h3Cells: string[];
  center?: { lat: number | null; lng: number | null };
  city: string;
  state: string;
  category?: string;       // Category _id
  categoryName?: string;   // denormalised for display
  isActive: boolean;
}

function cellPositions(cell: string): [number, number][] {
  return cellToBoundary(cell).map(([lat, lng]) => [lat, lng]);
}

// Colour hubs by their service category so overlapping services stay distinct.
function categoryColor(categoryId?: string): string {
  if (!categoryId) return "#64748b";
  const palette = ["#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1"];
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

// Great-circle distance in km between two lat/lng points.
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km away` : `${Math.round(km)} km away`;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const didFly = useRef(false);
  useEffect(() => {
    if (!didFly.current) { map.flyTo([lat, lng], 12, { duration: 0.8 }); didFly.current = true; }
  }, [map, lat, lng]);
  return null;
}

export default function AssignHubModal({
  api,
  partner,
  onClose,
  onSaved,
}: {
  api: ApiClient;
  partner: {
    id: string;
    name: string;
    assignedHubId?: string | null;
    location?: { coordinates: [number, number] };
    serviceCategoryNames?: string[]; // e.g. ["Mehendi", "AC Repair"]
  };
  onClose: () => void;
  onSaved: (hub: { id: string; name: string } | null) => void;
}) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(partner.assignedHubId || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coords = partner.location?.coordinates;
  const partnerLat = Array.isArray(coords) && coords.length === 2 ? coords[1] : null;
  const partnerLng = Array.isArray(coords) && coords.length === 2 ? coords[0] : null;
  const hasLocation = partnerLat !== null && partnerLng !== null;
  const mapCenter: [number, number] = hasLocation ? [partnerLat!, partnerLng!] : [22.47, 88.37];

  const currentHubId = partner.assignedHubId || null;

  useEffect(() => {
    api.get<any>("/hubs").then((res) => {
      if (res.success) setHubs(res.data?.hubs || res.data || []);
      setLoading(false);
    });
  }, [api]);

  // Partition hubs into three buckets:
  //  serviceHubs  — category matches one of the partner's service categories (clickable)
  //  legacyHubs   — no category at all (created before per-service system) (clickable, with warning)
  //  otherHubs    — belong to a different service (shown dimmed on map, not selectable)
  const { serviceHubs, legacyHubs, otherHubs } = useMemo(() => {
    const filterNames = (partner.serviceCategoryNames || [])
      .map((n) => n.toLowerCase().trim())
      .filter(Boolean);

    const serviceH: Hub[] = [];
    const legacyH: Hub[] = [];
    const otherH: Hub[] = [];

    for (const hub of hubs) {
      const catName = (hub.categoryName || "").toLowerCase().trim();
      if (!hub.category && !catName) {
        // Created before the per-service hub system — no category at all
        legacyH.push(hub);
      } else if (
        filterNames.length === 0 ||
        filterNames.some((n) => catName && (catName.includes(n) || n.includes(catName)))
      ) {
        serviceH.push(hub);
      } else {
        otherH.push(hub);
      }
    }
    return { serviceHubs: serviceH, legacyHubs: legacyH, otherHubs: otherH };
  }, [hubs, partner.serviceCategoryNames]);

  // IDs the partner is allowed to pick (own-service + legacy + their current hub)
  const selectableIds = useMemo(() => {
    const ids = new Set([...serviceHubs, ...legacyHubs].map((h) => h._id));
    if (currentHubId) ids.add(currentHubId);
    return ids;
  }, [serviceHubs, legacyHubs, currentHubId]);

  // Sort service hubs by distance for the list; other buckets keep original order.
  const serviceHubsWithDistance = useMemo(() => {
    const list = serviceHubs.map((hub) => {
      const c = hub.center;
      const distanceKm =
        hasLocation && c && Number.isFinite(c.lat) && Number.isFinite(c.lng)
          ? haversineKm(partnerLat!, partnerLng!, c.lat as number, c.lng as number)
          : null;
      return { hub, distanceKm };
    });
    if (hasLocation) {
      list.sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }
    return list;
  }, [serviceHubs, hasLocation, partnerLat, partnerLng]);

  const selectedHub = hubs.find((h) => h._id === selected) || null;
  const selectedInactive = selectedHub ? !selectedHub.isActive : false;
  const changed = selected !== currentHubId;

  // Button reflects the actual action about to happen.
  let actionLabel = "No changes";
  let actionDanger = false;
  if (changed) {
    if (selected === null) {
      actionLabel = "Remove hub assignment";
      actionDanger = true;
    } else if (currentHubId === null) {
      actionLabel = `Assign to ${selectedHub?.name ?? "hub"}`;
    } else {
      actionLabel = `Move to ${selectedHub?.name ?? "hub"}`;
    }
  }

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const res = await api.patch(`/partners/${partner.id}/hub`, { hubId: selected });
    setSaving(false);
    if (!res.success) { setError(res.error?.message || "Failed to assign hub"); return; }
    const hub = hubs.find((h) => h._id === selected);
    onSaved(selected && hub ? { id: hub._id, name: hub.name } : null);
    onClose();
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--panel)", borderRadius: 12, width: "min(1200px, 96vw)",
        height: "min(820px, 92vh)", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel-alt)",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Assign Hub</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
              {partner.name} — pick the hub this partner will serve
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--muted)", lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Map */}
          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>Loading hubs…</div>
            ) : (
              <MapContainer center={mapCenter} zoom={hasLocation ? 12 : 11} style={{ width: "100%", height: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {hasLocation && <FlyTo lat={partnerLat!} lng={partnerLng!} />}

                {hasLocation && (
                  <Marker position={[partnerLat!, partnerLng!]} icon={partnerIcon}>
                    <Tooltip permanent direction="top" offset={[0, -40]}>
                      <strong>{partner.name}</strong><br /><span style={{ fontSize: 11 }}>Partner location</span>
                    </Tooltip>
                  </Marker>
                )}

                {hubs.map((hub) => {
                  const isSelected = hub._id === selected;
                  const isCurrent = hub._id === currentHubId;
                  const isOtherService = otherHubs.some((h) => h._id === hub._id);
                  const isLegacy = legacyHubs.some((h) => h._id === hub._id);
                  const canSelect = selectableIds.has(hub._id);

                  // Colour scheme: other-service hubs are visually dimmed
                  let color: string;
                  if (isSelected) {
                    color = "#2563eb";
                  } else if (isCurrent) {
                    color = "#7c3aed";
                  } else if (isOtherService) {
                    color = "#cbd5e1"; // very light — clearly not for this partner
                  } else if (isLegacy) {
                    color = "#f59e0b"; // amber — legacy, assignable but flagged
                  } else {
                    color = hub.isActive ? categoryColor(hub.category) : INACTIVE_COLOR;
                  }

                  return (hub.h3Cells || []).map((cell) => (
                    <Polygon
                      key={`${hub._id}-${cell}`}
                      positions={cellPositions(cell)}
                      pathOptions={{
                        color,
                        fillColor: color,
                        fillOpacity: isOtherService ? 0.06 : isSelected ? 0.45 : 0.18,
                        weight: isOtherService ? 0.5 : isSelected ? 2.5 : 1,
                      }}
                      eventHandlers={{ click: () => canSelect && setSelected(hub._id) }}
                    >
                      <Tooltip sticky>
                        <strong>{hub.name}</strong>{hub.city ? `, ${hub.city}` : ""}
                        {hub.categoryName ? (
                          <><br /><span style={{ fontSize: 11, fontWeight: 600 }}>{hub.categoryName}</span></>
                        ) : (
                          <><br /><span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b" }}>Legacy (no service)</span></>
                        )}
                        {isOtherService && (
                          <><br /><span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 11 }}>Different service — not selectable</span></>
                        )}
                        {!hub.isActive && (
                          <><br /><span style={{ color: "#64748b", fontWeight: 600, fontSize: 11 }}>Disabled</span></>
                        )}
                        {isCurrent && !isSelected && (
                          <><br /><span style={{ color: "#7c3aed", fontWeight: 600, fontSize: 11 }}>Currently assigned</span></>
                        )}
                      </Tooltip>
                    </Polygon>
                  ));
                })}
              </MapContainer>
            )}

            <div style={{
              position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
              background: "rgba(15,23,42,0.82)", color: "#fff", borderRadius: 20,
              padding: "5px 14px", fontSize: 12, fontWeight: 500, zIndex: 1000,
              backdropFilter: "blur(4px)", pointerEvents: "none", whiteSpace: "nowrap",
            }}>
              {hubs.length === 0 && !loading
                ? "No hubs defined — create them in Zones → Hubs tab first"
                : otherHubs.length > 0
                  ? `Grey = other service (not selectable) · Amber = legacy · Click a coloured hub to select`
                  : "Red marker = partner location · Click a hub to select it"}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width: 260, borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "12px 16px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)" }}>
              Hubs ({serviceHubs.length}){hasLocation && serviceHubs.length > 1 ? " · nearest first" : ""}
              {(partner.serviceCategoryNames || []).length > 0 && (
                <span style={{ display: "block", fontWeight: 500, fontSize: 10, color: "var(--muted-2)", marginTop: 2, textTransform: "none" }}>
                  Filtered to: {partner.serviceCategoryNames!.join(", ")}
                </span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>

              {/* ── Service-matching hubs (clickable) ── */}
              {serviceHubsWithDistance.map(({ hub, distanceKm }) => {
                const meta = [
                  hub.categoryName || null,
                  hub.city || null,
                  `${hub.h3Cells.length} cells`,
                  distanceKm !== null ? formatKm(distanceKm) : null,
                ].filter(Boolean).join(" · ");
                return (
                  <div key={hub._id} onClick={() => setSelected(hub._id)} style={{
                    padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)",
                    background: selected === hub._id ? "var(--info-bg)" : hub._id === currentHubId ? "var(--purple-bg)" : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: hub.isActive ? categoryColor(hub.category) : INACTIVE_COLOR, flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, fontSize: 13, opacity: hub.isActive ? 1 : 0.6 }}>{hub.name}</span>
                      {!hub.isActive && (
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", color: "var(--muted)", background: "var(--muted-2)", borderRadius: 4, padding: "1px 5px" }}>
                          DISABLED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, paddingLeft: 16 }}>
                      {meta}
                      {hub._id === currentHubId && <span style={{ color: "#7c3aed", fontWeight: 600 }}> · assigned</span>}
                    </div>
                  </div>
                );
              })}

              {serviceHubs.length === 0 && !loading && (
                <div style={{ padding: "14px 16px", fontSize: 12, color: "var(--muted-2)", textAlign: "center" }}>
                  No hubs found for this service category.<br />Create them in Zones → Hubs tab.
                </div>
              )}

              {/* ── Legacy hubs (no category) ── */}
              {legacyHubs.length > 0 && (
                <>
                  <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "#f59e0b", background: "rgba(245,158,11,0.07)", borderTop: "1px solid var(--border)" }}>
                    ⚠ Legacy hubs — no service assigned
                  </div>
                  {legacyHubs.map((hub) => {
                    const meta = [hub.city || null, `${hub.h3Cells.length} cells`].filter(Boolean).join(" · ");
                    return (
                      <div key={hub._id} onClick={() => setSelected(hub._id)} style={{
                        padding: "10px 16px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)",
                        background: selected === hub._id ? "var(--info-bg)" : hub._id === currentHubId ? "var(--purple-bg)" : "rgba(245,158,11,0.04)",
                        opacity: 0.8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b", flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{hub.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.15)", borderRadius: 4, padding: "1px 5px" }}>LEGACY</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, paddingLeft: 16 }}>
                          {meta}
                          {hub._id === currentHubId && <span style={{ color: "#7c3aed", fontWeight: 600 }}> · assigned</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* ── Other-service hubs (not selectable) ── */}
              {otherHubs.length > 0 && (
                <>
                  <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted-2)", background: "var(--muted-3,var(--panel-alt))", borderTop: "1px solid var(--border)" }}>
                    Other services — not selectable
                  </div>
                  {otherHubs.map((hub) => {
                    const meta = [hub.categoryName || null, hub.city || null, `${hub.h3Cells.length} cells`].filter(Boolean).join(" · ");
                    return (
                      <div key={hub._id} style={{
                        padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
                        opacity: 0.4, cursor: "not-allowed",
                        background: hub._id === currentHubId ? "var(--purple-bg)" : "transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: "#cbd5e1", flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{hub.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, paddingLeft: 16 }}>
                          {meta}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

            </div>

            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
              {error && (
                <div style={{
                  fontSize: 12, color: "var(--danger-text)", background: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)", borderRadius: 6, padding: "6px 10px",
                }}>
                  {error}
                </div>
              )}
              {selectedInactive && (
                <div style={{
                  fontSize: 11, color: "var(--warning-text)", background: "var(--warning-bg)",
                  border: "1px solid var(--warning-border)", borderRadius: 6, padding: "6px 10px",
                }}>
                  ⚠ This hub is disabled — the partner won't receive hub-based jobs while it stays off.
                </div>
              )}
              <button
                className={actionDanger ? "button danger" : "button"}
                style={{ width: "100%" }}
                onClick={handleSave}
                disabled={saving || !changed}
              >
                {saving ? "Saving…" : actionLabel}
              </button>
              {selected && (
                <button className="button secondary" style={{ width: "100%", fontSize: 12 }} onClick={() => setSelected(null)}>
                  Deselect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
