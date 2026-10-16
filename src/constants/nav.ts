import type { NavItem } from "../types/admin";

// Must match the backend permission string (admin/constants/permissions.js →
// SYSTEM_RESET). Only SuperAdmin is granted it, so only SuperAdmin sees the
// destructive "Test Data Reset" tool.
export const PERM_SYSTEM_RESET = "system.reset";

// Backend ADMINS_MANAGE — also SuperAdmin only: adding admins, roles, passwords.
export const PERM_ADMINS_MANAGE = "admins.manage";

// Backend ACTIVITY_READ — SuperAdmin only: every admin's actions and sign-ins.
export const PERM_ACTIVITY_READ = "activity.read";

// Each item carries the permission its page's API needs (the guard on the
// matching backend router), so a role only sees pages it can actually open.
// The backend is still the real gate.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", permission: "dashboard.read" },
  { key: "customers", label: "Customers", permission: "customers.manage" },
  { key: "partners", label: "Partners", permission: "partners.approve" },
  { key: "partner-leads", label: "Professional Leads", permission: "partners.approve" },
  { key: "helpers", label: "Technician Helpers", permission: "partners.approve" },
  { key: "services", label: "Services", permission: "services.manage" },
  { key: "catalog", label: "Item Catalog", permission: "services.manage" },
  { key: "bookings", label: "Bookings", permission: "bookings.assign" },
  { key: "payments", label: "Payments", permission: "payments.refund" },
  { key: "complaints", label: "Complaints", permission: "complaints.view" },
  { key: "audit", label: "GST Report", permission: "audit.read" },
  { key: "disputes", label: "Disputes", permission: "disputes.resolve" },
  { key: "analytics", label: "Analytics", permission: "analytics.read" },
  { key: "learning", label: "Learning Insights", permission: "analytics.read" },
  { key: "coupons", label: "Coupons", permission: "coupons.manage" },
  { key: "referrals", label: "Referrals", permission: "analytics.read" },
  { key: "live-tracking", label: "Live Tracking", permission: "partners.approve" },
  { key: "zones", label: "Zones", permission: "zones.manage" },
  { key: "banners", label: "Banners", permission: "services.manage" },
  { key: "offers", label: "Offers", permission: "services.manage" },
  { key: "notifications", label: "Notifications", permission: "settings.manage" },
  { key: "roles", label: "Roles", permission: "roles.read" },
  { key: "admins", label: "Admin Users", permission: PERM_ADMINS_MANAGE },
  { key: "activity", label: "Activity Log", permission: PERM_ACTIVITY_READ },
  { key: "settings", label: "Settings", permission: "settings.manage" },
  { key: "policies", label: "About Us & Policies", permission: "settings.manage" },
  { key: "test-reset", label: "Test Data Reset", permission: PERM_SYSTEM_RESET },
];
