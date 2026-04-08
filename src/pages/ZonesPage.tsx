import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { ApiMeta } from "../types/admin";
import Pagination from "../components/Pagination";

const parseList = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export default function ZonesPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<any[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({});
  const [form, setForm] = useState({
    pincode: "",
    nearby: "",
    extended: "",
    isActive: true,
    customerAppEnabled: true,
    partnerAppEnabled: true,
    city: "",
    state: ""
  });

  const fetchRows = useCallback(async (page = 1) => {
    const res = await api.get<any>(`/zones?page=${page}`);
    if (res.success) {
      setRows(res.data);
      setMeta(res.meta);
    }
  }, [api]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const createZone = async () => {
    await api.post("/zones", {
      pincode: form.pincode,
      nearbyPincodes: parseList(form.nearby),
      extendedPincodes: parseList(form.extended),
      isActive: form.isActive,
      customerAppEnabled: form.customerAppEnabled,
      partnerAppEnabled: form.partnerAppEnabled,
      city: form.city,
      state: form.state
    });
    setForm({
      pincode: "",
      nearby: "",
      extended: "",
      isActive: true,
      customerAppEnabled: true,
      partnerAppEnabled: true,
      city: "",
      state: ""
    });
    fetchRows(meta.pagination?.page || 1);
  };

  const updateZone = async (id: string, patch: Record<string, unknown>) => {
    await api.patch(`/zones/${id}`, patch);
    fetchRows(meta.pagination?.page || 1);
  };

  const deleteZone = async (id: string) => {
    await api.delete(`/zones/${id}`);
    fetchRows(meta.pagination?.page || 1);
  };

  return (
    <>
      <div className="section">
        <h3>Create Zone</h3>
        <div className="row">
          <input className="input" placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          <input className="input" placeholder="Nearby pincodes (csv)" value={form.nearby} onChange={(e) => setForm({ ...form, nearby: e.target.value })} />
          <input className="input" placeholder="Extended pincodes (csv)" value={form.extended} onChange={(e) => setForm({ ...form, extended: e.target.value })} />
          <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input" placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <label className="row" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <label className="row" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={form.customerAppEnabled} onChange={(e) => setForm({ ...form, customerAppEnabled: e.target.checked })} />
            Customer App
          </label>
          <label className="row" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={form.partnerAppEnabled} onChange={(e) => setForm({ ...form, partnerAppEnabled: e.target.checked })} />
            Partner App
          </label>
          <button className="button" onClick={createZone}>Create</button>
        </div>
      </div>

      <div className="section">
        <table className="table">
          <thead>
            <tr>
              <th>Pincode</th>
              <th>Nearby</th>
              <th>Extended</th>
              <th>Active</th>
              <th>Customer App</th>
              <th>Partner App</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>{row.pincode}</td>
                <td>{(row.nearbyPincodes || []).join(", ")}</td>
                <td>{(row.extendedPincodes || []).join(", ")}</td>
                <td>{row.isActive ? "Yes" : "No"}</td>
                <td>{row.customerAppEnabled ? "Yes" : "No"}</td>
                <td>{row.partnerAppEnabled ? "Yes" : "No"}</td>
                <td>
                  <div className="row">
                    <button className="button secondary" onClick={() => updateZone(row._id, { isActive: !row.isActive })}>
                      {row.isActive ? "Disable" : "Enable"}
                    </button>
                    <button className="button secondary" onClick={() => updateZone(row._id, { customerAppEnabled: !row.customerAppEnabled })}>
                      Customer {row.customerAppEnabled ? "Off" : "On"}
                    </button>
                    <button className="button secondary" onClick={() => updateZone(row._id, { partnerAppEnabled: !row.partnerAppEnabled })}>
                      Partner {row.partnerAppEnabled ? "Off" : "On"}
                    </button>
                    <button className="button danger" onClick={() => deleteZone(row._id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination meta={meta} onPage={fetchRows} />
      </div>
    </>
  );
}
