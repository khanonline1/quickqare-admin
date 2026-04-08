import React from "react";
import { NAV_ITEMS } from "../constants/nav";
import type { AdminUser } from "../types/admin";

type LayoutProps = {
  admin: AdminUser;
  active: string;
  onNavigate: (key: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
};

export default function Layout({ admin, active, onNavigate, onLogout, children }: LayoutProps) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">QuickQare Admin</div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={active === item.key ? "active" : ""}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <div className="topbar">
          <div className="title">{NAV_ITEMS.find((i) => i.key === active)?.label}</div>
          <div className="row">
            <span className="tag">{admin.email}</span>
            <span className="tag">{admin.role}</span>
            <button className="button secondary" onClick={onLogout}>Logout</button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
