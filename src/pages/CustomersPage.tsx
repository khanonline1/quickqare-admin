import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { currency } from "../utils/format";
import Pagination from "../components/Pagination";

export default function CustomersPage({ api }: { api: ApiClient }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});

  const fetchRows = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/customers?q=${encodeURIComponent(query)}&page=${page}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api, query]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/customers/${id}/status`, { status });
    fetchRows(meta.pagination?.page || 1);
  };

  return (
    <>
      <div className="section">
        <div className="row">
          <input className="input" placeholder="Search name / phone / email" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="button" onClick={() => fetchRows(1)}>Search</button>
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
