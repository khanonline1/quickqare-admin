import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

type Referral = {
  _id: string;
  referrerId: { name: string; phone: string };
  referredId: { name: string; phone: string };
  status: string;
  rewardGiven: boolean;
  referrerRewardAmount: number;
  couponId?: { code: string; discountValue: number; expiryDate: string };
  createdAt: string;
  completedAt?: string;
};

type ReferralStats = {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  expiredReferrals: number;
  invalidReferrals: number;
  totalRewardsDistributed: number;
};

const TABS = [
  { key: "management", label: "Management" },
  { key: "settings", label: "Settings" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ReferralsPage({ api }: { api: ApiClient }) {
  const [tab, setTab] = useState<TabKey>("management");

  // ── Management state ──
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── Settings state ──
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referrerRewardAmount, setReferrerRewardAmount] = useState(50);
  const [newUserDiscountAmount, setNewUserDiscountAmount] = useState(100);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [couponExpiryDays, setCouponExpiryDays] = useState(30);
  const [maxReferralsPerUser, setMaxReferralsPerUser] = useState(10);
  const [couponDescription, setCouponDescription] = useState(
    "Referral discount for new users"
  );

  useEffect(() => {
    loadData();
  }, [page]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [referralsRes, statsRes] = await Promise.all([
        api.get<any>(`/referrals?page=${page}&limit=20`),
        api.get<any>("/referrals/referral-stats"),
      ]);

      if (referralsRes.success) {
        setReferrals(referralsRes.data.referrals);
        setTotalPages(referralsRes.data.pagination.pages);
      }

      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error("Error loading referrals:", error);
    }
    setLoading(false);
  };

  const loadSettings = async () => {
    try {
      const res = await api.get<any>("/referrals/referral-settings");
      if (res.success) {
        setReferralEnabled(res.data.isEnabled ?? true);
        setReferrerRewardAmount(res.data.referrerRewardAmount ?? 50);
        setNewUserDiscountAmount(res.data.newUserDiscountAmount ?? 100);
        setMinOrderAmount(res.data.minOrderAmount ?? 0);
        setCouponExpiryDays(res.data.couponExpiryDays ?? 30);
        setMaxReferralsPerUser(res.data.maxReferralsPerUser ?? 10);
        setCouponDescription(
          res.data.couponDescription ?? "Referral discount for new users"
        );
      }
    } catch (error) {
      console.error("Error loading referral settings:", error);
    }
    setSettingsLoading(false);
  };

  const saveReferralSettings = async () => {
    const res = await api.put("/referrals/referral-settings", {
      isEnabled: referralEnabled,
      referrerRewardAmount: Number(referrerRewardAmount),
      newUserDiscountAmount: Number(newUserDiscountAmount),
      minOrderAmount: Number(minOrderAmount),
      couponExpiryDays: Number(couponExpiryDays),
      maxReferralsPerUser: Number(maxReferralsPerUser),
      couponDescription,
    });
    if (res.success) {
      alert("Referral settings updated");
    } else {
      alert(res.error?.message || "Failed to update referral settings");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "green";
      case "PENDING": return "orange";
      case "EXPIRED": return "red";
      case "INVALID": return "red";
      default: return "gray";
    }
  };

  return (
    <>
      <div className="section" style={{ display: "flex", gap: 8 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "button" : "button secondary"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "management" && (
        <div className="section">
          <h3>Referral Management</h3>

          {stats && (
            <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
              <div className="stat-card">
                <div className="stat-value">{stats.totalReferrals}</div>
                <div className="stat-label">Total Referrals</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.pendingReferrals}</div>
                <div className="stat-label">Pending</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.completedReferrals}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">₹{stats.totalRewardsDistributed}</div>
                <div className="stat-label">Rewards Distributed</div>
              </div>
            </div>
          )}

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th>Referred User</th>
                  <th>Status</th>
                  <th>Reward Given</th>
                  <th>Reward Amount</th>
                  <th>Coupon</th>
                  <th>Created</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center" }}>Loading...</td>
                  </tr>
                ) : referrals.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center" }}>No referrals found</td>
                  </tr>
                ) : (
                  referrals.map((referral) => (
                    <tr key={referral._id}>
                      <td>
                        <div>{referral.referrerId.name}</div>
                        <div className="muted">{referral.referrerId.phone}</div>
                      </td>
                      <td>
                        <div>{referral.referredId.name}</div>
                        <div className="muted">{referral.referredId.phone}</div>
                      </td>
                      <td>
                        <span className={`tag ${getStatusColor(referral.status)}`}>
                          {referral.status}
                        </span>
                      </td>
                      <td>
                        <span className={`tag ${referral.rewardGiven ? 'green' : 'red'}`}>
                          {referral.rewardGiven ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>₹{referral.referrerRewardAmount || 0}</td>
                      <td>
                        {referral.couponId ? (
                          <div>
                            <div>{referral.couponId.code}</div>
                            <div className="muted">₹{referral.couponId.discountValue}</div>
                          </div>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                      <td>{new Date(referral.createdAt).toLocaleDateString()}</td>
                      <td>
                        {referral.completedAt ? (
                          new Date(referral.completedAt).toLocaleDateString()
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination" style={{ marginTop: "1rem", textAlign: "center" }}>
              <button
                className="button secondary"
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span style={{ margin: "0 1rem" }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="button secondary"
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && (
        <div className="section">
          <h3>Referral System Settings</h3>
          <div className="row" style={{ alignItems: "center", marginBottom: "1rem" }}>
            <label className="row" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={referralEnabled}
                onChange={(e) => setReferralEnabled(e.target.checked)}
                disabled={settingsLoading}
              />
              Enable referral system
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label>Referrer Reward Amount (₹)</label>
              <input
                type="number"
                value={referrerRewardAmount}
                onChange={(e) => setReferrerRewardAmount(Number(e.target.value))}
                disabled={settingsLoading}
                min="0"
              />
            </div>
            <div>
              <label>New User Discount Amount (₹)</label>
              <input
                type="number"
                value={newUserDiscountAmount}
                onChange={(e) => setNewUserDiscountAmount(Number(e.target.value))}
                disabled={settingsLoading}
                min="0"
              />
            </div>
            <div>
              <label>Minimum Order Amount (₹)</label>
              <input
                type="number"
                value={minOrderAmount}
                onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                disabled={settingsLoading}
                min="0"
              />
            </div>
            <div>
              <label>Coupon Expiry Days</label>
              <input
                type="number"
                value={couponExpiryDays}
                onChange={(e) => setCouponExpiryDays(Number(e.target.value))}
                disabled={settingsLoading}
                min="1"
              />
            </div>
            <div>
              <label>Max Referrals Per User</label>
              <input
                type="number"
                value={maxReferralsPerUser}
                onChange={(e) => setMaxReferralsPerUser(Number(e.target.value))}
                disabled={settingsLoading}
                min="1"
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>Coupon Description</label>
            <input
              type="text"
              value={couponDescription}
              onChange={(e) => setCouponDescription(e.target.value)}
              disabled={settingsLoading}
              style={{ width: "100%" }}
            />
          </div>

          <button className="button" onClick={saveReferralSettings} disabled={settingsLoading}>
            Save Referral Settings
          </button>

          <p className="muted" style={{ marginTop: "1rem" }}>
            When a new user signs up with a referral code and completes their first booking above the minimum order amount,
            the referrer receives the reward amount in their wallet and the new user gets a discount coupon.
          </p>
        </div>
      )}
    </>
  );
}
