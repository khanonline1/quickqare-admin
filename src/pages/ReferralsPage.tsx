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

export default function ReferralsPage({ api }: { api: ApiClient }) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [referralsRes, statsRes] = await Promise.all([
        api.get<any>(`/referrals?page=${page}&limit=20`),
        api.get<any>("/referral-stats")
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
  );
}