import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

type ActivityRow = {
  id: string;
  at: string;
  actor: { id: string; name: string; email: string } | null;
  attemptedEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  outcome: "success" | "failed" | null;
  statusCode: number | null;
  detail: string | null;
  ipAddress: string;
  body: Record<string, unknown> | null;
};

// "admin.partners.delete" → "partners · delete"
const actionLabel = (action: string) => action.replace(/^admin\./, "").replace(/\./g, " · ").replace(/_/g, " ");

// Entries from before outcomes were recorded have none.
const resultTag = (row: ActivityRow) =>
  row.outcome === "success" ? "tag tag-active" : row.outcome === "failed" ? "tag tag-danger" : "tag";

// SuperAdmin only. Every admin action and sign-in attempt, with how it went —
// the audit trail was always being written, this is the first screen that reads it.
export default function ActivityPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestFetch = useRef(0);

  const fetchRows = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    if (outcome) params.set("outcome", outcome);
    const fetchId = ++latestFetch.current;
    const res = await api.get<ActivityRow[]>(`/activity?${params.toString()}`);
    if (fetchId !== latestFetch.current) return; // answer to an older filter
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
      setError(null);
    } else {
      setError(res.error?.message || "Couldn't load the activity log.");
    }
  }, [api, query, outcome]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const applySearch = () => {
    const next = search.trim();
    if (next === query) fetchRows(1);
    else setQuery(next);
  };

  return (
    <>
      <div className="section">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input
            className="input"
            style={{ flex: "1 1 240px", minWidth: 200 }}
            placeholder="Filter by action, e.g. refund, partners.delete, auth.login"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">Any result</option>
            <option value="success">Succeeded</option>
            <option value="failed">Failed or refused</option>
          </select>
          <button className="button" onClick={applySearch}>Search</button>
        </div>
      </div>

      <div className="section">
        {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>On</th>
              <th>Result</th>
              <th>IP</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>No activity found</td></tr>
            )}
            {rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr>
                  <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>{formatDateTime(row.at)}</td>
                  <td style={{ fontSize: 13 }}>
                    {row.actor ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{row.actor.name}</div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>{row.actor.email}</div>
                      </>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>{row.attemptedEmail || "Not signed in"}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{actionLabel(row.action)}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.entityId || "—"}</td>
                  <td>
                    <span className={resultTag(row)}>
                      {row.outcome === "success" ? "OK" : row.outcome === "failed" ? "Failed" : "—"}
                      {row.statusCode ? ` · ${row.statusCode}` : ""}
                    </span>
                    {row.detail && (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{row.detail.replace(/_/g, " ")}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{row.ipAddress || "—"}</td>
                  <td>
                    {row.body && Object.keys(row.body).length > 0 ? (
                      <button
                        className="button secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => setOpenId(openId === row.id ? null : row.id)}
                      >
                        {openId === row.id ? "Hide" : "View"}
                      </button>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>—</span>
                    )}
                  </td>
                </tr>
                {openId === row.id && (
                  <tr>
                    <td colSpan={7}>
                      <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 320, overflow: "auto" }}>
                        {JSON.stringify(row.body, null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>
    </>
  );
}
