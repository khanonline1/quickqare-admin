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

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState("PENDING");
  const [withdrawalMeta, setWithdrawalMeta] = useState<ApiMeta>({});
  const [approveRef, setApproveRef] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

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

  const fetchWithdrawals = useCallback(async (page = 1) => {
    const filter = withdrawalFilter ? `&status=${withdrawalFilter}` : "";
    const res = await api.get<any>(`/payments/withdrawals?page=${page}${filter}`);
    if (res.success) {
      setWithdrawals(res.data);
      setWithdrawalMeta(res.meta);
    }
  }, [api, withdrawalFilter]);

  useEffect(() => {
    fetchOverview();
    fetchTransactions(1);
  }, [fetchOverview, fetchTransactions]);

  useEffect(() => {
    fetchWithdrawals(1);
  }, [fetchWithdrawals]);

  const createPayoutBatch = async () => {
    let items: any[] = [];
    try { items = JSON.parse(payoutItems); } catch {
      alert("Invalid JSON for payout items");
      return;
    }
    await api.post("/payments/payouts", { items });
    alert("Payout batch created");
  };

  const approveWithdrawal = async (id: string) => {
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await api.patch<any>(`/payments/withdrawals/${id}/approve`, {
        referenceId: approveRef[id] || "",
      });
      if (res.success) {
        fetchWithdrawals(1);
        fetchOverview();
      } else {
        alert(res.error?.message || "Approval failed");
      }
    } finally {
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const rejectWithdrawal = async (id: string) => {
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await api.patch<any>(`/payments/withdrawals/${id}/reject`, {
        reason: rejectReason[id] || "",
      });
      if (res.success) {
        fetchWithdrawals(1);
        fetchOverview();
      } else {
        alert(res.error?.message || "Rejection failed");
      }
    } finally {
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  };

  return (
    <>
      <div className="card-grid">
        <div className="card"><div className="label">Platform Revenue</div><div className="value">{currency.format(overview?.totalPlatformRevenue || 0)}</div></div>
        <div className="card"><div className="label">Partner Earnings</div><div className="value">{currency.format(overview?.totalPartnerEarnings || 0)}</div></div>
        <div className="card"><div className="label">Failed Payments</div><div className="value">{overview?.failedPayments ?? "-"}</div></div>
        <div className="card"><div className="label">Pending Withdrawals</div><div className="value">{overview?.pendingPayouts ?? "-"}</div></div>
      </div>

      {/* ── Withdrawal Requests ── */}
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Withdrawal Requests</h3>
          <div className="row" style={{ gap: 8 }}>
            {["PENDING", "APPROVED", "REJECTED", ""].map((s) => (
              <button
                key={s || "ALL"}
                className={`button ${withdrawalFilter === s ? "" : "secondary"}`}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setWithdrawalFilter(s)}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Amount</th>
              <th>Bank</th>
              <th>Status</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>No withdrawals found</td></tr>
            )}
            {withdrawals.map((row) => (
              <tr key={row._id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.partnerId?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.partnerId?.phone || ""}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{currency.format(row.amount || 0)}</td>
                <td style={{ fontSize: 13 }}>
                  <div>{row.bankDetails?.accountHolderName || "-"}</div>
                  <div style={{ color: "var(--muted)" }}>{row.bankDetails?.bankName} · {row.bankDetails?.ifsc}</div>
                  <div style={{ color: "var(--muted)" }}>A/C: {row.bankDetails?.accountNumber}</div>
                </td>
                <td>
                  <span className={`tag ${row.status === "APPROVED" ? "tag-active" : row.status === "REJECTED" ? "tag-inactive" : ""}`}>
                    {row.status}
                  </span>
                  {row.referenceId && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Ref: {row.referenceId}</div>}
                  {row.reason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{row.reason}</div>}
                </td>
                <td style={{ fontSize: 13, color: "var(--muted)" }}>{formatDateTime(row.createdAt)}</td>
                <td>
                  {row.status === "PENDING" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                      <input
                        className="input"
                        placeholder="UTR / Reference ID"
                        value={approveRef[row._id] || ""}
                        onChange={(e) => setApproveRef((r) => ({ ...r, [row._id]: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="button"
                          style={{ flex: 1, fontSize: 12, padding: "6px 0" }}
                          disabled={actionBusy[row._id]}
                          onClick={() => approveWithdrawal(row._id)}
                        >
                          {actionBusy[row._id] ? "…" : "Approve"}
                        </button>
                        <button
                          className="button secondary"
                          style={{ flex: 1, fontSize: 12, padding: "6px 0" }}
                          disabled={actionBusy[row._id]}
                          onClick={() => rejectWithdrawal(row._id)}
                        >
                          Reject
                        </button>
                      </div>
                      <input
                        className="input"
                        placeholder="Rejection reason (optional)"
                        value={rejectReason[row._id] || ""}
                        onChange={(e) => setRejectReason((r) => ({ ...r, [row._id]: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {row.processedAt ? formatDateTime(row.processedAt) : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={withdrawalMeta} onPage={fetchWithdrawals} />
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
        <h3>Wallet Transactions</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Booking</th>
              <th>Type</th>
              <th>Reason</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((row) => (
              <tr key={row._id}>
                <td>{row.partnerId?.name || "-"}</td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.bookingId?._id?.slice(-6) || "-"}</td>
                <td><span className={`tag ${row.type === "credit" ? "tag-active" : "tag-inactive"}`}>{row.type}</span></td>
                <td>{row.reason?.replace(/_/g, " ") || "-"}</td>
                <td style={{ fontWeight: 600 }}>{currency.format(row.amount || 0)}</td>
                <td><span className="tag">{row.status}</span></td>
                <td style={{ fontSize: 12, color: "var(--muted)" }}>{formatDateTime(row.createdAt)}</td>
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
