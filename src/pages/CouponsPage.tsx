import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import { formatDate, formatDateTime } from "../utils/format";
import Pagination from "../components/Pagination";

const BLANK_FORM = {
  code: "",
  discountType: "percent",
  discountValue: "10",
  expiresAt: "",
  usageLimit: "100",
  minOrder: "0",
  maxDiscount: "",
  perUserLimit: "1",
};

function ServicePicker({
  allServices,
  selected,
  onAdd,
  onRemove,
}: {
  allServices: any[];
  selected: any[];
  onAdd: (s: any) => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = allServices.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) &&
      !selected.find((sel) => sel._id === s._id)
  );
  return (
    <div style={{ marginTop: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
        Applicable Services{" "}
        <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(leave empty = valid for all)</span>
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {selected.map((s) => (
          <span key={s._id} style={{ backgroundColor: "#EDE9FE", color: "#7C3AED", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            {s.name}
            <button onClick={() => onRemove(s._id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7C3AED", fontWeight: 700, padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ position: "relative", maxWidth: 320 }}>
        <input
          className="input"
          placeholder="Search and add a service..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && filtered.length > 0 && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, maxHeight: 200, overflowY: "auto" }}>
            {filtered.slice(0, 10).map((s) => (
              <div
                key={s._id}
                onClick={() => { onAdd(s); setSearch(""); }}
                style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F3FF")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
              >
                {s.name}
                {s.category && (
                  <span style={{ color: "#9CA3AF", marginLeft: 8, fontSize: 11 }}>
                    {typeof s.category === "object" ? s.category?.name : s.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CouponsPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [allServices, setAllServices] = useState<any[]>([]);

  // ── Create form ──
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [createServices, setCreateServices] = useState<any[]>([]);

  // ── Edit state ──
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ ...BLANK_FORM });
  const [editServices, setEditServices] = useState<any[]>([]);

  // ── Usage panel ──
  const [usage, setUsage] = useState<any[]>([]);
  const [usageTitle, setUsageTitle] = useState("");

  useEffect(() => {
    api.get<any>("/services?limit=200").then((res) => {
      if (res.success) setAllServices(Array.isArray(res.data) ? res.data : []);
    });
  }, [api]);

  const fetchRows = useCallback(
    async (page = 1) => {
      const res = await api.get<any>(`/coupons?page=${page}`);
      if (res.success) {
        setRows(res.data);
        setMeta(res.meta);
      }
    },
    [api]
  );

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  // ── Create ──
  const createCoupon = async () => {
    const res = await api.post<any>("/coupons", {
      code: form.code,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      expiresAt: form.expiresAt,
      usageLimit: Number(form.usageLimit),
      minOrder: Number(form.minOrder),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      perUserLimit: Number(form.perUserLimit),
      applicableServices: createServices.map((s) => s._id),
    });
    if (res.success) {
      setForm({ ...BLANK_FORM });
      setCreateServices([]);
      fetchRows(meta.pagination?.page || 1);
    } else {
      alert(res.error?.message || "Failed to create coupon");
    }
  };

  // ── Edit ──
  const startEdit = (row: any) => {
    setEditId(row._id);
    setEditForm({
      code: row.code,
      discountType: row.discountType,
      discountValue: String(row.discountValue),
      expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : "",
      usageLimit: String(row.usageLimit ?? ""),
      minOrder: String(row.minAmount ?? 0),
      maxDiscount: row.maxDiscount != null ? String(row.maxDiscount) : "",
      perUserLimit: String(row.perUserLimit ?? 1),
    });
    const populated = (row.applicableServices || [])
      .map((id: any) => {
        const sid = typeof id === "object" ? id._id ?? id : id;
        return allServices.find((s) => s._id === String(sid));
      })
      .filter(Boolean);
    setEditServices(populated);
    setUsage([]);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if (!editId) return;
    const res = await api.patch<any>(`/coupons/${editId}`, {
      discountType: editForm.discountType,
      discountValue: Number(editForm.discountValue),
      expiresAt: editForm.expiresAt,
      usageLimit: Number(editForm.usageLimit),
      minOrder: Number(editForm.minOrder),
      maxDiscount: editForm.maxDiscount ? Number(editForm.maxDiscount) : null,
      perUserLimit: Number(editForm.perUserLimit),
      applicableServices: editServices.map((s) => s._id),
    });
    if (res.success) {
      setEditId(null);
      fetchRows(meta.pagination?.page || 1);
    } else {
      alert(res.error?.message || "Failed to update coupon");
    }
  };

  // ── Toggle active ──
  const toggleActive = async (row: any) => {
    await api.patch(`/coupons/${row._id}`, { isActive: !row.isActive });
    fetchRows(meta.pagination?.page || 1);
  };

  // ── Delete ──
  const deleteCoupon = async (row: any) => {
    if (!window.confirm(`Delete coupon "${row.code}"? This cannot be undone.`)) return;
    const res = await api.delete<any>(`/coupons/${row._id}`);
    if (res.success) {
      if (editId === row._id) setEditId(null);
      setUsage([]);
      fetchRows(meta.pagination?.page || 1);
    } else {
      alert(res.error?.message || "Failed to delete coupon");
    }
  };

  // ── Usage ──
  const loadUsage = async (row: any) => {
    const res = await api.get<any>(`/coupons/${row._id}/usage`);
    if (res.success) {
      setUsage(res.data);
      setUsageTitle(row.code);
    }
  };

  return (
    <>
      {/* ── Create form ── */}
      <div className="section">
        <h3>Create Coupon</h3>
        <div className="row">
          <input className="input" placeholder="CODE" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <select className="input" value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="percent">Percent</option>
            <option value="flat">Flat</option>
          </select>
          <input className="input" placeholder={form.discountType === "flat" ? "Discount ₹" : "Discount %"}
            value={form.discountValue}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          <input className="input" type="date" placeholder="Expires At"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          <input className="input" placeholder="Usage Limit" value={form.usageLimit}
            onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
          <input className="input" placeholder="Min Order ₹" value={form.minOrder}
            onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
          <input className="input" placeholder="Max Discount ₹" value={form.maxDiscount}
            onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
          <input className="input" placeholder="Per User Limit" value={form.perUserLimit}
            onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
          <button className="button" onClick={createCoupon}>Create</button>
        </div>
        <ServicePicker
          allServices={allServices}
          selected={createServices}
          onAdd={(s) => setCreateServices((p) => [...p, s])}
          onRemove={(id) => setCreateServices((p) => p.filter((s) => s._id !== id))}
        />
      </div>

      {/* ── Edit form (shown when editing) ── */}
      {editId && (
        <div className="section" style={{ border: "2px solid #6366F1", borderRadius: 10 }}>
          <h3 style={{ color: "#6366F1" }}>Edit Coupon — {editForm.code}</h3>
          <div className="row">
            <select className="input" value={editForm.discountType}
              onChange={(e) => setEditForm({ ...editForm, discountType: e.target.value })}>
              <option value="percent">Percent</option>
              <option value="flat">Flat</option>
            </select>
            <input className="input" placeholder={editForm.discountType === "flat" ? "Discount ₹" : "Discount %"}
              value={editForm.discountValue}
              onChange={(e) => setEditForm({ ...editForm, discountValue: e.target.value })} />
            <input className="input" type="date" placeholder="Expires At"
              value={editForm.expiresAt}
              onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })} />
            <input className="input" placeholder="Usage Limit" value={editForm.usageLimit}
              onChange={(e) => setEditForm({ ...editForm, usageLimit: e.target.value })} />
            <input className="input" placeholder="Min Order ₹" value={editForm.minOrder}
              onChange={(e) => setEditForm({ ...editForm, minOrder: e.target.value })} />
            <input className="input" placeholder="Max Discount ₹" value={editForm.maxDiscount}
              onChange={(e) => setEditForm({ ...editForm, maxDiscount: e.target.value })} />
            <input className="input" placeholder="Per User Limit" value={editForm.perUserLimit}
              onChange={(e) => setEditForm({ ...editForm, perUserLimit: e.target.value })} />
            <button className="button" onClick={saveEdit}>Save</button>
            <button className="button secondary" onClick={cancelEdit}>Cancel</button>
          </div>
          <ServicePicker
            allServices={allServices}
            selected={editServices}
            onAdd={(s) => setEditServices((p) => [...p, s])}
            onRemove={(id) => setEditServices((p) => p.filter((s) => s._id !== id))}
          />
        </div>
      )}

      {/* ── Coupons table ── */}
      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Value</th>
              <th>Min Order</th>
              <th>Max Discount</th>
              <th>Per User</th>
              <th>Expires</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} style={editId === row._id ? { backgroundColor: "#EEF2FF" } : undefined}>
                <td><strong>{row.code}</strong></td>
                <td>{row.discountType}</td>
                <td>{row.discountType === "flat" ? `₹${row.discountValue}` : `${row.discountValue}%`}</td>
                <td>₹{row.minAmount ?? 0}</td>
                <td>{row.maxDiscount != null ? `₹${row.maxDiscount}` : "—"}</td>
                <td>{row.perUserLimit ?? 1}</td>
                <td>{formatDate(row.expiresAt)}</td>
                <td>{row.usedCount ?? 0} / {row.usageLimit ?? "—"}</td>
                <td><span className="tag">{row.isActive ? "ACTIVE" : "INACTIVE"}</span></td>
                <td>
                  <div className="row">
                    <button className="button secondary" onClick={() => startEdit(row)}>Edit</button>
                    <button className="button secondary" onClick={() => toggleActive(row)}>
                      {row.isActive ? "Disable" : "Enable"}
                    </button>
                    <button className="button" onClick={() => loadUsage(row)}>Usage</button>
                    <button
                      className="button secondary"
                      style={{ color: "#DC2626", borderColor: "#DC2626" }}
                      onClick={() => deleteCoupon(row)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>

      {/* ── Usage panel ── */}
      {usage.length > 0 && (
        <div className="section">
          <h3>Usage — {usageTitle}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Booking</th>
                <th>Discount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((row) => (
                <tr key={row._id}>
                  <td>{row.customerId?.name || row.customerId?.phone}</td>
                  <td>{row.bookingId?._id}</td>
                  <td>₹{row.discountAmountInr ?? 0}</td>
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
