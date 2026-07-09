import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

type CatalogItem = {
  _id: string;
  name: string;
  priceInr: number;
  unit: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

const UNITS = ["piece", "metre", "centimetre", "litre", "ml", "kg", "gram", "set", "pair", "roll", "pack", "hour"];

const EMPTY_FORM = { name: "", priceInr: "", unit: "piece", description: "", sortOrder: "0" };

export default function CatalogPage({ api }: { api: ApiClient }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* form state */
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await api.get<CatalogItem[]>("/catalog");
    if (res.success) setItems(res.data ?? []);
    setLoading(false);
  }, [api]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* ── helpers ── */
  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setFormError(""); };

  const startEdit = (item: CatalogItem) => {
    setEditingId(item._id);
    setForm({
      name: item.name,
      priceInr: String(item.priceInr),
      unit: item.unit || "piece",
      description: item.description ?? "",
      sortOrder: String(item.sortOrder ?? 0),
    });
    setFormError("");
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const price = Number(form.priceInr);
    if (!name) return setFormError("Item name is required.");
    if (!Number.isFinite(price) || price < 0) return setFormError("Price must be a valid number ≥ 0.");

    setSaving(true);
    setFormError("");
    const body = {
      name,
      priceInr: price,
      unit: form.unit || "piece",
      description: form.description.trim(),
      sortOrder: Number(form.sortOrder) || 0,
    };

    const res = editingId
      ? await api.patch<CatalogItem>(`/catalog/${editingId}`, body)
      : await api.post<CatalogItem>("/catalog", { ...body, isActive: true });

    setSaving(false);
    if (res.success) { resetForm(); fetchItems(); }
    else setFormError(res.error?.message ?? "Save failed.");
  };

  const toggleActive = async (item: CatalogItem) => {
    await api.patch(`/catalog/${item._id}`, { isActive: !item.isActive });
    fetchItems();
  };

  const handleDelete = async (item: CatalogItem) => {
    if (!window.confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
    await api.delete(`/catalog/${item._id}`);
    fetchItems();
  };

  /* ── render ── */
  return (
    <>
      {/* ── Add / Edit form ── */}
      <div className="section">
        <h3 style={{ marginBottom: 16 }}>{editingId ? "Edit Item" : "Add New Item"}</h3>
        {formError && <p style={{ color: "var(--danger)", marginBottom: 12, fontSize: 13 }}>{formError}</p>}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "2 1 200px" }}>
            <label className="label">Item Name *</label>
            <input
              className="input"
              placeholder="e.g. Capacitor 25μF, Gas Refill, Filter Mesh"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div style={{ flex: "1 1 120px" }}>
            <label className="label">Price (₹) *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 350"
              value={form.priceInr}
              onChange={(e) => setForm((f) => ({ ...f, priceInr: e.target.value }))}
            />
          </div>

          <div style={{ flex: "0 1 130px" }}>
            <label className="label">Unit</label>
            <select
              className="input"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: "0 1 80px" }}>
            <label className="label">Sort Order</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </div>

          <div style={{ flex: "3 1 240px" }}>
            <label className="label">Description (optional)</label>
            <input
              className="input"
              placeholder="Short note visible to partner"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button className="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Add Item"}
            </button>
            {editingId && (
              <button className="button secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Items table ── */}
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            Catalog Items
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: "var(--muted)" }}>
              {items.length} item{items.length !== 1 ? "s" : ""} — shown to partners when building estimates
            </span>
          </h3>
        </div>

        {loading ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Unit</th>
                <th>Description</th>
                <th>Sort</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "32px 0" }}>
                    No items yet. Add your first catalog item above — partners will see these when creating estimates.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item._id}>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td style={{ fontWeight: 700 }}>₹{item.priceInr.toLocaleString("en-IN")}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{item.unit || "piece"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{item.description || "—"}</td>
                  <td style={{ color: "var(--muted)", fontSize: 13 }}>{item.sortOrder}</td>
                  <td>
                    <button
                      className={`tag ${item.isActive ? "tag-active" : "tag-inactive"}`}
                      style={{ cursor: "pointer", border: "none", background: "none", padding: 0 }}
                      onClick={() => toggleActive(item)}
                      title="Click to toggle"
                    >
                      {item.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="button secondary"
                        style={{ padding: "4px 12px", fontSize: 12 }}
                        onClick={() => startEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="button secondary"
                        style={{ padding: "4px 12px", fontSize: 12, color: "var(--danger)" }}
                        onClick={() => handleDelete(item)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
