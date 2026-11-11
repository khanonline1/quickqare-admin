import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency } from "../utils/format";
import Pagination from "../components/Pagination";
import AssignHubModal from "./AssignHubModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type PartnerRow = {
  id: string;
  name: string;
  phone: string;
  gender: string;
  serviceCategory: string;
  skillTier: number;
  pincode: string;
  status: string;
  rating: number;
  totalEarnings: number;
  completedJobs: number;
  pendingJobs: number;
  activeJobs: number;
  maxJobsLimit: number;
  isOnline: boolean;
  commissionPercent: number;
  subscriptionActive: boolean;
};

type PartnerStats = {
  partner: any;
  stats: {
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    totalEarnings: number;
    walletBalance: number;
    walletTotalEarnings: number;
  };
  activeBookings: any[];
};

type PartnerLocation = {
  isOnline: boolean;
  location?: { coordinates: [number, number] };
  currentPincode: string;
  currentAddress: string;
  lastLocationAt: string | null;
};

type AvailablePartner = {
  _id: string;
  name: string;
  phone: string;
  rating: number;
  activeJobs: number;
  maxJobsLimit: number;
  currentPincode: string;
  isOnline: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const statusColor = (s: string) => {
  if (s === "APPROVED") return "#16a34a";
  if (s === "BLOCKED")  return "#dc2626";
  if (s === "REJECTED") return "#9ca3af";
  return "#d97706";
};

const bookingStatusColor = (s: string) => {
  if (s === "COMPLETED")    return "#16a34a";
  if (s === "IN_PROGRESS")  return "#2563eb";
  if (s === "ON_THE_WAY" || s === "ARRIVED") return "#7c3aed";
  if (s === "ASSIGNED" || s === "PARTNER_ACCEPTED" || s === "CONFIRMED") return "#d97706";
  return "#6b7280";
};

// Women-only / men-only categories (Category.partnerGender) match on this, so
// a missing value is worth surfacing: that partner can't take those jobs.
const genderLabel = (g: string | undefined) =>
  g === "FEMALE" ? "Female" : g === "MALE" ? "Male" : g === "OTHER" ? "Other" : "Gender not set";

const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return d; }
};

// ─── Reassign Modal ───────────────────────────────────────────────────────────
function ReassignModal({
  api,
  booking,
  onClose,
  onDone,
}: {
  api: ApiClient;
  booking: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [pincode, setPincode] = useState(String(booking.pincode || ""));
  const [candidates, setCandidates] = useState<AvailablePartner[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<any>(
        `/partners/available?pincode=${encodeURIComponent(pincode)}&bookingId=${booking._id || booking.id || ""}`
      );
      if (res.success) setCandidates(res.data || []);
      else setError("Failed to load partners");
    } catch {
      setError("Failed to load partners");
    } finally {
      setLoading(false);
    }
  }, [api, pincode, booking]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const handleSubmit = async () => {
    if (!selected) { setError("Select a partner"); return; }
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters"); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post<any>(`/bookings/${booking._id || booking.id}/reassign`, {
        partnerId: selected,
        reason: reason.trim(),
      });
      if (res.success) { onDone(); }
      else setError(res.error?.message || "Reassign failed");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Reassign failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 400,
      background: "rgba(0,0,0,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--panel)", borderRadius: 12, width: "min(620px, 95vw)",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Reassign Booking</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
              #{booking.bookingNumber} &nbsp;·&nbsp;
              <span style={{ color: bookingStatusColor(booking.status), fontWeight: 600 }}>{booking.status}</span>
              {booking.pincode && <>&nbsp;·&nbsp; Pincode {booking.pincode}</>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "var(--muted)", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          {/* Pincode filter */}
          <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Filter by Pincode</label>
              <input
                className="input"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="Enter pincode"
                style={{ width: "100%" }}
              />
            </div>
            <button className="button secondary" onClick={fetchCandidates} disabled={loading}>
              {loading ? "Loading…" : "Search"}
            </button>
          </div>

          {/* Candidates list */}
          {candidates.length === 0 && !loading && (
            <div style={{ padding: "20px 0", textAlign: "center", color: "var(--muted-2)", fontSize: 14 }}>
              No available partners found for this pincode.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {candidates.map((p) => {
              const overloaded = p.activeJobs >= p.maxJobsLimit;
              const isSelected = selected === p._id;
              return (
                <div
                  key={p._id}
                  onClick={() => !overloaded && setSelected(p._id)}
                  style={{
                    border: `2px solid ${isSelected ? "#2563eb" : overloaded ? "#fca5a5" : "var(--border)"}`,
                    borderRadius: 8, padding: "12px 14px",
                    cursor: overloaded ? "not-allowed" : "pointer",
                    background: isSelected ? "var(--info-bg)" : overloaded ? "var(--danger-bg)" : "var(--panel)",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    opacity: overloaded ? 0.7 : 1,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {p.phone} &nbsp;·&nbsp; Pincode {p.currentPincode || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12 }}>
                    {/* Online indicator */}
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      color: p.isOnline ? "#16a34a" : "var(--muted-2)",
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.isOnline ? "#16a34a" : "var(--border-strong)", display: "inline-block" }} />
                      {p.isOnline ? "Online" : "Offline"}
                    </span>
                    {/* Rating */}
                    <span style={{ color: "#d97706", fontWeight: 600 }}>★ {p.rating?.toFixed(1)}</span>
                    {/* Workload */}
                    <span style={{
                      background: overloaded ? "var(--danger-bg)" : p.activeJobs >= p.maxJobsLimit - 1 ? "var(--warning-bg)" : "var(--success-bg)",
                      color: overloaded ? "#dc2626" : p.activeJobs >= p.maxJobsLimit - 1 ? "#d97706" : "#16a34a",
                      fontWeight: 700, borderRadius: 4, padding: "2px 7px",
                    }}>
                      {p.activeJobs}/{p.maxJobsLimit} jobs
                    </span>
                    {overloaded && <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 11 }}>FULL</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason */}
          <div>
            <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Reason for Reassignment *</label>
            <textarea
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Partner unavailable, customer request, area mismatch…"
              rows={3}
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="button secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="button" onClick={handleSubmit} disabled={submitting || !selected}>
            {submitting ? "Reassigning…" : "Confirm Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Partner Detail Panel ─────────────────────────────────────────────────────
function PartnerDetailPanel({
  api,
  partnerId,
  onClose,
}: {
  api: ApiClient;
  partnerId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PartnerStats | null>(null);
  const [location, setLocation] = useState<PartnerLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [reassignBooking, setReassignBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showHubModal, setShowHubModal] = useState(false);
  const [selfieVerifying, setSelfieVerifying] = useState(false);
  const [selfieRejectReason, setSelfieRejectReason] = useState("");
  const [selfieShowRejectBox, setSelfieShowRejectBox] = useState(false);
  const [selfieError, setSelfieError] = useState("");
  const [genderSaving, setGenderSaving] = useState(false);
  const [tierSaving, setTierSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setLocation(null);
    setSelfieRejectReason("");
    setSelfieShowRejectBox(false);
    setSelfieError("");
    api.get<any>(`/partners/${partnerId}/stats`).then((res) => {
      if (res.success) setData(res.data);
    }).finally(() => setLoading(false));
  }, [api, partnerId]);

  const handleSelfieVerify = async (status: "APPROVED" | "REJECTED") => {
    if (status === "REJECTED" && !selfieRejectReason.trim()) {
      setSelfieError("Please enter a rejection reason.");
      return;
    }
    setSelfieVerifying(true);
    setSelfieError("");
    try {
      const res = await api.patch<any>(`/partners/${partnerId}/selfie-verification`, {
        status,
        reason: selfieRejectReason.trim(),
      });
      if (res.success) {
        setData((prev) => prev ? {
          ...prev,
          partner: {
            ...prev.partner,
            selfieVerificationStatus: status,
            selfieRejectionReason: status === "REJECTED" ? selfieRejectReason.trim() : "",
          },
        } : prev);
        setSelfieShowRejectBox(false);
        setSelfieRejectReason("");
      }
    } catch {
      setSelfieError("Failed to update selfie verification. Please try again.");
    } finally {
      setSelfieVerifying(false);
    }
  };

  const handleGenderChange = async (gender: string) => {
    if (!gender) return;
    setGenderSaving(true);
    try {
      const res = await api.patch<any>(`/partners/${partnerId}/gender`, { gender });
      if (res.success) {
        setData((prev) => prev ? { ...prev, partner: { ...prev.partner, gender } } : prev);
      } else {
        alert(res.error?.message || "Failed to update gender");
      }
    } finally {
      setGenderSaving(false);
    }
  };

<<<<<<< HEAD
=======
  const [windowSaving, setWindowSaving] = useState(false);
  const handleBookingWindowChange = async (patch: { minLeadDays?: number; availableFrom?: string | null }) => {
    setWindowSaving(true);
    try {
      const res = await api.patch<any>(`/partners/${partnerId}/booking-window`, patch);
      if (res.success) {
        setData((prev) => prev ? { ...prev, partner: { ...prev.partner, ...res.data } } : prev);
      } else {
        alert(res.error?.message || "Failed to update booking window");
      }
    } finally {
      setWindowSaving(false);
    }
  };

>>>>>>> 073e824 (Upgrade admin)
  const handleSkillTierChange = async (skillTier: number) => {
    setTierSaving(true);
    try {
      const res = await api.patch<any>(`/partners/${partnerId}/skill-tier`, { skillTier });
      if (res.success) {
        setData((prev) => prev ? { ...prev, partner: { ...prev.partner, skillTier } } : prev);
      } else {
        alert(res.error?.message || "Failed to update skill tier");
      }
    } finally {
      setTierSaving(false);
    }
  };

  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const res = await api.get<any>(`/partners/${partnerId}/location`);
      if (res.success) setLocation(res.data);
    } finally {
      setLocationLoading(false);
    }
  };

  const p = data?.partner;
  const s = data?.stats;
  const partnerCats: string[] = (p?.serviceCategories || []).map((c: string) => String(c).toLowerCase());
  const partnerIsAC = partnerCats.some((c) => /(^|[^a-z])ac([^a-z]|$)|air.?con/.test(c));
  const partnerIsSalon = partnerCats.some((c) => /salon|hair studio|makeup|self.?care/.test(c));

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 298, background: "rgba(0,0,0,0.35)" }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 299,
        width: "min(560px, 95vw)", background: "var(--panel)",
        boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
        display: "flex", flexDirection: "column", overflowY: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", background: "var(--panel-alt)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              {loading ? (
                <div style={{ color: "var(--muted-2)" }}>Loading…</div>
              ) : (
                <>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>{p?.name || "Partner"}</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>
                    {p?.phone} {p?.email ? `· ${p.email}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px",
                      background: p?.isOnline ? "var(--success-bg)" : "var(--panel-alt)",
                      color: p?.isOnline ? "#16a34a" : "var(--muted)",
                    }}>
                      {p?.isOnline ? "● Online" : "○ Offline"}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px",
                      background: "var(--panel-alt)", color: statusColor(p?.isBlocked ? "BLOCKED" : p?.approvalStatus),
                    }}>
                      {p?.isBlocked ? "BLOCKED" : p?.approvalStatus}
                    </span>
                    {p?.plan && (
                      <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px", background: "var(--purple-bg)", color: "#7c3aed" }}>
                        {p.plan.toUpperCase()}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--muted)", lineHeight: 1 }}
            >×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
          {!loading && s && (
            <>
              {/* ── Stats grid ── */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                {[
                  { label: "Total Jobs", value: s.totalJobs, color: "var(--text)" },
                  { label: "Pending Jobs", value: s.pendingJobs, color: "#d97706" },
                  { label: "Completed", value: s.completedJobs, color: "#16a34a" },
                  { label: "Total Earnings", value: currency.format(s.totalEarnings), color: "var(--text)" },
                  { label: "Wallet Balance", value: currency.format(s.walletBalance), color: "#2563eb" },
                  { label: "Commission", value: `${p?.commissionPercent ?? 20}%`, color: "var(--muted)" },
                ].map((item) => (
                  <div key={item.label} style={{
                    background: "var(--panel-alt)", borderRadius: 8, padding: "12px 14px",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ fontSize: 11, color: "var(--muted-2)", fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* ── Partner info ── */}
              <div style={{ marginBottom: 20, background: "var(--panel-alt)", borderRadius: 8, border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-2)" }}>Partner Info</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
                  <div><span style={{ color: "var(--muted-2)" }}>Pincode: </span>{p?.currentPincode || "—"}</div>
                  <div><span style={{ color: "var(--muted-2)" }}>Rating: </span>★ {p?.rating?.toFixed(2)}</div>
                  <div><span style={{ color: "var(--muted-2)" }}>Active Jobs: </span>{p?.activeJobs}/{p?.maxJobsLimit}</div>
                  <div><span style={{ color: "var(--muted-2)" }}>Service Areas: </span>{p?.serviceAreas?.join(", ") || "—"}</div>
                  <div><span style={{ color: "var(--muted-2)" }}>Services: </span>{p?.serviceCategories?.join(", ") || "—"}</div>
                  <div>
                    <span style={{ color: "var(--muted-2)" }}>Gender: </span>
                    <select
                      className="input"
                      title="Women-only / men-only categories match partners on this"
                      style={{ height: 24, fontSize: 12, padding: "0 4px", width: "auto" }}
                      value={p?.gender || ""}
                      disabled={genderSaving}
                      onChange={(e) => handleGenderChange(e.target.value)}
                    >
                      <option value="" disabled>Not set</option>
                      <option value="FEMALE">Female</option>
                      <option value="MALE">Male</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <span style={{ color: "var(--muted-2)" }}>Skill Tier: </span>
                    {partnerIsAC || partnerIsSalon ? (
                      <select
                        className="input"
                        title="Tier-2 services are only assigned to tier-2 partners"
                        style={{ height: 24, fontSize: 12, padding: "0 4px", width: "auto" }}
                        value={p?.skillTier === 2 ? "2" : "1"}
                        disabled={tierSaving}
                        onChange={(e) => handleSkillTierChange(Number(e.target.value))}
                      >
                        <option value="1">{partnerIsAC ? "Non-Technician" : "Beautician"}</option>
                        <option value="2">{partnerIsAC ? "Technician" : "Senior beautician"}</option>
                      </select>
                    ) : "—"}
<<<<<<< HEAD
=======
                  </div>
                  <div>
                    <span style={{ color: "var(--muted-2)" }}>Bookable from: </span>
                    <select
                      className="input"
                      title="Minimum notice before this partner can be booked"
                      style={{ height: 24, fontSize: 12, padding: "0 4px", width: "auto" }}
                      value={String(p?.minLeadDays || 0)}
                      disabled={windowSaving}
                      onChange={(e) => handleBookingWindowChange({ minLeadDays: Number(e.target.value) })}
                    >
                      <option value="0">Same day</option>
                      <option value="1">Next day or later</option>
                      <option value="2">2 days ahead</option>
                      <option value="3">3 days ahead</option>
                      <option value="7">1 week ahead</option>
                    </select>
                    {" · not before "}
                    <input
                      type="date"
                      className="input"
                      style={{ height: 24, fontSize: 12, padding: "0 4px", width: "auto" }}
                      value={p?.availableFrom ? String(p.availableFrom).slice(0, 10) : ""}
                      disabled={windowSaving}
                      onChange={(e) => handleBookingWindowChange({ availableFrom: e.target.value || null })}
                    />
>>>>>>> 073e824 (Upgrade admin)
                  </div>
                  <div><span style={{ color: "var(--muted-2)" }}>Subscription: </span>{p?.subscriptionActive ? "Active" : "Inactive"}</div>
                </div>
                {(p?.serviceCategories || []).some((c: string) => String(c).toLowerCase().includes("mehendi")) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "var(--muted-2)", fontSize: 12, marginBottom: 6 }}>Mehendi Specializations</div>
                    {(p?.mehendiSpecializations || []).length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(p.mehendiSpecializations as string[]).map((s: string) => (
                          <span
                            key={s}
                            style={{
                              background: "var(--purple-bg)",
                              color: "var(--purple-text)",
                              border: "1px solid var(--purple-border)",
                              borderRadius: 20,
                              padding: "2px 10px",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--muted-2)" }}>Not specified</span>
                    )}
                  </div>
                )}
                {(p?.services || []).length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ color: "var(--muted-2)", fontSize: 12, marginBottom: 6 }}>
                      Selected Services ({p.services.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(p.services as any[]).map((sv: any) => (
                        <span
                          key={sv.serviceId || sv._id || sv.name}
                          style={{
                            background: "var(--accent-50)",
                            color: "var(--accent-dark)",
                            border: "1px solid var(--accent-border)",
                            borderRadius: 20,
                            padding: "2px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            opacity: sv.isActive === false ? 0.5 : 1,
                          }}
                          title={sv.isActive === false ? "Inactive service" : undefined}
                        >
                          {sv.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Selfie Verification ── */}
              <div style={{ marginBottom: 20, background: "var(--panel-alt)", borderRadius: 8, border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-2)" }}>Selfie Verification</div>
                  {p?.selfieVerificationStatus && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 8px",
                      background: p.selfieVerificationStatus === "APPROVED" ? "var(--success-bg)" : p.selfieVerificationStatus === "REJECTED" ? "var(--danger-bg)" : "var(--warning-bg)",
                      color: p.selfieVerificationStatus === "APPROVED" ? "#16a34a" : p.selfieVerificationStatus === "REJECTED" ? "#dc2626" : "#d97706",
                    }}>
                      {p.selfieVerificationStatus}
                    </span>
                  )}
                </div>
                {!p?.selfieUrl ? (
                  <div style={{ fontSize: 13, color: "var(--muted-2)" }}>No selfie uploaded yet.</div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 12 }}>
                      <img
                        src={p.selfieUrl}
                        alt="Partner selfie"
                        style={{
                          width: 96, height: 96, objectFit: "cover",
                          borderRadius: 8, border: "2px solid var(--border)",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ fontSize: 13, flex: 1 }}>
                        <div style={{ marginBottom: 4 }}><span style={{ color: "var(--muted-2)" }}>Name: </span>{p.name}</div>
                        <div style={{ marginBottom: 4 }}><span style={{ color: "var(--muted-2)" }}>Phone: </span>{p.phone}</div>
                        {p.selfieVerificationStatus === "REJECTED" && p.selfieRejectionReason && (
                          <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                            Rejected: {p.selfieRejectionReason}
                          </div>
                        )}
                      </div>
                    </div>
                    {p.selfieVerificationStatus !== "APPROVED" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {!selfieShowRejectBox ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="button"
                              style={{ fontSize: 12, padding: "5px 14px", background: "#16a34a", borderColor: "#16a34a" }}
                              onClick={() => handleSelfieVerify("APPROVED")}
                              disabled={selfieVerifying}
                            >
                              {selfieVerifying ? "Saving…" : "✓ Approve"}
                            </button>
                            <button
                              className="button secondary"
                              style={{ fontSize: 12, padding: "5px 14px", color: "#dc2626", borderColor: "#dc2626" }}
                              onClick={() => setSelfieShowRejectBox(true)}
                              disabled={selfieVerifying}
                            >
                              ✗ Reject
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <textarea
                              className="input"
                              rows={2}
                              placeholder="Rejection reason (required)…"
                              value={selfieRejectReason}
                              onChange={(e) => setSelfieRejectReason(e.target.value)}
                              style={{ width: "100%", resize: "vertical", fontSize: 13 }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                className="button"
                                style={{ fontSize: 12, padding: "5px 14px", background: "#dc2626", borderColor: "#dc2626" }}
                                onClick={() => handleSelfieVerify("REJECTED")}
                                disabled={selfieVerifying}
                              >
                                {selfieVerifying ? "Saving…" : "Confirm Reject"}
                              </button>
                              <button
                                className="button secondary"
                                style={{ fontSize: 12, padding: "5px 14px" }}
                                onClick={() => { setSelfieShowRejectBox(false); setSelfieRejectReason(""); setSelfieError(""); }}
                                disabled={selfieVerifying}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                        {selfieError && <div style={{ color: "#dc2626", fontSize: 12 }}>{selfieError}</div>}
                      </div>
                    )}
                    {p.selfieVerificationStatus === "APPROVED" && (
                      <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ Selfie verified</div>
                    )}
                  </>
                )}
              </div>

              {/* ── Hub Assignment ── */}
              <div style={{ marginBottom: 20, background: "var(--panel-alt)", borderRadius: 8, border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-2)" }}>Hub</div>
                  <button
                    className="button secondary"
                    style={{ fontSize: 12, padding: "4px 12px" }}
                    onClick={() => setShowHubModal(true)}
                  >
                    {p?.assignedHubId ? "Change Hub" : "Assign Hub"}
                  </button>
                </div>
                {p?.assignedHubId ? (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>⬡</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {p.assignedHubId?.name || "Hub"}
                          {p.assignedHubId?.city ? <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {p.assignedHubId.city}</span> : null}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--success-text)", marginTop: 2, fontWeight: 600 }}>
                          ● Hub assigned
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "var(--warning-text)", display: "flex", alignItems: "center", gap: 6 }}>
                    <span>⚠</span>
                    <span>No hub assigned — partner won't appear in hub-based assignment</span>
                  </div>
                )}
              </div>

              {/* ── Live Location ── */}
              <div style={{ marginBottom: 20, background: "var(--panel-alt)", borderRadius: 8, border: "1px solid var(--border)", padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-2)" }}>Live Location</div>
                  <button
                    className="button secondary"
                    style={{ fontSize: 12, padding: "4px 12px" }}
                    onClick={fetchLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? "Fetching…" : location ? "Refresh" : "Fetch Location"}
                  </button>
                </div>
                {!location ? (
                  <div style={{ fontSize: 13, color: "var(--muted-2)" }}>
                    Location is fetched on demand only — click "Fetch Location" to view.
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: "var(--muted-2)" }}>Status: </span>
                      <span style={{ color: location.isOnline ? "#16a34a" : "var(--muted)", fontWeight: 600 }}>
                        {location.isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: "var(--muted-2)" }}>Address: </span>
                      {location.currentAddress || "—"}
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ color: "var(--muted-2)" }}>Pincode: </span>{location.currentPincode || "—"}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: "var(--muted-2)" }}>Last updated: </span>{fmtDate(location.lastLocationAt)}
                    </div>
                    {location.location?.coordinates && (
                      <a
                        href={`https://maps.google.com/?q=${location.location.coordinates[1]},${location.location.coordinates[0]}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb", fontSize: 13, fontWeight: 600 }}
                      >
                        View on Google Maps →
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* ── Active Bookings ── */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-2)", marginBottom: 10 }}>
                  Active Bookings ({data?.activeBookings?.length || 0})
                </div>
                {(!data?.activeBookings || data.activeBookings.length === 0) ? (
                  <div style={{ fontSize: 13, color: "var(--muted-2)" }}>No active bookings.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.activeBookings.map((bk: any) => (
                      <div key={bk._id} style={{
                        border: "1px solid var(--border)", borderRadius: 8,
                        padding: "12px 14px", background: "var(--panel)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              #{bk.bookingNumber}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                              {fmtDate(bk.scheduledDate)} {bk.scheduledTime ? `· ${bk.scheduledTime}` : ""}
                              {bk.pincode ? ` · Pincode ${bk.pincode}` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                              {bk.services?.map((sv: any) => sv.name).join(", ") || "—"}
                              {bk.totalAmount ? ` · ${currency.format(bk.totalAmount)}` : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px",
                              background: "var(--panel-alt)", color: bookingStatusColor(bk.status),
                            }}>
                              {bk.status}
                            </span>
                            <button
                              className="button secondary"
                              style={{ fontSize: 11, padding: "4px 10px" }}
                              onClick={() => setReassignBooking(bk)}
                            >
                              Reassign
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reassign modal */}
      {reassignBooking && (
        <ReassignModal
          api={api}
          booking={reassignBooking}
          onClose={() => setReassignBooking(null)}
          onDone={() => {
            setReassignBooking(null);
            api.get<any>(`/partners/${partnerId}/stats`).then((res) => {
              if (res.success) setData(res.data);
            });
          }}
        />
      )}

      {/* Hub assignment modal */}
      {showHubModal && p && (
        <AssignHubModal
          api={api}
          partner={{
            id: String(p._id),
            name: p.name,
            assignedHubId: p.assignedHubId?._id || p.assignedHubId || null,
            location: p.location,
            serviceCategoryNames: Array.isArray(p.serviceCategories)
              ? (p.serviceCategories as string[])
              : p.serviceCategories
                ? [String(p.serviceCategories)]
                : [],
          }}
          onClose={() => setShowHubModal(false)}
          onSaved={(hub) => {
            // Update local state without a full reload
            setData((prev) =>
              prev
                ? { ...prev, partner: { ...prev.partner, assignedHubId: hub ? { _id: hub.id, name: hub.name } : null } }
                : prev
            );
          }}
        />
      )}
    </>
  );
}

// ─── Partners Page ────────────────────────────────────────────────────────────
export default function PartnersPage({ api }: { api: ApiClient }) {
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  // Applied on Enter / Search, not on every keystroke (see BookingsPage).
  const [query, setQuery] = useState("");
  const latestFetch = useRef(0);
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [commissionDraft, setCommissionDraft] = useState<Record<string, string>>({});
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const fetchRows = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (query) params.set("q", query);
    const fetchId = ++latestFetch.current;
    const res = await api.get<any>(`/partners?${params.toString()}`);
    if (fetchId !== latestFetch.current) return; // answer to an older filter
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, status, query]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  const applySearch = () => {
    const next = search.trim();
    if (next === query) fetchRows(1);
    else setQuery(next);
  };

  const updateApproval = async (id: string, next: string) => {
    const res = await api.patch(`/partners/${id}/approval`, { status: next });
    if (!res.success) { alert(res.error?.message || "Failed to update partner"); return; }
    fetchRows(meta.pagination?.page || 1);
  };

  // KYC is manual for now: approving is what marks the partner's KYC as
  // verified (verificationStatus → VERIFIED), so confirm the ID was checked.
  const approvePartner = (id: string, name: string) => {
    if (!window.confirm(`Approve ${name}? This also marks their KYC as verified — approve only after checking one government ID (Aadhaar, PAN, voter ID or driving licence).`)) {
      return;
    }
    updateApproval(id, "APPROVED");
  };

  const updateStatus = async (id: string, next: string) => {
    const res = await api.patch(`/partners/${id}/status`, { status: next });
    if (!res.success) { alert(res.error?.message || "Failed to update partner"); return; }
    fetchRows(meta.pagination?.page || 1);
  };

  const updateCommission = async (id: string) => {
    const value = Number(commissionDraft[id]);
    if (!Number.isFinite(value)) return;
    const res = await api.patch(`/partners/${id}/commission`, { commissionPercent: value });
    if (!res.success) { alert(res.error?.message || "Failed to update commission"); return; }
    fetchRows(meta.pagination?.page || 1);
  };

  const updateSubscription = async (id: string, subscriptionActive: boolean) => {
    const res = await api.patch(`/partners/${id}/subscription`, { subscriptionActive });
    if (!res.success) { alert(res.error?.message || "Failed to update subscription"); return; }
    fetchRows(meta.pagination?.page || 1);
  };

  // Delete keeps the partner's bookings, wallet and payout history: the account
  // is anonymised and closed, and the phone number is freed. The server refuses
  // while the partner still has wallet money or a pending withdrawal.
  const deletePartner = async (row: PartnerRow) => {
    const confirmed = window.confirm(
      `Delete partner ${row.name || row.phone}?\n\nThis closes the partner account for good. Their booking and wallet history is kept, and the same phone number can sign up again.`
    );
    if (!confirmed) return;

    const res = await api.delete(`/partners/${row.id}`);
    if (res.success) {
      if (selectedPartnerId === row.id) setSelectedPartnerId(null);
      fetchRows(meta.pagination?.page || 1);
      return;
    }

    if (res.error?.code === "PARTNER_HAS_ACTIVE_BOOKINGS") {
      const activeCount = (res.meta as any)?.activeBookings ?? "some";
      const choice = window.confirm(
        `This partner has ${activeCount} active booking(s).\n\n` +
        `OK  → Unassign active bookings (send back to Searching) then delete partner.\n\n` +
        `Cancel → Abort.`
      );
      if (!choice) return;

      const forceRes = await api.delete(`/partners/${row.id}?force=true`);
      if (!forceRes.success) {
        alert(forceRes.error?.message || "Delete failed");
        return;
      }

      if (selectedPartnerId === row.id) setSelectedPartnerId(null);
      fetchRows(meta.pagination?.page || 1);
      return;
    }

    alert(res.error?.message || "Failed to delete partner");
  };

  return (
    <>
      <div className="section">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <input
              className="input"
              style={{ flex: "1 1 240px", minWidth: 200 }}
              placeholder="Search by name, phone or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Partners</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="BLOCKED">Blocked</option>
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
              <th>Name</th>
              <th>Phone</th>
              <th>Service</th>
              <th>Pincode</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Pending</th>
              <th>Completed</th>
              <th>Earnings</th>
              <th>Commission %</th>
              <th>Sub</th>
              <th>Online</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    onClick={() => setSelectedPartnerId(row.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontWeight: 600, textDecoration: "underline", padding: 0, fontSize: 14 }}
                  >
                    {row.name || "—"}
                  </button>
                </td>
                <td>{row.phone}</td>
                <td>
                  {row.serviceCategory || "—"}
                  {String(row.serviceCategory || "").toLowerCase().includes("ac") && (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                      {" · "}{row.skillTier === 2 ? "Technician" : "Non-Technician"}
                    </span>
                  )}
                  <span style={{ color: row.gender ? "var(--muted)" : "#d97706", fontSize: 12 }}>
                    {" · "}{genderLabel(row.gender)}
                  </span>
                </td>
                <td>{row.pincode || "—"}</td>
                <td>
                  <span style={{
                    fontSize: 11, fontWeight: 700, borderRadius: 4, padding: "2px 7px",
                    background: "var(--panel-alt)", color: statusColor(row.status),
                  }}>
                    {row.status}
                  </span>
                </td>
                <td>★ {row.rating?.toFixed(1)}</td>
                <td>
                  <span style={{
                    fontWeight: 700, fontSize: 13,
                    color: row.pendingJobs >= row.maxJobsLimit ? "#dc2626" : row.pendingJobs > 0 ? "#d97706" : "var(--muted)",
                  }}>
                    {row.pendingJobs}/{row.maxJobsLimit}
                  </span>
                </td>
                <td>{row.completedJobs}</td>
                <td>{currency.format(row.totalEarnings || 0)}</td>
                <td>
                  <div className="row">
                    <input
                      className="input"
                      style={{ width: 58 }}
                      value={commissionDraft[row.id] ?? row.commissionPercent}
                      onChange={(e) => setCommissionDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                    <button className="button secondary" style={{ fontSize: 12 }} onClick={() => updateCommission(row.id)}>Save</button>
                  </div>
                </td>
                <td>
                  <button
                    className="button secondary"
                    style={{ fontSize: 12 }}
                    onClick={() => updateSubscription(row.id, !row.subscriptionActive)}
                  >
                    {row.subscriptionActive ? "Active" : "Off"}
                  </button>
                </td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.isOnline ? "#16a34a" : "var(--border-strong)", display: "inline-block" }} />
                    {row.isOnline ? "Online" : "Offline"}
                  </span>
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    <button className="button success" style={{ fontSize: 11 }} title="Approving also marks the partner's KYC as verified" onClick={() => approvePartner(row.id, row.name)}>Approve</button>
                    <button className="button warning" style={{ fontSize: 11 }} onClick={() => updateApproval(row.id, "REJECTED")}>Reject</button>
                    <button className="button danger" style={{ fontSize: 11 }} onClick={() => updateStatus(row.id, "BLOCKED")}>Block</button>
                    <button
                      className="button secondary"
                      style={{ fontSize: 11 }}
                      onClick={() => setSelectedPartnerId(row.id)}
                      title="Open partner details to assign / change hub"
                    >
                      Hub
                    </button>
                    <button
                      className="button"
                      style={{ fontSize: 11, background: "var(--text)" }}
                      onClick={() => setSelectedPartnerId(row.id)}
                    >
                      Details
                    </button>
                    <button
                      className="button danger"
                      style={{ fontSize: 11 }}
                      onClick={() => deletePartner(row)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>

      {/* Detail panel — rendered outside table to avoid stacking issues */}
      {selectedPartnerId && (
        <PartnerDetailPanel
          api={api}
          partnerId={selectedPartnerId}
          onClose={() => setSelectedPartnerId(null)}
        />
      )}
    </>
  );
}
