import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { AdminUser } from "../types/admin";
import { formatDateTime } from "../utils/format";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const EMPTY_FORM = { name: "", email: "", role: "", password: "" };
const MIN_PASSWORD = 10; // matches the backend rule (admin/utils/common.js)

// SuperAdmin only. One login per person: actions in the audit log then carry
// a name, and one person's access can be cut off without touching the others.
export default function AdminsPage({ api, me }: { api: ApiClient; me: AdminUser }) {
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const fetchRows = useCallback(async () => {
    const res = await api.get<AdminRow[]>("/admins");
    if (res.success) setRows(res.data);
  }, [api]);

  useEffect(() => {
    fetchRows();
    api.get<{ role: string }[]>("/roles").then((res) => res.success && setRoles(res.data.map((r) => r.role)));
  }, [api, fetchRows]);

  const createAdmin = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.role) {
      alert("Enter a name, an email and pick a role");
      return;
    }
    if (form.password.length < MIN_PASSWORD) {
      alert(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<AdminRow>("/admins", {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        password: form.password,
      });
      if (!res.success) { alert(res.error?.message || "Failed to add admin"); return; }
      setForm(EMPTY_FORM);
      fetchRows();
    } finally {
      setSaving(false);
    }
  };

  const patchAdmin = async (row: AdminRow, patch: Record<string, unknown>) => {
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      const res = await api.patch<AdminRow>(`/admins/${row.id}`, patch);
      if (!res.success) alert(res.error?.message || "Failed to update admin");
      fetchRows();
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  };

  const changeRole = (row: AdminRow, role: string) => {
    if (role === row.role) return;
    if (!window.confirm(`Change ${row.email} from ${row.role} to ${role}? They will be signed out and must sign in again.`)) return;
    patchAdmin(row, { role });
  };

  const toggleActive = (row: AdminRow) => {
    if (row.isActive && !window.confirm(`Disable ${row.email}? They are signed out everywhere and can't sign in until you enable them again.`)) return;
    patchAdmin(row, { isActive: !row.isActive });
  };

  const resetPassword = async (row: AdminRow) => {
    const password = newPassword[row.id] || "";
    if (password.length < MIN_PASSWORD) {
      alert(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (!window.confirm(`Set a new password for ${row.email}? They will be signed out everywhere.`)) return;
    setBusy((b) => ({ ...b, [row.id]: true }));
    try {
      const res = await api.post(`/admins/${row.id}/password`, { password });
      if (!res.success) { alert(res.error?.message || "Failed to set password"); return; }
      setNewPassword((p) => ({ ...p, [row.id]: "" }));
      alert("Password updated. Pass it on privately — they can change it after signing in.");
    } finally {
      setBusy((b) => ({ ...b, [row.id]: false }));
    }
  };

  return (
    <>
      <div className="section">
        <h3>Add Admin</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Give each person their own login. The sign-in code is emailed to this address, so use an inbox only that
          person can open.
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="">Role…</option>
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <input
            className="input"
            type="password"
            placeholder={`Password (${MIN_PASSWORD}+ characters)`}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <button className="button" onClick={createAdmin} disabled={saving}>{saving ? "Adding…" : "Add Admin"}</button>
        </div>
      </div>

      <div className="section">
        <h3>Admin Users</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Set password</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isMe = row.id === me.id;
              return (
                <tr key={row.id}>
                  <td>{row.name}{isMe && <span className="muted"> (you)</span>}</td>
                  <td>{row.email}</td>
                  <td>
                    <select
                      value={row.role}
                      disabled={isMe || busy[row.id]}
                      title={isMe ? "Another SuperAdmin has to change your role" : undefined}
                      onChange={(e) => changeRole(row, e.target.value)}
                    >
                      {(roles.includes(row.role) ? roles : [row.role, ...roles]).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`tag ${row.isActive ? "tag-active" : "tag-inactive"}`}>
                      {row.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--muted)" }}>{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : "Never"}</td>
                  <td>
                    {isMe ? (
                      <span className="muted" style={{ fontSize: 12 }}>Use Change Password in the menu below your email</span>
                    ) : (
                      <div className="row" style={{ gap: 6 }}>
                        <input
                          className="input"
                          type="password"
                          placeholder="New password"
                          autoComplete="new-password"
                          value={newPassword[row.id] || ""}
                          onChange={(e) => setNewPassword((p) => ({ ...p, [row.id]: e.target.value }))}
                          style={{ fontSize: 12, width: 150 }}
                        />
                        <button
                          className="button secondary"
                          style={{ fontSize: 12 }}
                          disabled={busy[row.id] || !(newPassword[row.id] || "")}
                          onClick={() => resetPassword(row)}
                        >
                          Set
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      className={`button ${row.isActive ? "danger" : "success"}`}
                      style={{ fontSize: 12 }}
                      disabled={isMe || busy[row.id]}
                      title={isMe ? "Another SuperAdmin has to disable your account" : undefined}
                      onClick={() => toggleActive(row)}
                    >
                      {row.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
