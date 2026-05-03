import React, { useState, useEffect } from "react";
import type { ApiClient } from "../api/adminApi";

interface TimelineEntry {
  id: string;
  status: string;
  notes: string;
  adminId: string;
  adminName: string;
  createdAt: string;
}

interface Complaint {
  id: string;
  orderId: string;
  issueType: string;
  description: string;
  status: string;
  resolution: string;
  refundAmount: number;
  reServiceScheduled: boolean;
  images: string[];
  createdAt: string;
  order: {
    serviceName: string;
    scheduledDate: string;
    status: string;
    totalAmount: number;
  };
  user: {
    name: string;
    phone: string;
    email: string;
  };
  timeline: TimelineEntry[];
}

const STATUS_TAG: Record<string, { cls: string; label: string }> = {
  SUBMITTED: { cls: "tag tag-info", label: "Submitted" },
  UNDER_REVIEW: { cls: "tag tag-purple", label: "Under Review" },
  IN_PROGRESS: { cls: "tag tag-orange", label: "In Progress" },
  RESOLVED: { cls: "tag tag-active", label: "Resolved" },
  CLOSED: { cls: "tag tag-closed", label: "Closed" },
};

const formatIssueType = (type: string) =>
  type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

export default function ComplaintDetailsPage({
  complaintId,
  api,
  onClose,
}: {
  complaintId: string;
  api: ApiClient;
  onClose: () => void;
}) {
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolution, setResolution] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [reServiceScheduled, setReServiceScheduled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = (await api.getComplaint(complaintId)) as any;
        setComplaint(res.data);
      } catch {
        setError("Failed to load complaint details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [complaintId, api]);

  const updateStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      await api.updateComplaintStatus(complaintId, {
        status: newStatus,
        notes: `Status updated to ${newStatus}`,
      });
      setComplaint((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch {
      setError("Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const resolveComplaint = async () => {
    setSaving(true);
    try {
      await api.resolveComplaint(complaintId, {
        resolution,
        refundAmount: refundAmount ? parseFloat(refundAmount) : undefined,
        reServiceScheduled,
      });
      setComplaint((prev) =>
        prev
          ? {
              ...prev,
              status: "RESOLVED",
              resolution,
              refundAmount: refundAmount ? parseFloat(refundAmount) : 0,
              reServiceScheduled,
            }
          : null
      );
      setShowResolveModal(false);
    } catch {
      setError("Failed to resolve complaint.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        Loading complaint details...
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="empty-state">
        {error || "Complaint not found."}
        <button className="button secondary" onClick={onClose}>
          ← Back to Complaints
        </button>
      </div>
    );
  }

  const statusInfo = STATUS_TAG[complaint.status] || { cls: "tag", label: complaint.status };

  return (
    <div className="complaint-details">
      {/* Header */}
      <div className="complaint-detail-header">
        <button className="button secondary" onClick={onClose}>
          ← Back to Complaints
        </button>
        <div className="row">
          <span className={statusInfo.cls}>{statusInfo.label}</span>
          <span className="muted" style={{ fontSize: 12 }}>
            #{complaint.id?.slice(-8).toUpperCase()}
          </span>
        </div>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Info grid */}
      <div className="detail-grid" style={{ marginBottom: 16 }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <h3>Customer</h3>
          <dl className="info-list">
            <div className="info-row">
              <dt>Name</dt>
              <dd>{complaint.user.name}</dd>
            </div>
            <div className="info-row">
              <dt>Phone</dt>
              <dd>{complaint.user.phone}</dd>
            </div>
            <div className="info-row">
              <dt>Email</dt>
              <dd>{complaint.user.email || "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="section" style={{ marginBottom: 0 }}>
          <h3>Order</h3>
          <dl className="info-list">
            <div className="info-row">
              <dt>Service</dt>
              <dd>{complaint.order?.serviceName || "—"}</dd>
            </div>
            <div className="info-row">
              <dt>Scheduled</dt>
              <dd>
                {complaint.order?.scheduledDate
                  ? new Date(complaint.order.scheduledDate).toLocaleDateString("en-IN")
                  : "—"}
              </dd>
            </div>
            <div className="info-row">
              <dt>Order Status</dt>
              <dd>{complaint.order?.status || "—"}</dd>
            </div>
            <div className="info-row">
              <dt>Amount</dt>
              <dd>₹{complaint.order?.totalAmount ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Complaint Details */}
      <div className="section">
        <h3>Complaint Details</h3>
        <dl className="info-list" style={{ marginBottom: 14 }}>
          <div className="info-row">
            <dt>Issue Type</dt>
            <dd>{formatIssueType(complaint.issueType)}</dd>
          </div>
          <div className="info-row">
            <dt>Submitted</dt>
            <dd>{new Date(complaint.createdAt).toLocaleString("en-IN")}</dd>
          </div>
        </dl>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 8,
            }}
          >
            Description
          </div>
          <p style={{ lineHeight: 1.65, color: "var(--text-2)" }}>{complaint.description}</p>
        </div>
      </div>

      {/* Resolution */}
      {complaint.resolution && (
        <div className="section">
          <h3>Resolution</h3>
          <p style={{ lineHeight: 1.65, marginBottom: complaint.refundAmount > 0 ? 12 : 0 }}>
            {complaint.resolution}
          </p>
          {complaint.refundAmount > 0 && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "var(--success-bg)",
                border: "1px solid var(--success-border)",
                borderRadius: "var(--radius-full)",
                color: "var(--success-text)",
                fontSize: 13,
                fontWeight: 500,
                marginTop: 8,
                marginRight: 8,
              }}
            >
              Refund: ₹{complaint.refundAmount}
            </div>
          )}
          {complaint.reServiceScheduled && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                background: "var(--accent-100)",
                border: "1px solid var(--accent-border)",
                borderRadius: "var(--radius-full)",
                color: "var(--accent-dark)",
                fontSize: 13,
                fontWeight: 500,
                marginTop: 8,
              }}
            >
              Re-service scheduled
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="section">
        <h3>Status Timeline</h3>
        {(complaint.timeline || []).length === 0 ? (
          <p className="muted">No timeline entries yet.</p>
        ) : (
          <div className="timeline">
            {complaint.timeline.map((entry) => (
              <div key={entry.id} className="timeline-entry">
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <div className="timeline-status">{entry.status.replace(/_/g, " ")}</div>
                  {entry.notes && <div className="timeline-notes">{entry.notes}</div>}
                  <div className="muted" style={{ fontSize: 12 }}>
                    {entry.adminName} · {new Date(entry.createdAt).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="section">
        <h3>Actions</h3>
        <div className="row">
          {complaint.status === "SUBMITTED" && (
            <button className="button" onClick={() => updateStatus("UNDER_REVIEW")} disabled={saving}>
              Start Review
            </button>
          )}
          {complaint.status === "UNDER_REVIEW" && (
            <button className="button" onClick={() => updateStatus("IN_PROGRESS")} disabled={saving}>
              Start Progress
            </button>
          )}
          {complaint.status === "IN_PROGRESS" && (
            <button className="button success" onClick={() => setShowResolveModal(true)} disabled={saving}>
              Resolve Complaint
            </button>
          )}
          {(complaint.status === "RESOLVED" || complaint.status === "IN_PROGRESS") && (
            <button className="button secondary" onClick={() => updateStatus("CLOSED")} disabled={saving}>
              Close
            </button>
          )}
          {["SUBMITTED", "UNDER_REVIEW", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(complaint.status) === false && (
            <p className="muted">No actions available for this status.</p>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Resolve Complaint</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="form-group">
                <label>Resolution Details</label>
                <textarea
                  className="input"
                  style={{ width: "100%", minHeight: 110, resize: "vertical" }}
                  placeholder="Describe how the complaint was resolved..."
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Refund Amount (₹) — optional</label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  type="number"
                  min="0"
                  placeholder="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>

              <label className="checkbox-row" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={reServiceScheduled}
                  onChange={(e) => setReServiceScheduled(e.target.checked)}
                />
                <span className="checkbox-label">Schedule re-service for customer</span>
              </label>
            </div>

            <div className="modal-actions">
              <button className="button secondary" onClick={() => setShowResolveModal(false)}>
                Cancel
              </button>
              <button className="button success" onClick={resolveComplaint} disabled={saving || !resolution.trim()}>
                {saving ? "Saving..." : "Confirm Resolution"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
