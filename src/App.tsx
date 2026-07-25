import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, Tokens } from "./types/admin";
import { createAdminApi } from "./api/adminApi";
import { PERM_SYSTEM_RESET } from "./constants/nav";
import { secureGet, secureRemove, secureSet } from "./api/secureStore";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import PartnersPage from "./pages/PartnersPage";
import PartnerLeadsPage from "./pages/PartnerLeadsPage";
import HelpersPage from "./pages/HelpersPage";
import ServicesPage from "./pages/ServicesPage";
import CatalogPage from "./pages/CatalogPage";
import BookingsPage from "./pages/BookingsPage";
import PaymentsPage from "./pages/PaymentsPage";
import AuditPage from "./pages/AuditPage";
import DisputesPage from "./pages/DisputesPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LearningPage from "./pages/LearningPage";
import CouponsPage from "./pages/CouponsPage";
import ZonesPage from "./pages/ZonesPage";
import BannersPage from "./pages/BannersPage";
import RolesPage from "./pages/RolesPage";
import SettingsPage from "./pages/SettingsPage";
import ReferralsPage from "./pages/ReferralsPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ComplaintDetailsPage from "./pages/ComplaintDetailsPage";
import PoliciesPage from "./pages/PoliciesPage";
import TestResetPage from "./pages/TestResetPage";
import LiveTrackingPage from "./pages/LiveTrackingPage";
import OffersPage from "./pages/OffersPage";
import NotificationsPage from "./pages/NotificationsPage";

export default function App() {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [active, setActive] = useState("dashboard");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  // Tokens are decrypted asynchronously on load; gate rendering until that
  // finishes so a reload doesn't briefly flash the login screen.
  const [hydrated, setHydrated] = useState(false);

  const handleNavigate = useCallback((newActive: string) => {
    setActive(newActive);
    setSelectedComplaintId(null); // Reset complaint details when navigating away
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await secureGet("qq_admin_tokens");
      const rawAdmin = await secureGet("qq_admin_user");
      if (raw) { try { setTokens(JSON.parse(raw)); } catch {} }
      if (rawAdmin) { try { setAdmin(JSON.parse(rawAdmin)); } catch {} }
      setHydrated(true);
    })();
  }, []);

  const persistTokens = useCallback((next: Tokens | null) => {
    setTokens(next);
    if (next) void secureSet("qq_admin_tokens", JSON.stringify(next));
    else secureRemove("qq_admin_tokens");
  }, []);

  const persistAdmin = useCallback((next: AdminUser | null) => {
    setAdmin(next);
    if (next) void secureSet("qq_admin_user", JSON.stringify(next));
    else secureRemove("qq_admin_user");
  }, []);

  const api = useMemo(() => createAdminApi(() => tokens, persistTokens), [tokens, persistTokens]);

  const handleLogout = useCallback(async () => {
    if (tokens?.refreshToken) {
      await api.post("/auth/logout", { refreshToken: tokens.refreshToken });
    }
    persistTokens(null);
    persistAdmin(null);
  }, [api, tokens, persistTokens, persistAdmin]);

  const handleLogoutAll = useCallback(async () => {
    await api.post("/auth/logout", {});
    persistTokens(null);
    persistAdmin(null);
  }, [api, persistTokens, persistAdmin]);

  if (!hydrated) return null;

  if (!tokens || !admin) {
    return <LoginPage api={api} onAuth={(t, u) => { persistTokens(t); persistAdmin(u); }} />;
  }

  return (
    <Layout admin={admin} active={active} onNavigate={handleNavigate} onLogout={handleLogout} onLogoutAll={handleLogoutAll}>
      {active === "dashboard" && <DashboardPage api={api} />}
      {active === "customers" && <CustomersPage api={api} />}
      {active === "partners" && <PartnersPage api={api} />}
      {active === "partner-leads" && <PartnerLeadsPage api={api} />}
      {active === "helpers" && <HelpersPage api={api} />}
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
      {active === "learning" && <LearningPage api={api} />}
      {active === "coupons" && <CouponsPage api={api} />}
      {active === "referrals" && <ReferralsPage api={api} />}
      {active === "live-tracking" && <LiveTrackingPage api={api} />}
      {active === "zones" && <ZonesPage api={api} />}
      {active === "banners" && <BannersPage api={api} />}
      {active === "offers" && <OffersPage api={api} />}
      {active === "notifications" && <NotificationsPage api={api} />}
      {active === "roles" && <RolesPage api={api} />}
      {active === "settings" && <SettingsPage api={api} />}
      {active === "policies" && <PoliciesPage api={api} />}
      {active === "test-reset" && admin.permissions.includes(PERM_SYSTEM_RESET) && (
        <TestResetPage api={api} />
      )}
    </Layout>
  );
}
