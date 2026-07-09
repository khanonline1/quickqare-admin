import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ApiResponse } from "../types/admin";

// ─── API Stats types ─────────────────────────────────────────────────────────
type PeriodStat = {
  googleCalls: number; cacheHits: number; adminActivity: number;
  total: number; cacheHitRate: number; estimatedCostUsd: number;
};
type SourceStat = {
  googleCalls: number; cacheHits: number; total: number;
  cacheHitRate: number; estimatedCostUsd: number; isGoogleSource: boolean;
};
type ApiStats = {
  periods: { today: PeriodStat; week: PeriodStat; month: PeriodStat; custom: PeriodStat };
  bySource: Record<string, SourceStat>;
  daily: Array<Record<string, unknown>>;
  meta: { days: number; fromDate: string; costPer1000: number };
};

const SOURCE_LABELS: Record<string, string> = {
  partner_heartbeat:        "Partner Location Update",
  partner_available_svc:    "Partner Available Services",
  customer_reverse_geocode: "Customer Reverse Geocode",
  customer_address_search:  "Customer Address Search",
  admin_live_tracking:      "Admin Live Tracking Fetch",
  admin_partner_location:   "Admin Partner Location",
  admin_location_ping:      "Admin Location Ping",
};

// Fix default marker icon paths broken by Vite bundling
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const onlineIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const offlineIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const staleIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

type PartnerLocation = {
  id: string;
  name: string;
  phone: string;
  isOnline: boolean;
  isAvailable: boolean;
  activeJobs: number;
  rating: number;
  latitude: number | null;
  longitude: number | null;
  currentPincode: string;
  currentAddress: string;
  lastLocationAt: string | null;
  locationFresh: boolean;
};

type Props = {
  api: {
    get: <T>(path: string) => Promise<ApiResponse<T>>;
    post: <T>(path: string, body?: unknown) => Promise<ApiResponse<T>>;
  };
};

function FitBounds({ partners }: { partners: PartnerLocation[] }) {
  const map = useMap();
  useEffect(() => {
    const located = partners.filter((p) => p.latitude !== null && p.longitude !== null);
    if (!located.length) return;
    const bounds = L.latLngBounds(located.map((p) => [p.latitude!, p.longitude!]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [partners, map]);
  return null;
}

function formatAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function LiveTrackingPage({ api }: Props) {
  const [mainTab, setMainTab] = useState<"map" | "stats">("map");

  // ── Map state ──────────────────────────────────────────────────────────────
  const [partners, setPartners] = useState<PartnerLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [filter, setFilter] = useState<"all" | "online" | "offline">("all");
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // ── Stats state ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [statsDays, setStatsDays] = useState(30);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PartnerLocation[]>("/partners/live-locations");
      if (res.success && Array.isArray(res.data)) {
        setPartners(res.data);
        setLastFetched(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  const requestLocationPing = useCallback(async () => {
    setPinging(true);
    try {
      await api.post("/partners/request-locations");
      // Give partners 3s to respond then refresh
      setTimeout(() => fetchLocations(), 3000);
    } finally {
      setPinging(false);
    }
  }, [api, fetchLocations]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get<ApiStats>(`/api-stats?days=${statsDays}`);
      if (res.success && res.data) setStats(res.data);
    } finally {
      setStatsLoading(false);
    }
  }, [api, statsDays]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (mainTab === "stats") fetchStats();
  }, [mainTab, fetchStats]);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(fetchLocations, 30000);
    } else {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    }
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current); };
  }, [autoRefresh, fetchLocations]);

  const filtered = partners.filter((p) => {
    if (filter === "online") return p.isOnline;
    if (filter === "offline") return !p.isOnline;
    return true;
  });

  const located = filtered.filter((p) => p.latitude !== null && p.longitude !== null);
  const onlineCount = partners.filter((p) => p.isOnline).length;
  const freshCount = partners.filter((p) => p.locationFresh).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>

      {/* Main tab bar */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid var(--border)" }}>
        {(["map", "stats"] as const).map((t) => (
          <button key={t} onClick={() => setMainTab(t)} style={{
            padding: "10px 20px", border: "none", background: "none", cursor: "pointer",
            fontWeight: mainTab === t ? 700 : 400,
            color: mainTab === t ? "var(--accent)" : "var(--text-secondary)",
            borderBottom: mainTab === t ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -2, textTransform: "capitalize",
          }}>
            {t === "map" ? "Live Map" : "API Usage Stats"}
          </button>
        ))}
      </div>

      {/* ── STATS TAB ──────────────────────────────────────────────────────── */}
      {mainTab === "stats" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Period selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Show last</span>
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => { setStatsDays(d); }} className={statsDays === d ? "button" : "button secondary"}
                style={{ fontSize: 12, padding: "5px 14px" }}>
                {d === 7 ? "7 days" : d === 30 ? "30 days" : "90 days"}
              </button>
            ))}
            <button className="button secondary" onClick={fetchStats} disabled={statsLoading} style={{ fontSize: 12, padding: "5px 14px" }}>
              {statsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {stats && (
            <>
              {/* Period summary cards */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {(["today", "week", "month"] as const).map((p) => {
                    const s = stats.periods[p];
                    return (
                      <div key={p} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", background: "var(--card)" }}>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          {p === "today" ? "Today" : p === "week" ? "Last 7 days" : "Last 30 days"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Google API calls</span>
                            <span style={{ fontWeight: 700, color: s.googleCalls > 0 ? "#dc2626" : "#16a34a" }}>{s.googleCalls.toLocaleString()}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Cache hits</span>
                            <span style={{ fontWeight: 600, color: "#2563eb" }}>{s.cacheHits.toLocaleString()}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Cache hit rate</span>
                            <span style={{ fontWeight: 600, color: s.cacheHitRate >= 80 ? "#16a34a" : "#f59e0b" }}>{s.cacheHitRate}%</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Admin activity</span>
                            <span style={{ fontWeight: 600 }}>{s.adminActivity.toLocaleString()}</span>
                          </div>
                          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "var(--text-secondary)" }}>Est. cost</span>
                            <span style={{ fontWeight: 700, color: "#7c3aed" }}>${s.estimatedCostUsd.toFixed(4)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Per-source breakdown */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
                  By Source — last {statsDays} days
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>Source</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Google Calls</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Cache Hits</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Total</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Hit Rate</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(stats.bySource).map(([src, s], i) => (
                        <tr key={src} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface)" }}>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{
                              display: "inline-block", marginRight: 8, padding: "2px 7px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: s.isGoogleSource ? "var(--warning-bg)" : "var(--info-bg)",
                              color:      s.isGoogleSource ? "var(--warning-text)" : "#1d4ed8",
                            }}>
                              {s.isGoogleSource ? "Google" : "Admin"}
                            </span>
                            {SOURCE_LABELS[src] || src}
                          </td>
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600, color: s.googleCalls > 0 ? "#dc2626" : "var(--muted)" }}>
                            {s.googleCalls.toLocaleString()}
                          </td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: "#2563eb" }}>
                            {s.cacheHits.toLocaleString()}
                          </td>
                          <td style={{ padding: "9px 14px", textAlign: "right" }}>
                            {s.total.toLocaleString()}
                          </td>
                          <td style={{ padding: "9px 14px", textAlign: "right", color: s.cacheHitRate >= 80 ? "#16a34a" : s.cacheHitRate >= 50 ? "#f59e0b" : "#dc2626" }}>
                            {s.isGoogleSource ? `${s.cacheHitRate}%` : "—"}
                          </td>
                          <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 600, color: "#7c3aed" }}>
                            {s.isGoogleSource ? `$${s.estimatedCostUsd.toFixed(4)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "2px solid var(--border)", background: "var(--surface)", fontWeight: 700 }}>
                        <td style={{ padding: "10px 14px" }}>Total</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#dc2626" }}>
                          {stats.periods.custom.googleCalls.toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#2563eb" }}>
                          {stats.periods.custom.cacheHits.toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          {(stats.periods.custom.googleCalls + stats.periods.custom.cacheHits).toLocaleString()}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a" }}>
                          {stats.periods.custom.cacheHitRate}%
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#7c3aed" }}>
                          ${stats.periods.custom.estimatedCostUsd.toFixed(4)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Daily trend table */}
              <div>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Daily Trend</div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto", overflowY: "auto", maxHeight: 360 }}>
                  <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--surface)", zIndex: 1 }}>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600 }}>Date</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Google Calls</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Cache Hits</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Hit Rate</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Admin Activity</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.daily].reverse().map((day, i) => {
                        const t = day.totals as PeriodStat;
                        return (
                          <tr key={day.date as string} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface)" }}>
                            <td style={{ padding: "8px 14px", fontWeight: 500 }}>{day.date as string}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: t.googleCalls > 0 ? "#dc2626" : "var(--muted)" }}>{t.googleCalls.toLocaleString()}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#2563eb" }}>{t.cacheHits.toLocaleString()}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: t.cacheHitRate >= 80 ? "#16a34a" : "#f59e0b" }}>{t.cacheHitRate}%</td>
                            <td style={{ padding: "8px 14px", textAlign: "right" }}>{t.adminActivity.toLocaleString()}</td>
                            <td style={{ padding: "8px 14px", textAlign: "right", color: "#7c3aed", fontWeight: 600 }}>${t.estimatedCostUsd.toFixed(4)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!stats && !statsLoading && (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40, fontSize: 14 }}>
              No data yet. Stats will appear once API calls are tracked.
            </div>
          )}
          {statsLoading && (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40 }}>Loading stats…</div>
          )}
        </div>
      )}

      {/* ── MAP TAB ────────────────────────────────────────────────────────── */}
      {mainTab === "map" && <>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Live Partner Tracking</h2>
          {lastFetched && (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Last updated: {lastFetched.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: "var(--accent)" }}
            />
            Auto-refresh (30s)
          </label>
          <button
            className="button secondary"
            onClick={fetchLocations}
            disabled={loading}
            style={{ fontSize: 13 }}
          >
            {loading ? "Refreshing..." : "Refresh Map"}
          </button>
          <button
            className="button"
            onClick={requestLocationPing}
            disabled={pinging}
            style={{ fontSize: 13 }}
          >
            {pinging ? "Pinging..." : "Fetch Current Location"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Total Partners", value: partners.length, color: "var(--accent)" },
          { label: "Online", value: onlineCount, color: "#16a34a" },
          { label: "Offline", value: partners.length - onlineCount, color: "var(--muted)" },
          { label: "Fresh Location (≤5m)", value: freshCount, color: "#2563eb" },
          { label: "On Map", value: located.length, color: "#7c3aed" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", minWidth: 110 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid var(--border)" }}>
        {(["all", "online", "offline"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
              fontWeight: filter === f ? 700 : 400,
              color: filter === f ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: filter === f ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -2, textTransform: "capitalize",
            }}
          >
            {f === "all" ? `All (${partners.length})` : f === "online" ? `Online (${onlineCount})` : `Offline (${partners.length - onlineCount})`}
          </button>
        ))}
      </div>

      {/* Map + List layout */}
      <div className="lt-map-layout">
        {/* Map */}
        <div className="lt-map-wrap">
          <MapContainer
            className="lt-mapcontainer"
            center={[20.5937, 78.9629]}
            zoom={5}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {located.length > 0 && <FitBounds partners={located} />}
            {located.map((p) => (
              <Marker
                key={p.id}
                position={[p.latitude!, p.longitude!]}
                icon={p.isOnline ? (p.locationFresh ? onlineIcon : staleIcon) : offlineIcon}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.phone}</div>
                    <div style={{ marginTop: 6, fontSize: 12 }}>
                      <span style={{
                        display: "inline-block", padding: "2px 8px", borderRadius: 10,
                        background: p.isOnline ? "var(--success-bg)" : "var(--panel-alt)",
                        color: p.isOnline ? "#16a34a" : "var(--muted)",
                        fontWeight: 600, fontSize: 11,
                      }}>
                        {p.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    {p.currentAddress && <div style={{ fontSize: 11, marginTop: 4, color: "var(--muted)" }}>{p.currentAddress}</div>}
                    <div style={{ fontSize: 11, marginTop: 4, color: p.locationFresh ? "#16a34a" : "#f59e0b" }}>
                      Location: {formatAgo(p.lastLocationAt)}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 2, color: "var(--muted)" }}>
                      Active jobs: {p.activeJobs} · Rating: {p.rating.toFixed(1)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Partner list */}
        <div className="lt-list">
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24, fontSize: 14 }}>
              No partners found
            </div>
          )}
          {filtered.map((p) => (
            <div
              key={p.id}
              style={{
                border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px",
                background: "var(--card)",
                borderLeft: `3px solid ${p.isOnline ? (p.locationFresh ? "#16a34a" : "#f59e0b") : "var(--border-strong)"}`,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6,
                  background: p.isOnline ? "var(--success-bg)" : "var(--panel-alt)",
                  color: p.isOnline ? "#16a34a" : "var(--muted-2)",
                }}>
                  {p.isOnline ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{p.phone}</div>
              {p.currentPincode && (
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  Pincode: {p.currentPincode}
                </div>
              )}
              <div style={{ fontSize: 11, marginTop: 4, color: p.locationFresh ? "#16a34a" : (p.lastLocationAt ? "#f59e0b" : "var(--muted-2)") }}>
                {p.latitude !== null ? `GPS: ${p.latitude.toFixed(4)}, ${p.longitude!.toFixed(4)}` : "No GPS data"}
                {" · "}{formatAgo(p.lastLocationAt)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                Jobs: {p.activeJobs} · Rating: {p.rating.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-secondary)", flexWrap: "wrap" }}>
        <span><span style={{ color: "#16a34a" }}>●</span> Online + fresh location (≤5 min)</span>
        <span><span style={{ color: "#f59e0b" }}>●</span> Online + stale location (&gt;5 min)</span>
        <span><span style={{ color: "var(--muted-2)" }}>●</span> Offline</span>
      </div>
      </>}
    </div>
  );
}
