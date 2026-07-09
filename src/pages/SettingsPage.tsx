import { useEffect, useRef, useState } from "react";
import type { ApiClient } from "../api/adminApi";

// ── Image upload picker ───────────────────────────────────────────────────────
function ImageUploadField({
  label, hint, value, onChange, api, shimmer,
}: {
  label: string; hint?: string; value: string;
  onChange: (url: string) => void; api: ApiClient; shimmer?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file: File) => {
    setError(""); setUploading(true);
    try {
      const result = await api.uploadFile<{ success: boolean; imageUrl: string }>("/api/upload", file, "image");
      if (result.success && result.imageUrl) onChange(result.imageUrl);
      else setError("Upload failed");
    } catch (e: unknown) {
      setError((e as Error).message || "Upload failed");
    } finally { setUploading(false); }
  };

  return (
    <div>
      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>
        {label}{hint && <span style={{ color: "var(--muted-2)", marginLeft: 6 }}>{hint}</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 8, flexShrink: 0 }}>
          {value ? (
            <img src={value} alt={label} style={{ display: "block", width: 48, height: 48, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel-alt)" }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 8, border: "2px solid var(--border)", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
              <div style={{ fontSize: 18, lineHeight: 1 }}>⬡</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: "var(--muted-2)", letterSpacing: 0.4 }}>DEFAULT</div>
            </div>
          )}
          {shimmer && (
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.75) 50%,transparent 100%)", animation: "shimmer-sweep 1.4s ease-in-out infinite", pointerEvents: "none" }} />
          )}
        </div>
        <div style={{ flex: 1 }}>
          {value ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="button" style={{ fontSize: 12, padding: "6px 14px" }} disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? "Uploading…" : "Replace Image"}
              </button>
              <button type="button" style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", padding: "5px 10px" }} onClick={() => onChange("")}>
                Use Default Icon
              </button>
            </div>
          ) : (
            <div>
              <button type="button" className="button" style={{ fontSize: 12, padding: "6px 14px" }} disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? "Uploading…" : "Upload Custom Icon"}
              </button>
              <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 5 }}>Using built-in icon</div>
            </div>
          )}
          {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{error}</div>}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, color = "#6366f1", disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; color?: string; disabled?: boolean;
}) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} style={{
      position: "relative", flexShrink: 0, width: 44, height: 24, borderRadius: 12,
      border: "none", cursor: disabled ? "not-allowed" : "pointer", padding: 0,
      backgroundColor: checked ? color : "var(--border-strong)",
      transition: "background-color 0.2s ease", opacity: disabled ? 0.5 : 1,
    }}>
      <span style={{
        position: "absolute", top: 3, left: checked ? 22 : 3,
        width: 18, height: 18, borderRadius: "50%", backgroundColor: "var(--panel)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.18s ease",
      }} />
    </button>
  );
}

// ── SettingRow (label + toggle in a row) ─────────────────────────────────────
function SettingRow({ label, description, checked, onChange, disabled }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ flex: 1, paddingRight: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: description ? 3 : 0 }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{description}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ── Theme presets ─────────────────────────────────────────────────────────────
const THEME_PRESETS = [
  { name: "Default (Monochrome)",  primaryColor: "#0A0A0A", accentColor: "#FFFFFF", backgroundColor: "var(--panel-alt)", promoTagBadge: "LIMITED OFFER",   promoTagline: "",                     promoCta: "Book now  →"  },
  { name: "Tricolor Classic",      primaryColor: "#FF9933", accentColor: "#138808", backgroundColor: "#FFF8F0", promoTagBadge: "INDEPENDENCE DAY", promoTagline: "Celebrate with Clean Homes", promoCta: "Book now  →" },
  { name: "Midnight Gold",         primaryColor: "#0B0F1A", accentColor: "#FFD700", backgroundColor: "var(--panel-alt)", promoTagBadge: "NEW YEAR OFFER",   promoTagline: "Start Fresh This Year",  promoCta: "Claim offer  →" },
  { name: "Royal Diwali",          primaryColor: "#7B2CBF", accentColor: "#FFD166", backgroundColor: "#FDF6FF", promoTagBadge: "DIWALI SPECIAL",   promoTagline: "Festive Home Care Offers", promoCta: "Book now  →" },
  { name: "Soft Romance",          primaryColor: "#E63946", accentColor: "#FFCAD4", backgroundColor: "#FFF5F6", promoTagBadge: "VALENTINE'S DAY",  promoTagline: "Gift a Clean Home",      promoCta: "Book now  →" },
  { name: "Emerald Night",         primaryColor: "#006D5B", accentColor: "#D4AF37", backgroundColor: "#F0FDF9", promoTagBadge: "EID MUBARAK",      promoTagline: "Fresh Start This Eid",   promoCta: "Book now  →" },
  { name: "Urban Purple",          primaryColor: "#8262A6", accentColor: "#F0E6FF", backgroundColor: "var(--panel-alt)", promoTagBadge: "EXCLUSIVE",        promoTagline: "",                     promoCta: "Book now  →" },
  { name: "Ice Blue Minimal",      primaryColor: "#3A86FF", accentColor: "#EAF2FF", backgroundColor: "#F4F8FF", promoTagBadge: "NEW",              promoTagline: "",                     promoCta: "Explore  →"  },
  { name: "Mint Clean",            primaryColor: "#2EC4B6", accentColor: "#D0F5F2", backgroundColor: "#F1FFFB", promoTagBadge: "SUMMER SPECIAL",   promoTagline: "Deep Clean This Season", promoCta: "Book now  →" },
  { name: "Orange Energy",         primaryColor: "#FF6B35", accentColor: "#1C1C1E", backgroundColor: "#FFF4F0", promoTagBadge: "HOT DEAL",         promoTagline: "AC Service Sale",        promoCta: "Save now  →" },
  { name: "Blush Elegant",         primaryColor: "#F48FB1", accentColor: "#FFF0F5", backgroundColor: "#FFF0F5", promoTagBadge: "MEHENDI SPECIAL",  promoTagline: "Book Your Bridal Look",  promoCta: "Book now  →" },
  { name: "Warm Comfort",          primaryColor: "#D97706", accentColor: "var(--orange-bg)", backgroundColor: "var(--orange-bg)", promoTagBadge: "HOME CARE",        promoTagline: "Trusted Home Services",  promoCta: "Book now  →" },
] as const;

type Tab = "app" | "theme" | "social" | "emergency";

export default function SettingsPage({ api }: { api: ApiClient }) {
  const [tab, setTab] = useState<Tab>("app");
  const [loading, setLoading] = useState(true);

  // App settings
  const [partnerSubscriptionRequired, setPartnerSubscriptionRequired] = useState(false);
  const [partnerVerificationRequired, setPartnerVerificationRequired] = useState(false);
  const [partnerSelfieRequired, setPartnerSelfieRequired] = useState(false);
  const [jobSelfieVerificationEnabled, setJobSelfieVerificationEnabled] = useState(false);
  const [useLiveLocation, setUseLiveLocation] = useState(false);
  const [useH3Zones, setUseH3Zones] = useState(false);
  const [defaultBannerEnabled, setDefaultBannerEnabled] = useState(true);
  const [platformFeePercent, setPlatformFeePercent] = useState(0);
  const [platformFeeFlatInr, setPlatformFeeFlatInr] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  const [appSaving, setAppSaving] = useState(false);

  // Emergency controls
  const [bookingsDisabled,  setBookingsDisabled]  = useState(false);
  const [paymentsFreezed,   setPaymentsFreezed]   = useState(false);
  const [payoutsFreezed,    setPayoutsFreezed]    = useState(false);
  const [emergencyLockdown, setEmergencyLockdown] = useState(false);
  const [emergencySaving,   setEmergencySaving]   = useState(false);

  // Theme
  const [themeActive,         setThemeActive]         = useState(false);
  const [themeName,           setThemeName]           = useState("default");
  const [primaryColor,        setPrimaryColor]        = useState("#0A0A0A");
  const [accentColor,         setAccentColor]         = useState("#FFFFFF");
  const [bgColor,             setBgColor]             = useState("#F5F5F5");
  const [promoTagBadge,       setPromoTagBadge]       = useState("LIMITED OFFER");
  const [promoTagline,        setPromoTagline]        = useState("");
  const [promoCta,            setPromoCta]            = useState("Book now  →");
  const [promoIconUrl,        setPromoIconUrl]        = useState("");
  const [catIconAcRepair,     setCatIconAcRepair]     = useState("");
  const [catIconPlumbing,     setCatIconPlumbing]     = useState("");
  const [catIconMehendi,      setCatIconMehendi]      = useState("");
  const [catIconElectrician,  setCatIconElectrician]  = useState("");
  const [catIconCelebration,  setCatIconCelebration]  = useState("");
  const [catShimmerAcRepair,    setCatShimmerAcRepair]    = useState(true);
  const [catShimmerPlumbing,    setCatShimmerPlumbing]    = useState(true);
  const [catShimmerMehendi,     setCatShimmerMehendi]     = useState(true);
  const [catShimmerElectrician, setCatShimmerElectrician] = useState(true);
  const [catShimmerCelebration, setCatShimmerCelebration] = useState(true);
  const [targetPlatform, setTargetPlatform] = useState<"both" | "app" | "web">("both");
  const [themeSaving, setThemeSaving] = useState(false);

  // Social links
  const [socialWhatsapp, setSocialWhatsapp] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialSaving, setSocialSaving] = useState(false);

  useEffect(() => {
    api.get<any>("/settings").then((res) => {
      if (res.success) {
        setPartnerSubscriptionRequired(Boolean(res.data.partnerSubscriptionRequired));
        setPartnerVerificationRequired(Boolean(res.data.partnerVerificationRequired));
        setPartnerSelfieRequired(Boolean(res.data.partnerSelfieRequired));
        setJobSelfieVerificationEnabled(Boolean(res.data.jobSelfieVerificationEnabled));
        setUseLiveLocation(Boolean(res.data.useLiveLocation));
        setUseH3Zones(Boolean(res.data.useH3Zones));
        setDefaultBannerEnabled(res.data.defaultBannerEnabled !== false);
        const pr = res.data.pricing || {};
        setPlatformFeePercent(Number(pr.platformFeePercent) || 0);
        setPlatformFeeFlatInr(Number(pr.platformFeeFlatInr) || 0);
        setTaxPercent(Number(pr.taxPercent ?? 18));
        setBookingsDisabled(Boolean(res.data.bookingsDisabled));
        setPaymentsFreezed(Boolean(res.data.paymentsFreezed));
        setPayoutsFreezed(Boolean(res.data.payoutsFreezed));
        setEmergencyLockdown(Boolean(res.data.emergencyLockdown));
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
          setPromoIconUrl(ht.promoIconUrl   ?? "");
          setTargetPlatform((ht.targetPlatform as "both" | "app" | "web") || "both");
          setCatIconAcRepair(ht.categoryIcons?.acRepair       ?? "");
          setCatIconPlumbing(ht.categoryIcons?.plumbing       ?? "");
          setCatIconMehendi(ht.categoryIcons?.mehendi         ?? "");
          setCatIconElectrician(ht.categoryIcons?.electrician ?? "");
          setCatIconCelebration(ht.categoryIcons?.celebration ?? "");
          setCatShimmerAcRepair(ht.categoryIcons?.acRepairShimmer    !== false);
          setCatShimmerPlumbing(ht.categoryIcons?.plumbingShimmer    !== false);
          setCatShimmerMehendi(ht.categoryIcons?.mehendiShimmer      !== false);
          setCatShimmerElectrician(ht.categoryIcons?.electricianShimmer !== false);
          setCatShimmerCelebration(ht.categoryIcons?.celebrationShimmer !== false);
        }
        const sl = res.data.socialLinks;
        if (sl) {
          setSocialWhatsapp(sl.whatsapp || "");
          setSocialInstagram(sl.instagram || "");
          setSocialFacebook(sl.facebook || "");
          setSocialTwitter(sl.twitter || "");
          setSocialYoutube(sl.youtube || "");
        }
      }
    }).finally(() => setLoading(false));
  }, [api]);

  const saveAppSettings = async () => {
    setAppSaving(true);
    try {
      await api.patch("/settings", {
        partnerSubscriptionRequired,
        partnerVerificationRequired,
        partnerSelfieRequired,
        jobSelfieVerificationEnabled,
        useLiveLocation,
        useH3Zones,
        defaultBannerEnabled,
        pricing: {
          platformFeePercent: Number(platformFeePercent) || 0,
          platformFeeFlatInr: Number(platformFeeFlatInr) || 0,
          taxPercent:         Number(taxPercent)         || 0,
        },
      });
    } finally { setAppSaving(false); }
  };

  const patchEmergency = async (patch: Record<string, boolean>) => {
    setEmergencySaving(true);
    try {
      const res = await api.patch<any>("/emergency", patch);
      if (res.success) {
        setBookingsDisabled(Boolean(res.data.bookingsDisabled));
        setPaymentsFreezed(Boolean(res.data.paymentsFreezed));
        setPayoutsFreezed(Boolean(res.data.payoutsFreezed));
        setEmergencyLockdown(Boolean(res.data.emergencyLockdown));
      }
    } finally { setEmergencySaving(false); }
  };

  const applyPreset = (preset: typeof THEME_PRESETS[number]) => {
    setThemeName(preset.name); setPrimaryColor(preset.primaryColor);
    setAccentColor(preset.accentColor); setBgColor(preset.backgroundColor);
    setPromoTagBadge(preset.promoTagBadge); setPromoTagline(preset.promoTagline);
    setPromoCta(preset.promoCta);
  };

  const saveTheme = async () => {
    setThemeSaving(true);
    try {
      await api.patch("/settings", {
        homeTheme: {
          isActive: themeActive, targetPlatform, themeName, primaryColor, accentColor,
          backgroundColor: bgColor, promoTagBadge, promoTagline, promoCta, promoIconUrl,
          categoryIcons: {
            acRepair: catIconAcRepair, acRepairShimmer: catShimmerAcRepair,
            plumbing: catIconPlumbing, plumbingShimmer: catShimmerPlumbing,
            mehendi:  catIconMehendi,  mehendiShimmer:  catShimmerMehendi,
            electrician: catIconElectrician, electricianShimmer: catShimmerElectrician,
            celebration: catIconCelebration, celebrationShimmer: catShimmerCelebration,
          },
        },
      });
    } finally { setThemeSaving(false); }
  };

  const saveSocialLinks = async () => {
    setSocialSaving(true);
    try {
      await api.patch("/settings", {
        socialLinks: {
          whatsapp: socialWhatsapp.trim(),
          instagram: socialInstagram.trim(),
          facebook: socialFacebook.trim(),
          twitter: socialTwitter.trim(),
          youtube: socialYoutube.trim(),
        },
      });
    } finally { setSocialSaving(false); }
  };

  const anyEmergencyActive = emergencyLockdown || bookingsDisabled || paymentsFreezed || payoutsFreezed;
  const anySocialLinkSet = Boolean(socialWhatsapp || socialInstagram || socialFacebook || socialTwitter || socialYoutube);

  const TABS: { id: Tab; label: string; badge?: string }[] = [
    { id: "app",       label: "App Settings" },
    { id: "theme",     label: "Home Screen Theme", badge: themeActive ? "LIVE" : undefined },
    { id: "social",    label: "Social Links", badge: anySocialLinkSet ? "SET" : undefined },
    { id: "emergency", label: "Emergency Controls", badge: anyEmergencyActive ? "!" : undefined },
  ];

  return (
    <>
      <style>{`
        @keyframes shimmer-sweep { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }
        .settings-tab { padding: 9px 18px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; white-space: nowrap; display: flex; align-items: center; gap: 7px; }
        .settings-tab:hover { color: var(--text); }
        .settings-tab.active { color: var(--accent, #0ea5e9); border-bottom-color: var(--accent, #0ea5e9); }
        .settings-tab.danger.active { color: #dc2626; border-bottom-color: #dc2626; }
      `}</style>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 0 }}>
        <h2 style={{ margin: "0 0 2px 0", fontSize: 22, fontWeight: 800 }}>Settings</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Manage platform configuration, appearance, and safety controls.</p>
      </div>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginTop: 24, marginBottom: 28, gap: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`settings-tab${tab === t.id ? " active" : ""}${t.id === "emergency" ? " danger" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge && (
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px", borderRadius: 4,
                background: t.id === "emergency" ? "#dc2626" : "var(--accent, #0ea5e9)",
                color: "#fff",
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: APP SETTINGS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "app" && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>Partner Requirements</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Control which steps are mandatory for partners to operate on the platform.
            </p>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "0 20px" }}>
            <SettingRow
              label="Subscription Required"
              description="Partners must have an active subscription to log in and accept bookings."
              checked={partnerSubscriptionRequired}
              onChange={setPartnerSubscriptionRequired}
              disabled={loading}
            />
            <SettingRow
              label="KYC / Bank Verification Required"
              description="KYC and bank details must be verified before a partner can operate. When off, verification is visible but not enforced."
              checked={partnerVerificationRequired}
              onChange={setPartnerVerificationRequired}
              disabled={loading}
            />
            <SettingRow
              label="Selfie Required at Signup"
              description="Partners must submit a selfie during onboarding. Off by default — can be enabled later."
              checked={partnerSelfieRequired}
              onChange={setPartnerSelfieRequired}
              disabled={loading}
            />
            <SettingRow
              label="Job-Spot Selfie Verification"
              description="Partner must upload a live selfie at the customer's location before starting a service, and the customer app shows the partner's onboarding photo for face matching. Takes effect within ~60 seconds."
              checked={jobSelfieVerificationEnabled}
              onChange={setJobSelfieVerificationEnabled}
              disabled={loading}
            />
            <SettingRow
              label="Use Live Location in Assignment"
              description="When enabled, online partners who have not sent a GPS update in the last 5 minutes are deprioritized during booking assignment. Requires partner app to send location heartbeats. Disable to revert to stored coordinates."
              checked={useLiveLocation}
              onChange={setUseLiveLocation}
              disabled={loading}
            />
            <SettingRow
              label="Use H3 Hubs (instead of Pincode Zones)"
              description="When ON, bookings, partner matching and service availability use map-drawn H3 Hubs. When OFF, the legacy pincode Zone system is used. Only enable after you have drawn hubs and assigned partners to them. Takes effect within ~60 seconds."
              checked={useH3Zones}
              onChange={setUseH3Zones}
              disabled={loading}
            />
            <SettingRow
              label="Default Promo Banner (Web)"
              description="Show an attractive built-in promo banner on the web home page when no custom banner is active. Turn off to hide the banner slot entirely until you add your own banner."
              checked={defaultBannerEnabled}
              onChange={setDefaultBannerEnabled}
              disabled={loading}
            />
          </div>

          <div style={{ marginTop: 32, marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>Fees and Taxes</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Customers see one combined <strong>"Fees and Taxes"</strong> line on the bill. Platform fee is your service charge; tax is GST. Both apply to every paid booking.
            </p>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Platform Fee (%)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={platformFeePercent}
                    onChange={(e) => setPlatformFeePercent(Number(e.target.value))}
                    disabled={loading}
                    style={{ width: "100%", paddingRight: 28 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)", fontSize: 13 }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 4 }}>% of taxable amount</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Platform Fee (Flat)
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)", fontSize: 13 }}>₹</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    step="1"
                    value={platformFeeFlatInr}
                    onChange={(e) => setPlatformFeeFlatInr(Number(e.target.value))}
                    disabled={loading}
                    style={{ width: "100%", paddingLeft: 24 }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 4 }}>Flat ₹ per booking</div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>
                  Tax (%)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Number(e.target.value))}
                    disabled={loading}
                    style={{ width: "100%", paddingRight: 28 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted-2)", fontSize: 13 }}>%</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 4 }}>GST. Default 18%</div>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: "var(--bg)", borderRadius: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
              <strong>Example on a ₹1,000 booking:</strong>{" "}
              Platform fee = ₹{Math.round((1000 * (Number(platformFeePercent) || 0)) / 100 + (Number(platformFeeFlatInr) || 0))}.{" "}
              Tax = ₹{Math.round(((1000 + Math.round((1000 * (Number(platformFeePercent) || 0)) / 100 + (Number(platformFeeFlatInr) || 0))) * (Number(taxPercent) || 0)) / 100)}.{" "}
              Customer sees <strong>"Fees and Taxes: ₹{
                Math.round((1000 * (Number(platformFeePercent) || 0)) / 100 + (Number(platformFeeFlatInr) || 0))
                + Math.round(((1000 + Math.round((1000 * (Number(platformFeePercent) || 0)) / 100 + (Number(platformFeeFlatInr) || 0))) * (Number(taxPercent) || 0)) / 100)
              }"</strong>.
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <button className="button" onClick={saveAppSettings} disabled={loading || appSaving} style={{ minWidth: 140 }}>
              {appSaving ? "Saving…" : "Save Changes"}
            </button>
            {appSaving === false && <span style={{ fontSize: 12, color: "var(--muted-2)" }}>Changes take effect immediately.</span>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: HOME SCREEN THEME
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "theme" && (
        <div>
          {/* Header row with live toggle */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 20, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>Home Screen Theme</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                Customize the customer app header, promo banner, and accent colors. Updates push instantly when active.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <Toggle checked={themeActive} onChange={setThemeActive} color="#0ea5e9" />
              <span style={{ fontWeight: 700, fontSize: 13, color: themeActive ? "#0ea5e9" : "var(--muted)" }}>
                {themeActive ? "Live" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Apply to selector */}
          <div style={{ marginBottom: 24, padding: "14px 16px", background: "var(--panel-alt)", borderRadius: 10, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-2)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>Apply Theme To</div>
            <div style={{ display: "flex", gap: 8 }}>
              {([
                { value: "both", label: "📱 App + 🌐 Web", desc: "Both platforms" },
                { value: "app",  label: "📱 App Only",     desc: "Mobile app only" },
                { value: "web",  label: "🌐 Web Only",     desc: "Web browser only" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetPlatform(opt.value)}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${targetPlatform === opt.value ? "#0ea5e9" : "var(--border)"}`,
                    background: targetPlatform === opt.value ? "#e0f2fe" : "var(--panel)",
                    fontWeight: 700, fontSize: 12,
                    color: targetPlatform === opt.value ? "#0369a1" : "var(--muted)",
                    textAlign: "center",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--muted-2)" }}>
              {targetPlatform === "both" ? "Theme colors and icons will apply to both the mobile app and the web." :
               targetPlatform === "app"  ? "Theme will apply only to the customer mobile app. Web keeps default colors." :
               "Theme will apply only to the website. Mobile app keeps its default colors."}
            </p>
          </div>

          {/* Preset swatches */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-2)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Presets</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
              {THEME_PRESETS.map((preset) => {
                const isSelected = themeName === preset.name;
                return (
                  <div key={preset.name} onClick={() => applyPreset(preset)} style={{
                    border: isSelected ? `2px solid ${preset.primaryColor}` : "2px solid var(--border)",
                    borderRadius: 10, padding: 12, cursor: "pointer",
                    background: isSelected ? `${preset.primaryColor}12` : "var(--panel)",
                    transition: "border-color 0.15s",
                  }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: preset.primaryColor }} title="Primary" />
                      <div style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: preset.accentColor, border: "1px solid var(--border)" }} title="Accent" />
                      <div style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: preset.backgroundColor, border: "1px solid var(--border)" }} title="Background" />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.name}</div>
                    {preset.promoTagline && <div style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 3 }}>"{preset.promoTagline}"</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom overrides + preview side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-2)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Custom / Override</div>
              <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 18 }}>
                {/* Colors */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "Primary Color",    value: primaryColor,   onChange: setPrimaryColor,  placeholder: "#0A0A0A" },
                    { label: "Accent Color",     value: accentColor,    onChange: setAccentColor,   placeholder: "#FFFFFF" },
                    { label: "Background Color", value: bgColor,        onChange: setBgColor,       placeholder: "var(--panel-alt)" },
                  ].map((c) => (
                    <div key={c.label}>
                      <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>{c.label}</label>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <input type="color" value={c.value} onChange={(e) => c.onChange(e.target.value)} style={{ width: 36, height: 32, border: "none", cursor: "pointer", borderRadius: 6, flexShrink: 0 }} />
                        <input className="input" value={c.value} onChange={(e) => c.onChange(e.target.value)} style={{ flex: 1, fontFamily: "monospace", fontSize: 12 }} placeholder={c.placeholder} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo text */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Promo Badge</label>
                    <input className="input" value={promoTagBadge} onChange={(e) => setPromoTagBadge(e.target.value)} placeholder="LIMITED OFFER" maxLength={32} style={{ width: "100%" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>CTA Button</label>
                    <input className="input" value={promoCta} onChange={(e) => setPromoCta(e.target.value)} placeholder="Book now  →" maxLength={40} style={{ width: "100%" }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4 }}>Promo Tagline</label>
                    <input className="input" value={promoTagline} onChange={(e) => setPromoTagline(e.target.value)} placeholder='e.g. "AC Service Sale" — leave blank for default' maxLength={80} style={{ width: "100%" }} />
                  </div>
                </div>

                {/* Promo icon */}
                <div style={{ marginBottom: 16 }}>
                  <ImageUploadField label="Promo Icon" hint="(leave blank for default AC icon)" value={promoIconUrl} onChange={setPromoIconUrl} api={api} />
                </div>

                {/* Category icons */}
                <div>
                  <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 10 }}>
                    Category Icons <span style={{ color: "var(--muted-2)" }}>("What do you need?" row)</span>
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {([
                      { label: "AC Repair",   value: catIconAcRepair,    onChange: setCatIconAcRepair,    shimmer: catShimmerAcRepair,    onShimmer: setCatShimmerAcRepair },
                      { label: "Plumbing",    value: catIconPlumbing,    onChange: setCatIconPlumbing,    shimmer: catShimmerPlumbing,    onShimmer: setCatShimmerPlumbing },
                      { label: "Mehendi",     value: catIconMehendi,     onChange: setCatIconMehendi,     shimmer: catShimmerMehendi,     onShimmer: setCatShimmerMehendi },
                      { label: "Electrician", value: catIconElectrician, onChange: setCatIconElectrician, shimmer: catShimmerElectrician, onShimmer: setCatShimmerElectrician },
                      { label: "Celebration", value: catIconCelebration, onChange: setCatIconCelebration, shimmer: catShimmerCelebration, onShimmer: setCatShimmerCelebration },
                    ] as const).map((cat) => (
                      <div key={cat.label}>
                        <ImageUploadField label={cat.label} value={cat.value} onChange={cat.onChange} api={api} shimmer={cat.shimmer} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>Shimmer</span>
                          <Toggle checked={cat.shimmer} onChange={cat.onShimmer} color="#6366f1" />
                          <span style={{ fontSize: 11, fontWeight: 600, color: cat.shimmer ? "#6366f1" : "var(--muted-2)" }}>{cat.shimmer ? "On" : "Off"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live preview */}
            <div style={{ width: 300 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted-2)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 }}>Preview</div>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
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
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, lineHeight: 1.2, marginBottom: 5 }}>{promoTagline || "Home Services"}</div>
                      <div style={{ border: "1px solid rgba(255,255,255,0.3)", borderRadius: 5, display: "inline-block", padding: "6px 12px", fontSize: 12, color: "#fff", fontWeight: 700 }}>{promoCta || "Book now →"}</div>
                    </div>
                    {promoIconUrl ? (
                      <img src={promoIconUrl} alt="promo" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, opacity: 0.9 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: accentColor, opacity: 0.8 }} />
                    )}
                  </div>
                </div>
              </div>
              {themeActive && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", animation: "none" }} />
                  <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>Live — visible to all users</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="button" onClick={saveTheme} disabled={themeSaving || loading} style={{ minWidth: 180 }}>
              {themeSaving ? "Saving…" : themeActive ? "Save & Activate Theme" : "Save Theme (Inactive)"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: SOCIAL LINKS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "social" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>Social Media Links</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Paste your profile/page links below. Each icon only shows in the web footer and the app when its link is set — leave blank to hide it.
            </p>
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>WhatsApp</label>
              <input
                className="input"
                placeholder="https://wa.me/91XXXXXXXXXX"
                value={socialWhatsapp}
                onChange={(e) => setSocialWhatsapp(e.target.value)}
                disabled={loading}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>Instagram</label>
              <input
                className="input"
                placeholder="https://instagram.com/yourhandle"
                value={socialInstagram}
                onChange={(e) => setSocialInstagram(e.target.value)}
                disabled={loading}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>Facebook</label>
              <input
                className="input"
                placeholder="https://facebook.com/yourpage"
                value={socialFacebook}
                onChange={(e) => setSocialFacebook(e.target.value)}
                disabled={loading}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>X</label>
              <input
                className="input"
                placeholder="https://x.com/yourhandle"
                value={socialTwitter}
                onChange={(e) => setSocialTwitter(e.target.value)}
                disabled={loading}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 4, fontWeight: 600 }}>YouTube</label>
              <input
                className="input"
                placeholder="https://youtube.com/@yourchannel"
                value={socialYoutube}
                onChange={(e) => setSocialYoutube(e.target.value)}
                disabled={loading}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <button className="button" onClick={saveSocialLinks} disabled={socialSaving || loading} style={{ minWidth: 180 }}>
              {socialSaving ? "Saving…" : "Save Social Links"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: EMERGENCY CONTROLS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "emergency" && (
        <div style={{ maxWidth: 680 }}>
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 700 }}>Emergency Safety Controls</h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              Instantly restrict platform operations. Each action requires confirmation. Changes are applied in real time — no restart needed.
            </p>
          </div>

          {/* Emergency Lockdown — master card */}
          <div style={{
            borderRadius: 14, padding: 24, marginBottom: 20,
            border: `2px solid ${emergencyLockdown ? "#dc2626" : "#fca5a5"}`,
            background: emergencyLockdown ? "var(--danger-bg)" : "var(--panel)",
            transition: "background 0.2s, border-color 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 22 }}>🔴</span>
                  <span style={{ fontWeight: 800, fontSize: 17, color: "#dc2626" }}>Emergency Lockdown</span>
                  {emergencyLockdown && (
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, background: "#dc2626", color: "#fff", borderRadius: 4, padding: "2px 8px" }}>ACTIVE</span>
                  )}
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
                  Master kill switch. Instantly blocks all new bookings, payments, and partner payouts at once.
                  Use only in genuine emergencies.
                </p>
                {emergencyLockdown && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["Bookings Blocked", "Payments Frozen", "Payouts Frozen"].map((lbl) => (
                      <span key={lbl} style={{ fontSize: 11, fontWeight: 700, background: "#fca5a5", color: "#7f1d1d", borderRadius: 5, padding: "3px 9px" }}>{lbl}</span>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={emergencySaving || loading}
                onClick={() => {
                  const action = emergencyLockdown ? "DEACTIVATE" : "ACTIVATE";
                  const confirmed = window.confirm(
                    `⚠️ ${action} EMERGENCY LOCKDOWN?\n\n` +
                    (emergencyLockdown
                      ? "This will restore all operations (bookings, payments, payouts)."
                      : "This will IMMEDIATELY block all new bookings, payments, and partner payouts.\n\nOnly use this in a genuine emergency.")
                  );
                  if (confirmed) {
                    const next = !emergencyLockdown;
                    patchEmergency({
                      emergencyLockdown: next,
                      ...(next ? { bookingsDisabled: true, paymentsFreezed: true, payoutsFreezed: true } : {}),
                    });
                  }
                }}
                style={{
                  flexShrink: 0, padding: "11px 22px", borderRadius: 9, fontWeight: 700, fontSize: 13,
                  border: "2px solid #dc2626",
                  background: emergencyLockdown ? "#dc2626" : "transparent",
                  color: emergencyLockdown ? "#fff" : "#dc2626",
                  cursor: emergencySaving || loading ? "not-allowed" : "pointer",
                  opacity: emergencySaving || loading ? 0.6 : 1,
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {emergencyLockdown ? "Deactivate Lockdown" : "Activate Lockdown"}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--muted-2)", letterSpacing: 0.8, textTransform: "uppercase" }}>Individual Controls</span>
            <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          </div>

          {emergencyLockdown && (
            <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "var(--warning-bg)", border: "1px solid #fcd34d", fontSize: 12, color: "var(--warning-text)", fontWeight: 600 }}>
              Individual controls are locked while Emergency Lockdown is active. Deactivate lockdown first to manage them independently.
            </div>
          )}

          {/* Individual toggle cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                key: "bookingsDisabled" as const,
                label: "Disable New Bookings",
                icon: "🚫",
                description: "Prevents customers from placing any new bookings. In-progress bookings are unaffected.",
                active: bookingsDisabled,
                onToggle: (v: boolean) => patchEmergency({ bookingsDisabled: v }),
              },
              {
                key: "paymentsFreezed" as const,
                label: "Freeze Payments",
                icon: "💳",
                description: "Blocks all new Razorpay payment orders. Customers cannot pay for pending bookings.",
                active: paymentsFreezed,
                onToggle: (v: boolean) => patchEmergency({ paymentsFreezed: v }),
              },
              {
                key: "payoutsFreezed" as const,
                label: "Freeze Payouts",
                icon: "🏦",
                description: "Blocks all partner withdrawal requests. Existing wallet balances are preserved.",
                active: payoutsFreezed,
                onToggle: (v: boolean) => patchEmergency({ payoutsFreezed: v }),
              },
            ].map((ctrl) => (
              <div key={ctrl.key} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderRadius: 12,
                border: `1.5px solid ${ctrl.active ? "#f59e0b" : "var(--border)"}`,
                background: ctrl.active ? "var(--warning-bg)" : "var(--panel)",
                opacity: emergencyLockdown ? 0.6 : 1,
                transition: "all 0.2s",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
                  <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }}>{ctrl.icon}</span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: ctrl.active ? "var(--warning-text)" : "var(--text)" }}>{ctrl.label}</span>
                      {ctrl.active && (
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, background: "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 6px" }}>ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{ctrl.description}</div>
                  </div>
                </div>
                <div style={{ marginLeft: 20, flexShrink: 0 }}>
                  <Toggle
                    checked={ctrl.active}
                    color="#f59e0b"
                    disabled={emergencySaving || loading || emergencyLockdown}
                    onChange={(next) => {
                      const action = next ? "enable" : "disable";
                      const confirmed = window.confirm(
                        `Are you sure you want to ${action} "${ctrl.label}"?\n\n` +
                        (next ? ctrl.description : "This will restore normal operation.")
                      );
                      if (confirmed) ctrl.onToggle(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Status summary */}
          {anyEmergencyActive && !emergencyLockdown && (
            <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 10, background: "var(--warning-bg)", border: "1px solid #fcd34d", fontSize: 13, color: "var(--warning-text)" }}>
              <strong>Platform is in partial restriction mode.</strong> Some operations are limited. Deactivate controls above when the situation is resolved.
            </div>
          )}
          {!anyEmergencyActive && (
            <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 10, background: "var(--success-bg)", border: "1px solid #86efac", fontSize: 13, color: "var(--success-text)" }}>
              <strong>All systems operational.</strong> No emergency controls are active.
            </div>
          )}
        </div>
      )}
    </>
  );
}
