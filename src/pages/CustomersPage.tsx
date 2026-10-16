import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency } from "../utils/format";
import Pagination from "../components/Pagination";

export default function CustomersPage({ api }: { api: ApiClient }) {
  const [search, setSearch] = useState("");
  // Applied on Enter / Search, not on every keystroke (see BookingsPage).
  const [query, setQuery] = useState("");
  const latestFetch = useRef(0);
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});

  const fetchRows = useCallback(async (page = 1) => {
    const fetchId = ++latestFetch.current;
    const res = await api.get<any>(`/customers?q=${encodeURIComponent(query)}&page=${page}`);
    if (fetchId !== latestFetch.current) return; // answer to an older search
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, query]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const applySearch = () => {
    const next = search.trim();
    if (next === query) fetchRows(1);
    else setQuery(next);
  };

  const updateStatus = async (id: string, status: string) => {
    const res = await api.patch(`/customers/${id}/status`, { status });
    if (!res.success) { alert(res.error?.message || "Failed to update customer"); return; }
    fetchRows(meta.pagination?.page || 1);
  };

  return (
    <>
      <div className="section">
        <div className="row">
          <input
            className="input"
            placeholder="Search name / phone / email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
          <button className="button" onClick={applySearch}>Search</button>
        </div>
      </div>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Total Bookings</th>
              <th>Total Spent</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name || "-"}</td>
                <td>{row.phone}</td>
                <td>{row.email || "-"}</td>
                <td>{row.totalBookings}</td>
                <td>{currency.format(row.totalSpent || 0)}</td>
                <td><span className="tag">{row.status}</span></td>
                <td>
                  <div className="row">
                    <button className="button secondary" onClick={() => updateStatus(row.id, "ACTIVE")}>Activate</button>
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
