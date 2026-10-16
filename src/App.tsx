import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminUser, Tokens } from "./types/admin";
import { createAdminApi } from "./api/adminApi";
import { PERM_ACTIVITY_READ, PERM_ADMINS_MANAGE, PERM_SYSTEM_RESET } from "./constants/nav";
import {
  ADMIN_KEY,
  TOKENS_KEY,
  readStoredAdmin,
  readStoredTokens,
  storeAdmin,
  storeTokens,
} from "./api/tokenStore";
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
import AdminsPage from "./pages/AdminsPage";
import AccountPage from "./pages/AccountPage";
import ActivityPage from "./pages/ActivityPage";

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
      const storedTokens = await readStoredTokens();
      const storedAdmin = await readStoredAdmin();
      if (storedTokens) setTokens(storedTokens);
      if (storedAdmin) setAdmin(storedAdmin);
      setHydrated(true);
    })();
  }, []);

  // Another tab signed in, or refreshed its tokens (each refresh swaps the
  // refresh token for a new one): take what it stored, so this tab never
  // presents the old one. A removal is deliberately ignored — if the other tab
  // signed out, the session is revoked on the server and this tab's next
  // request ends it here too; a tab that merely lost its own session must not
  // take the others down with it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.newValue === null) return;
      if (event.key === TOKENS_KEY) void readStoredTokens().then((stored) => stored && setTokens(stored));
      if (event.key === ADMIN_KEY) void readStoredAdmin().then((stored) => stored && setAdmin(stored));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Returns the storage write, so a token refresh can wait until the new pair
  // is there for the other tabs before it lets the next one go.
  const persistTokens = useCallback((next: Tokens | null) => {
    setTokens(next);
    return storeTokens(next);
  }, []);

  const persistAdmin = useCallback((next: AdminUser | null) => {
    setAdmin(next);
    void storeAdmin(next);
  }, []);

  const api = useMemo(() => createAdminApi(() => tokens, persistTokens, setTokens), [tokens, persistTokens]);

  // The role and permissions shown here were saved at sign-in. Re-read them
  // once on load, so a permission added since (or a role change) reaches the
  // menu without signing in again. The backend checks every request regardless.
  useEffect(() => {
    if (!hydrated || !tokens) return;
    api.get<AdminUser>("/auth/me").then((res) => {
      if (res.success && res.data) persistAdmin(res.data);
    });
    // Once per page load — not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const handleLogout = useCallback(async () => {
    if (tokens?.refreshToken) {
      await api.post("/auth/logout", { refreshToken: tokens.refreshToken });
    }
    void persistTokens(null);
    persistAdmin(null);
  }, [api, tokens, persistTokens, persistAdmin]);

  const handleLogoutAll = useCallback(async () => {
    await api.post("/auth/logout", {});
    void persistTokens(null);
    persistAdmin(null);
  }, [api, persistTokens, persistAdmin]);

  if (!hydrated) return null;

  if (!tokens || !admin) {
    return <LoginPage api={api} onAuth={(t, u) => { void persistTokens(t); persistAdmin(u); }} />;
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
      {active === "admins" && admin.permissions.includes(PERM_ADMINS_MANAGE) && (
        <AdminsPage api={api} me={admin} />
      )}
      {active === "activity" && admin.permissions.includes(PERM_ACTIVITY_READ) && <ActivityPage api={api} />}
      {active === "account" && <AccountPage api={api} me={admin} />}
      {active === "settings" && <SettingsPage api={api} />}
      {active === "policies" && <PoliciesPage api={api} />}
      {active === "test-reset" && admin.permissions.includes(PERM_SYSTEM_RESET) && (
        <TestResetPage api={api} />
      )}
    </Layout>
  );
}
