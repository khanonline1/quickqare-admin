import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import { currency } from "../utils/format";

export default function DashboardPage({ api }: { api: ApiClient }) {
  const [kpis, setKpis] = useState<any>(null);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [bookingTrend, setBookingTrend] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>("/dashboard/kpis").then((res) => res.success && setKpis(res.data));
    api.get<any>("/dashboard/revenue-trend?days=14").then((res) => res.success && setRevenueTrend(res.data));
    api.get<any>("/dashboard/bookings-trend?days=14").then((res) => res.success && setBookingTrend(res.data));
  }, [api]);

  const renderLine = (rows: any[], key: string) => {
    if (!rows.length) return <div className="muted">No data</div>;
    const values = rows.map((r) => r[key] ?? 0);
    const max = Math.max(...values, 1);
    const points = values
      .map((value, index) => {
        const x = (index / (values.length - 1 || 1)) * 100;
        const y = 100 - (value / max) * 100;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points} />
      </svg>
    );
  };

  return (
    <>
      <div className="card-grid">
        <div className="card"><div className="label">Total Bookings Today</div><div className="value">{kpis?.totalBookingsToday ?? "-"}</div></div>
        <div className="card"><div className="label">Revenue Today</div><div className="value">{currency.format(kpis?.totalRevenueToday ?? 0)}</div></div>
        <div className="card"><div className="label">Active Partners</div><div className="value">{kpis?.activePartners ?? "-"}</div></div>
        <div className="card"><div className="label">Pending Jobs</div><div className="value">{kpis?.pendingJobs ?? "-"}</div></div>
        <div className="card"><div className="label">Completed Jobs</div><div className="value">{kpis?.completedJobs ?? "-"}</div></div>
        <div className="card"><div className="label">Cancelled Jobs</div><div className="value">{kpis?.cancelledJobs ?? "-"}</div></div>
        <div className="card"><div className="label">New Signups</div><div className="value">{kpis?.newCustomerSignups ?? "-"}</div></div>
      </div>

      <div className="section">
        <h3>Revenue Trend (14 days)</h3>
        <div className="chart">{renderLine(revenueTrend, "totalRevenue")}</div>
      </div>

      <div className="section">
        <h3>Bookings Trend (14 days)</h3>
        <div className="chart">{renderLine(bookingTrend, "totalBookings")}</div>
      </div>
    </>
  );
}
