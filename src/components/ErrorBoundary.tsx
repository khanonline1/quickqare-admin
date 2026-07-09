import React from "react";

// App-level error boundary for the admin panel. Without one, a render-time
// exception unmounts the whole tree and an operator sees a blank page with no
// way back. This catches those errors and shows a recoverable fallback.
//
// Styles are inline (and theme-aware via the data-theme attribute the app sets
// on <html>) so the fallback renders even if the CSS bundle failed to load.

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught render error:", error, info);
    // TODO(observability): forward to Sentry once an admin web DSN is configured.
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "dark";

    const bg = isDark ? "#0f172a" : "#f7f8fa";
    const fg = isDark ? "#e2e8f0" : "#1f2937";
    const sub = isDark ? "#94a3b8" : "#4b5563";
    const cardBorder = isDark ? "#1e293b" : "#e5e7eb";

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: bg,
          color: fg,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            textAlign: "center",
            border: `1px solid ${cardBorder}`,
            borderRadius: 12,
            padding: "32px 28px",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            The admin panel hit an error
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, margin: "0 0 20px", color: sub }}>
            An unexpected error interrupted this screen. Reloading usually fixes it.
            If it keeps happening, note what you were doing and report it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 22px",
              borderRadius: 8,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
