import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency, formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

function partnerLabel(partner: any) {
  if (!partner) return "-";
  const name = String(partner.name || "").trim();
  const phone = String(partner.phone || "").trim();
  if (name && phone) return `${name} (${phone})`;
  return name || phone || partner._id || "-";
}

export default function BookingsPage({ api }: { api: ApiClient }) {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [assign, setAssign] = useState({ partnerId: "", reason: "" });
  const [cancelReason, setCancelReason] = useState("");
  const [refund, setRefund] = useState({ amountInr: "", reason: "" });

  const fetchRows = useCallback(async (page = 1) => {
    const qs = status ? `?status=${encodeURIComponent(status)}&page=${page}` : `?page=${page}`;
    const res = await api.get<any>(`/bookings${qs}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, status]);

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

  return (
    <>
      <div className="section">
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="SEARCHING">Searching</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="PARTNER_ACCEPTED">Partner Accepted</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button className="button" onClick={() => fetchRows(1)}>Filter</button>
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
    </>
  );
}
