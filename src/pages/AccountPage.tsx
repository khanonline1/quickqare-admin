import React, { useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { AdminUser } from "../types/admin";

const MIN_PASSWORD = 10; // matches the backend rule (admin/utils/common.js)

// Reached from the session menu in the sidebar — every admin can change their
// own password, whatever their role.
export default function AccountPage({ api, me }: { api: ApiClient; me: AdminUser }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const changePassword = async () => {
    if (!currentPassword) {
      setMsg({ ok: false, text: "Enter your current password." });
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setMsg({ ok: false, text: `New password must be at least ${MIN_PASSWORD} characters.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ ok: false, text: "The two new passwords don't match." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post("/auth/change-password", { currentPassword, newPassword });
      if (!res.success) {
        setMsg({ ok: false, text: res.error?.message || "Couldn't change the password." });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg({ ok: true, text: "Password changed. Your other devices have been signed out." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section" style={{ maxWidth: 460 }}>
      <h3>Change Password</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Signed in as {me.email} ({me.role}).
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          className="input"
          type="password"
          placeholder="Current password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder={`New password (min ${MIN_PASSWORD} characters)`}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="New password again"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        {msg && (
          <div style={{ fontSize: 13, color: msg.ok ? "#16a34a" : "#dc2626" }}>{msg.text}</div>
        )}

        <button className="button" onClick={changePassword} disabled={saving}>
          {saving ? "Saving…" : "Change Password"}
        </button>
      </div>
    </div>
  );
}
