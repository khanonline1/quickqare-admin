import React, { useState } from "react";
import type { ApiClient } from "../api/adminApi";

/**
 * Promotional push broadcast — sends ONE message to the "promos" FCM topic;
 * Firebase fans it out to every customer device subscribed to it (the customer
 * app subscribes at login, so only app versions with that code receive these).
 *
 * There is no send history stored server-side; each send is audit-logged
 * (admin.notifications.broadcast) and shown here only for the current session.
 */

const TITLE_MAX = 100;
const BODY_MAX = 240;

type SentRecord = {
  title: string;
  body: string;
  imageUrl?: string;
  messageId: string;
  at: string;
};

export default function NotificationsPage({ api }: { api: ApiClient }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [sentThisSession, setSentThisSession] = useState<SentRecord[]>([]);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && !sending && !uploading;

  const handleImageUpload = async (file?: File | null) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const response = await api.uploadFile<{ success: boolean; imageUrl: string; message?: string }>(
        "/api/upload",
        file
      );
      if (!response.success || !response.imageUrl) {
        throw new Error(response.message || "Image upload failed");
      }
      setImageUrl(response.imageUrl);
    } catch (e: any) {
      setError(e?.message || "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      const res = await api.post<{ messageId: string }>("/notifications/broadcast", {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error?.message || "Broadcast failed");
        return;
      }
      setSentThisSession((prev) => [
        {
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
          messageId: res.data?.messageId || "",
          at: new Date().toLocaleString(),
        },
        ...prev,
      ]);
      setTitle("");
      setBody("");
      setImageUrl("");
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>Notifications</h1>
      <p className="muted" style={{ marginBottom: 20, fontSize: 13 }}>
        Send a promotional push notification to all customers. Delivered to every device
        subscribed to promotions (customers on the latest app version, logged in at least once).
      </p>

      {/* ── Compose card ── */}
      <div className="card" style={{ padding: 20, maxWidth: 560 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Title <span className="muted" style={{ fontWeight: 400 }}>({title.length}/{TITLE_MAX})</span>
          </label>
          <input
            className="input"
            style={{ width: "100%" }}
            maxLength={TITLE_MAX}
            placeholder="e.g. Weekend Offer — 20% off AC service"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Message <span className="muted" style={{ fontWeight: 400 }}>({body.length}/{BODY_MAX})</span>
          </label>
          <textarea
            className="input"
            style={{ width: "100%", minHeight: 80, resize: "vertical" }}
            maxLength={BODY_MAX}
            placeholder="e.g. Book any AC service this weekend and get 20% off. Limited slots!"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Image <span className="muted" style={{ fontWeight: 400 }}>(optional — shown as a big picture on Android)</span>
          </label>
          {imageUrl ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={imageUrl} alt="notification" style={{ height: 56, borderRadius: 6, border: "1px solid var(--border)" }} />
              <button className="button secondary" style={{ fontSize: 12 }} onClick={() => setImageUrl("")}>
                Remove
              </button>
            </div>
          ) : (
            <label className="button secondary upload-button" style={{ fontSize: 12 }}>
              {uploading ? "Uploading..." : "Upload image"}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  handleImageUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>

        {/* ── Phone-style preview ── */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 18,
            background: "var(--bg)",
          }}
        >
          <div style={{ fontSize: 11, marginBottom: 4 }} className="muted">
            Preview
          </div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{title.trim() || "Notification title"}</div>
          <div style={{ fontSize: 12 }} className={body.trim() ? "" : "muted"}>
            {body.trim() || "Notification message appears here"}
          </div>
          {imageUrl && (
            <img src={imageUrl} alt="" style={{ marginTop: 8, maxHeight: 90, borderRadius: 6 }} />
          )}
        </div>

        {error && (
          <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        {confirming ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              Send to ALL customers now?
            </span>
            <button className="button" disabled={sending} onClick={handleSend}>
              {sending ? "Sending..." : "Yes, send"}
            </button>
            <button className="button secondary" disabled={sending} onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>
        ) : (
          <button className="button" disabled={!canSend} onClick={() => setConfirming(true)}>
            Review &amp; send
          </button>
        )}
      </div>

      {/* ── This session's sends ── */}
      {sentThisSession.length > 0 && (
        <div style={{ marginTop: 24, maxWidth: 560 }}>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Sent this session</h3>
          {sentThisSession.map((s, i) => (
            <div key={i} className="card" style={{ padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                <div className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{s.at}</div>
              </div>
              <div style={{ fontSize: 12 }} className="muted">{s.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
