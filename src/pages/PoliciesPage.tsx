import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

const POLICY_TYPES = [
  { key: "about",          label: "About Us",                    group: "Customer" },
  { key: "terms",          label: "Terms & Conditions",          group: "Customer" },
  { key: "privacy",        label: "Privacy Policy",              group: "Customer" },
  { key: "refund",         label: "Cancellation & Refund",       group: "Customer" },
  { key: "anti_discrimination", label: "Anti-discrimination Policy", group: "Customer" },
  { key: "partner_terms",  label: "Partner Terms & Conditions",  group: "Partner"  },
  { key: "partner_privacy",label: "Partner Privacy Policy",      group: "Partner"  },
];

export default function PoliciesPage({ api }: { api: ApiClient }) {
  const [activeTab, setActiveTab] = useState(POLICY_TYPES[0].key);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPolicy = useCallback(async (type: string) => {
    setLoading(true);
    setContent("");
    try {
      const res = await api.get<any>(`/policies/${type}`);
      if (res.success && res.data) {
        setContent(res.data.content || "");
      }
    } catch (error) {
      console.error("Failed to load policy:", error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadPolicy(activeTab);
  }, [activeTab, loadPolicy]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/policies/${activeTab}`, { content });
      if (res.success) {
        alert("Policy updated successfully");
      } else {
        alert(res.error?.message || "Failed to update policy");
      }
    } catch (error) {
      alert("Error saving policy");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section">
      <h3>About Us & Policies</h3>
      <p className="muted">Manage policy content displayed in the customer and partner apps.</p>

      {["Customer", "Partner"].map((group) => (
        <div key={group} style={{ marginBottom: "0.75rem" }}>
          <p className="muted" style={{ marginBottom: "0.4rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{group}</p>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            {POLICY_TYPES.filter((t) => t.group === group).map((tab) => (
              <button
                key={tab.key}
                className={`button ${activeTab === tab.key ? "" : "secondary"}`}
                onClick={() => setActiveTab(tab.key)}
                disabled={loading || saving}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {loading ? (
          <div className="muted">Loading content...</div>
        ) : (
          <textarea
            className="input"
            style={{ width: "100%", minHeight: "400px", fontFamily: "inherit", padding: "1rem", lineHeight: "1.6", resize: "vertical" }}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Enter ${POLICY_TYPES.find(t => t.key === activeTab)?.label} here...`}
          />
        )}

        <div className="row">
          <button
            className="button"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
