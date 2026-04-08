import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import { currency } from "../utils/format";

type GstRow = {
  date: string;
  bookingCount: number;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
};

type GstReport = {
  startDate: string;
  endDate: string;
  timezone: string;
  summary: {
    bookingCount: number;
    baseAmount: number;
    gstAmount: number;
    totalAmount: number;
  };
  rows: GstRow[];
};

const toISODate = (date: Date) => date.toISOString().slice(0, 10);

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
};

export default function AuditPage({ api }: { api: ApiClient }) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [endDate, setEndDate] = useState(() => toISODate(new Date()));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GstReport | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await api.get<GstReport>(`/reports/gst?start=${startDate}&end=${endDate}`);
    if (res.success) setReport(res.data);
    else alert(res.error?.message || "Unable to load GST report");
    setLoading(false);
  }, [api, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const csvData = useMemo(() => {
    if (!report) return "";
    const lines = [
      ["Start Date", report.startDate],
      ["End Date", report.endDate],
      ["Timezone", report.timezone],
      [],
      ["Summary"],
      ["Bookings", report.summary.bookingCount],
      ["Base Amount", report.summary.baseAmount],
      ["GST Amount", report.summary.gstAmount],
      ["Total Amount", report.summary.totalAmount],
      [],
      ["Date", "Bookings", "Base Amount", "GST Amount", "Total Amount"],
      ...report.rows.map((row) => [
        row.date,
        row.bookingCount,
        row.baseAmount,
        row.gstAmount,
        row.totalAmount,
      ]),
    ];

    return lines
      .map((row) => row.map((cell) => csvEscape(cell)).join(","))
      .join("\n");
  }, [report]);

  const downloadCsv = () => {
    if (!report) return;
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gst-report-${report.startDate}_to_${report.endDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="section">
        <h3>GST Audit</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            Start
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            End
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <button className="button" onClick={fetchReport} disabled={loading}>
            {loading ? "Loading..." : "Fetch"}
          </button>
          <button className="button" onClick={downloadCsv} disabled={!report}>
            Download CSV
          </button>
        </div>
        <p className="muted">Paid bookings only. Timezone: {report?.timezone || "Asia/Kolkata"}.</p>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="label">Bookings</div>
          <div className="value">{report?.summary.bookingCount ?? "-"}</div>
        </div>
        <div className="card">
          <div className="label">Base Amount</div>
          <div className="value">{currency.format(report?.summary.baseAmount || 0)}</div>
        </div>
        <div className="card">
          <div className="label">GST Amount</div>
          <div className="value">{currency.format(report?.summary.gstAmount || 0)}</div>
        </div>
        <div className="card">
          <div className="label">Total Amount</div>
          <div className="value">{currency.format(report?.summary.totalAmount || 0)}</div>
        </div>
      </div>

      <div className="section">
        <h3>Daily Breakdown</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bookings</th>
              <th>Base Amount</th>
              <th>GST Amount</th>
              <th>Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {(report?.rows || []).map((row) => (
              <tr key={row.date}>
                <td>{row.date}</td>
                <td>{row.bookingCount}</td>
                <td>{currency.format(row.baseAmount || 0)}</td>
                <td>{currency.format(row.gstAmount || 0)}</td>
                <td>{currency.format(row.totalAmount || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
