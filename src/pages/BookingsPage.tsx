import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency, exactCurrency, formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

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

// ─── RESCHEDULE ────────────────────────────────────────────────────────────────

const RESCHEDULE_REASONS = [
  "Due to an unforeseen emergency with your assigned professional",
  "Due to a scheduling conflict on our end",
  "Due to adverse weather conditions in your area",
  "Due to a technical issue with our operations",
  "Due to high service demand in your area",
] as const;

const RESCHEDULE_ELIGIBLE = new Set([
  "SEARCHING", "ASSIGNED", "CONFIRMED", "PARTNER_ACCEPTED", "ON_THE_WAY", "ARRIVED",
]);

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function partnerLabel(partner: any) {
  if (!partner) return "-";
  const name = String(partner.name || "").trim();
  const phone = String(partner.phone || "").trim();
  if (name && phone) return `${name} (${phone})`;
  return name || phone || partner._id || "-";
}

// Human labels for the partner on-site issue codes (must match the backend's
// PARTNER_REPORT_ISSUE_TYPES in booking.controller.js).
const REPORT_ISSUE_LABELS: Record<string, string> = {
  CUSTOMER_ASKED_LATER:   "Customer asked to come later",
  CUSTOMER_NOT_AVAILABLE: "Customer not available at location",
  CUSTOMER_NOT_REACHABLE: "Customer not picking up call",
  WRONG_ADDRESS:          "Address wrong / not found",
  OTHER:                  "Other issue",
};

export default function BookingsPage({ api }: { api: ApiClient }) {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  // What the list is filtered by. Typing only edits `search`; Enter or the
  // Search button applies it. The list used to refetch on every keystroke.
  const [query, setQuery] = useState("");
  const latestFetch = useRef(0);
  const [dr, setDr] = useState<DateRange | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [assign, setAssign] = useState({ partnerId: "", reason: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [forceCancelReason, setForceCancelReason] = useState("");
  const [forceCancelMsg, setForceCancelMsg] = useState("");
  // Both cancel cards share this. On: whatever the customer paid is recorded
  // as a refund owed (it then waits in Payments → Customer Refunds). Off: e.g.
  // the customer was at fault and nothing is due back.
  const [refundOnCancel, setRefundOnCancel] = useState(true);
  const [refund, setRefund] = useState({ amountInr: "", reason: "" });
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState(RESCHEDULE_REASONS[0] as string);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [startCodeMsg, setStartCodeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchRows = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (query) params.set("q", query);
    if (dr) { params.set("start", dr.start.toISOString()); params.set("end", dr.end.toISOString()); }
    const fetchId = ++latestFetch.current;
    const res = await api.get<any>(`/bookings?${params.toString()}`);
    // A newer request has gone out since: this answer is for an older filter.
    if (fetchId !== latestFetch.current) return;
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, status, query, dr]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  // Same text again = a plain refresh; new text refetches through `query`.
  const applySearch = () => {
    const next = search.trim();
    if (next === query) fetchRows(1);
    else setQuery(next);
  };

  const loadDetail = async (id: string) => {
    const res = await api.get<any>(`/bookings/${id}`);
    if (res.success) setSelected(res.data);
  };

  const assignPartner = async () => {
    if (!selected) return;
    // Surface the server's refusal (wrong gender for a women-only category,
    // overloaded partner, unassignable status) instead of silently reloading.
    const res = await api.post<any>(`/bookings/${selected._id}/assign`, assign);
    if (!res.success) { alert(res.error?.message || "Assign failed"); return; }
    loadDetail(selected._id);
  };

  // Shown after a cancel that left a refund owed, so it isn't forgotten.
  // What is owed is the total on record minus anything refunded earlier.
  const refundOwedNote = (data: any) => {
    const owed = (data?.refundAmount || 0) - (data?.refundedAmount || 0);
    return data?.refundStatus === "PENDING" && owed > 0
      ? ` A refund of ${exactCurrency.format(owed)} is recorded — pay it from Payments → Customer Refunds.`
      : "";
  };

  // Asked before either cancel goes through: it can't be undone, and the
  // customer and partner are told at once.
  const confirmCancel = () =>
    window.confirm(
      `Cancel booking ${selected?._id}?\n\n` +
        "The customer and the partner are told straight away, and it can't be undone.\n" +
        (refundOnCancel
          ? "Whatever the customer paid will be recorded as a refund owed."
          : "No refund will be recorded.")
    );

  const cancelBooking = async () => {
    if (!selected) return;
    if (cancelReason.trim().length < 3) { alert("Enter a reason (at least 3 characters)"); return; }
    if (!confirmCancel()) return;
    const res = await api.post<any>(`/bookings/${selected._id}/cancel`, { reason: cancelReason.trim(), refund: refundOnCancel });
    if (!res.success) { alert(res.error?.message || "Cancel failed"); return; }
    setCancelReason("");
    const note = refundOwedNote(res.data);
    if (note) alert(`Booking cancelled.${note}`);
    loadDetail(selected._id);
    fetchRows(meta.pagination?.page || 1);
  };

  const requestRefund = async () => {
    if (!selected) return;
    const amountInr = Number(refund.amountInr);
    if (!(amountInr >= 1) || refund.reason.trim().length < 3) {
      alert("Enter the refund amount and a reason (at least 3 characters)");
      return;
    }
    if (!window.confirm(
      `Record a refund of ₹${amountInr} for booking ${selected._id}?\n\n` +
        "It is added to what this customer is owed and waits in Payments → Customer Refunds."
    )) return;
    const res = await api.post(`/bookings/${selected._id}/refund`, { amountInr, reason: refund.reason.trim() });
    if (!res.success) { alert(res.error?.message || "Refund request failed"); return; }
    setRefund({ amountInr: "", reason: "" });
    alert("Refund recorded. Press Send refund in Payments → Customer Refunds to pay it through Razorpay.");
    loadDetail(selected._id);
  };

  const forceCancel = async () => {
    if (!selected) return;
    if (!forceCancelReason.trim() || forceCancelReason.trim().length < 3) {
      setForceCancelMsg("Reason must be at least 3 characters.");
      return;
    }
    if (!confirmCancel()) return;
    setForceCancelMsg("");
    const res = await api.post<any>(`/bookings/${selected._id}/force-cancel`, {
      reason: forceCancelReason.trim(),
      refund: refundOnCancel,
    });
    if (res.success) {
      setForceCancelReason("");
      setForceCancelMsg(`Booking force-cancelled.${refundOwedNote(res.data)}`);
      loadDetail(selected._id);
      fetchRows(1);
    } else {
      setForceCancelMsg(res.error?.message || "Force cancel failed.");
    }
  };

  // 5 wrong start codes lock the job (it unlocks by itself 30 min later);
  // support can unlock it straight away once they've confirmed the code.
  const resetStartCode = async () => {
    if (!selected) return;
    setStartCodeMsg(null);
    const res = await api.post(`/bookings/${selected._id}/reset-start-code`, {});
    if (res.success) {
      setStartCodeMsg({ ok: true, text: "Start code unlocked — the partner can try again." });
      loadDetail(selected._id);
    } else {
      setStartCodeMsg({ ok: false, text: res.error?.message || "Couldn't reset the start code." });
    }
  };

  const requestReschedule = async () => {
    if (!selected) return;
    setRescheduleSaving(true);
    setRescheduleMsg(null);
    const res = await api.post(`/bookings/${selected._id}/request-reschedule`, { reason: rescheduleReason });
    setRescheduleSaving(false);
    if (res.success) {
      setRescheduleMsg({ ok: true, text: "Reschedule requested. Customer has been notified." });
      loadDetail(selected._id);
      fetchRows(1);
    } else {
      setRescheduleMsg({ ok: false, text: res.error?.message || "Failed to request reschedule." });
    }
  };

  const closeRescheduleModal = () => {
    setShowReschedule(false);
    setRescheduleReason(RESCHEDULE_REASONS[0]);
    setRescheduleMsg(null);
  };

  return (
    <>
      <div className="section">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DateRangePicker onChange={(r) => { setDr(r); }} />
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <input
              className="input"
              style={{ flex: "1 1 240px", minWidth: 200 }}
              placeholder="Search by customer name, phone or booking ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {/* Checkout started but Razorpay never completed — the customer
                  can't see these (hidden from My Bookings); useful for
                  abandoned-cart follow-up calls. */}
              <option value="PENDING_PAYMENT">🛒 Abandoned Checkout (unpaid)</option>
              <option value="SEARCHING">Searching</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="PARTNER_ACCEPTED">Partner Accepted</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button className="button" onClick={applySearch}>Search</button>
            {(search || query || status) && (
              <button className="button secondary" onClick={() => { setSearch(""); setQuery(""); setStatus(""); }}>Clear</button>
            )}
          </div>
        </div>
      </div>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Customer</th>
              <th>Partner</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{row.user?.name || row.user?.phone || "-"}</td>
                <td>{row.partner?.name || "-"}</td>
                <td><span className="tag">{row.status}</span></td>
                <td>{row.scheduledDate} {row.scheduledTime}</td>
                <td>{currency.format(row.totalAmount || 0)}</td>
                <td>
                  <button className="button secondary" onClick={() => loadDetail(row._id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>

      {selected && (
        <div className="section">
          <h3>Booking Detail</h3>
          <div className="row">
            <div className="card" style={{ flex: 1 }}>
              <div className="label">Booking</div>
              <div className="value">{selected._id}</div>
              <div className="muted">Status: {selected.status}</div>
              <div className="muted">Created: {formatDateTime(selected.createdAt)}</div>
              {selected.refundStatus && selected.refundStatus !== "NONE" && (
                <div className="muted">
                  Refund: {selected.refundStatus} · {exactCurrency.format(selected.refundAmount || 0)}
                </div>
              )}
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="label">Customer</div>
              <div className="value">{selected.user?.name || "-"}</div>
              <div className="muted">{selected.user?.phone}</div>
              <div className="muted">{selected.user?.email}</div>
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="label">Partner</div>
              <div className="value">{selected.partner?.name || "-"}</div>
              <div className="muted">{selected.partner?.phone || "-"}</div>
            </div>
          </div>

          {(selected.partner?.selfieUrl || selected.startSelfieUrl) && (
            <div className="row" style={{ marginTop: 16 }}>
              <div className="card" style={{ flex: 1 }}>
                <div className="label">Selfie Verification</div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                  Compare the onboarding photo with the live selfie taken at the customer's location.
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Onboarding photo</div>
                    {selected.partner?.selfieUrl ? (
                      <a href={selected.partner.selfieUrl} target="_blank" rel="noreferrer">
                        <img src={selected.partner.selfieUrl} alt="Onboarding selfie" style={{ width: 150, height: 150, objectFit: "cover", borderRadius: 8 }} />
                      </a>
                    ) : (
                      <div className="muted" style={{ width: 150, paddingTop: 60 }}>Not available</div>
                    )}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>On-site selfie</div>
                    {selected.startSelfieUrl ? (
                      <>
                        <a href={selected.startSelfieUrl} target="_blank" rel="noreferrer">
                          <img
                            src={selected.startSelfieUrl}
                            alt="On-site selfie"
                            style={{
                              width: 150, height: 150, objectFit: "cover", borderRadius: 8,
                              border: selected.startSelfieFlagged ? "3px solid #dc2626" : undefined,
                            }}
                          />
                        </a>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {selected.startSelfieAt ? formatDateTime(selected.startSelfieAt) : ""}
                        </div>
                        {typeof selected.startSelfieDistanceMeters === "number" ? (
                          <div
                            style={{
                              fontSize: 12, marginTop: 2, fontWeight: 600,
                              color: selected.startSelfieFlagged ? "#dc2626" : "#16a34a",
                            }}
                          >
                            {selected.startSelfieFlagged ? "⚠ " : ""}
                            Taken {selected.startSelfieDistanceMeters >= 1000
                              ? `${(selected.startSelfieDistanceMeters / 1000).toFixed(1)} km`
                              : `${selected.startSelfieDistanceMeters} m`} from customer location
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            GPS unavailable at capture
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="muted" style={{ width: 150, paddingTop: 60 }}>Not uploaded yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(selected.partnerReports?.length > 0) && (
            <div className="row" style={{ marginTop: 16 }}>
              <div className="card" style={{ flex: 1, borderLeft: "4px solid #f59e0b" }}>
                <div className="label" style={{ color: "#b45309" }}>
                  ⚠ Partner On-Site Reports ({selected.partnerReports.length})
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
                  The partner flagged a problem at the customer's location. Follow up — no fee or status
                  change was applied automatically.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[...selected.partnerReports].reverse().map((rep: any, i: number) => (
                    <div
                      key={rep._id || `${rep.createdAt}-${i}`}
                      style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(245,158,11,0.10)" }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {REPORT_ISSUE_LABELS[rep.issueType] || rep.issueType}
                      </div>
                      {rep.note && rep.note !== REPORT_ISSUE_LABELS[rep.issueType] ? (
                        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{rep.note}</div>
                      ) : null}
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        By {partnerLabel(rep.partner)} · at status {rep.statusAtReport || "-"} ·{" "}
                        {rep.createdAt ? formatDateTime(rep.createdAt) : "-"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="row" style={{ marginTop: 16 }}>
            <div className="card" style={{ flex: 1 }}>
              <div className="label">Manual Assign</div>
              <input className="input" placeholder="Partner ID" value={assign.partnerId} onChange={(e) => setAssign({ ...assign, partnerId: e.target.value })} />
              <input className="input" placeholder="Reason" value={assign.reason} onChange={(e) => setAssign({ ...assign, reason: e.target.value })} />
              <button className="button" onClick={assignPartner}>Assign</button>
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="label">Cancel Booking</div>
              <input className="input" placeholder="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              {/* flexDirection: the global `label` rule stacks children in a column */}
              <label className="checkbox-row" style={{ cursor: "pointer", flexDirection: "row" }}>
                <input type="checkbox" checked={refundOnCancel} onChange={(e) => setRefundOnCancel(e.target.checked)} />
                <span className="checkbox-label">Refund the customer in full (if they paid)</span>
              </label>
              <button className="button danger" onClick={cancelBooking}>Cancel</button>
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="label">Request Refund</div>
              <input className="input" placeholder="Amount INR" value={refund.amountInr} onChange={(e) => setRefund({ ...refund, amountInr: e.target.value })} />
              <input className="input" placeholder="Reason" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} />
              <button className="button warning" onClick={requestRefund}>Refund</button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div className="card" style={{ flex: 1, borderLeft: "4px solid #dc2626" }}>
              <div className="label" style={{ color: "#dc2626" }}>Force Cancel</div>
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Cancels the booking from any status. Frees the assigned partner, cancels pending timers, and notifies the customer.
                Cannot cancel COMPLETED or already-CANCELLED bookings.
              </div>
              <input
                className="input"
                placeholder="Reason (required, min 3 chars)"
                value={forceCancelReason}
                onChange={(e) => { setForceCancelReason(e.target.value); setForceCancelMsg(""); }}
              />
              <label className="checkbox-row" style={{ cursor: "pointer", flexDirection: "row" }}>
                <input type="checkbox" checked={refundOnCancel} onChange={(e) => setRefundOnCancel(e.target.checked)} />
                <span className="checkbox-label">Refund the customer in full (if they paid)</span>
              </label>
              {forceCancelMsg && (
                <div style={{ fontSize: 13, marginTop: 4, color: forceCancelMsg.includes("force-cancelled") ? "#16a34a" : "#dc2626" }}>
                  {forceCancelMsg}
                </div>
              )}
              <button
                className="button danger"
                style={{ marginTop: 8 }}
                onClick={forceCancel}
                disabled={selected.status === "CANCELLED" || selected.status === "COMPLETED"}
              >
                Force Cancel Booking
              </button>
              {(selected.status === "CANCELLED" || selected.status === "COMPLETED") && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Not available for {selected.status} bookings.
                </div>
              )}
            </div>
            <div className="card" style={{ flex: 1, borderLeft: "4px solid #f59e0b" }}>
              <div className="label" style={{ color: "#f59e0b" }}>Request Reschedule</div>
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Flags this booking as needing rescheduling and notifies the customer to pick a new slot.
                Only available while the booking is active.
              </div>
              <button
                className="button warning"
                onClick={() => { setRescheduleMsg(null); setShowReschedule(true); }}
                disabled={!RESCHEDULE_ELIGIBLE.has(selected.status)}
              >
                Request Reschedule
              </button>
              {!RESCHEDULE_ELIGIBLE.has(selected.status) && (
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Not available for {selected.status} bookings.
                </div>
              )}
            </div>
          </div>

          {(selected.startCodeAttempts || 0) > 0 && !["COMPLETED", "CANCELLED"].includes(selected.status) && (
            <div className="card" style={{ marginTop: 16, borderLeft: "4px solid #dc2626" }}>
              <div className="label" style={{ color: "#dc2626" }}>Start Code</div>
              <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
                Wrong start-code attempts: {selected.startCodeAttempts} of 5
                {selected.startCodeLockedAt
                  ? ` — locked since ${formatDateTime(selected.startCodeLockedAt)} (unlocks by itself after 30 min)`
                  : ""}
                . Unlock only after confirming with the customer.
              </div>
              <button className="button danger" onClick={resetStartCode}>
                Reset start code
              </button>
              {startCodeMsg && (
                <div style={{ fontSize: 13, marginTop: 6, color: startCodeMsg.ok ? "#16a34a" : "#dc2626" }}>
                  {startCodeMsg.text}
                </div>
              )}
            </div>
          )}

          <div className="section" style={{ marginTop: 16 }}>
            <h3>Assignment Audit</h3>
            {(selected.assignmentAudit || []).length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {selected.assignmentAudit.map((item: any, index: number) => (
                  <div key={`${item.createdAt || index}-${item.event || index}`} className="card">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div className="label">{item.event || "ASSIGNMENT_EVENT"}</div>
                        <div className="muted">Stage {item.stage || "-"}</div>
                        <div className="muted">{formatDateTime(item.createdAt)}</div>
                      </div>
                      <div className="muted">
                        Selected: {partnerLabel(item.selectedPartnerId)}
                      </div>
                    </div>
                    <div className="muted" style={{ marginTop: 8 }}>
                      Pincodes searched: {(item.searchedPincodes || []).join(", ") || "-"}
                    </div>
                    {item.notes ? <div className="muted" style={{ marginTop: 6 }}>{item.notes}</div> : null}
                    {(item.candidates || []).length ? (
                      <div style={{ marginTop: 12 }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Partner</th>
                              <th>Score</th>
                              <th>Skill</th>
                              <th>Distance</th>
                              <th>Jobs</th>
                              <th>Rating</th>
                              <th>Fairness</th>
                              <th>Reliability</th>
                              <th>Primary Pincode</th>
                              <th>Auto Accept</th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.candidates.map((candidate: any, candidateIndex: number) => (
                              <tr key={`${candidate.partnerId?._id || candidate.partnerId || candidateIndex}`}>
                                <td>{partnerLabel(candidate.partnerId)}</td>
                                <td>{candidate.score ?? "-"}</td>
                                <td>{candidate.skillMatchLevel ?? "-"}</td>
                                <td>{candidate.distanceMeters ?? "-"}</td>
                                <td>{candidate.activeJobs ?? "-"}</td>
                                <td>{candidate.rating ?? "-"}</td>
                                <td>{candidate.fairnessScore ?? "-"}</td>
                                <td>{candidate.reliabilityScore ?? "-"}</td>
                                <td>{candidate.inPrimaryPincode ? "Yes" : "No"}</td>
                                <td>{candidate.autoAccept ? "Yes" : "No"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="muted" style={{ marginTop: 8 }}>No candidate rows recorded for this step.</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No assignment audit recorded yet.</p>
            )}
          </div>

          {(selected.estimateItems?.length > 0) && (
            <div className="section" style={{ marginTop: 16 }}>
              <div className="section-header" style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Partner Estimate</h3>
                <span className={`tag ${
                  selected.estimateStatus === "approved" ? "tag-active" :
                  selected.estimateStatus === "rejected" ? "tag-blocked" :
                  selected.estimateStatus === "pending" ? "tag-pending" : ""
                }`}>
                  {(selected.estimateStatus || "none").toUpperCase()}
                </span>
              </div>
              {selected.estimateSubmittedAt && (
                <div className="muted" style={{ marginBottom: 12, fontSize: 13 }}>
                  Submitted: {formatDateTime(selected.estimateSubmittedAt)}
                  {selected.estimateApprovedAt && ` · Approved: ${formatDateTime(selected.estimateApprovedAt)}`}
                  {selected.estimateRejectedAt && ` · Rejected: ${formatDateTime(selected.estimateRejectedAt)}`}
                </div>
              )}
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.estimateItems.map((item: any, i: number) => (
                    <tr key={item.serviceId || i}>
                      <td>{item.name}</td>
                      <td>{currency.format(item.price || 0)}</td>
                      <td>{item.quantity}</td>
                      <td>{currency.format(item.lineTotal || 0)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>Estimate Total</td>
                    <td style={{ fontWeight: 600 }}>{currency.format(selected.estimateTotal || 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div className="section" style={{ marginTop: 16 }}>
            <h3>Timeline</h3>
            <ul>
              {(selected.timeline || []).map((item: any) => (
                <li key={item._id}>{formatDateTime(item.createdAt)} - {item.eventType}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showReschedule && selected && (
        <div className="modal-overlay" onClick={closeRescheduleModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Request Reschedule</div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
                Booking <strong>{selected._id}</strong> · current status:{" "}
                <span className="tag tag-pending" style={{ fontSize: 11 }}>{selected.status}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                The customer will be notified and asked to pick a new date and time.
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                Reason for rescheduling
              </label>
              <select
                className="input"
                value={rescheduleReason}
                onChange={(e) => { setRescheduleReason(e.target.value); setRescheduleMsg(null); }}
              >
                {RESCHEDULE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {rescheduleMsg && (
              <div style={{
                fontSize: 13,
                padding: "8px 12px",
                borderRadius: 8,
                marginBottom: 12,
                background: rescheduleMsg.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                color: rescheduleMsg.ok ? "#10b981" : "#ef4444",
              }}>
                {rescheduleMsg.text}
              </div>
            )}

            <div className="modal-actions">
              <button className="button secondary" onClick={closeRescheduleModal} disabled={rescheduleSaving}>
                Cancel
              </button>
              <button className="button warning" onClick={requestReschedule} disabled={rescheduleSaving}>
                {rescheduleSaving ? "Sending…" : "Confirm Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
