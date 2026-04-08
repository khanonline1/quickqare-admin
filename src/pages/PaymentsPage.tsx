import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency, formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

export default function PaymentsPage({ api }: { api: ApiClient }) {
  const [overview, setOverview] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [payoutItems, setPayoutItems] = useState("[]");

  const fetchOverview = useCallback(async () => {
    const res = await api.get<any>("/payments/overview");
    if (res.success) setOverview(res.data);
  }, [api]);

  const fetchTransactions = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/payments/transactions?page=${page}`);
    if (res.success) {
      setTransactions(res.data);
      setMeta(res.meta);
    }
  }, [api]);

  useEffect(() => {
    fetchOverview();
    fetchTransactions(1);
  }, [fetchOverview, fetchTransactions]);

  const createPayoutBatch = async () => {
    let items: any[] = [];
    try { items = JSON.parse(payoutItems); } catch {
      alert("Invalid JSON for payout items");
      return;
    }
    await api.post("/payments/payouts", { items });
    alert("Payout batch created");
  };

  return (
    <>
      <div className="card-grid">
        <div className="card"><div className="label">Platform Revenue</div><div className="value">{currency.format(overview?.totalPlatformRevenue || 0)}</div></div>
        <div className="card"><div className="label">Partner Earnings</div><div className="value">{currency.format(overview?.totalPartnerEarnings || 0)}</div></div>
        <div className="card"><div className="label">Failed Payments</div><div className="value">{overview?.failedPayments ?? "-"}</div></div>
        <div className="card"><div className="label">Pending Payouts</div><div className="value">{overview?.pendingPayouts ?? "-"}</div></div>
      </div>

      <div className="section">
        <h3>Refunds Snapshot</h3>
        <table className="table">
          <thead><tr><th>Status</th><th>Count</th><th>Total</th></tr></thead>
          <tbody>
            {(overview?.refunds || []).map((row: any) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{row.count}</td>
                <td>{currency.format(row.totalAmountInr || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3>Transactions</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((row) => (
              <tr key={row._id}>
                <td>{row.partnerId?.name || "-"}</td>
                <td>{row.bookingId?._id || "-"}</td>
                <td>{row.type}</td>
                <td>{currency.format(row.amountInr || 0)}</td>
                <td>{formatDateTime(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchTransactions} />
      </div>

      <div className="section">
        <h3>Create Payout Batch</h3>
        <p className="muted">Paste JSON array: [{"{"}"partnerId":"...","amountInr":1200,"referenceId":"optional"{"}"}]</p>
        <textarea className="input" style={{ width: "100%", minHeight: 120 }} value={payoutItems} onChange={(e) => setPayoutItems(e.target.value)} />
        <button className="button" onClick={createPayoutBatch}>Create Batch</button>
      </div>
    </>
  );
}

