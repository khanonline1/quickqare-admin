import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

type OfferType = "bundle" | "coupon" | "info";

type OfferRow = {
  _id: string;
  type: OfferType;
  title: string;
  tagline?: string;
  description?: string;
  badgeText?: string;
  badgeColor?: string;
  serviceCategory?: string | null;
  originalPrice?: number | null;
  bundlePrice?: number | null;
  couponCode?: string | null;
  sortOrder?: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  applicableServices?: any[];
};

const BLANK: typeof emptyForm = {
  type: "coupon",
  title: "",
  tagline: "",
  description: "",
  badgeText: "",
  badgeColor: "#DC2626",
  serviceCategory: "",
  originalPrice: "",
  bundlePrice: "",
  couponCode: "",
  sortOrder: "0",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

const emptyForm = {
  type: "coupon" as OfferType,
  title: "",
  tagline: "",
  description: "",
  badgeText: "",
  badgeColor: "#DC2626",
  serviceCategory: "",
  originalPrice: "",
  bundlePrice: "",
  couponCode: "",
  sortOrder: "0",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

const TYPE_META: Record<OfferType, { label: string; color: string; icon: string; hint: string }> = {
  bundle:  { label: "Bundle",       color: "#059669", icon: "📦", hint: "Show a service bundle with before/after pricing" },
  coupon:  { label: "Coupon Promo", color: "#7C3AED", icon: "🏷️", hint: "Display a promo code card — also create the code in the Coupons page" },
  info:    { label: "Info",         color: "#2563EB", icon: "ℹ️", hint: "General announcement or promotional banner" },
};

function validityStatus(row: OfferRow): { label: string; color: string; bg: string } {
  const now = Date.now();
  if (!row.isActive) return { label: "Inactive", color: "#9CA3AF", bg: "#F3F4F6" };
  if (row.endsAt && new Date(row.endsAt).getTime() < now)
    return { label: "Expired", color: "#DC2626", bg: "#FEE2E2" };
  if (row.startsAt && new Date(row.startsAt).getTime() > now)
    return { label: "Scheduled", color: "#D97706", bg: "#FEF3C7" };
  return { label: "Live", color: "#059669", bg: "#D1FAE5" };
}

export default function OffersPage({ api }: { api: ApiClient }) {
  const [rows, setRows]         = useState<OfferRow[]>([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]         = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [error, setError]       = useState("");
  const [allServices, setAllServices] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServices, setSelectedServices] = useState<any[]>([]);

  const f = (k: keyof typeof emptyForm, v: any) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get<any>("/services?limit=200").then((res) => {
      if (res.success) setAllServices(Array.isArray(res.data) ? res.data : []);
    });
  }, [api]);

  const filteredServices = allServices.filter(
    (s) =>
      s.name?.toLowerCase().includes(serviceSearch.toLowerCase()) &&
      !selectedServices.find((sel) => sel._id === s._id)
  );

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<any>("/offers?limit=50");
      if (res.success) setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const resetForm = () => { setForm({ ...emptyForm }); setEditingId(null); setError(""); setSelectedServices([]); setServiceSearch(""); };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (row: OfferRow) => {
    const preselected = Array.isArray(row.applicableServices)
      ? row.applicableServices.map((s: any) =>
          typeof s === "object" ? s : allServices.find((a) => a._id === String(s))
        ).filter(Boolean)
      : [];
    setSelectedServices(preselected);
    setForm({
      type: row.type,
      title: row.title || "",
      tagline: row.tagline || "",
      description: row.description || "",
      badgeText: row.badgeText || "",
      badgeColor: row.badgeColor || "#DC2626",
      serviceCategory: row.serviceCategory || "",
      originalPrice: row.originalPrice != null ? String(row.originalPrice) : "",
      bundlePrice: row.bundlePrice != null ? String(row.bundlePrice) : "",
      couponCode: row.couponCode || "",
      sortOrder: String(row.sortOrder ?? 0),
      isActive: row.isActive,
      startsAt: row.startsAt ? row.startsAt.slice(0, 10) : "",
      endsAt: row.endsAt ? row.endsAt.slice(0, 10) : "",
    });
    setEditingId(row._id);
    setError("");
    setShowForm(true);
    setTimeout(() => document.getElementById("offer-form")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Title is required"); return; }
    setSaving(true); setError("");
    try {
      const payload: any = {
        type: form.type,
        title: form.title.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        badgeText: form.badgeText.trim(),
        badgeColor: form.badgeColor || "#DC2626",
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        applicableServices: selectedServices.map((s) => s._id),
      };
      if (form.type === "bundle") {
        payload.serviceCategory = form.serviceCategory.trim() || null;
        payload.originalPrice   = form.originalPrice ? Number(form.originalPrice) : null;
        payload.bundlePrice     = form.bundlePrice   ? Number(form.bundlePrice)   : null;
        payload.couponCode      = null;
      } else if (form.type === "coupon") {
        payload.couponCode      = form.couponCode.trim().toUpperCase() || null;
        payload.serviceCategory = null; payload.originalPrice = null; payload.bundlePrice = null;
      } else {
        payload.couponCode = null; payload.serviceCategory = null; payload.originalPrice = null; payload.bundlePrice = null;
      }

      const res = editingId
        ? await api.patch(`/offers/${editingId}`, payload)
        : await api.post("/offers", payload);

      if (res.success) { setShowForm(false); resetForm(); fetchRows(); }
      else setError(res.error?.message || "Failed to save");
    } catch (e: any) {
      setError(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this offer?")) return;
    await api.delete(`/offers/${id}`);
    if (editingId === id) { setShowForm(false); resetForm(); }
    fetchRows();
  };

  const handleToggle = async (row: OfferRow) => {
    await api.patch(`/offers/${row._id}`, { isActive: !row.isActive });
    fetchRows();
  };

  const handleReorder = async (row: OfferRow, direction: "up" | "down") => {
    const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex((r) => r._id === row._id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx], b = sorted[swapIdx];
    const aOrder = a.sortOrder ?? 0, bOrder = b.sortOrder ?? 0;
    await Promise.all([
      api.patch(`/offers/${a._id}`, { sortOrder: bOrder }),
      api.patch(`/offers/${b._id}`, { sortOrder: aOrder }),
    ]);
    fetchRows();
  };

  const sorted = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Offers</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            {rows.length} offer{rows.length !== 1 ? "s" : ""} · cards appear in the customer app home screen
          </p>
        </div>
        {!showForm && (
          <button onClick={openCreate} style={primaryBtn}>+ New Offer</button>
        )}
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div id="offer-form" style={formCard}>
          {/* Form header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              {editingId ? "Edit Offer" : "New Offer"}
            </h3>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={ghostBtn}>✕ Cancel</button>
          </div>

          {/* Type picker */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Offer Type</label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(Object.entries(TYPE_META) as [OfferType, typeof TYPE_META[OfferType]][]).map(([t, meta]) => (
                <button
                  key={t}
                  onClick={() => f("type", t)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 10,
                    border: `2px solid ${form.type === t ? meta.color : "#E5E7EB"}`,
                    backgroundColor: form.type === t ? meta.color + "12" : "#FAFAFA",
                    color: form.type === t ? meta.color : "#6B7280",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                    textAlign: "left",
                    minWidth: 160,
                  }}
                >
                  <div>{meta.icon} {meta.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.8, whiteSpace: "normal" }}>{meta.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Coupon warning */}
          {form.type === "coupon" && (
            <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400E" }}>
              ⚠️ <strong>Heads up:</strong> This offer card only <em>displays</em> the code to users. For the code to actually give a discount at checkout, you must also create it in the <strong>Coupons</strong> page.
            </div>
          )}

          {/* Core fields */}
          <div style={grid2}>
            <Field label="Title *">
              <input style={input} value={form.title} onChange={(e) => f("title", e.target.value)} placeholder="e.g. AC Summer Bundle" />
            </Field>
            <Field label="Tagline">
              <input style={input} value={form.tagline} onChange={(e) => f("tagline", e.target.value)} placeholder="e.g. Save ₹300 this week" />
            </Field>
          </div>

          <Field label="Description">
            <textarea style={{ ...input, minHeight: 68, resize: "vertical" }} value={form.description} onChange={(e) => f("description", e.target.value)} placeholder="Full details shown when user taps the offer" />
          </Field>

          {/* Badge */}
          <div style={grid2}>
            <Field label="Badge Text" hint="e.g. HOT · NEW · LIMITED">
              <input style={input} value={form.badgeText} onChange={(e) => f("badgeText", e.target.value)} placeholder="HOT" />
            </Field>
            <Field label="Badge Color">
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color" value={form.badgeColor} onChange={(e) => f("badgeColor", e.target.value)}
                  style={{ width: 42, height: 38, border: "1px solid #E5E7EB", borderRadius: 6, padding: 2, cursor: "pointer", flexShrink: 0 }} />
                <input style={{ ...input, flex: 1 }} value={form.badgeColor} onChange={(e) => f("badgeColor", e.target.value)} />
                {form.badgeText && (
                  <span style={{ backgroundColor: form.badgeColor, color: "#fff", padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {form.badgeText}
                  </span>
                )}
              </div>
            </Field>
          </div>

          {/* Type-specific fields */}
          {form.type === "bundle" && (
            <div style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10 }}>📦 Bundle Details</div>
              <div style={grid3}>
                <Field label="Service Category slug">
                  <input style={input} value={form.serviceCategory} onChange={(e) => f("serviceCategory", e.target.value)} placeholder="e.g. ac-service" />
                </Field>
                <Field label="Original Price (₹)">
                  <input type="number" style={input} value={form.originalPrice} onChange={(e) => f("originalPrice", e.target.value)} placeholder="1799" />
                </Field>
                <Field label="Bundle Price (₹)">
                  <input type="number" style={input} value={form.bundlePrice} onChange={(e) => f("bundlePrice", e.target.value)} placeholder="1499" />
                </Field>
              </div>
            </div>
          )}

          {form.type === "coupon" && (
            <div style={{ backgroundColor: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", marginBottom: 10 }}>🏷️ Coupon Code to Display</div>
              <Field label="Coupon Code">
                <input style={{ ...input, fontFamily: "monospace", fontWeight: 700, letterSpacing: 2 }}
                  value={form.couponCode} onChange={(e) => f("couponCode", e.target.value.toUpperCase())} placeholder="SAVE20" />
              </Field>
            </div>
          )}

          {/* Service restriction */}
          <Field label="Applicable Services" hint="leave empty = shown for all services">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {selectedServices.map((s) => (
                <span key={s._id} style={{ backgroundColor: "#EDE9FE", color: "#7C3AED", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {s.name}
                  <button onClick={() => setSelectedServices((p) => p.filter((x) => x._id !== s._id))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#7C3AED", fontWeight: 700, padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ position: "relative", maxWidth: 320 }}>
              <input style={input} placeholder="Search and add a service…" value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)} />
              {serviceSearch && filteredServices.length > 0 && (
                <div style={dropdown}>
                  {filteredServices.slice(0, 10).map((s) => (
                    <div key={s._id}
                      onClick={() => { setSelectedServices((p) => [...p, s]); setServiceSearch(""); }}
                      style={dropdownItem}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F5F3FF")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}>
                      {s.name}
                      {s.category && <span style={{ color: "#9CA3AF", marginLeft: 8, fontSize: 11 }}>{typeof s.category === "object" ? s.category?.name : s.category}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>

          {/* Scheduling */}
          <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "14px 16px", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>📅 Schedule & Visibility</div>
            <div style={grid3}>
              <Field label="Starts At">
                <input type="date" style={input} value={form.startsAt} onChange={(e) => f("startsAt", e.target.value)} />
              </Field>
              <Field label="Ends At">
                <input type="date" style={input} value={form.endsAt} onChange={(e) => f("endsAt", e.target.value)} />
              </Field>
              <Field label="Sort Order" hint="lower = shown first">
                <input type="number" style={input} value={form.sortOrder} onChange={(e) => f("sortOrder", e.target.value)} />
              </Field>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 4 }}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => f("isActive", e.target.checked)} style={{ width: 16, height: 16, accentColor: "#22A06B" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Active — show to users immediately</span>
            </label>
          </div>

          {error && <p style={{ color: "#DC2626", fontSize: 13, margin: "8px 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={primaryBtn}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Create Offer"}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Offer cards ── */}
      {loading ? (
        <p style={{ color: "#9CA3AF" }}>Loading…</p>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎁</div>
          <p style={{ margin: 0, fontSize: 15 }}>No offers yet. Create your first one above.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((row, idx) => {
            const meta = TYPE_META[row.type];
            const status = validityStatus(row);
            return (
              <div key={row._id} style={{
                backgroundColor: "#fff",
                border: `1px solid ${editingId === row._id ? "#6366F1" : "#E5E7EB"}`,
                borderRadius: 12,
                padding: "16px 18px",
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                boxShadow: editingId === row._id ? "0 0 0 3px #E0E7FF" : "0 1px 3px rgba(0,0,0,0.05)",
              }}>

                {/* Sort arrows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, paddingTop: 2 }}>
                  <button onClick={() => handleReorder(row, "up")} disabled={idx === 0}
                    style={arrowBtn(idx === 0)} title="Move up">▲</button>
                  <button onClick={() => handleReorder(row, "down")} disabled={idx === sorted.length - 1}
                    style={arrowBtn(idx === sorted.length - 1)} title="Move down">▼</button>
                </div>

                {/* Type icon */}
                <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: meta.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {meta.icon}
                </div>

                {/* Main content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{row.title}</span>
                    {row.badgeText && (
                      <span style={{ backgroundColor: row.badgeColor || "#DC2626", color: "#fff", padding: "1px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                        {row.badgeText}
                      </span>
                    )}
                    <span style={{ backgroundColor: meta.color + "15", color: meta.color, padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {meta.label}
                    </span>
                    <span style={{ backgroundColor: status.bg, color: status.color, padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      {status.label}
                    </span>
                  </div>

                  {row.tagline && <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>{row.tagline}</div>}

                  {/* Type-specific detail line */}
                  <div style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {row.type === "bundle" && row.bundlePrice != null && (
                      <span>💰 <strong style={{ color: "#059669" }}>₹{row.bundlePrice}</strong> <s style={{ opacity: 0.5 }}>₹{row.originalPrice}</s></span>
                    )}
                    {row.type === "coupon" && row.couponCode && (
                      <span>Code: <strong style={{ fontFamily: "monospace", color: "#7C3AED", letterSpacing: 1 }}>{row.couponCode}</strong></span>
                    )}
                    {row.startsAt && <span>From {row.startsAt.slice(0, 10)}</span>}
                    {row.endsAt   && <span>Until {row.endsAt.slice(0, 10)}</span>}
                    {!row.startsAt && !row.endsAt && <span style={{ color: "#9CA3AF" }}>No date restriction</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                  <button
                    onClick={() => handleToggle(row)}
                    style={{
                      padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 12,
                      backgroundColor: row.isActive ? "#D1FAE5" : "#F3F4F6",
                      color: row.isActive ? "#059669" : "#9CA3AF",
                    }}
                  >
                    {row.isActive ? "Active" : "Off"}
                  </button>
                  <button onClick={() => openEdit(row)} style={actionBtn("#2563EB")}>Edit</button>
                  <button onClick={() => handleDelete(row._id)} style={actionBtn("#DC2626")}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!showForm && rows.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <button onClick={openCreate} style={primaryBtn}>+ New Offer</button>
        </div>
      )}
    </div>
  );
}

/* ── Small components ── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={labelStyle}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: "#9CA3AF", marginLeft: 6, fontSize: 11 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

/* ── Styles ── */
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4,
};

const input: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
  fontSize: 14, boxSizing: "border-box", outline: "none", backgroundColor: "#fff",
};

const formCard: React.CSSProperties = {
  backgroundColor: "#fff", borderRadius: 14, border: "1px solid #E5E7EB",
  padding: 22, marginBottom: 28, boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
};

const grid2: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, marginBottom: 4,
};

const grid3: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12,
};

const dropdown: React.CSSProperties = {
  position: "absolute", top: "100%", left: 0, right: 0, backgroundColor: "#fff",
  border: "1px solid #E5E7EB", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  zIndex: 50, maxHeight: 180, overflowY: "auto",
};

const dropdownItem: React.CSSProperties = {
  padding: "8px 12px", cursor: "pointer", fontSize: 13, borderBottom: "1px solid #F3F4F6",
};

const primaryBtn: React.CSSProperties = {
  backgroundColor: "#22A06B", color: "#fff", border: "none", borderRadius: 8,
  padding: "9px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB",
  borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer",
};

function actionBtn(color: string): React.CSSProperties {
  return {
    backgroundColor: color + "15", color, border: "none", borderRadius: 6,
    padding: "5px 12px", fontWeight: 700, fontSize: 12, cursor: "pointer",
  };
}

function arrowBtn(disabled: boolean): React.CSSProperties {
  return {
    background: "none", border: "1px solid #E5E7EB", borderRadius: 4, cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.25 : 0.7, fontSize: 10, padding: "2px 5px", lineHeight: 1,
    color: "#6B7280",
  };
}
