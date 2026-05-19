import React, { useEffect, useState, useCallback, useRef } from "react";
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
    case "month": {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: eod(), label: "This Month" };
    }
    case "year": {
      return { start: new Date(now.getFullYear(), 0, 1), end: eod(), label: "This Year" };
    }
    case "custom":
      return { start: customStart ?? today(), end: customEnd ?? eod(), label: "Custom Range" };
  }
}

function toISO(d: Date) { return d.toISOString(); }
function fmtDate(d: Date) { return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }

function DateRangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const [active, setActive] = useState<PresetKey>("30d");
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
          <input
            type="date"
            className="input"
            style={{ width: 140, fontSize: 13, padding: "4px 8px" }}
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span style={{ color: "var(--muted)", fontSize: 13 }}>→</span>
          <input
            type="date"
            className="input"
            style={{ width: 140, fontSize: 13, padding: "4px 8px" }}
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
          />
          <button className="button" style={{ fontSize: 13, padding: "5px 12px" }} onClick={applyCustom}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

// ─── SVG CHART PRIMITIVES ──────────────────────────────────────────────────────

function AreaChart({ rows, valueKey, color, label, formatValue }: {
  rows: any[]; valueKey: string; color: string; label?: string; formatValue?: (v: number) => string;
}) {
  if (!rows.length) return <div className="chart-empty" style={{ height: 180 }}>No data for this period</div>;
  const values = rows.map((r) => Number(r[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 600, H = 160, padX = 8, padY = 16;
  const points = values.map((v, i) => ({
    x: padX + (i / Math.max(values.length - 1, 1)) * (W - padX * 2),
    y: padY + (1 - (v - min) / range) * (H - padY * 2),
    v,
    label: rows[i]._id ? `${rows[i]._id.d}/${rows[i]._id.m}` : String(i),
  }));
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [`${points[0].x},${H}`, ...points.map((p) => `${p.x},${p.y}`), `${points[points.length-1].x},${H}`].join(" ");
  const gradId = `grad-${valueKey}-${color.replace("#","")}`;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN"));
  return (
    <div style={{ width: "100%" }}>
      {label && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>{label}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={180} style={{ display: "block" }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line key={r} x1={padX} y1={padY + r*(H-padY*2)} x2={W-padX} y2={padY + r*(H-padY*2)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4" />
        ))}
        <polygon fill={`url(#${gradId})`} points={areaPoints} />
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={polylinePoints} />
        {points.map((p, i) => (
          <g key={i}><circle cx={p.x} cy={p.y} r="4" fill="white" stroke={color} strokeWidth="2" /><title>{`${p.label}: ${fmt(p.v)}`}</title></g>
        ))}
        <text x={padX} y={H-2} fontSize="10" fill="var(--muted-2)">{points[0]?.label}</text>
        <text x={W-padX} y={H-2} fontSize="10" fill="var(--muted-2)" textAnchor="end">{points[points.length-1]?.label}</text>
        <text x={padX} y={padY-2} fontSize="10" fill="var(--muted-2)">{fmt(max)}</text>
      </svg>
    </div>
  );
}

function HorizontalBars({ rows, labelKey, valueKey, color, formatValue, maxRows = 10 }: {
  rows: any[]; labelKey: string; valueKey: string; color: string; formatValue?: (v: number) => string; maxRows?: number;
}) {
  const data = rows.slice(0, maxRows);
  if (!data.length) return <div className="chart-empty">No data available</div>;
  const maxVal = Math.max(...data.map((r) => Number(r[valueKey] ?? 0)), 1);
  const fmt = formatValue ?? ((v: number) => v.toLocaleString("en-IN"));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((row, i) => {
        const val = Number(row[valueKey] ?? 0);
        const pct = (val / maxVal) * 100;
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: "var(--text-2)" }}>
              <span style={{ fontWeight: 500, maxWidth: "60%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row[labelKey] || "Unknown"}</span>
              <span style={{ color: "var(--muted)", fontWeight: 600 }}>{fmt(val)}</span>
            </div>
            <div style={{ height: 8, background: "var(--panel-alt)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ segments, size = 160 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className="chart-empty">No data</div>;
  const r = 55, cx = size/2, cy = size/2, stroke = 22;
  let cumAngle = -Math.PI / 2;
  const arcs = segments.map((seg) => {
    const angle = (seg.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle), y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle), y2 = cy + r * Math.sin(cumAngle);
    return { ...seg, x1, y1, x2, y2, large: angle > Math.PI ? 1 : 0, angle };
  });
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {arcs.map((arc, i) => arc.angle < 0.01 ? null : (
          <path key={i} d={`M ${arc.x1} ${arc.y1} A ${r} ${r} 0 ${arc.large} 1 ${arc.x2} ${arc.y2}`} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="butt" />
        ))}
        <circle cx={cx} cy={cy} r={r-stroke/2-2} fill="var(--panel)" />
        <text x={cx} y={cy-6} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">{total.toLocaleString("en-IN")}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize="10" fill="var(--muted)">total</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ color: "var(--text-2)", flex: 1 }}>{seg.label}</span>
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>{total > 0 ? `${((seg.value/total)*100).toFixed(1)}%` : "0%"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FunnelViz({ stages }: { stages: { stage: string; count: number }[] }) {
  if (!stages.length) return <div className="chart-empty">No data</div>;
  const max = stages[0].count || 1;
  const colors = ["#0ea5e9","#8b5cf6","#10b981","#f59e0b","#ef4444"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {stages.map((s, i) => {
        const pct = (s.count / max) * 100;
        const prev = i > 0 ? stages[i-1].count : s.count;
        const dropPct = prev > 0 ? (((prev - s.count) / prev) * 100).toFixed(0) : "0";
        return (
          <div key={i}>
            {i > 0 && <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginBottom: 3 }}>▼ {dropPct}% drop-off</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: `${Math.max(pct,5)}%`, minWidth: 80, background: colors[i]??"#64748b", borderRadius: 6, padding: "10px 14px", color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between", transition: "width 0.6s ease", gap: 8, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
                <span style={{ opacity: 0.9, fontSize: 12, whiteSpace: "nowrap" }}>{s.stage}</span>
                <span style={{ fontWeight: 700 }}>{s.count.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, sub, color, icon }: { label: string; value: string|number; sub?: string; color: string; icon?: string }) {
  return (
    <div className="card">
      <div className="card-accent-bar" style={{ background: color }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div className="label">{label}</div>
          <div className="value" style={{ color, marginTop: 10 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{sub}</div>}
        </div>
        {icon && <div style={{ fontSize: 22, opacity: 0.15, marginTop: 4, userSelect: "none" }}>{icon}</div>}
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="section-header">
      <div>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function LoadingSection() {
  return <div className="loading-state" style={{ padding: "40px 20px" }}><div className="loading-spinner" />Loading…</div>;
}

function qs(dr: DateRange) { return `start=${toISO(dr.start)}&end=${toISO(dr.end)}`; }

// ─── TAB: REVENUE ─────────────────────────────────────────────────────────────

function RevenueTab({ api, dr }: { api: ApiClient; dr: DateRange }) {
  const [overview, setOverview] = useState<any>(null);
  const [booking, setBooking]   = useState<any>(null);
  const [revTrend, setRevTrend] = useState<any[]>([]);
  const [aovTrend, setAovTrend] = useState<any[]>([]);
  const [byCity, setByCity]     = useState<any[]>([]);
  const [serviceMix, setServiceMix] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = qs(dr);
    Promise.all([
      api.get<any>(`/analytics/revenue-overview?${q}`),
      api.get<any>(`/analytics/booking-overview?${q}`),
      api.get<any>(`/dashboard/revenue-trend?${q}`),
      api.get<any>(`/analytics/aov-trend?${q}`),
      api.get<any>(`/analytics/revenue-by-city?${q}`),
      api.get<any>(`/analytics/service-mix?${q}`),
    ]).then(([ov, bk, rt, aov, city, mix]) => {
      if (ov.success)   setOverview(ov.data);
      if (bk.success)   setBooking(bk.data);
      if (rt.success)   setRevTrend(rt.data);
      if (aov.success)  setAovTrend(aov.data);
      if (city.success) setByCity(city.data);
      if (mix.success)  setServiceMix(mix.data);
      setLoading(false);
    });
  }, [api, dr]);

  if (loading) return <LoadingSection />;

  const serviceMixSegments = serviceMix.slice(0, 5).map((s, i) => ({
    label: s._id || "Other",
    value: s.bookings,
    color: ["#0ea5e9","#8b5cf6","#10b981","#f59e0b","#ef4444"][i],
  }));

  const growthColor = booking?.growthPct === null ? "#64748b" : Number(booking?.growthPct) >= 0 ? "#10b981" : "#ef4444";
  const growthLabel = booking?.growthPct === null ? "No prior data" : `${Number(booking?.growthPct) >= 0 ? "+" : ""}${booking?.growthPct}% vs prev period`;

  return (
    <>
      <div className="card-grid">
        <MetricCard label="Total GMV" value={currency.format(overview?.gmv ?? 0)} sub="All paid bookings" color="#10b981" icon="₹" />
        <MetricCard label="Platform Commission" value={currency.format(booking?.commission ?? 0)} sub="Earnings after payouts" color="#8b5cf6" icon="%" />
        <MetricCard label="Technician Earnings" value={currency.format(booking?.technicianEarnings ?? 0)} sub="Partner payouts" color="#0ea5e9" icon="↑" />
        <MetricCard label="Avg Order Value" value={currency.format(overview?.aov ?? 0)} sub="Per booking" color="#f59e0b" icon="=" />
        <MetricCard label="Booking Growth" value={booking?.growthPct !== null ? `${Number(booking?.growthPct) >= 0 ? "+" : ""}${booking?.growthPct}%` : "—"} sub={growthLabel} color={growthColor} icon="↗" />
        <MetricCard label="Discount Given" value={currency.format(overview?.totalDiscount ?? 0)} sub={`${overview?.refundCount ?? 0} refund cases`} color="#f59e0b" icon="%" />
        <MetricCard label="Refund Rate" value={`${overview?.refundRate ?? "0.0"}%`} sub="Cancelled after payment" color={Number(overview?.refundRate ?? 0) > 10 ? "#ef4444" : "#10b981"} icon="↩" />
        <MetricCard label="Pending Payments" value={(booking?.pendingPayments ?? 0).toLocaleString("en-IN")} sub="Unpaid bookings" color="#ef4444" icon="!" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="section">
          <SectionHeader title="Revenue Trend" sub={dr.label} />
          <AreaChart rows={revTrend} valueKey="totalRevenue" color="#10b981" formatValue={(v) => currency.format(v)} />
        </div>
        <div className="section">
          <SectionHeader title="Avg Order Value Trend" sub={dr.label} />
          <AreaChart rows={aovTrend} valueKey="aov" color="#0ea5e9" formatValue={(v) => currency.format(v)} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="section">
          <SectionHeader title="Revenue by Pincode" sub="Top 10 areas" />
          <HorizontalBars rows={byCity} labelKey="_id" valueKey="totalRevenue" color="#0ea5e9" formatValue={(v) => currency.format(v)} maxRows={10} />
        </div>
        <div className="section">
          <SectionHeader title="Service Mix" sub="Bookings by category" />
          <DonutChart segments={serviceMixSegments} size={160} />
        </div>
      </div>

      <div className="section">
        <SectionHeader title="Bookings by Category" sub="Volume breakdown" />
        <HorizontalBars rows={serviceMix} labelKey="_id" valueKey="bookings" color="#8b5cf6" maxRows={8} />
      </div>
    </>
  );
}

// ─── TAB: CUSTOMERS ───────────────────────────────────────────────────────────

function CustomersTab({ api, dr }: { api: ApiClient; dr: DateRange }) {
  const [overview, setOverview]         = useState<any>(null);
  const [trend, setTrend]               = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = qs(dr);
    Promise.all([
      api.get<any>(`/analytics/customer-overview?${q}`),
      api.get<any>(`/analytics/customer-trend?${q}`),
      api.get<any>("/analytics/top-customers?limit=15"),
    ]).then(([ov, tr, top]) => {
      if (ov.success)  setOverview(ov.data);
      if (tr.success)  setTrend(tr.data);
      if (top.success) setTopCustomers(top.data);
      setLoading(false);
    });
  }, [api, dr]);

  if (loading) return <LoadingSection />;

  return (
    <>
      <div className="card-grid">
        <MetricCard label="Total Customers" value={(overview?.totalCustomers ?? 0).toLocaleString("en-IN")} sub="All registered users" color="#0ea5e9" icon="👤" />
        <MetricCard label="New Customers" value={(overview?.newCustomers ?? 0).toLocaleString("en-IN")} sub={`Registered in ${dr.label}`} color="#10b981" icon="+" />
        <MetricCard label="Active Customers" value={(overview?.activeCustomers ?? 0).toLocaleString("en-IN")} sub={`Booked in ${dr.label}`} color="#8b5cf6" icon="✓" />
        <MetricCard label="Repeat Booking Rate" value={`${overview?.repeatRate ?? 0}%`} sub="Customers with 2+ bookings" color="#f59e0b" icon="↺" />
        <MetricCard label="Retention Rate" value={`${overview?.retentionRate ?? 0}%`} sub="Active / Total" color="#10b981" icon="♻" />
        <MetricCard label="Avg Customer LTV" value={currency.format(overview?.avgLTV ?? 0)} sub="Lifetime spend per user" color="#ef4444" icon="₹" />
      </div>

      <div className="section" style={{ marginBottom: 20 }}>
        <SectionHeader title="New Customer Registrations" sub={dr.label} />
        <AreaChart rows={trend} valueKey="newCustomers" color="#0ea5e9" />
      </div>

      <div className="section">
        <SectionHeader title="Top Customers by Lifetime Value" sub="Ranked by total spend (all time)" />
        {topCustomers.length === 0 ? (
          <div className="empty-state">No data available</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Customer</th><th>Phone</th><th>Bookings</th><th>Total Spend</th><th>Last Booking</th></tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={String(c._id)}>
                    <td><span style={{ fontWeight: 700, color: i < 3 ? "#f59e0b" : "var(--muted)", fontSize: i < 3 ? 15 : 13 }}>{i + 1}</span></td>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>{c.name}</td>
                    <td><code>{c.phone}</code></td>
                    <td><span className="tag">{c.bookings} bookings</span></td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{currency.format(c.totalSpend)}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{c.lastBooking ? new Date(c.lastBooking).toLocaleDateString("en-IN") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── TAB: PARTNERS ────────────────────────────────────────────────────────────

function PartnersTab({ api, dr }: { api: ApiClient; dr: DateRange }) {
  const [overview, setOverview]     = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [ratingDist, setRatingDist] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = qs(dr);
    Promise.all([
      api.get<any>(`/analytics/partner-overview?${q}`),
      api.get<any>(`/analytics/partner-leaderboard?limit=10&${q}`),
      api.get<any>("/analytics/rating-distribution"),
    ]).then(([ov, lb, rd]) => {
      if (ov.success) setOverview(ov.data);
      if (lb.success) setLeaderboard(lb.data);
      if (rd.success) setRatingDist(rd.data);
      setLoading(false);
    });
  }, [api, dr]);

  if (loading) return <LoadingSection />;

  const totalRatings = ratingDist.reduce((s: number, r: any) => s + r.count, 0);

  return (
    <>
      <div className="card-grid">
        <MetricCard label="Approved Partners" value={(overview?.totalApproved ?? 0).toLocaleString("en-IN")} sub="Active & not blocked" color="#10b981" icon="✓" />
        <MetricCard label="Online Now" value={(overview?.onlineNow ?? 0).toLocaleString("en-IN")} sub="Currently available" color="#0ea5e9" icon="●" />
        <MetricCard label="Avg Platform Rating" value={overview?.avgRating ? `${overview.avgRating} ★` : "—"} sub={`${(overview?.totalRatings ?? 0).toLocaleString("en-IN")} ratings`} color="#f59e0b" icon="★" />
        <MetricCard label="Job Completion Rate" value={`${overview?.completionRate ?? "0.0"}%`} sub={`In ${dr.label}`} color={Number(overview?.completionRate ?? 0) >= 85 ? "#10b981" : "#f59e0b"} icon="✓" />
        <MetricCard label="Acceptance Rate" value={`${overview?.acceptanceRate ?? "0.0"}%`} sub="Partners who accepted" color="#8b5cf6" icon="↑" />
        <MetricCard label="Cancellation Rate" value={`${overview?.cancellationRate ?? "0.0"}%`} sub={`In ${dr.label}`} color={Number(overview?.cancellationRate ?? 0) > 15 ? "#ef4444" : "#10b981"} icon="✕" />
      </div>

      <div className="section" style={{ marginBottom: 20 }}>
        <SectionHeader title="Top Partners by Revenue" sub={`Ranked by completed job value — ${dr.label}`} />
        {leaderboard.length === 0 ? (
          <div className="empty-state">No completed jobs yet</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Rank</th><th>Partner</th><th>Phone</th><th>Jobs Done</th><th>Revenue</th><th>Earnings</th><th>Avg Rating</th></tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr key={String(p._id)}>
                    <td><span style={{ fontWeight: 700, color: i===0?"#f59e0b":i===1?"#64748b":i===2?"#b45309":"var(--muted)", fontSize: i<3?16:13 }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span></td>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>{p.name}</td>
                    <td><code>{p.phone}</code></td>
                    <td><span className="tag">{p.jobCount} jobs</span></td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{currency.format(p.totalRevenue)}</td>
                    <td style={{ color: "var(--muted)" }}>{currency.format(p.totalEarnings ?? 0)}</td>
                    <td>{p.avgRating ? <span style={{ color: p.avgRating>=4?"var(--success)":p.avgRating>=3?"var(--warning)":"var(--danger)", fontWeight: 600 }}>{p.avgRating} ★</span> : <span className="muted">No ratings</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <SectionHeader title="Rating Distribution" sub={`${totalRatings.toLocaleString("en-IN")} total ratings`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ratingDist.map((r: any) => {
            const pct = totalRatings > 0 ? (r.count / totalRatings) * 100 : 0;
            const starColor = r.stars >= 4 ? "#10b981" : r.stars === 3 ? "#f59e0b" : "#ef4444";
            return (
              <div key={r.stars} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, fontSize: 13, fontWeight: 700, color: starColor, flexShrink: 0 }}>{r.stars} ★</div>
                <div style={{ flex: 1, height: 12, background: "var(--panel-alt)", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: starColor, borderRadius: 6, transition: "width 0.6s ease" }} />
                </div>
                <div style={{ width: 80, fontSize: 13, color: "var(--muted)", textAlign: "right" }}>{r.count.toLocaleString("en-IN")} ({pct.toFixed(1)}%)</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── TAB: OPERATIONS ──────────────────────────────────────────────────────────

function OperationsTab({ api, dr }: { api: ApiClient; dr: DateRange }) {
  const [funnel, setFunnel]             = useState<any[]>([]);
  const [cancelTrend, setCancelTrend]   = useState<any[]>([]);
  const [complaints, setComplaints]     = useState<any[]>([]);
  const [peakHours, setPeakHours]       = useState<any[]>([]);
  const [booking, setBooking]           = useState<any>(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = qs(dr);
    Promise.all([
      api.get<any>(`/analytics/booking-funnel?${q}`),
      api.get<any>(`/analytics/cancellation-trend?${q}`),
      api.get<any>(`/analytics/complaint-breakdown?${q}`),
      api.get<any>(`/analytics/peak-hours?${q}`),
      api.get<any>(`/analytics/booking-overview?${q}`),
    ]).then(([fn, ct, cb, ph, bk]) => {
      if (fn.success) setFunnel(fn.data);
      if (ct.success) setCancelTrend(ct.data);
      if (cb.success) setComplaints(cb.data);
      if (ph.success) setPeakHours(ph.data);
      if (bk.success) setBooking(bk.data);
      setLoading(false);
    });
  }, [api, dr]);

  if (loading) return <LoadingSection />;

  const totalBookings = funnel[0]?.count || 1;
  const completed = funnel[funnel.length - 1]?.count || 0;
  const completionRate = ((completed / totalBookings) * 100).toFixed(1);
  const cancelData = cancelTrend.map((r) => ({ ...r, rate: r.total > 0 ? (r.cancelled / r.total) * 100 : 0 }));

  const ISSUE_LABELS: Record<string, string> = {
    SERVICE_NOT_COMPLETED: "Not Completed",
    SERVICE_DELAYED: "Delayed",
    SERVICE_QUALITY_ISSUE: "Quality Issue",
    PARTNER_BEHAVIOR: "Partner Behavior",
    PAYMENT_ISSUE: "Payment Issue",
    APP_TECHNICAL_ISSUE: "Tech Issue",
    OTHER: "Other",
  };
  const complaintRows = complaints.map((c: any) => ({ ...c, _id: ISSUE_LABELS[c._id] ?? c._id }));

  return (
    <>
      <div className="card-grid">
        <MetricCard label="Total Bookings" value={(booking?.total ?? 0).toLocaleString("en-IN")} sub={dr.label} color="#0ea5e9" icon="#" />
        <MetricCard label="Completed" value={(booking?.completed ?? 0).toLocaleString("en-IN")} sub={dr.label} color="#10b981" icon="✓" />
        <MetricCard label="Cancelled" value={(booking?.cancelled ?? 0).toLocaleString("en-IN")} sub={dr.label} color="#ef4444" icon="✕" />
        <MetricCard label="Active Jobs" value={(booking?.active ?? 0).toLocaleString("en-IN")} sub="Currently in progress" color="#8b5cf6" icon="⚡" />
        <MetricCard label="Overall Completion Rate" value={`${completionRate}%`} sub={`${completed.toLocaleString("en-IN")} of ${totalBookings.toLocaleString("en-IN")}`} color={Number(completionRate)>=70?"#10b981":"#ef4444"} icon="✓" />
        <MetricCard label="Total Complaints" value={complaints.reduce((s:number,c:any)=>s+c.count,0).toLocaleString("en-IN")} sub={dr.label} color="#f59e0b" icon="!" />
        <MetricCard label="Cancellations" value={cancelTrend.reduce((s,r)=>s+r.cancelled,0).toLocaleString("en-IN")} sub={dr.label} color="#ef4444" icon="✕" />
        <MetricCard label="Peak Demand Slot" value={peakHours[0]?._id ?? "—"} sub={peakHours[0] ? `${peakHours[0].bookings} bookings` : "No data"} color="#8b5cf6" icon="⏱" />
      </div>

      <div className="section" style={{ marginBottom: 20 }}>
        <SectionHeader title="Booking Conversion Funnel" sub={dr.label} />
        <FunnelViz stages={funnel} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="section">
          <SectionHeader title="Cancellation Rate Trend" sub={dr.label} />
          <AreaChart rows={cancelData} valueKey="rate" color="#ef4444" formatValue={(v) => `${v.toFixed(1)}%`} />
        </div>
        <div className="section">
          <SectionHeader title="Complaints by Type" sub={dr.label} />
          <HorizontalBars rows={complaintRows} labelKey="_id" valueKey="count" color="#f59e0b" maxRows={7} />
        </div>
      </div>

      <div className="section">
        <SectionHeader title="Peak Demand Hours" sub="Most booked time slots" />
        <HorizontalBars rows={peakHours} labelKey="_id" valueKey="bookings" color="#8b5cf6" maxRows={12} />
      </div>
    </>
  );
}

// ─── TAB: SERVICES ────────────────────────────────────────────────────────────

function ServicesTab({ api, dr }: { api: ApiClient; dr: DateRange }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/analytics/service-analytics?${qs(dr)}`).then((res) => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, [api, dr]);

  if (loading) return <LoadingSection />;

  const { mostBooked = [], highestRevenue = [], peakDays = [] } = data ?? {};

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="section">
          <SectionHeader title="Most Booked Services" sub={dr.label} />
          <HorizontalBars rows={mostBooked} labelKey="_id" valueKey="bookings" color="#0ea5e9" maxRows={10} />
        </div>
        <div className="section">
          <SectionHeader title="Highest Revenue Services" sub={dr.label} />
          <HorizontalBars rows={highestRevenue} labelKey="_id" valueKey="revenue" color="#10b981" formatValue={(v) => currency.format(v)} maxRows={10} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="section">
          <SectionHeader title="Peak Booking Days" sub="By day of week" />
          <HorizontalBars rows={peakDays} labelKey="_id" valueKey="bookings" color="#8b5cf6" maxRows={7} />
        </div>
        <div className="section">
          <SectionHeader title="Low Performing Services" sub="Fewest bookings" />
          <HorizontalBars rows={[...mostBooked].reverse().slice(0, 5)} labelKey="_id" valueKey="bookings" color="#ef4444" maxRows={5} />
        </div>
      </div>

      <div className="section">
        <SectionHeader title="Service Revenue Breakdown" sub={dr.label} />
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>#</th><th>Service</th><th>Bookings</th><th>Revenue</th></tr>
            </thead>
            <tbody>
              {highestRevenue.map((s: any, i: number) => (
                <tr key={i}>
                  <td style={{ color: "var(--muted)", fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{s._id || "Other"}</td>
                  <td><span className="tag">{s.bookings} bookings</span></td>
                  <td style={{ fontWeight: 700, color: "var(--success)" }}>{currency.format(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── TAB: LIVE DASHBOARD ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED:         "#0ea5e9",
  CONFIRMED:        "#8b5cf6",
  PARTNER_ACCEPTED: "#10b981",
  ON_THE_WAY:       "#f59e0b",
  ARRIVED:          "#f59e0b",
  IN_PROGRESS:      "#10b981",
};

function LiveTab({ api }: { api: ApiClient }) {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(() => {
    api.get<any>("/analytics/live-stats").then((res) => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, [api]);

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(fetch, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetch]);

  if (loading) return <LoadingSection />;

  const live = data ?? {};

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Live — auto-refreshes every 30 seconds</span>
      </div>

      <div className="card-grid">
        <MetricCard label="Online Technicians" value={(live.onlinePartners ?? 0).toLocaleString("en-IN")} sub="Currently available" color="#10b981" icon="●" />
        <MetricCard label="Ongoing Jobs" value={(live.ongoingJobs ?? 0).toLocaleString("en-IN")} sub="In Progress / Arrived" color="#0ea5e9" icon="⚡" />
        <MetricCard label="En Route" value={(live.upcomingJobs ?? 0).toLocaleString("en-IN")} sub="Accepted / On the way" color="#f59e0b" icon="→" />
        <MetricCard label="Pending Assignment" value={(live.pendingAssignment ?? 0).toLocaleString("en-IN")} sub="Searching / Queued" color="#ef4444" icon="⏳" />
      </div>

      <div className="section" style={{ marginTop: 20 }}>
        <SectionHeader title="Active Jobs" sub="Currently assigned or in progress" />
        {!live.recentBookings?.length ? (
          <div className="empty-state">No active jobs right now</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr><th>Booking #</th><th>Status</th><th>Category</th><th>Scheduled</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {live.recentBookings.map((b: any) => (
                  <tr key={String(b._id)}>
                    <td><code style={{ fontSize: 12 }}>{b.bookingNumber || "—"}</code></td>
                    <td>
                      <span style={{ background: `${STATUS_COLORS[b.status] ?? "#64748b"}22`, color: STATUS_COLORS[b.status] ?? "#64748b", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {b.status}
                      </span>
                    </td>
                    <td>{b.serviceCategory || "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>
                      {b.scheduledDate ? `${new Date(b.scheduledDate).toLocaleDateString("en-IN")} ${b.scheduledTime ?? ""}` : "—"}
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{currency.format(b.totalAmount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

// ─── GEOGRAPHIC ───────────────────────────────────────────────────────────────

function GeographicTab({ api, dr }: { api: ApiClient; dr: DateRange }) {
  const [rows, setRows]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<any>(`/analytics/geographic?${qs(dr)}`).then((res) => {
      if (res.success) setRows(res.data);
      setLoading(false);
    });
  }, [api, dr]);

  if (loading) return <LoadingSection />;

  const highDemand = [...rows].sort((a, b) => b.bookings - a.bookings).slice(0, 10);
  const lowSupply  = [...rows].sort((a, b) => b.gap - a.gap).slice(0, 10);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div className="section">
          <SectionHeader title="Highest Demand Areas" sub={`Bookings by pincode — ${dr.label}`} />
          <HorizontalBars rows={highDemand} labelKey="pincode" valueKey="bookings" color="#0ea5e9" maxRows={10} />
        </div>
        <div className="section">
          <SectionHeader title="Supply Gap by Area" sub="Demand vs available partners" />
          <HorizontalBars rows={lowSupply} labelKey="pincode" valueKey="gap" color="#ef4444" maxRows={10} />
        </div>
      </div>

      <div className="section">
        <SectionHeader title="Area Breakdown" sub="Demand, supply, and revenue" />
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr><th>Pincode</th><th>Bookings</th><th>Partners Serving</th><th>Revenue</th><th>Supply Gap</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><code>{r.pincode}</code></td>
                  <td><span className="tag">{r.bookings}</span></td>
                  <td>{r.partners}</td>
                  <td style={{ fontWeight: 700, color: "var(--success)" }}>{currency.format(r.revenue)}</td>
                  <td style={{ color: r.gap > 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                    {r.gap > 0 ? `▲ ${r.gap} demand` : "Covered"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

const TABS = [
  { key: "revenue",    label: "Revenue & Growth" },
  { key: "customers",  label: "Customers" },
  { key: "partners",   label: "Partners" },
  { key: "operations", label: "Operations" },
  { key: "services",   label: "Services" },
  { key: "geographic", label: "Geographic" },
  { key: "live",       label: "Live" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function AnalyticsPage({ api }: { api: ApiClient }) {
  const [tab, setTab] = useState<TabKey>("revenue");
  const [dr, setDr]   = useState<DateRange>(() => resolvePreset("30d"));

  return (
    <>
      <div className="section" style={{ marginBottom: 20, padding: "12px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {TABS.map((t) => (
              <button key={t.key} className={`filter-pill${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
                {t.key === "live" ? "● Live" : t.label}
              </button>
            ))}
          </div>
          {tab !== "live" && <DateRangePicker value={dr} onChange={setDr} />}
        </div>
        {tab !== "live" && (
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            Showing: <strong>{dr.label}</strong> — {fmtDate(dr.start)} → {fmtDate(dr.end)}
          </div>
        )}
      </div>

      {tab === "revenue"    && <RevenueTab    api={api} dr={dr} />}
      {tab === "customers"  && <CustomersTab  api={api} dr={dr} />}
      {tab === "partners"   && <PartnersTab   api={api} dr={dr} />}
      {tab === "operations" && <OperationsTab api={api} dr={dr} />}
      {tab === "services"   && <ServicesTab   api={api} dr={dr} />}
      {tab === "geographic" && <GeographicTab api={api} dr={dr} />}
      {tab === "live"       && <LiveTab       api={api} />}
    </>
  );
}
