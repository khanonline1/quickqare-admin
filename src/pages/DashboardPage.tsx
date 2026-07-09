import React, { useEffect, useState, useCallback } from "react";
import type { ApiClient } from "../api/adminApi";
import { currency } from "../utils/format";

// ─── DATE RANGE ────────────────────────────────────────────────────────────────

type DateRange = { start: Date; end: Date; label: string };

const PRESETS = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "Last 7 Days" },
  { key: "30d",       label: "Last 30 Days" },
  { key: "month",     label: "This Month" },
  { key: "year",      label: "This Year" },
  { key: "custom",    label: "Custom" },
] as const;

type PresetKey = typeof PRESETS[number]["key"];

function resolvePreset(key: PresetKey, customStart?: Date, customEnd?: Date): DateRange {
  const now = new Date();
  const today = () => { const d = new Date(now); d.setHours(0,0,0,0); return d; };
  const eod   = () => { const d = new Date(now); d.setHours(23,59,59,999); return d; };
  switch (key) {
    case "today":     return { start: today(), end: eod(), label: "Today" };
    case "yesterday": {
      const s = new Date(today()); s.setDate(s.getDate() - 1);
      const e = new Date(s); e.setHours(23,59,59,999);
      return { start: s, end: e, label: "Yesterday" };
    }
    case "7d": {
      const s = new Date(today()); s.setDate(s.getDate() - 6);
      return { start: s, end: eod(), label: "Last 7 Days" };
    }
    case "30d": {
      const s = new Date(today()); s.setDate(s.getDate() - 29);
      return { start: s, end: eod(), label: "Last 30 Days" };
    }
    case "month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: eod(), label: "This Month" };
    case "year":
      return { start: new Date(now.getFullYear(), 0, 1), end: eod(), label: "This Year" };
    case "custom":
      return { start: customStart ?? today(), end: customEnd ?? eod(), label: "Custom Range" };
  }
}

function DateRangePicker({ onChange }: { onChange: (r: DateRange) => void }) {
  const [active, setActive] = useState<PresetKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]     = useState("");
  const [showCustom, setShowCustom]   = useState(false);

  const pick = (key: PresetKey) => {
    setActive(key);
    if (key === "custom") { setShowCustom(true); return; }
    setShowCustom(false);
    onChange(resolvePreset(key));
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const s = new Date(customStart); s.setHours(0,0,0,0);
    const e = new Date(customEnd);   e.setHours(23,59,59,999);
    if (s > e) return;
    onChange(resolvePreset("custom", s, e));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Period:</span>
      {PRESETS.map((p) => (
        <button
          key={p.key}
          className={`filter-pill${active === p.key ? " active" : ""}`}
          onClick={() => pick(p.key)}
        >
          {p.label}
        </button>
      ))}
      {showCustom && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <input type="date" className="input" style={{ width: 140, fontSize: 13, padding: "4px 8px" }}
            value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          <span style={{ color: "var(--muted)", fontSize: 13 }}>→</span>
          <input type="date" className="input" style={{ width: 140, fontSize: 13, padding: "4px 8px" }}
            value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          <button className="button" style={{ fontSize: 13, padding: "5px 12px" }} onClick={applyCustom}>Apply</button>
        </div>
      )}
    </div>
  );
}

// ─── TREND CHART ───────────────────────────────────────────────────────────────

function TrendChart({ rows, valueKey, color }: { rows: any[]; valueKey: string; color: string }) {
  if (!rows.length) return <div className="chart-empty">No data available</div>;

  const values = rows.map((r) => Number(r[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 600; const H = 160; const padX = 8; const padY = 12;

  const points = values.map((v, i) => ({
    x: padX + (i / Math.max(values.length - 1, 1)) * (W - padX * 2),
    y: padY + (1 - (v - min) / range) * (H - padY * 2),
    v,
  }));

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [`${points[0].x},${H}`, ...points.map((p) => `${p.x},${p.y}`), `${points[points.length - 1].x},${H}`].join(" ");
  const gradId = `grad-${valueKey}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line key={ratio} x1={padX} y1={padY + ratio * (H - padY * 2)} x2={W - padX} y2={padY + ratio * (H - padY * 2)}
          stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
      ))}
      <polygon fill={`url(#${gradId})`} points={areaPoints} />
      <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polylinePoints} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function DashboardPage({ api }: { api: ApiClient }) {
  const [dr, setDr] = useState<DateRange>(() => resolvePreset("today"));
  const [kpis, setKpis] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [bookingTrend, setBookingTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (range: DateRange) => {
    setLoading(true);
    const qs = `start=${range.start.toISOString()}&end=${range.end.toISOString()}`;
    const [k, r, b] = await Promise.all([
      api.get<any>(`/dashboard/kpis?${qs}`),
      api.get<any>(`/dashboard/revenue-trend?${qs}`),
      api.get<any>(`/dashboard/bookings-trend?${qs}`),
    ]);
    if (k.success) setKpis(k.data);
    if (r.success) setRevenueTrend(r.data);
    if (b.success) setBookingTrend(b.data);
    setLoading(false);
  }, [api]);

  useEffect(() => { fetchAll(dr); }, [fetchAll, dr]);

  const KPI_CONFIG = [
    { key: "totalBookings",      label: "Bookings",        format: "number",   color: "#0ea5e9" },
    { key: "totalRevenue",       label: "Revenue",         format: "currency",  color: "#10b981" },
    { key: "activePartners",     label: "Active Partners", format: "number",   color: "#8b5cf6" },
    { key: "pendingJobs",        label: "Pending Jobs",    format: "number",   color: "#f59e0b" },
    { key: "completedJobs",      label: "Completed Jobs",  format: "number",   color: "#10b981" },
    { key: "cancelledJobs",      label: "Cancelled Jobs",  format: "number",   color: "#ef4444" },
    { key: "newCustomerSignups", label: "New Signups",     format: "number",   color: "#0ea5e9" },
  ];

  return (
    <>
      <div className="section">
        <DateRangePicker onChange={(r) => setDr(r)} />
      </div>

      <div className="card-grid">
        {KPI_CONFIG.map(({ key, label, format, color }) => (
          <div key={key} className="card">
            <div className="card-accent-bar" style={{ background: color }} />
            <div className="label">{label}</div>
            <div className="value" style={{ color }}>
              {loading ? "—" : format === "currency" ? currency.format(kpis?.[key] ?? 0) : kpis?.[key] ?? "—"}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{dr.label}</div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-header">
          <h3 style={{ margin: 0 }}>Revenue Trend</h3>
          <span className="tag">{dr.label}</span>
        </div>
        <div className="chart">
          <TrendChart rows={revenueTrend} valueKey="totalRevenue" color="#10b981" />
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3 style={{ margin: 0 }}>Bookings Trend</h3>
          <span className="tag">{dr.label}</span>
        </div>
        <div className="chart">
          <TrendChart rows={bookingTrend} valueKey="totalBookings" color="#0ea5e9" />
        </div>
      </div>
    </>
  );
}
