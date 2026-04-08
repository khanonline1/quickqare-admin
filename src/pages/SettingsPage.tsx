import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

export default function SettingsPage({ api }: { api: ApiClient }) {
  const [partnerSubscriptionRequired, setPartnerSubscriptionRequired] = useState(false);
  const [partnerVerificationRequired, setPartnerVerificationRequired] = useState(false);
  const [partnerSelfieRequired, setPartnerSelfieRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>("/settings").then((res) => {
      if (res.success) {
        setPartnerSubscriptionRequired(Boolean(res.data.partnerSubscriptionRequired));
        setPartnerVerificationRequired(Boolean(res.data.partnerVerificationRequired));
        setPartnerSelfieRequired(Boolean(res.data.partnerSelfieRequired));
      }
      setLoading(false);
    });
  }, [api]);

  const save = async () => {
    await api.patch("/settings", {
      partnerSubscriptionRequired,
      partnerVerificationRequired,
      partnerSelfieRequired,
    });
    alert("Settings updated");
  };

  return (
    <div className="section">
      <h3>App Settings</h3>
      <div className="row" style={{ alignItems: "center" }}>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={partnerSubscriptionRequired}
            onChange={(e) => setPartnerSubscriptionRequired(e.target.checked)}
            disabled={loading}
          />
          Partner subscription required
        </label>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={partnerVerificationRequired}
            onChange={(e) => setPartnerVerificationRequired(e.target.checked)}
            disabled={loading}
          />
          Partner KYC/bank verification required
        </label>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={partnerSelfieRequired}
            onChange={(e) => setPartnerSelfieRequired(e.target.checked)}
            disabled={loading}
          />
          Partner selfie required at signup
        </label>
        <button className="button" onClick={save} disabled={loading}>Save</button>
      </div>
      <p className="muted">
        When enabled, partners must have an active subscription to log in. This is OFF by default.
      </p>
      <p className="muted">
        When partner verification is OFF, KYC and bank verification stay visible in the app but do not block partner operations.
      </p>
      <p className="muted">
        Selfie collection can be enabled later from admin. It stays OFF by default for now.
      </p>
    </div>
  );
}
