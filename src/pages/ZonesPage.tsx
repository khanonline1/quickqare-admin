import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import Pagination from "../components/Pagination";
import HubsTab from "./HubsTab";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_KEYS = [
  { key: "acRepair",     label: "AC Repair" },
  { key: "plumbing",    label: "Plumbing" },
  { key: "mehendi",     label: "Mehendi" },
  { key: "electrician", label: "Electrician" },
] as const;

type ServiceKey = typeof SERVICE_KEYS[number]["key"];

const DEFAULT_SERVICES = { acRepair: true, plumbing: true, mehendi: true, electrician: true };

const EMPTY_FORM = {
  primaryPincode: "",
  nearbyPincodes: [] as string[],
  city: "",
  state: "",
  isActive: true,
  customerAppEnabled: true,
  partnerAppEnabled: true,
  services: { ...DEFAULT_SERVICES },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isValidPincode = (p: string) => /^\d{6}$/.test(p.trim());

const zonePincodes = (zone: any): string[] => [
  ...new Set(
    [
      zone.pincode,
      ...(Array.isArray(zone.nearbyPincodes) ? zone.nearbyPincodes : []),
      ...(Array.isArray(zone.extendedPincodes) ? zone.extendedPincodes : []),
    ].filter(Boolean)
  ),
];

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 40, height: 22, borderRadius: 11, position: "relative", flexShrink: 0,
          background: checked ? "var(--accent, #0ea5e9)" : "var(--muted-2, #cbd5e1)",
          transition: "background 0.2s",
          cursor: "pointer",
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: checked ? 21 : 3,
          width: 16, height: 16, borderRadius: "50%", background: "var(--panel)",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 14, color: "var(--text-2)" }}>{label}</span>
    </label>
  );
}

// ─── Pincode Chip Input ────────────────────────────────────────────────────────

function PincodeChipInput({
  chips,
  onChange,
  placeholder = "Type 6-digit pincode and press Enter",
}: {
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addChip = (raw: string) => {
    const val = raw.trim();
    if (!val) return;
    if (!isValidPincode(val)) { setError(`"${val}" is not a valid 6-digit pincode`); return; }
    if (chips.includes(val)) { setError(`${val} already added`); setInput(""); return; }
    setError("");
    onChange([...chips, val]);
    setInput("");
  };

  const removeChip = (chip: string) => onChange(chips.filter((c) => c !== chip));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addChip(input);
    } else if (e.key === "Backspace" && !input && chips.length) {
      removeChip(chips[chips.length - 1]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const values = pasted.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);
    const invalid: string[] = [];
    const toAdd: string[] = [];
    values.forEach((v) => {
      if (!isValidPincode(v)) { invalid.push(v); return; }
      if (!chips.includes(v) && !toAdd.includes(v)) toAdd.push(v);
    });
    if (toAdd.length) onChange([...chips, ...toAdd]);
    if (invalid.length) setError(`Skipped invalid: ${invalid.join(", ")}`);
    else setError("");
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          minHeight: 44, border: "1px solid var(--border)", borderRadius: "var(--radius, 8px)",
          padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
          background: "var(--input-bg, #fff)", cursor: "text",
        }}
      >
        {chips.map((chip) => (
          <span key={chip} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "var(--accent-100, #e0f2fe)", color: "var(--accent-dark, #0369a1)",
            borderRadius: 6, padding: "2px 8px", fontSize: 13, fontWeight: 600,
            border: "1px solid var(--accent-border, #bae6fd)",
          }}>
            {chip}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeChip(chip); }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                color: "var(--accent-dark, #0369a1)", lineHeight: 1, fontSize: 14, fontWeight: 700,
              }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value.replace(/[^0-9]/g, "")); setError(""); }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (input) addChip(input); }}
          maxLength={6}
          placeholder={chips.length === 0 ? placeholder : ""}
          style={{
            border: "none", outline: "none", background: "transparent",
            fontSize: 13, minWidth: 160, flex: 1, padding: "2px 0",
            color: "var(--text)",
          }}
        />
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{error}</div>}
      {chips.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
          {chips.length} pincode{chips.length > 1 ? "s" : ""} added
        </div>
      )}
    </div>
  );
}

// ─── Zone Form Modal ───────────────────────────────────────────────────────────

type ZoneForm = typeof EMPTY_FORM;

function ZoneModal({
  title,
  initial,
  saving,
  onSave,
  onClose,
}: {
  title: string;
  initial: ZoneForm;
  saving: boolean;
  onSave: (form: ZoneForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ZoneForm>(initial);
  const [primaryError, setPrimaryError] = useState("");

  const set = (patch: Partial<ZoneForm>) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = () => {
    if (!isValidPincode(form.primaryPincode)) {
      setPrimaryError("Enter a valid 6-digit primary pincode");
      return;
    }
    setPrimaryError("");
    onSave(form);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: "var(--panel, #fff)", borderRadius: 12, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "var(--muted)", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Location */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Location</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>City <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="e.g. Mumbai"
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>State <span style={{ color: "#dc2626" }}>*</span></label>
                <input
                  className="input"
                  style={{ width: "100%" }}
                  placeholder="e.g. Maharashtra"
                  value={form.state}
                  onChange={(e) => set({ state: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Primary Pincode */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Primary Pincode</div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Primary Pincode <span style={{ color: "#dc2626" }}>*</span>
              <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>— the zone's canonical identifier</span>
            </label>
            <input
              className="input"
              style={{ width: "100%", fontFamily: "monospace", fontSize: 15, letterSpacing: 2 }}
              placeholder="000000"
              maxLength={6}
              value={form.primaryPincode}
              onChange={(e) => { set({ primaryPincode: e.target.value.replace(/\D/g, "") }); setPrimaryError(""); }}
            />
            {primaryError && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{primaryError}</div>}
          </div>

          {/* Serviceable Pincodes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Serviceable Pincodes</div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
              Additional Pincodes
              <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>— partners and customers in any of these can be matched together</span>
            </label>
            <PincodeChipInput
              chips={form.nearbyPincodes}
              onChange={(chips) => set({ nearbyPincodes: chips })}
            />
          </div>

          {/* Visibility Settings */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Zone Settings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Toggle checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Zone Active" />
              <Toggle checked={form.customerAppEnabled} onChange={(v) => set({ customerAppEnabled: v })} label="Visible in Customer App" />
              <Toggle checked={form.partnerAppEnabled} onChange={(v) => set({ partnerAppEnabled: v })} label="Visible in Partner App" />
            </div>
          </div>

          {/* Services */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Available Services</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {SERVICE_KEYS.map(({ key, label }) => (
                <Toggle
                  key={key}
                  checked={form.services[key]}
                  onChange={(v) => set({ services: { ...form.services, [key]: v } })}
                  label={label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="button secondary" onClick={onClose}>Cancel</button>
          <button className="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : title}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ZonesPage({ api }: { api: ApiClient }) {
  const [activeTab, setActiveTab] = useState<"pincode" | "hub">("pincode");
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [showCreate, setShowCreate] = useState(false);
  const [editZone, setEditZone] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/zones?page=${page}`);
    if (res.success) { setRows(res.data); setMeta(res.meta); }
  }, [api]);

  useEffect(() => { fetchRows(1); }, [fetchRows]);

  const createZone = async (form: ZoneForm) => {
    setSaving(true);
    const res = await api.post("/zones", {
      pincode: form.primaryPincode,
      nearbyPincodes: form.nearbyPincodes,
      extendedPincodes: [],
      isActive: form.isActive,
      customerAppEnabled: form.customerAppEnabled,
      partnerAppEnabled: form.partnerAppEnabled,
      city: form.city,
      state: form.state,
      services: form.services,
    });
    setSaving(false);
    if (!res.success) { alert(res.error?.message || "Failed to create zone"); return; }
    setShowCreate(false);
    fetchRows(1);
  };

  const saveEdit = async (form: ZoneForm) => {
    if (!editZone) return;
    setSaving(true);
    const res = await api.patch(`/zones/${editZone._id}`, {
      pincode: form.primaryPincode,
      nearbyPincodes: form.nearbyPincodes,
      extendedPincodes: [],
      isActive: form.isActive,
      customerAppEnabled: form.customerAppEnabled,
      partnerAppEnabled: form.partnerAppEnabled,
      city: form.city,
      state: form.state,
      services: form.services,
    });
    setSaving(false);
    if (!res.success) { alert(res.error?.message || "Failed to update zone"); return; }
    setEditZone(null);
    fetchRows(meta.pagination?.page || 1);
  };

  const openEdit = (row: any) => {
    const allPins = zonePincodes(row);
    setEditZone({
      ...row,
      _editForm: {
        primaryPincode: row.pincode || allPins[0] || "",
        nearbyPincodes: allPins.slice(1),
        city: row.city || "",
        state: row.state || "",
        isActive: row.isActive !== false,
        customerAppEnabled: row.customerAppEnabled !== false,
        partnerAppEnabled: row.partnerAppEnabled !== false,
        services: { ...DEFAULT_SERVICES, ...(row.services || {}) },
      },
    });
  };

  const quickPatch = async (id: string, patch: Record<string, unknown>) => {
    await api.patch(`/zones/${id}`, patch);
    fetchRows(meta.pagination?.page || 1);
  };

  const deleteZone = async (id: string) => {
    if (!window.confirm("Delete this zone? Pincodes it covers will become unserviceable.")) return;
    await api.delete(`/zones/${id}`);
    fetchRows(meta.pagination?.page || 1);
  };

  return (
    <>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Service Zones</h2>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            Each zone defines a group of pincodes where partners and customers can be matched.
          </div>
        </div>
        {activeTab === "pincode" && (
          <button className="button" onClick={() => setShowCreate(true)}>+ Create Zone</button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "2px solid var(--border)", paddingBottom: 0 }}>
        {(["pincode", "hub"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "8px 18px", fontSize: 13, fontWeight: 600,
              borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === tab ? "var(--accent-dark)" : "var(--muted)",
              marginBottom: -2, transition: "color 0.15s",
            }}
          >
            {tab === "pincode" ? "Pincode Zones" : "Hubs"}
            {tab === "hub" && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "1px 5px",
                borderRadius: 4, background: "var(--purple-bg)", color: "var(--purple-text)",
                border: "1px solid var(--purple-border)", verticalAlign: "middle",
              }}>BETA</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "hub" && <HubsTab api={api} />}

      {activeTab === "pincode" && (
        <>
          {/* Zone list */}
          <div className="section">
            {rows.length === 0 ? (
              <div className="empty-state">No zones yet. Create one to get started.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Pincodes</th>
                    <th>Status</th>
                    <th>Services</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const pins = zonePincodes(row);
                    const primaryPin = row.pincode || pins[0];
                    const extraPins = pins.filter((p) => p !== primaryPin);
                    return (
                      <tr key={row._id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{row.city || "—"}</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.state || ""}</div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 300 }}>
                            {primaryPin && (
                              <span style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 12,
                                fontWeight: 700, background: "var(--accent-100, #e0f2fe)",
                                color: "var(--accent-dark, #0369a1)", border: "1px solid var(--accent-border, #bae6fd)",
                              }}>{primaryPin}</span>
                            )}
                            {extraPins.map((p) => (
                              <span key={p} style={{
                                display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 12,
                                fontWeight: 500, background: "var(--bg-2, #f1f5f9)", color: "var(--text-2)",
                                border: "1px solid var(--border)",
                              }}>{p}</span>
                            ))}
                            {pins.length === 1 && (
                              <span style={{ fontSize: 11, color: "var(--warning-text)", display: "block", width: "100%", marginTop: 2 }}>
                                ⚠ Single pincode — add nearby pincodes for better coverage
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: row.isActive ? "#16a34a" : "#dc2626" }}>
                              {row.isActive ? "● Active" : "● Inactive"}
                            </span>
                            <span style={{ fontSize: 12, color: row.customerAppEnabled ? "#16a34a" : "var(--muted)" }}>
                              Customer App: {row.customerAppEnabled ? "On" : "Off"}
                            </span>
                            <span style={{ fontSize: 12, color: row.partnerAppEnabled ? "#16a34a" : "var(--muted)" }}>
                              Partner App: {row.partnerAppEnabled ? "On" : "Off"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {SERVICE_KEYS.map(({ key, label }) => {
                              const on = row.services?.[key] !== false;
                              return (
                                <button
                                  key={key}
                                  onClick={() => quickPatch(row._id, { services: { [key]: !on } })}
                                  title={`Click to toggle ${label}`}
                                  style={{
                                    padding: "2px 8px", fontSize: 11, borderRadius: 4, border: "none",
                                    cursor: "pointer", fontWeight: 600,
                                    background: on ? "var(--success-bg)" : "var(--danger-bg)",
                                    color: on ? "var(--success-text)" : "var(--danger-text)",
                                  }}
                                >{label}</button>
                              );
                            })}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button className="button secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => openEdit(row)}>
                              Edit
                            </button>
                            <button
                              className="button secondary"
                              style={{ fontSize: 12, padding: "5px 10px" }}
                              onClick={() => quickPatch(row._id, { isActive: !row.isActive })}
                            >
                              {row.isActive ? "Disable" : "Enable"}
                            </button>
                            <button className="button danger" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => deleteZone(row._id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <Pagination meta={meta} onPage={fetchRows} />
          </div>

          {/* Create modal */}
          {showCreate && (
            <ZoneModal
              title="Create Zone"
              initial={{ ...EMPTY_FORM }}
              saving={saving}
              onSave={createZone}
              onClose={() => setShowCreate(false)}
            />
          )}

          {/* Edit modal */}
          {editZone && (
            <ZoneModal
              title="Save Changes"
              initial={editZone._editForm}
              saving={saving}
              onSave={saveEdit}
              onClose={() => setEditZone(null)}
            />
          )}
        </>
      )}
    </>
  );
}
