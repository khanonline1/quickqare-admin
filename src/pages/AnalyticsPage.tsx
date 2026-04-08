import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import { currency } from "../utils/format";

export default function AnalyticsPage({ api }: { api: ApiClient }) {
  const [city, setCity] = useState<any[]>([]);
  const [service, setService] = useState<any[]>([]);
  const [peak, setPeak] = useState<any[]>([]);

  useEffect(() => {
    api.get<any>("/analytics/revenue-by-city").then((res) => res.success && setCity(res.data));
    api.get<any>("/analytics/service-mix").then((res) => res.success && setService(res.data));
    api.get<any>("/analytics/peak-hours").then((res) => res.success && setPeak(res.data));
  }, [api]);

  return (
    <>
      <div className="section">
        <h3>Revenue by City (Pincode)</h3>
        <table className="table">
          <thead><tr><th>Pincode</th><th>Revenue</th><th>Bookings</th></tr></thead>
          <tbody>
            {city.map((row) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{currency.format(row.totalRevenue || 0)}</td>
                <td>{row.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3>Service Mix</h3>
        <table className="table">
          <thead><tr><th>Category</th><th>Bookings</th></tr></thead>
          <tbody>
            {service.map((row) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{row.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section">
        <h3>Peak Hours</h3>
        <table className="table">
          <thead><tr><th>Time Slot</th><th>Bookings</th></tr></thead>
          <tbody>
            {peak.map((row) => (
              <tr key={row._id}>
                <td>{row._id}</td>
                <td>{row.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
