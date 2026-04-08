import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency } from "../utils/format";
import Pagination from "../components/Pagination";

export default function PartnersPage({ api }: { api: ApiClient }) {
  const [status, setStatus] = useState("PENDING");
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [commissionDraft, setCommissionDraft] = useState<Record<string, string>>({});

  const fetchRows = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/partners?status=${encodeURIComponent(status)}&page=${page}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, status]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const updateApproval = async (id: string, next: string) => {
    await api.patch(`/partners/${id}/approval`, { status: next });
    fetchRows(meta.pagination?.page || 1);
  };

  const updateStatus = async (id: string, next: string) => {
    await api.patch(`/partners/${id}/status`, { status: next });
    fetchRows(meta.pagination?.page || 1);
  };

  const updateCommission = async (id: string) => {
    const value = Number(commissionDraft[id]);
    if (!Number.isFinite(value)) return;
    await api.patch(`/partners/${id}/commission`, { commissionPercent: value });
    fetchRows(meta.pagination?.page || 1);
  };

  const updateSubscription = async (id: string, subscriptionActive: boolean) => {
    await api.patch(`/partners/${id}/subscription`, { subscriptionActive });
    fetchRows(meta.pagination?.page || 1);
  };

  return (
    <>
      <div className="section">
        <div className="row">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="BLOCKED">Blocked</option>
          </select>
          <button className="button" onClick={() => fetchRows(1)}>Refresh</button>
        </div>
      </div>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Service</th>
              <th>Status</th>
              <th>Rating</th>
              <th>Completed</th>
              <th>Earnings</th>
              <th>Commission %</th>
              <th>Subscription</th>
              <th>Online</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name || "-"}</td>
                <td>{row.phone}</td>
                <td>{row.serviceCategory || "-"}</td>
                <td><span className="tag">{row.status}</span></td>
                <td>{row.rating?.toFixed?.(2) ?? row.rating}</td>
                <td>{row.completedJobs}</td>
                <td>{currency.format(row.totalEarnings || 0)}</td>
                <td>
                  <div className="row">
                    <input
                      className="input"
                      style={{ width: 70 }}
                      value={commissionDraft[row.id] ?? row.commissionPercent}
                      onChange={(e) => setCommissionDraft((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    />
                    <button className="button secondary" onClick={() => updateCommission(row.id)}>Save</button>
                  </div>
                </td>
                <td>
                  <button
                    className="button secondary"
                    onClick={() => updateSubscription(row.id, !row.subscriptionActive)}
                  >
                    {row.subscriptionActive ? "Active" : "Off"}
                  </button>
                </td>
                <td>{row.isOnline ? "Online" : "Offline"}</td>
                <td>
                  <div className="row">
                    <button className="button success" onClick={() => updateApproval(row.id, "APPROVED")}>Approve</button>
                    <button className="button warning" onClick={() => updateApproval(row.id, "REJECTED")}>Reject</button>
                    <button className="button danger" onClick={() => updateStatus(row.id, "BLOCKED")}>Block</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>
    </>
  );
}
