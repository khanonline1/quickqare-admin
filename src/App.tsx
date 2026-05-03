import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, Tokens } from "./types/admin";
import { createAdminApi } from "./api/adminApi";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import PartnersPage from "./pages/PartnersPage";
import ServicesPage from "./pages/ServicesPage";
import CatalogPage from "./pages/CatalogPage";
import BookingsPage from "./pages/BookingsPage";
import PaymentsPage from "./pages/PaymentsPage";
import AuditPage from "./pages/AuditPage";
import DisputesPage from "./pages/DisputesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CouponsPage from "./pages/CouponsPage";
import ZonesPage from "./pages/ZonesPage";
import BannersPage from "./pages/BannersPage";
import RolesPage from "./pages/RolesPage";
import SettingsPage from "./pages/SettingsPage";
import ReferralsPage from "./pages/ReferralsPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ComplaintDetailsPage from "./pages/ComplaintDetailsPage";
import PoliciesPage from "./pages/PoliciesPage";

export default function App() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [active, setActive] = useState("dashboard");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);

  const handleNavigate = useCallback((newActive: string) => {
    setActive(newActive);
    setSelectedComplaintId(null); // Reset complaint details when navigating away
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem("qq_admin_tokens");
    const rawAdmin = localStorage.getItem("qq_admin_user");
    if (raw) setTokens(JSON.parse(raw));
    if (rawAdmin) setAdmin(JSON.parse(rawAdmin));
  }, []);

  const persistTokens = useCallback((next: Tokens | null) => {
    setTokens(next);
    if (next) localStorage.setItem("qq_admin_tokens", JSON.stringify(next));
    else localStorage.removeItem("qq_admin_tokens");
  }, []);

  const persistAdmin = useCallback((next: AdminUser | null) => {
    setAdmin(next);
    if (next) localStorage.setItem("qq_admin_user", JSON.stringify(next));
    else localStorage.removeItem("qq_admin_user");
  }, []);

  const api = useMemo(() => createAdminApi(() => tokens, persistTokens), [tokens, persistTokens]);

  const handleLogout = useCallback(async () => {
    if (tokens?.refreshToken) {
      await api.post("/auth/logout", { refreshToken: tokens.refreshToken });
    }
    persistTokens(null);
    persistAdmin(null);
  }, [api, tokens, persistTokens, persistAdmin]);

  if (!tokens || !admin) {
    return <LoginPage api={api} onAuth={(t, u) => { persistTokens(t); persistAdmin(u); }} />;
  }

  return (
    <Layout admin={admin} active={active} onNavigate={handleNavigate} onLogout={handleLogout}>
      {active === "dashboard" && <DashboardPage api={api} />}
      {active === "customers" && <CustomersPage api={api} />}
      {active === "partners" && <PartnersPage api={api} />}
      {active === "services" && <ServicesPage api={api} />}
      {active === "catalog" && <CatalogPage api={api} />}
      {active === "bookings" && <BookingsPage api={api} />}
      {active === "payments" && <PaymentsPage api={api} />}
      {active === "complaints" && !selectedComplaintId && (
        <ComplaintsPage
          api={api}
          onNavigateToDetails={setSelectedComplaintId}
        />
      )}
      {active === "complaints" && selectedComplaintId && (
        <ComplaintDetailsPage
          complaintId={selectedComplaintId}
          api={api}
          onClose={() => setSelectedComplaintId(null)}
        />
      )}
      {active === "audit" && <AuditPage api={api} />}
      {active === "disputes" && <DisputesPage api={api} />}
      {active === "analytics" && <AnalyticsPage api={api} />}
      {active === "coupons" && <CouponsPage api={api} />}
      {active === "referrals" && <ReferralsPage api={api} />}
      {active === "zones" && <ZonesPage api={api} />}
      {active === "banners" && <BannersPage api={api} />}
      {active === "roles" && <RolesPage api={api} />}
      {active === "settings" && <SettingsPage api={api} />}
      {active === "policies" && <PoliciesPage api={api} />}
    </Layout>
  );
}
