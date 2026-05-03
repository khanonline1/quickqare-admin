import React, { useState, useEffect, useCallback } from "react";
import type { ApiClient } from "../api/adminApi";

interface Complaint {
  id: string;
  orderId: string;
  issueType: string;
  description: string;
  status: string;
  refundAmount: number;
  reServiceScheduled: boolean;
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
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const STATUS_TAG_CLASS: Record<string, string> = {
  SUBMITTED: "tag tag-info",
  UNDER_REVIEW: "tag tag-purple",
  IN_PROGRESS: "tag tag-orange",
  RESOLVED: "tag tag-active",
  CLOSED: "tag tag-closed",
};

const formatIssueType = (type: string) =>
  type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());

export default function ComplaintsPage({
  api,
  onNavigateToDetails,
}: {
  api: ApiClient;
  onNavigateToDetails?: (id: string) => void;
}) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchComplaints = useCallback(
    async (p = 1) => {
      if (p === 1) setLoading(true);
      setError(null);
      try {
        const params: Record<string, string> = { page: p.toString(), limit: "20" };
        if (statusFilter) params.status = statusFilter;

        const res = (await api.getComplaints(params)) as any;
        const newComplaints: Complaint[] = res.data?.complaints ?? res.data ?? [];

        if (p === 1) {
          setComplaints(newComplaints);
        } else {
          setComplaints((prev) => [...prev, ...newComplaints]);
        }
        setHasMore(newComplaints.length === 20);
      } catch (err) {
        setError("Failed to load complaints. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [api, statusFilter]
  );

  useEffect(() => {
    setPage(1);
    fetchComplaints(1);
  }, [statusFilter]);

  const updateStatus = async (id: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.updateComplaintStatus(id, {
        status: newStatus,
        notes: `Status updated to ${newStatus}`,
      });
      setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)));
    } catch {
      setError("Failed to update status.");
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchComplaints(next);
  };

  const filtered = complaints.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.user.name.toLowerCase().includes(q) ||
      c.user.phone.includes(q) ||
      (c.order?.serviceName || "").toLowerCase().includes(q) ||
      c.issueType.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="section">
        <div className="filter-bar">
          <input
            className="input"
            placeholder="Search by name, phone, service or issue type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: 420 }}
          />
          <div className="tag-filter">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`filter-pill${statusFilter === opt.value ? " active" : ""}`}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && page === 1 ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          Loading complaints...
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="40" height="40" strokeWidth="1.5" style={{ color: "var(--muted-2)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          No complaints found.
        </div>
      ) : (
        <div className="complaint-list">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="complaint-card"
              onClick={() => onNavigateToDetails?.(c.id)}
            >
              <div className="complaint-card-header">
                <div>
                  <div className="complaint-user-name">{c.user.name}</div>
                  <div className="complaint-user-phone">{c.user.phone}</div>
                </div>
                <span className={STATUS_TAG_CLASS[c.status] || "tag"}>
                  {c.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="complaint-service">{c.order?.serviceName || "—"}</div>
              <div className="complaint-issue">{formatIssueType(c.issueType)}</div>
              <p className="complaint-desc">{c.description}</p>

              <div className="complaint-card-footer">
                <span className="muted">{new Date(c.createdAt).toLocaleDateString("en-IN")}</span>
                <div className="row">
                  {c.status === "SUBMITTED" && (
                    <button className="button sm" onClick={(e) => updateStatus(c.id, "UNDER_REVIEW", e)}>
                      Review
                    </button>
                  )}
                  {c.status === "UNDER_REVIEW" && (
                    <button className="button sm" onClick={(e) => updateStatus(c.id, "IN_PROGRESS", e)}>
                      Start
                    </button>
                  )}
                  {c.status === "IN_PROGRESS" && (
                    <button className="button success sm" onClick={(e) => updateStatus(c.id, "RESOLVED", e)}>
                      Resolve
                    </button>
                  )}
                  {(c.status === "RESOLVED" || c.status === "IN_PROGRESS") && (
                    <button className="button secondary sm" onClick={(e) => updateStatus(c.id, "CLOSED", e)}>
                      Close
                    </button>
                  )}
                  <button
                    className="button secondary sm"
                    onClick={(e) => { e.stopPropagation(); onNavigateToDetails?.(c.id); }}
                  >
                    Details →
                  </button>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <button
              className="button secondary"
              style={{ width: "100%", marginTop: 4 }}
              onClick={loadMore}
            >
              Load More
            </button>
          )}
        </div>
      )}
    </>
  );
}
