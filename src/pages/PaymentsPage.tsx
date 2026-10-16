import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency, exactCurrency, formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

export default function PaymentsPage({ api }: { api: ApiClient }) {
  const [overview, setOverview] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});

  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState("PENDING");
  const [withdrawalMeta, setWithdrawalMeta] = useState<ApiMeta>({});
  const [approveRef, setApproveRef] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<Record<string, boolean>>({});

  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountFilter, setAccountFilter] = useState("PENDING");
  const [accountMeta, setAccountMeta] = useState<ApiMeta>({});
  const [accountRejectReason, setAccountRejectReason] = useState<Record<string, string>>({});

  const [refunds, setRefunds] = useState<any[]>([]);
  const [refundFilter, setRefundFilter] = useState("PENDING");
  const [refundMeta, setRefundMeta] = useState<ApiMeta>({});
  const [refundRef, setRefundRef] = useState<Record<string, string>>({});

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

  const fetchAccounts = useCallback(async (page = 1) => {
    const filter = accountFilter ? `&status=${accountFilter}` : "";
    const res = await api.get<any>(`/payments/payout-accounts?page=${page}${filter}`);
    if (res.success) {
      setAccounts(res.data);
      setAccountMeta(res.meta);
    }
  }, [api, accountFilter]);

  useEffect(() => {
    fetchAccounts(1);
  }, [fetchAccounts]);

  const fetchRefunds = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/payments/refunds?page=${page}&status=${refundFilter}`);
    if (res.success) {
      setRefunds(res.data);
      setRefundMeta(res.meta);
    }
  }, [api, refundFilter]);

  useEffect(() => {
    fetchRefunds(1);
  }, [fetchRefunds]);

  // Pays the refund through Razorpay itself (no refund ID sent = the backend
  // issues it). Cancellation refunds go out automatically; this is for the ones
  // held for approval or that an automatic try could not send.
  const sendRefund = async (row: any) => {
    const id = row.bookingId;
    if (!window.confirm(`Send ${exactCurrency.format(row.refundAmount || 0)} back to ${row.customer?.name || "the customer"} through Razorpay now?`)) {
      return;
    }
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await api.post<any>(`/payments/refunds/${id}/complete`, {});
      if (res.success) fetchRefunds(1);
      else alert(res.error?.message || "Could not send the refund");
    } finally {
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  };

  // For a refund issued by hand in the Razorpay dashboard: record it by its
  // refund ID. A row whose automatic refund already went out arrives with its
  // refund ID filled in, so it only needs confirming.
  const markRefunded = async (row: any) => {
    const id = row.bookingId;
    const referenceId = (refundRef[id] ?? row.refundReference ?? "").trim();
    if (!referenceId) {
      alert("Refund the payment in Razorpay first, then enter its refund ID");
      return;
    }
    if (!window.confirm(`Confirm you have refunded ${exactCurrency.format(row.refundAmount || 0)} to ${row.customer?.name || "the customer"} (Ref: ${referenceId})?`)) {
      return;
    }
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await api.post<any>(`/payments/refunds/${id}/complete`, { referenceId });
      if (res.success) fetchRefunds(1);
      else alert(res.error?.message || "Could not mark the refund as paid");
    } finally {
      setActionBusy((b) => ({ ...b, [id]: false }));
    }
  };

  // `revision` pins the decision to the details on screen: if the partner
  // resubmitted since this list loaded, the backend refuses (409) and we reload.
  const decideAccount = async (row: any, status: "VERIFIED" | "REJECTED") => {
    const reason = (accountRejectReason[row._id] || "").trim();
    if (status === "REJECTED" && !reason) {
      alert("Enter a reason so the partner knows what to fix");
      return;
    }
    setActionBusy((b) => ({ ...b, [row._id]: true }));
    try {
      const res = await api.patch<any>(`/payments/payout-accounts/${row._id}/verify`, {
        status,
        revision: row.revision,
        reason,
      });
      if (!res.success) alert(res.error?.message || "Update failed");
      fetchAccounts(1);
    } finally {
      setActionBusy((b) => ({ ...b, [row._id]: false }));
    }
  };

  const approveWithdrawal = async (row: any) => {
    const id = row._id;
    const referenceId = (approveRef[id] || "").trim();
    if (!referenceId) {
      alert("Make the transfer first, then enter its UTR / reference ID");
      return;
    }
    const destination = row.payoutMethod === "UPI" ? row.upiId : `A/C ${row.bankDetails?.accountNumber}`;
    if (!window.confirm(`Confirm you have sent ${currency.format(row.amount || 0)} to ${destination} (Ref: ${referenceId})?`)) {
      return;
    }
    setActionBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await api.patch<any>(`/payments/withdrawals/${id}/approve`, { referenceId });
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

      {/* ── Customer Refunds ── */}
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>
            Customer Refunds
            {refundFilter === "PENDING" && (refundMeta.pagination?.total ?? 0) > 0 && (
              <span className="tag tag-warning" style={{ marginLeft: 8 }}>{refundMeta.pagination?.total} waiting</span>
            )}
          </h3>
          <div className="row" style={{ gap: 8 }}>
            {["PENDING", "PROCESSED"].map((s) => (
              <button
                key={s}
                className={`button ${refundFilter === s ? "" : "secondary"}`}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setRefundFilter(s)}
              >
                {s === "PENDING" ? "Owed" : "Refunded"}
              </button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Every refund the system has recorded as owed — customer cancellations, auto-cancelled bookings, admin cancels
          and refunds requested from a booking. Cancellation refunds are sent to Razorpay automatically and move to
          Refunded; Razorpay's webhook confirms them. Refunds requested from a booking, dispute or complaint wait here
          until you press Send refund. Anything left under Owed after a while could not be sent automatically.
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Booking</th>
              <th>Refund</th>
              <th>Why</th>
              <th>Razorpay payment</th>
              <th>{refundFilter === "PENDING" ? "Actions" : "Refunded"}</th>
            </tr>
          </thead>
          <tbody>
            {refunds.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                {refundFilter === "PENDING" ? "No refunds waiting" : "No refunds found"}
              </td></tr>
            )}
            {refunds.map((row) => (
              <tr key={row.bookingId}>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.customer?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.customer?.phone || ""}</div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div>{row.bookingId}</div>
                  <div style={{ color: "var(--muted)" }}>{row.bookingStatus}</div>
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{exactCurrency.format(row.refundAmount || 0)}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>of {exactCurrency.format(row.totalAmount || 0)} booking</div>
                  {row.alreadyRefunded > 0 && (
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>
                      on top of {exactCurrency.format(row.alreadyRefunded)} refunded earlier
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>
                  <div>{row.reason || "-"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    {row.cancelledBy ? `Cancelled by ${row.cancelledBy}` : "Booking not cancelled"}
                    {row.cancelledAt ? ` · ${formatDateTime(row.cancelledAt)}` : ""}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>
                  <div>{row.paymentId || "-"}</div>
                  {row.estimatePaymentId && <div style={{ color: "var(--muted)" }}>Estimate: {row.estimatePaymentId}</div>}
                </td>
                <td>
                  {row.refundStatus === "PENDING" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                      {row.autoRefundError && (
                        <div style={{ fontSize: 12, color: "#ef4444" }}>
                          Automatic refund failed{row.autoRefundAttempts ? ` (${row.autoRefundAttempts} tries)` : ""}: {row.autoRefundError}
                        </div>
                      )}
                      {row.canAutoRefund ? (
                        <button
                          className="button"
                          style={{ fontSize: 12, padding: "6px 0" }}
                          disabled={actionBusy[row.bookingId]}
                          title="Sends this refund to the customer through Razorpay"
                          onClick={() => sendRefund(row)}
                        >
                          {actionBusy[row.bookingId] ? "…" : "Send refund via Razorpay"}
                        </button>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          Can't be sent automatically (on-site estimate payment or no captured payment). Refund it in
                          the Razorpay dashboard and enter the refund ID.
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Or, if you already refunded it in Razorpay:</div>
                      <input
                        className="input"
                        placeholder="Razorpay refund ID (rfnd_…)"
                        value={refundRef[row.bookingId] ?? row.refundReference ?? ""}
                        onChange={(e) => setRefundRef((r) => ({ ...r, [row.bookingId]: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                      <button
                        className="button"
                        style={{ fontSize: 12, padding: "6px 0" }}
                        disabled={actionBusy[row.bookingId] || !(refundRef[row.bookingId] ?? row.refundReference ?? "").trim()}
                        title="Refund the payment in Razorpay first, then enter its refund ID to mark it done"
                        onClick={() => markRefunded(row)}
                      >
                        {actionBusy[row.bookingId] ? "…" : "Mark refunded"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      <div>{row.refundProcessedAt ? formatDateTime(row.refundProcessedAt) : "—"}</div>
                      {row.refundReference && <div style={{ fontSize: 12 }}>Ref: {row.refundReference}</div>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={refundMeta} onPage={fetchRefunds} />
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
              <th>Pay to</th>
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
                  {row.payoutMethod === "UPI" ? (
                    <div style={{ color: "var(--muted)" }}>UPI: {row.upiId}</div>
                  ) : (
                    <>
                      <div style={{ color: "var(--muted)" }}>{row.bankDetails?.bankName} · {row.bankDetails?.ifsc}</div>
                      <div style={{ color: "var(--muted)" }}>A/C: {row.bankDetails?.accountNumber}</div>
                    </>
                  )}
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
                          disabled={actionBusy[row._id] || !(approveRef[row._id] || "").trim()}
                          title="Transfer the money first, then enter its UTR to mark it paid"
                          onClick={() => approveWithdrawal(row)}
                        >
                          {actionBusy[row._id] ? "…" : "Mark paid"}
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

      {/* ── Partner Payout Accounts ── */}
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Partner Payout Accounts</h3>
          <div className="row" style={{ gap: 8 }}>
            {["PENDING", "VERIFIED", "REJECTED", ""].map((s) => (
              <button
                key={s || "ALL"}
                className={`button ${accountFilter === s ? "" : "secondary"}`}
                style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => setAccountFilter(s)}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          Verify only when the holder name matches the partner. Withdrawals are paid only to verified accounts.
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Account</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>No payout accounts found</td></tr>
            )}
            {accounts.map((row) => (
              <tr key={row._id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{row.partner?.name || "-"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.partner?.phone || ""}</div>
                </td>
                <td style={{ fontSize: 13 }}>
                  <div style={{ fontWeight: 600 }}>{row.accountHolderName}</div>
                  {row.method === "UPI" ? (
                    <div style={{ color: "var(--muted)" }}>UPI: {row.upiId}</div>
                  ) : (
                    <>
                      <div style={{ color: "var(--muted)" }}>A/C: {row.accountNumber}</div>
                      <div style={{ color: "var(--muted)" }}>IFSC: {row.ifsc}{row.bankName ? ` · ${row.bankName}` : ""}</div>
                    </>
                  )}
                </td>
                <td>
                  <span className={`tag ${row.status === "VERIFIED" ? "tag-active" : row.status === "REJECTED" ? "tag-inactive" : ""}`}>
                    {row.status}
                  </span>
                  {row.rejectionReason && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{row.rejectionReason}</div>}
                  {row.withdrawalsBlockedUntil && new Date(row.withdrawalsBlockedUntil) > new Date() && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Changed recently — withdrawals on hold until {formatDateTime(row.withdrawalsBlockedUntil)}
                    </div>
                  )}
                </td>
                <td style={{ fontSize: 13, color: "var(--muted)" }}>{formatDateTime(row.submittedAt)}</td>
                <td>
                  {row.status === "PENDING" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 180 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <button
                          className="button"
                          style={{ flex: 1, fontSize: 12, padding: "6px 0" }}
                          disabled={actionBusy[row._id]}
                          onClick={() => decideAccount(row, "VERIFIED")}
                        >
                          {actionBusy[row._id] ? "…" : "Verify"}
                        </button>
                        <button
                          className="button secondary"
                          style={{ flex: 1, fontSize: 12, padding: "6px 0" }}
                          disabled={actionBusy[row._id]}
                          onClick={() => decideAccount(row, "REJECTED")}
                        >
                          Reject
                        </button>
                      </div>
                      <input
                        className="input"
                        placeholder="Rejection reason (required to reject)"
                        value={accountRejectReason[row._id] || ""}
                        onChange={(e) => setAccountRejectReason((r) => ({ ...r, [row._id]: e.target.value }))}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {row.verifiedAt ? formatDateTime(row.verifiedAt) : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={accountMeta} onPage={fetchAccounts} />
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
    </>
  );
}
