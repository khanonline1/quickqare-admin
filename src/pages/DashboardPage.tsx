import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import { currency } from "../utils/format";

const KPI_CONFIG = [
  { key: "totalBookingsToday", label: "Bookings Today", format: "number", color: "#0ea5e9" },
  { key: "totalRevenueToday", label: "Revenue Today", format: "currency", color: "#10b981" },
  { key: "activePartners", label: "Active Partners", format: "number", color: "#8b5cf6" },
  { key: "pendingJobs", label: "Pending Jobs", format: "number", color: "#f59e0b" },
  { key: "completedJobs", label: "Completed Jobs", format: "number", color: "#10b981" },
  { key: "cancelledJobs", label: "Cancelled Jobs", format: "number", color: "#ef4444" },
  { key: "newCustomerSignups", label: "New Signups", format: "number", color: "#0ea5e9" },
];

function TrendChart({ rows, valueKey, color }: { rows: any[]; valueKey: string; color: string }) {
  if (!rows.length) {
    return <div className="chart-empty">No data available</div>;
  }

  const values = rows.map((r) => Number(r[valueKey] ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const W = 600;
  const H = 160;
  const padX = 8;
  const padY = 12;

  const points = values.map((v, i) => {
    const x = padX + (i / Math.max(values.length - 1, 1)) * (W - padX * 2);
    const y = padY + (1 - (v - min) / range) * (H - padY * 2);
    return { x, y, v };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const areaPoints = [
    `${points[0].x},${H}`,
    ...points.map((p) => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${H}`,
  ].join(" ");

  const gradId = `grad-${valueKey}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((ratio) => (
        <line
          key={ratio}
          x1={padX}
          y1={padY + ratio * (H - padY * 2)}
          x2={W - padX}
          y2={padY + ratio * (H - padY * 2)}
          stroke="#e2e8f0"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      ))}

      {/* Area fill */}
      <polygon fill={`url(#${gradId})`} points={areaPoints} />

      {/* Line */}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="white" stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

export default function DashboardPage({ api }: { api: ApiClient }) {
  const [kpis, setKpis] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [bookingTrend, setBookingTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>("/dashboard/kpis"),
      api.get<any>("/dashboard/revenue-trend?days=14"),
      api.get<any>("/dashboard/bookings-trend?days=14"),
    ]).then(([k, r, b]) => {
      if (k.success) setKpis(k.data);
      if (r.success) setRevenueTrend(r.data);
      if (b.success) setBookingTrend(b.data);
      setLoading(false);
    });
  }, [api]);

  return (
    <>
      <div className="card-grid">
        {KPI_CONFIG.map(({ key, label, format, color }) => (
          <div key={key} className="card">
            <div className="card-accent-bar" style={{ background: color }} />
            <div className="label">{label}</div>
            <div className="value" style={{ color }}>
              {loading
                ? "—"
                : format === "currency"
                ? currency.format(kpis?.[key] ?? 0)
                : kpis?.[key] ?? "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="section-header">
          <h3 style={{ margin: 0 }}>Revenue Trend</h3>
          <span className="tag">Last 14 days</span>
        </div>
        <div className="chart">
          <TrendChart rows={revenueTrend} valueKey="totalRevenue" color="#10b981" />
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3 style={{ margin: 0 }}>Bookings Trend</h3>
          <span className="tag">Last 14 days</span>
        </div>
        <div className="chart">
          <TrendChart rows={bookingTrend} valueKey="totalBookings" color="#0ea5e9" />
        </div>
      </div>
    </>
  );
}
