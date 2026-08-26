import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

type Lead = {
  _id: string;
  name: string;
  phone: string;
  status: "NEW" | "CONTACTED" | "CONVERTED" | "REJECTED";
  notes: string;
  createdAt: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "CONVERTED", label: "Converted" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_TAG_CLASS: Record<string, string> = {
  NEW: "tag tag-info",
  CONTACTED: "tag tag-orange",
  CONVERTED: "tag tag-active",
  REJECTED: "tag tag-closed",
};

export default function PartnerLeadsPage({ api }: { api: ApiClient }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (statusFilter) params.status = statusFilter;
      const res = (await api.get<{ leads: Lead[] }>(`/partner-leads?${new URLSearchParams(params)}`)) as any;
      setLeads(res.data?.leads ?? []);
    } catch {
      setError("Failed to load leads. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const updateStatus = async (id: string, status: Lead["status"]) => {
    try {
      await api.patch(`/partner-leads/${id}/status`, { status });
      setLeads((prev) => prev.map((l) => (l._id === id ? { ...l, status } : l)));
    } catch {
      setError("Failed to update status.");
    }
  };

  return (
    <div className="section">
      <h3>Professional Leads</h3>
      <p className="muted">
        Phone numbers left on the public "Register as a Professional" web page. Call them back and update the status below.
      </p>

      <div className="filter-bar" style={{ marginTop: 16, marginBottom: 16 }}>
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

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          Loading leads...
        </div>
      ) : leads.length === 0 ? (
        <div className="empty-state">No leads found.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Submitted</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead._id}>
                <td>{lead.name || <span className="muted">—</span>}</td>
                <td>
                  <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                </td>
                <td className="muted">{new Date(lead.createdAt).toLocaleString("en-IN")}</td>
                <td>
                  <span className={STATUS_TAG_CLASS[lead.status] || "tag"}>{lead.status}</span>
                </td>
                <td>
                  <div className="row" style={{ gap: 6 }}>
                    {lead.status === "NEW" && (
                      <button className="button sm" onClick={() => updateStatus(lead._id, "CONTACTED")}>
                        Mark Contacted
                      </button>
                    )}
                    {lead.status === "CONTACTED" && (
                      <>
                        <button className="button success sm" onClick={() => updateStatus(lead._id, "CONVERTED")}>
                          Converted
                        </button>
                        <button className="button secondary sm" onClick={() => updateStatus(lead._id, "REJECTED")}>
                          Not Interested
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
