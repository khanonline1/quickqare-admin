import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ApiClient } from "../api/adminApi";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type BannerRow = {
  _id: string;
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  placement?: string;
  platform?: "all" | "web" | "app";
  sortOrder?: number;
  displayDurationSeconds?: number;
  isActive?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const emptyForm = {
  title: "",
  imageUrl: "",
  linkUrl: "",
  placement: "home",
  platform: "all" as "all" | "web" | "app",
  sortOrder: "0",
  displayDurationSeconds: "5",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

export default function BannersPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  // --- Cropper State ---
  const [cropModalInfo, setCropModalInfo] = useState<{
    file: File;
    src: string;
    aspect: number;
    onComplete: (file: File) => void;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: "%", width: 90, x: 5, y: 5, height: 90 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  const startCrop = (file: File | undefined | null, aspect: number, onComplete: (f: File) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCrop({ unit: "%", width: 90, x: 5, y: 5, height: 90 });
      setCropModalInfo({ file, src: reader.result as string, aspect, onComplete });
    });
    reader.readAsDataURL(file);
  };

  const handleCropComplete = () => {
    if (!imgRef.current || !crop.width || !crop.height || !cropModalInfo) return;
    const canvas = document.createElement("canvas");
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      imgRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], cropModalInfo.file.name, { type: cropModalInfo.file.type });
      cropModalInfo.onComplete(croppedFile);
      setCropModalInfo(null);
    }, cropModalInfo.file.type, 0.95);
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BannerRow[]>("/banners?activeOnly=false&placement=home");
      if (res.success) {
        setRows(Array.isArray(res.data) ? res.data : []);
      } else {
        alert(res.error?.message || "Unable to load banners");
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const uploadImage = async (file: File) => {
    const response = await api.uploadFile<{ success: boolean; imageUrl: string; message?: string }>("/api/upload", file);
    if (!response.success || !response.imageUrl) {
      throw new Error(response.message || "Image upload failed");
    }
    return response.imageUrl;
  };

  const handleImageUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const saveBanner = async () => {
    if (!form.imageUrl.trim()) {
      alert("Upload banner image first");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        imageUrl: form.imageUrl.trim(),
        linkUrl: form.linkUrl.trim(),
        placement: form.placement,
        platform: form.platform,
        sortOrder: Number(form.sortOrder) || 0,
        displayDurationSeconds: Number(form.displayDurationSeconds) || 5,
        isActive: form.isActive,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
      };

      const response = editingId
        ? await api.patch(`/banners/${editingId}`, payload)
        : await api.post("/banners", payload);

      if (!response.success) {
        alert(response.error?.message || "Failed to save banner");
        return;
      }

      setForm({ ...emptyForm });
      setEditingId(null);
      fetchRows();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: BannerRow) => {
    setEditingId(row._id);
    setForm({
      title: row.title || "",
      imageUrl: row.imageUrl || "",
      linkUrl: row.linkUrl || "",
      placement: row.placement || "home",
      platform: row.platform || "all",
      sortOrder: String(row.sortOrder ?? 0),
      displayDurationSeconds: String(row.displayDurationSeconds ?? 5),
      isActive: row.isActive !== false,
      startsAt: row.startsAt ? String(row.startsAt).slice(0, 16) : "",
      endsAt: row.endsAt ? String(row.endsAt).slice(0, 16) : "",
    });
  };

  const toggleBanner = async (row: BannerRow) => {
    const response = await api.patch(`/banners/${row._id}`, { isActive: !row.isActive });
    if (!response.success) {
      alert(response.error?.message || "Failed to update banner");
      return;
    }
    fetchRows();
  };

  const deleteBanner = async (row: BannerRow) => {
    if (!window.confirm("Delete this banner?")) return;
    const response = await api.delete(`/banners/${row._id}`);
    if (!response.success) {
      alert(response.error?.message || "Failed to delete banner");
      return;
    }
    if (editingId === row._id) {
      setEditingId(null);
      setForm({ ...emptyForm });
    }
    fetchRows();
  };

  const formTitle = useMemo(() => (editingId ? "Edit Banner" : "Add Banner"), [editingId]);

  return (
    <>
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>{formTitle}</h3>
            <div className="muted">Upload 4-5 banners and control their rotation timing from here.</div>
          </div>
          <button className="button secondary" onClick={fetchRows} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <input
            className="input"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
            style={{ minWidth: 220, flex: "1 1 220px" }}
          />
          <input
            className="input"
            placeholder="Link URL"
            value={form.linkUrl}
            onChange={(e) => setForm((current) => ({ ...current, linkUrl: e.target.value }))}
            style={{ minWidth: 240, flex: "1 1 240px" }}
          />
          <input
            className="input"
            placeholder="Placement"
            value={form.placement}
            onChange={(e) => setForm((current) => ({ ...current, placement: e.target.value }))}
            style={{ width: 140 }}
          />
          <select
            className="input"
            value={form.platform}
            onChange={(e) =>
              setForm((current) => ({ ...current, platform: e.target.value as "all" | "web" | "app" }))
            }
            style={{ width: 150 }}
          >
            <option value="all">All (web + app)</option>
            <option value="web">Web only</option>
            <option value="app">App only</option>
          </select>
          <input
            className="input"
            placeholder="Sort order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm((current) => ({ ...current, sortOrder: e.target.value }))}
            style={{ width: 120 }}
          />
          <input
            className="input"
            placeholder="Slide time (sec)"
            type="number"
            min="1"
            value={form.displayDurationSeconds}
            onChange={(e) =>
              setForm((current) => ({ ...current, displayDurationSeconds: e.target.value }))
            }
            style={{ width: 150 }}
          />
        </div>

        <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
          <label className="row" style={{ alignItems: "center" }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
            />
            Active
          </label>
          <input
            className="input"
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))}
            style={{ minWidth: 220 }}
          />
          <input
            className="input"
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => setForm((current) => ({ ...current, endsAt: e.target.value }))}
            style={{ minWidth: 220 }}
          />
          <label className="button secondary upload-button">
            {uploading ? "Uploading..." : form.imageUrl ? "Replace Image" : "Upload Image"}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                startCrop(e.target.files?.[0], 2.5, handleImageUpload);
                e.target.value = '';
              }}
              disabled={uploading}
            />
          </label>
          <button className="button" onClick={saveBanner} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update Banner" : "Save Banner"}
          </button>
          {editingId ? (
            <button
              className="button secondary"
              onClick={() => {
                setEditingId(null);
                setForm({ ...emptyForm });
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>

        {form.imageUrl ? (
          <div style={{ marginTop: 16 }}>
            <div className="muted" style={{ marginBottom: 8 }}>Image preview</div>
            <img
              src={form.imageUrl}
              alt="banner preview"
              style={{ width: "100%", maxWidth: 720, height: 160, objectFit: "cover", borderRadius: 12, border: "1px solid var(--border)" }}
            />
          </div>
        ) : null}
      </div>

      <div className="section">
        <h3>Banners</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Title</th>
              <th>Platform</th>
              <th>Timing</th>
              <th>Order</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id}>
                <td>
                  <img className="table-image-preview" src={row.imageUrl} alt={row.title || "banner"} />
                </td>
                <td>
                  <div style={{ fontWeight: 700 }}>{row.title || "Untitled"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{row.placement || "home"}</div>
                </td>
                <td>
                  {row.platform === "web" ? "Web only" : row.platform === "app" ? "App only" : "All"}
                </td>
                <td>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {row.startsAt ? `From ${new Date(row.startsAt).toLocaleString()}` : "No start"}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {row.endsAt ? `To ${new Date(row.endsAt).toLocaleString()}` : "No end"}
                  </div>
                </td>
                <td>{row.sortOrder ?? 0}</td>
                <td>{row.displayDurationSeconds ?? 5}s</td>
                <td>{row.isActive ? "Active" : "Inactive"}</td>
                <td>
                  <div className="row">
                    <button className="button secondary" onClick={() => startEdit(row)}>
                      Edit
                    </button>
                    <button className="button warning" onClick={() => toggleBanner(row)}>
                      {row.isActive ? "Disable" : "Enable"}
                    </button>
                    <button className="button danger" onClick={() => deleteBanner(row)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cropModalInfo ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--panel)", padding: 24, borderRadius: 12, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", width: 600 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Crop Banner Image</h3>
            <p className="muted" style={{ marginBottom: 16 }}>Drag the box to frame exactly what will be visible in the app.</p>
            <div style={{ display: "flex", justifyContent: "center", backgroundColor: "var(--panel-alt)", padding: 20, borderRadius: 8, marginBottom: 20 }}>
              <ReactCrop crop={crop} onChange={c => setCrop(c)} aspect={cropModalInfo.aspect}>
                <img
                  src={cropModalInfo.src}
                  onLoad={(e) => { imgRef.current = e.currentTarget; }}
                  style={{ maxHeight: "50vh", maxWidth: "100%", objectFit: "contain" }}
                  alt="Crop preview"
                />
              </ReactCrop>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setCropModalInfo(null)}>Cancel</button>
              <button className="button" onClick={handleCropComplete}>Apply & Upload</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
