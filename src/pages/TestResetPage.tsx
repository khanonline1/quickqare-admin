import React, { useState } from "react";
import type { ApiClient } from "../api/adminApi";

const CONFIRM_PHRASE = "RESET ALL DATA";

export default function TestResetPage({ api }: { api: ApiClient }) {
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleReset = async () => {
    if (phrase !== CONFIRM_PHRASE) {
      setError(`Type exactly: ${CONFIRM_PHRASE}`);
      return;
    }

    const confirmed = window.confirm(
      "FINAL WARNING\n\nThis will permanently delete:\n" +
      "• All bookings\n• All partners & their wallets\n• All customers & their wallets\n" +
      "• All ratings, complaints, referrals, payouts\n• All slot locks and audit logs\n\n" +
      "Catalog, zones, banners, policies, coupons, and admin accounts will be kept.\n\n" +
      "This cannot be undone. Proceed?"
    );
    if (!confirmed) return;

    setLoading(true);
    setError("");
    setResult(null);

    const res = await api.post<any>("/test-reset", { confirm: CONFIRM_PHRASE });

    setLoading(false);

    if (res.success) {
      setResult(res.data);
      setPhrase("");
    } else {
      setError(res.error?.message || "Reset failed");
    }
  };

  return (
    <div className="section">
      <div style={{
        background: "var(--warning-bg)", border: "1px solid #ffc107", borderRadius: 8,
        padding: "16px 20px", marginBottom: 24,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--warning-text)", marginBottom: 6 }}>
          Testing Phase — Data Reset
        </div>
        <div style={{ fontSize: 13, color: "var(--warning-text)", lineHeight: 1.6 }}>
          Use this before your production launch to wipe all test bookings, partners, customers,
          wallets, ratings, complaints, referrals, and audit logs.
          Catalog, zones, banners, policies, coupons, and admin accounts are <strong>preserved</strong>.
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, borderLeft: "4px solid #dc2626" }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#dc2626", marginBottom: 4 }}>
          Reset All Test Data
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Deletes all transactional data. <strong>This is irreversible.</strong> Make sure you have
          a backup if you need to keep anything.
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6, fontWeight: 600 }}>
            What will be deleted:
          </div>
          <ul style={{ fontSize: 13, color: "var(--muted)", margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li>All Bookings</li>
            <li>All Partners and their wallets</li>
            <li>All Customers (Users) and their wallets</li>
            <li>All Ratings, Complaints, Referrals</li>
            <li>All Payouts, Disputes, Refunds</li>
            <li>All Slot locks and capacity records</li>
            <li>All Audit logs</li>
          </ul>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6, fontWeight: 600 }}>
            What will be kept:
          </div>
          <ul style={{ fontSize: 13, color: "var(--muted)", margin: 0, paddingLeft: 20, lineHeight: 1.9 }}>
            <li>Admin accounts</li>
            <li>Services, Item catalog, Categories</li>
            <li>Zones, Banners, Policies</li>
            <li>Coupons, Referral settings</li>
          </ul>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 6 }}>
            Type <code style={{ background: "var(--panel-alt)", padding: "1px 5px", borderRadius: 3 }}>{CONFIRM_PHRASE}</code> to confirm:
          </label>
          <input
            className="input"
            value={phrase}
            onChange={(e) => { setPhrase(e.target.value); setError(""); }}
            placeholder={CONFIRM_PHRASE}
            style={{ fontFamily: "monospace", letterSpacing: 1 }}
          />
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <button
          className="button danger"
          onClick={handleReset}
          disabled={loading || phrase !== CONFIRM_PHRASE}
          style={{ width: "100%" }}
        >
          {loading ? "Resetting…" : "Reset All Test Data"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 24, maxWidth: 560 }}>
          <div style={{
            background: "var(--success-bg)", border: "1px solid #bbf7d0", borderRadius: 8,
            padding: "14px 18px", marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, color: "var(--success-text)", marginBottom: 4 }}>Reset complete</div>
            <div style={{ fontSize: 13, color: "var(--success-text)" }}>
              {result.totalDeleted} documents deleted. {result.message}
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Breakdown</div>
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr><th>Collection</th><th>Deleted</th></tr>
              </thead>
              <tbody>
                {Object.entries(result.breakdown as Record<string, number>)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([col, count]) => (
                    <tr key={col}>
                      <td style={{ fontFamily: "monospace" }}>{col}</td>
                      <td style={{ fontWeight: 700, color: "#dc2626" }}>{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
