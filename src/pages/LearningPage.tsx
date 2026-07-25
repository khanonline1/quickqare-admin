import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";
import { formatDateTime } from "../utils/format";

// ─── Types (mirror admin/routes/v1/learning.routes.js → GET /learning/overview) ─

type DurationRow = {
  serviceId: string;
  name: string;
  category: string | null;
  isActive: boolean;
  adminDuration: number;
  learnedDuration: number | null;
  samples: number;
  effectiveDuration: number;
  active: boolean;
  clampLo: number;
  clampHi: number;
  clamped: boolean;
  deltaPct: number | null;
  updatedAt: string | null;
};

type BufferRow = {
  learned: number | null;
  samples: number;
  default: number;
  effective: number;
  clampLo: number;
  clampHi: number;
  active: boolean;
};

type Overview = {
  durations: DurationRow[];
  travelBuffers: {
    general: BufferRow;
    ac: BufferRow;
    updatedAt: string | null;
  };
  meta: {
    minSamples: number;
    minFactor: number;
    maxFactor: number;
    travelMinSamples: number;
    totalServices: number;
    servicesLearning: number;
    servicesClamped: number;
    generatedAt: string;
  };
};

// ─── Small presentational helpers ───────────────────────────────────────────────

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card">
      <div className="card-accent-bar" style={{ background: color }} />
      <div className="label">{label}</div>
      <div className="value" style={{ color, marginTop: 10 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="section-header">
      <div>
        <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
        {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function StatusPill({ row, minSamples }: { row: DurationRow; minSamples: number }) {
  if (row.clamped) {
    return <span style={pill("#f59e0b")}>Clamped to band</span>;
  }
  if (row.active) {
    return <span style={pill("#10b981")}>Learning</span>;
  }
  if (row.learnedDuration !== null) {
    return <span style={pill("#64748b")}>Collecting ({row.samples}/{minSamples})</span>;
  }
  return <span style={pill("#94a3b8")}>No data yet</span>;
}

function pill(color: string): React.CSSProperties {
  return {
    background: `${color}22`,
    color,
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: "var(--muted-2)" }}>—</span>;
  if (pct === 0) return <span style={{ color: "var(--muted)" }}>no change</span>;
  const up = pct > 0;
  const color = up ? "#ef4444" : "#10b981"; // longer than admin = red (blocks more time)
  return (
    <span style={{ color, fontWeight: 600 }}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

function BufferCard({ title, buffer, unit = "min" }: { title: string; buffer: BufferRow; unit?: string }) {
  const active = buffer.active;
  return (
    <div className="card" style={{ display: "block" }}>
      <div className="card-accent-bar" style={{ background: active ? "#0ea5e9" : "#94a3b8" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div className="label">{title}</div>
        {active
          ? <span style={pill("#10b981")}>Learned</span>
          : <span style={pill("#94a3b8")}>Using default</span>}
      </div>
      <div className="value" style={{ color: active ? "#0ea5e9" : "var(--muted)", marginTop: 10 }}>
        {buffer.effective} {unit}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
        <div>Learned: <strong>{buffer.learned !== null ? `${buffer.learned} ${unit}` : "—"}</strong> · Default: {buffer.default} {unit}</div>
        <div>Samples: {buffer.samples} · Safe band: {buffer.clampLo}–{buffer.clampHi} {unit}</div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Filter = "all" | "learning" | "collecting";

export default function LearningPage({ api }: { api: ApiClient }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<Overview>("/learning/overview").then((res) => {
      if (res.success) setData(res.data);
      else setError(res.error?.message || "Failed to load learning insights");
      setLoading(false);
    });
  }, [api]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="loading-state" style={{ padding: "40px 20px" }}><div className="loading-spinner" />Loading…</div>;
  }
  if (error || !data) {
    return (
      <div className="section">
        <div className="empty-state">{error || "No data"}</div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="button" onClick={load}>Retry</button>
        </div>
      </div>
    );
  }

  const { durations, travelBuffers, meta } = data;
  const filtered = durations.filter((r) => {
    if (filter === "learning") return r.active;
    if (filter === "collecting") return !r.active && r.isActive;
    return true;
  });

  return (
    <>
      {/* Header */}
      <div className="section" style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>Learning Insights</h2>
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6, maxWidth: 680, lineHeight: 1.6 }}>
              What the nightly learning crons have inferred from real completed jobs — service durations
              (from on-site time) and travel buffers (from transit time) — next to the admin defaults and
              the safety band the scheduler enforces. Read-only; nothing here changes live behaviour.
            </div>
          </div>
          <button className="button" onClick={load}>Refresh</button>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 10 }}>
          Generated {formatDateTime(meta.generatedAt)} · Learners run once daily
        </div>
      </div>

      {/* Summary */}
      <div className="card-grid">
        <MetricCard label="Services Tracked" value={meta.totalServices} sub="In catalog" color="#0ea5e9" />
        <MetricCard
          label="Actively Learning"
          value={meta.servicesLearning}
          sub={`≥ ${meta.minSamples} samples — learned value in use`}
          color="#10b981"
        />
        <MetricCard
          label="Still Collecting"
          value={Math.max(meta.totalServices - meta.servicesLearning, 0)}
          sub="Using admin default until enough data"
          color="#64748b"
        />
        <MetricCard
          label="Hitting Clamp"
          value={meta.servicesClamped}
          sub="Real time drifting past ±40% band"
          color={meta.servicesClamped > 0 ? "#f59e0b" : "#10b981"}
        />
      </div>

      {/* Travel buffers */}
      <div className="section" style={{ marginTop: 4, marginBottom: 20 }}>
        <SectionHeader
          title="Travel Buffers"
          sub={`Door-to-door transit the scheduler reserves between jobs · needs ≥ ${meta.travelMinSamples} samples per category${travelBuffers.updatedAt ? ` · updated ${formatDateTime(travelBuffers.updatedAt)}` : ""}`}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <BufferCard title="General" buffer={travelBuffers.general} />
          <BufferCard title="AC" buffer={travelBuffers.ac} />
        </div>
      </div>

      {/* Durations */}
      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <SectionHeader
            title="Learned Service Durations"
            sub={`Effective = learned value clamped to ±${Math.round((meta.maxFactor - 1) * 100)}% of admin duration, once ≥ ${meta.minSamples} samples`}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {([["all", "All"], ["learning", "Learning"], ["collecting", "Collecting"]] as [Filter, string][]).map(([k, label]) => (
              <button key={k} className={`filter-pill${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">No services in this view</div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Admin</th>
                  <th style={{ textAlign: "right" }}>Learned</th>
                  <th style={{ textAlign: "right" }}>Samples</th>
                  <th style={{ textAlign: "right" }}>Effective</th>
                  <th style={{ textAlign: "right" }}>Δ vs admin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.serviceId} style={{ opacity: r.isActive ? 1 : 0.55 }}>
                    <td style={{ fontWeight: 600, color: "var(--text)" }}>
                      {r.name}
                      {!r.isActive && <span style={{ ...pill("#94a3b8"), marginLeft: 8 }}>inactive</span>}
                    </td>
                    <td style={{ color: "var(--muted)" }}>{r.category || "—"}</td>
                    <td style={{ textAlign: "right" }}>{r.adminDuration}m</td>
                    <td style={{ textAlign: "right", color: r.learnedDuration !== null ? "var(--text)" : "var(--muted-2)" }}>
                      {r.learnedDuration !== null ? `${r.learnedDuration}m` : "—"}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--muted)" }}>{r.samples}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: r.active ? "#0ea5e9" : "var(--muted)" }}>
                      {r.effectiveDuration}m
                    </td>
                    <td style={{ textAlign: "right" }}><DeltaBadge pct={r.deltaPct} /></td>
                    <td><StatusPill row={r} minSamples={meta.minSamples} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 12, lineHeight: 1.7 }}>
          <strong>How to read this:</strong> a service uses its <em>admin</em> duration until the learner
          gathers ≥ {meta.minSamples} clean single-unit completions, then switches to the <em>effective</em> value.
          <span style={{ color: "#f59e0b" }}> Clamped</span> means real jobs are running past the ±{Math.round((meta.maxFactor - 1) * 100)}%
          guard — worth reviewing whether the admin duration itself should move. A red <strong>▲</strong> means the
          scheduler is now reserving <em>more</em> time than the admin default (green <strong>▼</strong> = less).
        </div>
      </div>
    </>
  );
}
