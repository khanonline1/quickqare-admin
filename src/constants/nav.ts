import type { NavItem } from "../types/admin";

// Must match the backend permission string (admin/constants/permissions.js →
// SYSTEM_RESET). Only SuperAdmin is granted it, so only SuperAdmin sees the
// destructive "Test Data Reset" tool.
export const PERM_SYSTEM_RESET = "system.reset";

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "customers", label: "Customers" },
  { key: "partners", label: "Partners" },
  { key: "partner-leads", label: "Professional Leads", permission: "partners.approve" },
  { key: "helpers", label: "Technician Helpers" },
  { key: "services", label: "Services" },
  { key: "catalog", label: "Item Catalog" },
  { key: "bookings", label: "Bookings" },
  { key: "payments", label: "Payments" },
  { key: "complaints", label: "Complaints" },
  { key: "audit", label: "GST Report" },
  { key: "disputes", label: "Disputes" },
  { key: "analytics", label: "Analytics" },
  { key: "learning", label: "Learning Insights", permission: "analytics.read" },
  { key: "coupons", label: "Coupons" },
  { key: "referrals", label: "Referrals" },
  { key: "live-tracking", label: "Live Tracking" },
  { key: "zones", label: "Zones" },
  { key: "banners", label: "Banners" },
  { key: "offers", label: "Offers" },
  { key: "notifications", label: "Notifications" },
  { key: "roles", label: "Roles" },
  { key: "settings", label: "Settings" },
  { key: "policies", label: "About Us & Policies" },
  { key: "test-reset", label: "Test Data Reset", permission: PERM_SYSTEM_RESET },
];
