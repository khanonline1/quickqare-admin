import React, { useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

// ── 12 preset festival / campaign themes ─────────────────────────────────────
const THEME_PRESETS = [
  { name: "Default (Monochrome)",  primaryColor: "#0A0A0A", accentColor: "#FFFFFF", backgroundColor: "#F5F5F5", promoTagBadge: "LIMITED OFFER",  promoTagline: "",                    promoCta: "Book now  →" },
  { name: "Tricolor Classic",      primaryColor: "#FF9933", accentColor: "#138808", backgroundColor: "#FFF8F0", promoTagBadge: "INDEPENDENCE DAY", promoTagline: "Celebrate with Clean Homes", promoCta: "Book now  →" },
  { name: "Midnight Gold",         primaryColor: "#0B0F1A", accentColor: "#FFD700", backgroundColor: "#F5F5F5", promoTagBadge: "NEW YEAR OFFER",   promoTagline: "Start Fresh This Year",  promoCta: "Claim offer  →" },
  { name: "Royal Diwali",          primaryColor: "#7B2CBF", accentColor: "#FFD166", backgroundColor: "#FDF6FF", promoTagBadge: "DIWALI SPECIAL",   promoTagline: "Festive Home Care Offers", promoCta: "Book now  →" },
  { name: "Soft Romance",          primaryColor: "#E63946", accentColor: "#FFCAD4", backgroundColor: "#FFF5F6", promoTagBadge: "VALENTINE'S DAY",  promoTagline: "Gift a Clean Home",      promoCta: "Book now  →" },
  { name: "Emerald Night",         primaryColor: "#006D5B", accentColor: "#D4AF37", backgroundColor: "#F0FDF9", promoTagBadge: "EID MUBARAK",      promoTagline: "Fresh Start This Eid",   promoCta: "Book now  →" },
  { name: "Urban Purple",          primaryColor: "#8262A6", accentColor: "#F0E6FF", backgroundColor: "#F7F7F9", promoTagBadge: "EXCLUSIVE",        promoTagline: "",                    promoCta: "Book now  →" },
  { name: "Ice Blue Minimal",      primaryColor: "#3A86FF", accentColor: "#EAF2FF", backgroundColor: "#F4F8FF", promoTagBadge: "NEW",              promoTagline: "",                    promoCta: "Explore  →" },
  { name: "Mint Clean",            primaryColor: "#2EC4B6", accentColor: "#D0F5F2", backgroundColor: "#F1FFFB", promoTagBadge: "SUMMER SPECIAL",   promoTagline: "Deep Clean This Season", promoCta: "Book now  →" },
  { name: "Orange Energy",         primaryColor: "#FF6B35", accentColor: "#1C1C1E", backgroundColor: "#FFF4F0", promoTagBadge: "HOT DEAL",         promoTagline: "AC Service Sale",        promoCta: "Save now  →" },
  { name: "Blush Elegant",         primaryColor: "#F48FB1", accentColor: "#FFF0F5", backgroundColor: "#FFF0F5", promoTagBadge: "MEHENDI SPECIAL",  promoTagline: "Book Your Bridal Look",  promoCta: "Book now  →" },
  { name: "Warm Comfort",          primaryColor: "#D97706", accentColor: "#FFF7ED", backgroundColor: "#FFF7ED", promoTagBadge: "HOME CARE",        promoTagline: "Trusted Home Services",  promoCta: "Book now  →" },
] as const;

export default function SettingsPage({ api }: { api: ApiClient }) {
  const [partnerSubscriptionRequired, setPartnerSubscriptionRequired] = useState(false);
  const [partnerVerificationRequired, setPartnerVerificationRequired] = useState(false);
  const [partnerSelfieRequired, setPartnerSelfieRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  // Theme campaign state
  const [themeActive, setThemeActive] = useState(false);
  const [themeName, setThemeName]         = useState("default");
  const [primaryColor, setPrimaryColor]   = useState("#0A0A0A");
  const [accentColor, setAccentColor]     = useState("#FFFFFF");
  const [bgColor, setBgColor]             = useState("#F5F5F5");
  const [promoTagBadge, setPromoTagBadge] = useState("LIMITED OFFER");
  const [promoTagline, setPromoTagline]   = useState("");
  const [promoCta, setPromoCta]           = useState("Book now  →");
  const [themeSaving, setThemeSaving]     = useState(false);

  // Referral settings
  const [referralEnabled, setReferralEnabled] = useState(true);
  const [referrerRewardAmount, setReferrerRewardAmount] = useState(50);
  const [newUserDiscountAmount, setNewUserDiscountAmount] = useState(100);
  const [minOrderAmount, setMinOrderAmount] = useState(0);
  const [couponExpiryDays, setCouponExpiryDays] = useState(30);
  const [maxReferralsPerUser, setMaxReferralsPerUser] = useState(10);
  const [couponDescription, setCouponDescription] = useState("Referral discount for new users");

  useEffect(() => {
    // Load app settings
    api.get<any>("/settings").then((res) => {
      if (res.success) {
        setPartnerSubscriptionRequired(Boolean(res.data.partnerSubscriptionRequired));
        setPartnerVerificationRequired(Boolean(res.data.partnerVerificationRequired));
        setPartnerSelfieRequired(Boolean(res.data.partnerSelfieRequired));
        const ht = res.data.homeTheme;
        if (ht) {
          setThemeActive(Boolean(ht.isActive));
          setThemeName(ht.themeName       || "default");
          setPrimaryColor(ht.primaryColor || "#0A0A0A");
          setAccentColor(ht.accentColor   || "#FFFFFF");
          setBgColor(ht.backgroundColor   || "#F5F5F5");
          setPromoTagBadge(ht.promoTagBadge || "LIMITED OFFER");
          setPromoTagline(ht.promoTagline   || "");
          setPromoCta(ht.promoCta           || "Book now  →");
        }
      }
    });

    // Load referral settings
    api.get<any>("/referral-settings").then((res) => {
      if (res.success) {
        setReferralEnabled(res.data.isEnabled ?? true);
        setReferrerRewardAmount(res.data.referrerRewardAmount ?? 50);
        setNewUserDiscountAmount(res.data.newUserDiscountAmount ?? 100);
        setMinOrderAmount(res.data.minOrderAmount ?? 0);
        setCouponExpiryDays(res.data.couponExpiryDays ?? 30);
        setMaxReferralsPerUser(res.data.maxReferralsPerUser ?? 10);
        setCouponDescription(res.data.couponDescription ?? "Referral discount for new users");
      }
      setLoading(false);
    });
  }, [api]);

  const saveAppSettings = async () => {
    await api.patch("/settings", {
      partnerSubscriptionRequired,
      partnerVerificationRequired,
      partnerSelfieRequired,
    });
    alert("App settings updated");
  };

  const applyPreset = (preset: typeof THEME_PRESETS[number]) => {
    setThemeName(preset.name);
    setPrimaryColor(preset.primaryColor);
    setAccentColor(preset.accentColor);
    setBgColor(preset.backgroundColor);
    setPromoTagBadge(preset.promoTagBadge);
    setPromoTagline(preset.promoTagline);
    setPromoCta(preset.promoCta);
  };

  const saveTheme = async () => {
    setThemeSaving(true);
    await api.patch("/settings", {
      homeTheme: {
        isActive: themeActive,
        themeName,
        primaryColor,
        accentColor,
        backgroundColor: bgColor,
        promoTagBadge,
        promoTagline,
        promoCta,
      },
    });
    setThemeSaving(false);
    alert(themeActive ? "Theme activated — customers will see it immediately." : "Theme saved (inactive).");
  };

  const saveReferralSettings = async () => {
    await api.put("/referral-settings", {
      isEnabled: referralEnabled,
      referrerRewardAmount: Number(referrerRewardAmount),
      newUserDiscountAmount: Number(newUserDiscountAmount),
      minOrderAmount: Number(minOrderAmount),
      couponExpiryDays: Number(couponExpiryDays),
      maxReferralsPerUser: Number(maxReferralsPerUser),
      couponDescription,
    });
    alert("Referral settings updated");
  };

  return (
    <div className="section">
      <h3>App Settings</h3>
      <div className="row" style={{ alignItems: "center" }}>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={partnerSubscriptionRequired}
            onChange={(e) => setPartnerSubscriptionRequired(e.target.checked)}
            disabled={loading}
          />
          Partner subscription required
        </label>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={partnerVerificationRequired}
            onChange={(e) => setPartnerVerificationRequired(e.target.checked)}
            disabled={loading}
          />
          Partner KYC/bank verification required
        </label>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={partnerSelfieRequired}
            onChange={(e) => setPartnerSelfieRequired(e.target.checked)}
            disabled={loading}
          />
          Partner selfie required at signup
        </label>
        <button className="button" onClick={saveAppSettings} disabled={loading}>Save App Settings</button>
      </div>
      <p className="muted">
        When enabled, partners must have an active subscription to log in. This is OFF by default.
      </p>
      <p className="muted">
        When partner verification is OFF, KYC and bank verification stay visible in the app but do not block partner operations.
      </p>
      <p className="muted">
        Selfie collection can be enabled later from admin. It stays OFF by default for now.
      </p>

      <hr style={{ margin: "2rem 0" }} />

      <h3>Referral System Settings</h3>
      <div className="row" style={{ alignItems: "center", marginBottom: "1rem" }}>
        <label className="row" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            checked={referralEnabled}
            onChange={(e) => setReferralEnabled(e.target.checked)}
            disabled={loading}
          />
          Enable referral system
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label>Referrer Reward Amount (₹)</label>
          <input
            type="number"
            value={referrerRewardAmount}
            onChange={(e) => setReferrerRewardAmount(Number(e.target.value))}
            disabled={loading}
            min="0"
          />
        </div>
        <div>
          <label>New User Discount Amount (₹)</label>
          <input
            type="number"
            value={newUserDiscountAmount}
            onChange={(e) => setNewUserDiscountAmount(Number(e.target.value))}
            disabled={loading}
            min="0"
          />
        </div>
        <div>
          <label>Minimum Order Amount (₹)</label>
          <input
            type="number"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(Number(e.target.value))}
            disabled={loading}
            min="0"
          />
        </div>
        <div>
          <label>Coupon Expiry Days</label>
          <input
            type="number"
            value={couponExpiryDays}
            onChange={(e) => setCouponExpiryDays(Number(e.target.value))}
            disabled={loading}
            min="1"
          />
        </div>
        <div>
          <label>Max Referrals Per User</label>
          <input
            type="number"
            value={maxReferralsPerUser}
            onChange={(e) => setMaxReferralsPerUser(Number(e.target.value))}
            disabled={loading}
            min="1"
          />
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Coupon Description</label>
        <input
          type="text"
          value={couponDescription}
          onChange={(e) => setCouponDescription(e.target.value)}
          disabled={loading}
          style={{ width: "100%" }}
        />
      </div>

      <button className="button" onClick={saveReferralSettings} disabled={loading}>Save Referral Settings</button>

      <p className="muted" style={{ marginTop: "1rem" }}>
        When a new user signs up with a referral code and completes their first booking above the minimum order amount,
        the referrer receives the reward amount in their wallet and the new user gets a discount coupon.
      </p>

      <hr style={{ margin: "2rem 0" }} />

      {/* ── Theme Campaign ───────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Home Screen Theme</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{
            width: 44, height: 24, borderRadius: 12,
            backgroundColor: themeActive ? "var(--accent, #0ea5e9)" : "#cbd5e1",
            position: "relative", transition: "background 0.2s", cursor: "pointer",
          }} onClick={() => setThemeActive(v => !v)}>
            <div style={{
              position: "absolute", top: 3, left: themeActive ? 23 : 3,
              width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }} />
          </div>
          <span style={{ fontWeight: 600, color: themeActive ? "var(--accent, #0ea5e9)" : "#64748b" }}>
            {themeActive ? "ACTIVE — Live for all users" : "Inactive (default theme shown)"}
          </span>
        </label>
      </div>

      <p className="muted" style={{ marginBottom: 20 }}>
        Pick a preset or set custom colors. When active, the customer app header, promo banner,
        and accent colors update instantly. Current theme is the default when inactive.
      </p>

      {/* Preset swatches */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
        {THEME_PRESETS.map((preset) => {
          const isSelected = themeName === preset.name;
          return (
            <div
              key={preset.name}
              onClick={() => applyPreset(preset)}
              style={{
                border: isSelected ? `2px solid ${preset.primaryColor}` : "2px solid var(--border)",
                borderRadius: 10, padding: 12, cursor: "pointer",
                background: isSelected ? `${preset.primaryColor}10` : "var(--panel)",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: preset.primaryColor }} title="Primary" />
                <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: preset.accentColor, border: "1px solid var(--border)" }} title="Accent" />
                <div style={{ width: 20, height: 20, borderRadius: 5, backgroundColor: preset.backgroundColor, border: "1px solid var(--border)" }} title="Background" />
              </div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.name}</div>
              {preset.promoTagline && (
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>"{preset.promoTagline}"</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom overrides */}
      <div style={{ background: "var(--panel-alt, #f8fafc)", border: "1px solid var(--border)", borderRadius: 10, padding: 18, marginBottom: 20 }}>
        <h4 style={{ margin: "0 0 14px 0", fontSize: 14 }}>Custom / Override</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Primary Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: 40, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
              <input className="input" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1, fontFamily: "monospace" }} placeholder="#0A0A0A" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Accent Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ width: 40, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
              <input className="input" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={{ flex: 1, fontFamily: "monospace" }} placeholder="#FFFFFF" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Background Color</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: 40, height: 36, border: "none", cursor: "pointer", borderRadius: 6 }} />
              <input className="input" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ flex: 1, fontFamily: "monospace" }} placeholder="#F5F5F5" />
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Promo Badge Text</label>
            <input className="input" value={promoTagBadge} onChange={(e) => setPromoTagBadge(e.target.value)} placeholder="LIMITED OFFER" style={{ width: "100%" }} maxLength={32} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>CTA Button Text</label>
            <input className="input" value={promoCta} onChange={(e) => setPromoCta(e.target.value)} placeholder="Book now  →" style={{ width: "100%" }} maxLength={40} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 4 }}>Promo Tagline</label>
            <input className="input" value={promoTagline} onChange={(e) => setPromoTagline(e.target.value)} placeholder='e.g. "AC Service Sale"  (leave blank for default)' style={{ width: "100%" }} maxLength={80} />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div style={{ marginBottom: 20 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Preview</div>
        <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", maxWidth: 340 }}>
          <div style={{ backgroundColor: primaryColor, padding: "14px 16px" }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>YOUR LOCATION</div>
            <div style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>New Delhi, India</div>
          </div>
          <div style={{ background: primaryColor, padding: "0 16px 14px" }}>
            <div style={{ borderRadius: 8, backgroundColor: "rgba(255,255,255,0.12)", padding: "10px 12px", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Search services</div>
          </div>
          <div style={{ background: bgColor, padding: 16 }}>
            <div style={{ borderRadius: 10, overflow: "hidden", background: primaryColor, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ border: "1px solid rgba(255,255,255,0.25)", borderRadius: 3, display: "inline-block", padding: "2px 7px", fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: 1.2, marginBottom: 8 }}>{promoTagBadge || "LIMITED OFFER"}</div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 18, lineHeight: 1.2, marginBottom: 5 }}>{promoTagline || "Home Services"}</div>
                <div style={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 5, display: "inline-block", padding: "6px 12px", fontSize: 12, color: "#fff", fontWeight: 700 }}>{promoCta || "Book now →"}</div>
              </div>
              <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: accentColor, opacity: 0.8 }} />
            </div>
          </div>
        </div>
      </div>

      <button className="button" onClick={saveTheme} disabled={themeSaving || loading}>
        {themeSaving ? "Saving..." : themeActive ? "Save & Activate Theme" : "Save Theme (Inactive)"}
      </button>
    </div>
  );
}
