import React, { useState } from "react";
import type { ApiClient } from "../api/adminApi";
import type { AdminUser, ChallengeResponse, Tokens } from "../types/admin";
import { sanitize } from "../utils/format";

type LoginProps = { api: ApiClient; onAuth: (tokens: Tokens, admin: AdminUser) => void };

export default function LoginPage({ api, onAuth }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"login" | "2fa">("login");
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<ChallengeResponse>("/auth/login", {
        email: sanitize(email),
        password,
      });
      if (!res.success) {
        setError(res.error?.message || "Login failed. Check your credentials.");
        return;
      }
      setChallenge(res.data);
      setStep("2fa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach admin server.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; admin: AdminUser }>(
        "/auth/verify-2fa",
        { challengeToken: challenge.challengeToken, code: sanitize(code) }
      );
      if (!res.success) {
        setError(res.error?.message || "2FA verification failed.");
        return;
      }
      onAuth(
        { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken },
        res.data.admin
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (step === "login") handleLogin();
      else handleVerify();
    }
  };

  return (
    <div className="login">
      <div className="login-box">
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="white" />
            </svg>
          </div>
          <div>
            <h1>QuickQare</h1>
            <p>Operations Control Panel</p>
          </div>
        </div>

        {step === "login" && (
          <>
            <div className="login-form-group" onKeyDown={handleKeyDown}>
              <input
                className="login-input"
                type="email"
                placeholder="Admin email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="login-input"
                type="password"
                placeholder="Password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="login-button" onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </>
        )}

        {step === "2fa" && challenge && (
          <>
            <p className="login-hint">
              Enter the 6-digit verification code sent to your admin channel.
            </p>

            <div className="login-form-group" onKeyDown={handleKeyDown}>
              <input
                className="login-input"
                type="text"
                placeholder="000000"
                value={code}
                maxLength={6}
                autoComplete="one-time-code"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{ letterSpacing: "0.3em", textAlign: "center", fontSize: 22 }}
                autoFocus
              />
            </div>

            {challenge.devCode && (
              <div className="login-hint" style={{ marginBottom: 10 }}>
                Dev code: <strong style={{ color: "#94a3b8" }}>{challenge.devCode}</strong>
              </div>
            )}

            {error && <div className="login-error">{error}</div>}

            <button className="login-button" onClick={handleVerify} disabled={loading}>
              {loading ? "Verifying..." : "Verify Code"}
            </button>

            <button
              onClick={() => { setStep("login"); setError(null); setCode(""); }}
              style={{
                background: "none",
                border: "none",
                color: "#475569",
                fontSize: 13,
                cursor: "pointer",
                marginTop: 10,
                padding: "4px 0",
                fontFamily: "inherit",
              }}
            >
              ← Back to login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
