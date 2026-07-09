import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import Pagination from "../components/Pagination";

type Relationship = {
  id: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "REMOVED";
  technicianId: string | null;
  technicianName: string;
  technicianPhone: string;
  helperId: string | null;
  helperName: string;
  helperPhone: string;
  invitedAt?: string;
  respondedAt?: string;
  removedAt?: string;
};

type Technician = { id: string; name: string; phone: string; skillTier: number };

const STATUS_FILTERS = ["ALL", "ACTIVE", "PENDING", "REJECTED", "REMOVED"] as const;

const STATUS_TAG: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "var(--success-bg)", color: "var(--success-text)" },
  PENDING: { bg: "var(--warning-bg)", color: "var(--warning-text)" },
  REJECTED: { bg: "var(--danger-bg)", color: "var(--danger-text)" },
  REMOVED: { bg: "var(--panel-alt)", color: "var(--text-2)" },
};

const fmtDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : "-";

export default function HelpersPage({ api }: { api: ApiClient }) {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("ALL");
  const [rows, setRows] = useState<Relationship[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [reassign, setReassign] = useState<Relationship | null>(null);
  const [reassignTarget, setReassignTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fetchRows = useCallback(
    async (page = 1) => {
      const statusQuery = statusFilter === "ALL" ? "" : `&status=${statusFilter}`;
      const res = await api.get<Relationship[]>(
        `/technician-helpers?page=${page}${statusQuery}`
      );
      if (res.success) {
        setRows(res.data || []);
        setMeta(res.meta);
        setError("");
      } else {
        setRows([]);
        setError(res.error?.message || "Unable to load helper relationships.");
      }
    },
    [api, statusFilter]
  );

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  useEffect(() => {
    api.get<Technician[]>(`/partners?pageSize=100`).then((res) => {
      if (res.success) {
        setTechnicians((res.data || []).filter((p) => p.skillTier === 2));
      }
    });
  }, [api]);

  const removeRow = async (row: Relationship) => {
    const label = row.status === "PENDING" ? "Cancel this invitation" : "Unlink this helper";
    if (!window.confirm(`${label} (${row.helperName} ↔ ${row.technicianName})?`)) return;
    setBusy(true);
    const res = await api.post(`/technician-helpers/${row.id}/remove`);
    setBusy(false);
    if (!res.success) {
      alert(res.error?.message || "Action failed");
      return;
    }
    fetchRows(meta.pagination?.page || 1);
  };

  const submitReassign = async () => {
    if (!reassign || !reassign.helperId || !reassignTarget) return;
    setBusy(true);
    const res = await api.post(`/technician-helpers/reassign`, {
      helperId: reassign.helperId,
      newTechnicianId: reassignTarget,
    });
    setBusy(false);
    if (!res.success) {
      alert(res.error?.message || "Reassign failed");
      return;
    }
    setReassign(null);
    setReassignTarget("");
    fetchRows(meta.pagination?.page || 1);
  };

  return (
    <>
      <div className="section">
        <div className="row">
          <select
            className="input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as (typeof STATUS_FILTERS)[number])}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All statuses" : s}
              </option>
            ))}
          </select>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0" }}>
          A helper works under one technician at a time. Use Reassign to move an
          active helper to a different technician.
        </p>
      </div>

      {error && (
        <div
          className="section"
          style={{ background: "var(--danger-bg)", color: "var(--danger-text)", fontSize: 13 }}
        >
          {error}
        </div>
      )}

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Technician</th>
              <th>Helper</th>
              <th>Status</th>
              <th>Invited</th>
              <th>Responded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                  {error ? "Could not load relationships." : "No relationships found."}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const tag = STATUS_TAG[row.status] || STATUS_TAG.REMOVED;
              return (
                <tr key={row.id}>
                  <td>
                    <div>{row.technicianName}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {row.technicianPhone}
                    </div>
                  </td>
                  <td>
                    <div>{row.helperName}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>
                      {row.helperPhone}
                    </div>
                  </td>
                  <td>
                    <span
                      className="tag"
                      style={{ background: tag.bg, color: tag.color }}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>{fmtDate(row.invitedAt)}</td>
                  <td>{fmtDate(row.respondedAt)}</td>
                  <td>
                    {row.status === "ACTIVE" || row.status === "PENDING" ? (
                      <div className="row">
                        {row.status === "ACTIVE" && (
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() => {
                              setReassign(row);
                              setReassignTarget("");
                            }}
                          >
                            Reassign
                          </button>
                        )}
                        <button
                          className="button danger"
                          disabled={busy}
                          onClick={() => removeRow(row)}
                        >
                          {row.status === "PENDING" ? "Cancel" : "Unlink"}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>

      {reassign && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setReassign(null)}
        >
          <div
            className="section"
            style={{ width: 420, maxWidth: "90vw", background: "var(--panel)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Reassign helper</h3>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Move <strong>{reassign.helperName}</strong> from{" "}
              <strong>{reassign.technicianName}</strong> to another technician.
              The current link is unlinked automatically.
            </p>
            <select
              className="input"
              value={reassignTarget}
              onChange={(e) => setReassignTarget(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="">Select a technician…</option>
              {technicians
                .filter((t) => t.id !== reassign.technicianId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phone})
                  </option>
                ))}
            </select>
            <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setReassign(null)}>
                Cancel
              </button>
              <button
                className="button"
                disabled={busy || !reassignTarget}
                onClick={submitReassign}
              >
                Confirm Reassign
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
