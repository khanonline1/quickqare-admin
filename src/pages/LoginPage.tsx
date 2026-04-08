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
      const res = await api.post<ChallengeResponse>("/auth/login", { email: sanitize(email), password });
      if (!res.success) {
        setError(res.error?.message || "Login failed");
        return;
      }

      setChallenge(res.data);
      setStep("2fa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach admin server");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string; admin: AdminUser }>("/auth/verify-2fa", {
        challengeToken: challenge.challengeToken,
        code: sanitize(code)
      });

      if (!res.success) {
        setError(res.error?.message || "2FA verification failed");
        return;
      }

      onAuth({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken }, res.data.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to verify 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-box">
        <h1>QuickQare Admin</h1>
        <p>Secure login for operations control.</p>

        {step === "login" && (
          <>
            <div className="row" style={{ flexDirection: "column" }}>
              <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input
                className="input"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="muted" style={{ color: "var(--danger)" }}>{error}</p>}
            <button className="button" onClick={handleLogin} disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </>
        )}

        {step === "2fa" && challenge && (
          <>
            <p className="muted">Enter the 6-digit code sent to your admin channel.</p>
            <div className="row" style={{ flexDirection: "column" }}>
              <input className="input" placeholder="2FA Code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            {challenge.devCode && (
              <p className="muted">Dev code: {challenge.devCode}</p>
            )}
            {error && <p className="muted" style={{ color: "var(--danger)" }}>{error}</p>}
            <button className="button" onClick={handleVerify} disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
