import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polygon, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { cellToBoundary, polygonToCells, getHexagonAreaAvg } from "h3-js";
import "leaflet/dist/leaflet.css";
import type { ApiClient } from "../api/adminApi";

// ─── Constants ────────────────────────────────────────────────────────────────
const H3_RESOLUTION = 7;
const GRID_MIN_ZOOM = 10; // only render the clickable grid when zoomed in enough
// Average ground area of one hexagon at this resolution (~5.16 km² at res 7).
// Derived from h3 so it stays correct if H3_RESOLUTION ever changes.
const HEX_AREA_KM2 = getHexagonAreaAvg(H3_RESOLUTION, "km2");

// A hub belongs to exactly ONE service category. The Hubs tab shows one
// service at a time via sub-tabs, loaded dynamically from the catalog so
// adding a new service needs no code change.
interface Category {
  _id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
}

const EMPTY_FORM = {
  name: "", city: "", state: "", categoryId: "",
  isActive: true, customerAppEnabled: true, partnerAppEnabled: true,
};

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
  customerAppEnabled: boolean;
  partnerAppEnabled: boolean;
  partnerCount?: number;
}

// Coloured centre marker so each hub's pin matches its region colour.
function makeHubIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "hub-center-marker",
    html: `<div style="background:${color};color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;box-shadow:0 1px 4px rgba(0,0,0,0.4);border:2px solid #fff;">H</div>`,
    iconSize: [22, 22], iconAnchor: [11, 11],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function cellPositions(cell: string): [number, number][] {
  return cellToBoundary(cell).map(([lat, lng]) => [lat, lng]);
}

// Stable colour per *category* so each service reads consistently (used for tabs).
const CATEGORY_PALETTE = ["#0ea5e9", "#16a34a", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1"];
function categoryColor(categoryId?: string): string {
  if (!categoryId) return "#64748b";
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) hash = (hash * 31 + categoryId.charCodeAt(i)) | 0;
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

// Distinct colour per *hub* within a service tab so neighbouring hubs are easy
// to tell apart. Hand-picked palette for the first dozen; beyond that we generate
// evenly-spaced hues via the golden angle so any number of hubs stays distinct.
const HUB_PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6", "#6366f1", "#eab308", "#db2777", "#0891b2", "#65a30d"];
function hubColorAt(index: number): string {
  if (index < HUB_PALETTE.length) return HUB_PALETTE[index];
  const hue = (index * 137.508) % 360; // golden angle keeps adjacent hues far apart
  return `hsl(${hue.toFixed(1)}, 65%, 45%)`;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div onClick={() => onChange(!checked)} style={{
        width: 40, height: 22, borderRadius: 11, position: "relative", flexShrink: 0,
        background: checked ? "var(--accent)" : "var(--muted-2)", transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3, width: 16, height: 16,
          borderRadius: "50%", background: "var(--panel)", transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 14, color: "var(--text-2)" }}>{label}</span>
    </label>
  );
}

// ─── Map interaction layer ────────────────────────────────────────────────────
function GridLayer({
  drawing,
  selectedCells,
  claimedCells,
  onToggleCell,
}: {
  drawing: boolean;
  selectedCells: Set<string>;
  claimedCells: Set<string>;
  onToggleCell: (cell: string) => void;
}) {
  const [gridCells, setGridCells] = useState<string[]>([]);
  const [zoom, setZoom] = useState(11);

  // Ref avoids stale closure in moveend/zoomend handlers
  const drawingRef = useRef(drawing);
  useEffect(() => { drawingRef.current = drawing; }, [drawing]);

  const recompute = useCallback((map: L.Map) => {
    const z = map.getZoom();
    setZoom(z);
    if (!drawingRef.current || z < GRID_MIN_ZOOM) { setGridCells([]); return; }
    const b = map.getBounds();
    const poly: [number, number][] = [
      [b.getNorth(), b.getWest()],
      [b.getNorth(), b.getEast()],
      [b.getSouth(), b.getEast()],
      [b.getSouth(), b.getWest()],
      [b.getNorth(), b.getWest()], // close the ring
    ];
    try {
      setGridCells(polygonToCells(poly, H3_RESOLUTION));
    } catch {
      setGridCells([]);
    }
  }, []);

  // NOTE: no map-level `click` handler — it double-fires with the polygon click
  // (toggling a cell on then immediately off). Polygon clicks alone are enough.
  const map = useMapEvents({
    moveend: () => recompute(map),
    zoomend: () => recompute(map),
  });

  useEffect(() => { recompute(map); }, [drawing, map, recompute]);

  if (!drawing) return null;

  if (zoom < GRID_MIN_ZOOM) return null;

  return (
    <>
      {gridCells.map((cell) => {
        const isSelected = selectedCells.has(cell);
        const isClaimed = claimedCells.has(cell) && !isSelected;
        return (
          <Polygon
            key={cell}
            positions={cellPositions(cell)}
            pathOptions={{
              // Empty grid cells: faint grey hex outline (still clickable). Selected
              // stays blue. Claimed = owned by another hub *in this same service*.
              color: isSelected ? "#2563eb" : isClaimed ? "#dc2626" : "#94a3b8",
              weight: isSelected ? 2.5 : isClaimed ? 1 : 0.6,
              fillColor: isSelected ? "#2563eb" : isClaimed ? "#dc2626" : "#94a3b8",
              fillOpacity: isSelected ? 0.5 : isClaimed ? 0.3 : 0.05,
            }}
            eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e.originalEvent); if (!isClaimed) onToggleCell(cell); } }}
          />
        );
      })}
    </>
  );
}

// ─── Fly the map to a hub when editing starts ─────────────────────────────────
// Fires once per hub (keyed by id) so toggling cells mid-edit doesn't re-pan.
function FlyToHub({ hub }: { hub: Hub | null }) {
  const map = useMap();
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    if (!hub) { lastId.current = null; return; }
    if (hub._id === lastId.current) return;
    lastId.current = hub._id;

    const cells = hub.h3Cells || [];
    if (cells.length > 0) {
      const pts: [number, number][] = [];
      for (const c of cells) for (const [lat, lng] of cellToBoundary(c)) pts.push([lat, lng]);
      if (pts.length > 0) {
        map.flyToBounds(L.latLngBounds(pts), { padding: [40, 40], duration: 0.8, maxZoom: 14 });
        return;
      }
    }
    if (hub.center && Number.isFinite(hub.center.lat) && Number.isFinite(hub.center.lng)) {
      map.flyTo([hub.center.lat as number, hub.center.lng as number], 13, { duration: 0.8 });
    }
  }, [hub, map]);
  return null;
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export default function HubsTab({ api }: { api: ApiClient }) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const [drawing, setDrawing] = useState(false);
  const [editingHub, setEditingHub] = useState<Hub | null>(null);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // Which service this tab is currently showing/drawing. One sub-tab per category.
  const [activeCategory, setActiveCategory] = useState<string>("");

  const fetchHubs = useCallback(async () => {
    setLoading(true);
    const res = await api.get<any>("/hubs");
    if (res.success) {
      setHubs(res.data?.hubs || res.data || []);
      setApiUnavailable(false);
    } else {
      setApiUnavailable(true);
      setHubs([]);
    }
    setLoading(false);
  }, [api]);

  const fetchCategories = useCallback(async () => {
    const res = await api.get<any>("/hubs/categories");
    if (res.success) {
      const rows: Category[] = res.data?.categories || res.data || [];
      setCategories(rows.filter((c) => c.isActive !== false));
    }
  }, [api]);

  useEffect(() => { fetchHubs(); fetchCategories(); }, [fetchHubs, fetchCategories]);

  // Default to the first service tab once categories load.
  useEffect(() => {
    if (!activeCategory && categories.length) setActiveCategory(categories[0]._id);
  }, [categories, activeCategory]);

  const activeCategoryObj = useMemo(
    () => categories.find((c) => c._id === activeCategory) || null,
    [categories, activeCategory]
  );

  const categoryName = useCallback(
    (hub: Hub) => hub.categoryName || categories.find((c) => c._id === hub.category)?.name || "—",
    [categories]
  );

  // Cells owned by *other* hubs of the active service — those can't be claimed.
  // Hubs of a different service live on their own tab and may overlap freely.
  const claimedCells = useMemo(() => {
    const s = new Set<string>();
    if (!activeCategory) return s;
    for (const h of hubs) {
      if (editingHub && h._id === editingHub._id) continue;
      if (String(h.category) !== String(activeCategory)) continue;
      for (const c of h.h3Cells || []) s.add(c);
    }
    return s;
  }, [hubs, editingHub, activeCategory]);

  // Hubs for the active service, matching the search box.
  const filteredHubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return hubs.filter((h) => {
      if (String(h.category) !== String(activeCategory)) return false;
      if (!q) return true;
      return h.name.toLowerCase().includes(q) || (h.city || "").toLowerCase().includes(q);
    });
  }, [hubs, search, activeCategory]);

  // Saved hubs drawn on the map: only the active service, minus the one being edited.
  const visibleHubs = useMemo(
    () => hubs.filter((h) => String(h.category) === String(activeCategory) && !(editingHub && h._id === editingHub._id)),
    [hubs, activeCategory, editingHub]
  );

  // Per-service hub counts for the sub-tab badges.
  const countByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of hubs) m.set(String(h.category), (m.get(String(h.category)) || 0) + 1);
    return m;
  }, [hubs]);

  // Assign each hub in the active service a distinct colour so they're easy to
  // tell apart on the map and in the list. Keyed by _id so list & map agree.
  const hubColorMap = useMemo(() => {
    const m = new Map<string, string>();
    hubs
      .filter((h) => String(h.category) === String(activeCategory))
      .forEach((h, i) => m.set(h._id, hubColorAt(i)));
    return m;
  }, [hubs, activeCategory]);

  const hubColor = useCallback(
    (hub: Hub) => (hub.isActive ? hubColorMap.get(hub._id) || categoryColor(hub.category) : "#94a3b8"),
    [hubColorMap]
  );

  const patchForm = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const toggleCell = (cell: string) => {
    if (claimedCells.has(cell)) return; // belongs to another hub in this service
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(cell)) next.delete(cell); else next.add(cell);
      return next;
    });
  };

  const startCreate = () => {
    if (!activeCategory) return;
    setEditingHub(null);
    setForm({ ...EMPTY_FORM, categoryId: activeCategory });
    setSelectedCells(new Set());
    setDrawing(true);
  };

  const startEdit = (hub: Hub) => {
    if (hub.category) setActiveCategory(hub.category);
    setEditingHub(hub);
    setForm({
      name: hub.name, city: hub.city || "", state: hub.state || "",
      categoryId: hub.category || activeCategory,
      isActive: hub.isActive, customerAppEnabled: hub.customerAppEnabled,
      partnerAppEnabled: hub.partnerAppEnabled,
    });
    setSelectedCells(new Set(hub.h3Cells || []));
    setDrawing(true);
  };

  const cancelDraw = () => {
    setDrawing(false);
    setEditingHub(null);
    setSelectedCells(new Set());
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert("Enter a hub name"); return; }
    if (!form.categoryId) { alert("Pick a service tab first"); return; }
    if (selectedCells.size === 0) { alert("Select at least one cell on the map"); return; }
    setSaving(true);
    const payload = { ...form, h3Cells: [...selectedCells] };
    const res = editingHub
      ? await api.patch(`/hubs/${editingHub._id}`, payload)
      : await api.post("/hubs", payload);
    setSaving(false);
    if (!res.success) { alert(res.error?.message || "Failed to save hub"); return; }
    await fetchHubs();
    cancelDraw();
  };

  const handleDelete = async (hub: Hub, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete hub "${hub.name}"? Partners assigned to it will be unassigned.`)) return;
    await api.delete(`/hubs/${hub._id}`);
    await fetchHubs();
    if (editingHub?._id === hub._id) cancelDraw();
  };

  const quickToggle = async (hub: Hub, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.patch(`/hubs/${hub._id}`, { isActive: !hub.isActive });
    await fetchHubs();
  };

  const selectTab = (categoryId: string) => {
    if (drawing) return; // don't switch service mid-draw
    setActiveCategory(categoryId);
    setSearch("");
  };

  return (
    <div>
      {/* Banner */}
      <div style={{
        background: "var(--purple-bg)", border: "1px solid var(--purple-border)",
        borderRadius: 10, padding: "10px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>⬡</span>
        <div>
          <span style={{ fontWeight: 700, color: "var(--purple-text)", fontSize: 13 }}>Hubs — one map per service </span>
          <span style={{ fontSize: 12, color: "var(--purple-text)" }}>
            Pick a service tab, then draw its coverage by selecting H3 cells. Each service has its own hubs;
            hubs for <strong>different</strong> services may overlap, two hubs for the <strong>same</strong> service may not.
          </span>
        </div>
      </div>

      {apiUnavailable && (
        <div style={{
          background: "var(--warning-bg)", border: "1px solid var(--warning-border)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--warning-text)",
        }}>
          Backend endpoint <code>/api/v1/admin/hubs</code> is not reachable. Hubs cannot be saved or loaded yet.
        </div>
      )}

      {/* Service sub-tabs — one per catalog category */}
      {categories.length === 0 ? (
        !loading && (
          <div style={{
            background: "var(--warning-bg)", border: "1px solid var(--warning-border)",
            borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: "var(--warning-text)",
          }}>
            No service categories found. Add a service in the catalog first, then come back to draw its hubs.
          </div>
        )
      ) : (
        <div style={{ display: "flex", gap: 2, marginBottom: 14, borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
          {categories.map((c) => {
            const active = activeCategory === c._id;
            const n = countByCategory.get(c._id) || 0;
            const locked = drawing && !active;
            return (
              <button
                key={c._id}
                onClick={() => selectTab(c._id)}
                disabled={locked}
                title={locked ? "Finish or cancel the current hub to switch service" : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                  border: "none", background: "none", cursor: drawing ? "default" : "pointer",
                  borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                  marginBottom: -1,
                  color: active ? "var(--text)" : "var(--muted)",
                  fontWeight: active ? 700 : 500, fontSize: 13,
                  opacity: locked ? 0.4 : 1,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 2, background: categoryColor(c._id) }} />
                {c.name}
                <span style={{
                  fontSize: 11, fontWeight: 600, color: active ? "var(--accent)" : "var(--muted)",
                  background: active ? "var(--accent-50)" : "var(--muted-2)", borderRadius: 10, padding: "0 7px", minWidth: 18, textAlign: "center",
                }}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, height: "calc(100vh - 320px)", minHeight: 460 }}>
        {/* Map */}
        <div style={{ flex: 1, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", position: "relative" }}>
          <MapContainer center={[22.47, 88.37]} zoom={12} style={{ width: "100%", height: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FlyToHub hub={editingHub} />

            {/* Saved hubs for the active service (each hub a distinct colour) */}
            {visibleHubs.map((hub) => {
              const color = hubColor(hub);
              return (hub.h3Cells || []).map((cell) => (
                <Polygon
                  key={`${hub._id}-${cell}`}
                  positions={cellPositions(cell)}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.32, weight: 1.5 }}
                >
                  <Tooltip sticky className="glass-tip">
                    <strong>{hub.name}</strong>{hub.city ? `, ${hub.city}` : ""}<br />
                    <span style={{ fontSize: 11 }}>{categoryName(hub)} · {hub.h3Cells.length} cells · {hub.partnerCount ?? 0} partners</span>
                  </Tooltip>
                </Polygon>
              ));
            })}

            {/* Hub centre markers — coloured to match the region, name always shown */}
            {visibleHubs.map((hub) =>
              hub.center && Number.isFinite(hub.center.lat) && Number.isFinite(hub.center.lng) ? (
                <Marker key={`c-${hub._id}`} position={[hub.center.lat as number, hub.center.lng as number]} icon={makeHubIcon(hubColor(hub))}>
                  <Tooltip permanent direction="top" offset={[0, -12]} className="glass-tip">{hub.name}</Tooltip>
                </Marker>
              ) : null
            )}

            {/* Draw/selection layer */}
            <GridLayer
              drawing={drawing}
              selectedCells={selectedCells}
              claimedCells={claimedCells}
              onToggleCell={toggleCell}
            />

            {/* Selected cells (always visible while drawing, even if grid hidden) */}
            {drawing && [...selectedCells].map((cell) => (
              <Polygon
                key={`sel-${cell}`}
                positions={cellPositions(cell)}
                pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.45, weight: 2 }}
                eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e.originalEvent); toggleCell(cell); } }}
              />
            ))}
          </MapContainer>

          {/* Map hint */}
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            background: "rgba(15,23,42,0.82)", color: "#fff", borderRadius: 20,
            padding: "5px 14px", fontSize: 12, fontWeight: 500, zIndex: 1000,
            backdropFilter: "blur(4px)", pointerEvents: "none", whiteSpace: "nowrap",
          }}>
            {drawing
              ? `Drawing a ${activeCategoryObj?.name ?? "service"} hub · click cells to add/remove · each hex ≈ ${HEX_AREA_KM2.toFixed(0)} km² · red = taken by another ${activeCategoryObj?.name ?? "service"} hub`
              : activeCategoryObj
                ? `Showing ${activeCategoryObj.name} hubs · press "New ${activeCategoryObj.name} Hub" to draw one`
                : "Pick a service tab above"}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto", flexShrink: 0 }}>
          {drawing ? (
            <div className="section" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 14 }}>
                {editingHub ? "Edit Hub" : `New ${activeCategoryObj?.name ?? ""} Hub`}
              </div>

              {/* Service is fixed by the active tab */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
                background: "var(--muted-2)", borderRadius: 8, padding: "8px 12px",
              }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: categoryColor(form.categoryId), flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{activeCategoryObj?.name ?? "Service"}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>This hub serves only this service</div>
                </div>
              </div>

              {/* Cell counter */}
              <div style={{
                background: "var(--accent-50)", border: "1px solid var(--accent-border)",
                borderRadius: 8, padding: "8px 12px", marginBottom: 14,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, color: "var(--accent-dark)", fontWeight: 600 }}>
                  ⬡ {selectedCells.size} cell{selectedCells.size !== 1 ? "s" : ""} selected
                  {selectedCells.size > 0 && (
                    <span style={{ fontWeight: 500 }}> · ≈ {Math.round(selectedCells.size * HEX_AREA_KM2)} km²</span>
                  )}
                </span>
                {selectedCells.size > 0 && (
                  <button
                    onClick={() => setSelectedCells(new Set())}
                    style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                  >Clear</button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Hub Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input className="input" style={{ width: "100%" }} placeholder={`e.g. Santoshpur ${activeCategoryObj?.name ?? ""}`}
                    value={form.name} onChange={(e) => patchForm({ name: e.target.value })} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>City</label>
                    <input className="input" style={{ width: "100%" }} placeholder="Kolkata"
                      value={form.city} onChange={(e) => patchForm({ city: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>State</label>
                    <input className="input" style={{ width: "100%" }} placeholder="WB"
                      value={form.state} onChange={(e) => patchForm({ state: e.target.value })} />
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <Toggle checked={form.isActive}           onChange={(v) => patchForm({ isActive: v })}           label="Hub Active" />
                <Toggle checked={form.customerAppEnabled} onChange={(v) => patchForm({ customerAppEnabled: v })} label="Customer App" />
                <Toggle checked={form.partnerAppEnabled}  onChange={(v) => patchForm({ partnerAppEnabled: v })}  label="Partner App" />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="button" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : editingHub ? "Update Hub" : "Save Hub"}
                </button>
                <button className="button secondary" onClick={cancelDraw}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="button" onClick={startCreate} style={{ width: "100%" }} disabled={!activeCategory}>
              {activeCategoryObj ? `+ New ${activeCategoryObj.name} Hub` : "Pick a service tab"}
            </button>
          )}

          {/* Hub list (active service) */}
          <div className="section" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{activeCategoryObj ? `${activeCategoryObj.name} Hubs` : "Hubs"}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {loading ? "Loading…" : `${filteredHubs.length}`}
              </div>
            </div>

            {(countByCategory.get(activeCategory) || 0) > 0 && (
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
                <input
                  className="input"
                  style={{ width: "100%", fontSize: 13 }}
                  placeholder="Search by name or city…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            {filteredHubs.length === 0 ? (
              <div style={{ padding: "20px 16px", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                {loading ? "Loading…"
                  : search.trim() ? "No hubs match your search."
                  : activeCategoryObj ? `No ${activeCategoryObj.name} hubs yet. Press "New ${activeCategoryObj.name} Hub" to draw one.`
                  : "Pick a service tab."}
              </div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {filteredHubs.map((hub) => (
                  <div key={hub._id} style={{
                    padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)",
                    background: editingHub?._id === hub._id ? "var(--accent-50)" : "transparent",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: hubColor(hub), flexShrink: 0 }} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{hub.name}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                          {hub.city || "—"} · {hub.h3Cells.length} cells · {hub.partnerCount ?? 0} partners
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button className="button secondary" style={{ fontSize: 10, padding: "2px 7px" }} onClick={() => startEdit(hub)}>
                          Edit
                        </button>
                        <button className="button secondary" style={{ fontSize: 10, padding: "2px 7px" }} onClick={(e) => quickToggle(hub, e)}>
                          {hub.isActive ? "Disable" : "Enable"}
                        </button>
                        <button className="button danger" style={{ fontSize: 10, padding: "2px 7px" }} onClick={(e) => handleDelete(hub, e)}>
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
