import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import Pagination from "../components/Pagination";

export default function DisputesPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [resolution, setResolution] = useState("NO_ACTION");
  const [notes, setNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");

  const fetchRows = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/disputes?page=${page}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  const loadDetail = async (id: string) => {
    const res = await api.get<any>(`/disputes/${id}`);
    if (res.success) setSelected(res.data);
  };

  const resolveDispute = async () => {
    if (!selected) return;
    await api.post(`/disputes/${selected._id}/resolve`, {
      resolution,
      notes,
      refundAmountInr: Number(refundAmount || 0)
    });
    loadDetail(selected._id);
  };

  return (
    <>
      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Booking</th>
              <th>Customer</th>
              <th>Partner</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{row.bookingId?._id || "-"}</td>
                <td>{row.customerId?.name || row.customerId?.phone || "-"}</td>
                <td>{row.partnerId?.name || "-"}</td>
                <td><span className="tag">{row.status}</span></td>
                <td><button className="button secondary" onClick={() => loadDetail(row._id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>

      {selected && (
        <div className="section">
          <h3>Resolve Dispute</h3>
          <div className="row">
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              <option value="NO_ACTION">No Action</option>
              <option value="REFUND">Refund</option>
              <option value="PENALTY">Penalty</option>
            </select>
            <input className="input" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <input className="input" placeholder="Refund amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            <button className="button" onClick={resolveDispute}>Resolve</button>
          </div>
        </div>
      )}
    </>
  );
}
