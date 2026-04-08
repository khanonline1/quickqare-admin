import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { formatDate, formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

export default function CouponsPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [form, setForm] = useState({
    code: "",
    discountPercent: "10",
    expiresAt: "",
    usageLimit: "100",
    minAmount: "0",
    maxDiscount: "",
    perUserLimit: "1"
  });
  const [usage, setUsage] = useState<any[]>([]);

  const fetchRows = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/coupons?page=${page}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  const createCoupon = async () => {
    await api.post("/coupons", {
      code: form.code,
      discountPercent: Number(form.discountPercent),
      expiresAt: form.expiresAt,
      usageLimit: Number(form.usageLimit),
      minAmount: Number(form.minAmount),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      perUserLimit: Number(form.perUserLimit)
    });
    setForm({ code: "", discountPercent: "10", expiresAt: "", usageLimit: "100", minAmount: "0", maxDiscount: "", perUserLimit: "1" });
    fetchRows(meta.pagination?.page || 1);
  };

  const updateCoupon = async (id: string, patch: Record<string, unknown>) => {
    await api.patch(`/coupons/${id}`, patch);
    fetchRows(meta.pagination?.page || 1);
  };

  const loadUsage = async (id: string) => {
    const res = await api.get<any>(`/coupons/${id}/usage`);
    if (res.success) setUsage(res.data);
  };

  return (
    <>
      <div className="section">
        <h3>Create Coupon</h3>
        <div className="row">
          <input className="input" placeholder="CODE" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <input className="input" placeholder="Discount %" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} />
          <input className="input" placeholder="Expires At (YYYY-MM-DD)" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          <input className="input" placeholder="Usage Limit" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          <button className="button" onClick={createCoupon}>Create</button>
        </div>
      </div>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Expires</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>{row.code}</td>
                <td>{row.discountValue}%</td>
                <td>{formatDate(row.expiresAt)}</td>
                <td>{row.usedCount ?? 0} / {row.usageLimit}</td>
                <td><span className="tag">{row.isActive ? "ACTIVE" : "INACTIVE"}</span></td>
                <td>
                  <div className="row">
                    <button className="button secondary" onClick={() => updateCoupon(row._id, { isActive: !row.isActive })}>
                      {row.isActive ? "Disable" : "Enable"}
                    </button>
                    <button className="button" onClick={() => loadUsage(row._id)}>Usage</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>

      {usage.length > 0 && (
        <div className="section">
          <h3>Coupon Usage</h3>
          <table className="table">
            <thead><tr><th>Customer</th><th>Booking</th><th>Date</th></tr></thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row._id}>
                  <td>{row.customerId?.name || row.customerId?.phone}</td>
                  <td>{row.bookingId?._id}</td>
                  <td>{formatDateTime(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
