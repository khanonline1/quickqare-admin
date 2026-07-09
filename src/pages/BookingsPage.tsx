import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency, formatDateTime } from "../utils/format";
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
  const [dr, setDr] = useState<DateRange | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [assign, setAssign] = useState({ partnerId: "", reason: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [forceCancelReason, setForceCancelReason] = useState("");
  const [forceCancelMsg, setForceCancelMsg] = useState("");
  const [refund, setRefund] = useState({ amountInr: "", reason: "" });
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState(RESCHEDULE_REASONS[0] as string);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleMsg, setRescheduleMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchRows = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (search.trim()) params.set("q", search.trim());
    if (dr) { params.set("start", dr.start.toISOString()); params.set("end", dr.end.toISOString()); }
    const res = await api.get<any>(`/bookings?${params.toString()}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, status, search, dr]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const loadDetail = async (id: string) => {
    const res = await api.get<any>(`/bookings/${id}`);
    if (res.success) setSelected(res.data);
  };

  const assignPartner = async () => {
    if (!selected) return;
    await api.post(`/bookings/${selected._id}/assign`, assign);
    loadDetail(selected._id);
  };

  const cancelBooking = async () => {
    if (!selected) return;
    await api.post(`/bookings/${selected._id}/cancel`, { reason: cancelReason });
    loadDetail(selected._id);
  };

  const requestRefund = async () => {
    if (!selected) return;
    await api.post(`/bookings/${selected._id}/refund`, { amountInr: Number(refund.amountInr), reason: refund.reason });
    loadDetail(selected._id);
  };

  const forceCancel = async () => {
    if (!selected) return;
    if (!forceCancelReason.trim() || forceCancelReason.trim().length < 3) {
      setForceCancelMsg("Reason must be at least 3 characters.");
      return;
    }
    setForceCancelMsg("");
    const res = await api.post(`/bookings/${selected._id}/force-cancel`, { reason: forceCancelReason.trim() });
    if (res.success) {
      setForceCancelReason("");
      setForceCancelMsg("Booking force-cancelled.");
      loadDetail(selected._id);
      fetchRows(1);
    } else {
      setForceCancelMsg(res.error?.message || "Force cancel failed.");
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
              onKeyDown={(e) => e.key === "Enter" && fetchRows(1)}
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
            <button className="button" onClick={() => fetchRows(1)}>Search</button>
            {(search || status) && (
              <button className="button secondary" onClick={() => { setSearch(""); setStatus(""); }}>Clear</button>
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
