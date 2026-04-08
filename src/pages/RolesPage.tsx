import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

export default function RolesPage({ api }: { api: ApiClient }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    api.get<any>("/roles").then((res) => res.success && setRoles(res.data));
    api.get<any>("/permissions").then((res) => res.success && setPermissions(res.data));
  }, [api]);

  return (
    <>
      <div className="section">
        <h3>Roles</h3>
        <table className="table">
          <thead><tr><th>Role</th><th>Permissions</th></tr></thead>
          <tbody>
            {roles.map((row) => (
              <tr key={row.role}>
                <td>{row.role}</td>
                <td>{row.permissions?.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3>Permissions</h3>
        <div className="row" style={{ gap: 8 }}>
          {permissions.map((perm) => (
            <span className="tag" key={perm}>{perm}</span>
          ))}
        </div>
      </div>
    </>
  );
}
