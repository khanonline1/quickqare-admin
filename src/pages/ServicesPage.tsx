import React, { useCallback, useEffect, useState, useRef } from "react";
import type { ApiClient } from "../api/adminApi";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export default function ServicesPage({ api }: { api: ApiClient }) {
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [pageError, setPageError] = useState("");
  const [serviceUploadBusy, setServiceUploadBusy] = useState(false);
  const [subCategoryUploadBusy, setSubCategoryUploadBusy] = useState(false);
  const [rowUploadBusy, setRowUploadBusy] = useState<Record<string, boolean>>({});
  const [categoryUploadBusy, setCategoryUploadBusy] = useState<Record<string, boolean>>({});
  const [subCategoryRowUploadBusy, setSubCategoryRowUploadBusy] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"services" | "categories" | "subcategories">("services");
  const [form, setForm] = useState({
    name: "",
    categoryId: "",
    newCategoryName: "",
    subCategoryId: "",
    newSubCategoryName: "",
    newSubCategoryImageUrl: "",
    basePriceInr: "",
    commissionPercent: "20",
    description: "",
    imageUrl: "",
    duration: ""
  });

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
    const res = await api.get<any>("/services");
    if (res.success) {
      setRows(res.data);
      setPageError("");
      return;
    }
    setPageError(res.error?.message || "Unable to load services");
  }, [api]);

  const fetchCategories = useCallback(async () => {
    const res = await api.get<any>("/services/categories");
    if (res.success) {
      setCategories(res.data);
      return;
    }
    setPageError(res.error?.message || "Unable to load categories");
  }, [api]);

  const fetchSubCategories = useCallback(async (categoryId?: string) => {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    const res = await api.get<any>(`/services/subcategories${query}`);
    if (res.success) {
      setSubCategories(res.data);
      return;
    }
    setPageError(res.error?.message || "Unable to load subcategories");
  }, [api]);

  useEffect(() => {
    fetchRows();
    fetchCategories();
    fetchSubCategories();
  }, [fetchRows, fetchCategories, fetchSubCategories]);

  const createService = async () => {
    let categoryId = form.categoryId;
    if (form.newCategoryName.trim()) {
      const res = await api.post<any>("/services/categories", { name: form.newCategoryName.trim() });
      if (!res.success) {
        alert(res.error?.message || "Failed to create category");
        return;
      }
      categoryId = res.data._id;
    }

    let subCategoryId = form.subCategoryId;
    if (form.newSubCategoryName.trim()) {
      if (!categoryId) {
        alert("Select or create a category first");
        return;
      }
      const res = await api.post<any>("/services/subcategories", {
        name: form.newSubCategoryName.trim(),
        categoryId,
        imageUrl: form.newSubCategoryImageUrl.trim()
      });
      if (!res.success) {
        alert(res.error?.message || "Failed to create subcategory");
        return;
      }
      subCategoryId = res.data._id;
    }

    await api.post("/services", {
      name: form.name,
      categoryId,
      subCategoryId,
      categoryName: form.newCategoryName.trim() || undefined,
      subCategoryName: form.newSubCategoryName.trim() || undefined,
      basePriceInr: Number(form.basePriceInr),
      commissionPercent: Number(form.commissionPercent),
      description: form.description,
      imageUrl: form.imageUrl,
      duration: Number(form.duration)
    });
    setForm({
      name: "",
      categoryId: "",
      newCategoryName: "",
      subCategoryId: "",
      newSubCategoryName: "",
      newSubCategoryImageUrl: "",
      basePriceInr: "",
      commissionPercent: "20",
      description: "",
      imageUrl: "",
      duration: ""
    });
    fetchRows();
    fetchCategories();
    fetchSubCategories(categoryId || undefined);
  };

  const seedDefaults = async () => {
    const res = await api.post("/services/seed-defaults");
    if (!res.success) {
      alert(res.error?.message || "Failed to import defaults");
      return;
    }
    fetchRows();
  };

  const updateService = async (id: string, patch: Record<string, unknown>) => {
    await api.patch(`/services/${id}`, patch);
    fetchRows();
  };

  const uploadImage = async (file: File) => {
    const response = await api.uploadFile<{ success: boolean; imageUrl: string; message?: string }>("/api/upload", file);
    if (!response.success || !response.imageUrl) {
      throw new Error(response.message || "Image upload failed");
    }
    return response.imageUrl;
  };

  const handleServiceImageUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      setServiceUploadBusy(true);
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, imageUrl }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setServiceUploadBusy(false);
    }
  };

  const handleSubCategoryImageUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      setSubCategoryUploadBusy(true);
      const imageUrl = await uploadImage(file);
      setForm((current) => ({ ...current, newSubCategoryImageUrl: imageUrl }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setSubCategoryUploadBusy(false);
    }
  };

  const handleRowImageUpload = async (serviceId: string, file?: File | null) => {
    if (!file) return;
    try {
      setRowUploadBusy((current) => ({ ...current, [serviceId]: true }));
      const imageUrl = await uploadImage(file);
      await updateService(serviceId, { imageUrl });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setRowUploadBusy((current) => ({ ...current, [serviceId]: false }));
    }
  };

  const updateCategory = async (id: string, patch: Record<string, unknown>) => {
    const res = await api.patch<any>(`/services/categories/${id}`, patch);
    if (!res.success) {
      alert(res.error?.message || "Failed to update category");
      return;
    }
    fetchCategories();
    fetchRows();
  };

  const updateSubCategory = async (id: string, patch: Record<string, unknown>) => {
    const res = await api.patch<any>(`/services/subcategories/${id}`, patch);
    if (!res.success) {
      alert(res.error?.message || "Failed to update subcategory");
      return;
    }
    fetchSubCategories(form.categoryId || undefined);
    fetchRows();
  };

  const handleCategoryImageUpload = async (categoryId: string, file?: File | null) => {
    if (!file) return;
    try {
      setCategoryUploadBusy((current) => ({ ...current, [categoryId]: true }));
      const imageUrl = await uploadImage(file);
      await updateCategory(categoryId, { imageUrl });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setCategoryUploadBusy((current) => ({ ...current, [categoryId]: false }));
    }
  };

  const handleSubCategoryRowImageUpload = async (subCategoryId: string, file?: File | null) => {
    if (!file) return;
    try {
      setSubCategoryRowUploadBusy((current) => ({ ...current, [subCategoryId]: true }));
      const imageUrl = await uploadImage(file);
      await updateSubCategory(subCategoryId, { imageUrl });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setSubCategoryRowUploadBusy((current) => ({ ...current, [subCategoryId]: false }));
    }
  };

  const toggleService = async (id: string, isEnabled: boolean) => {
    await api.patch(`/services/${id}/status`, { isEnabled });
    fetchRows();
  };

  return (
    <>
      <div className="row" style={{ marginBottom: "1rem", gap: "0.5rem" }}>
        <button className={`button ${activeTab === "services" ? "" : "secondary"}`} onClick={() => setActiveTab("services")}>Services</button>
        <button className={`button ${activeTab === "categories" ? "" : "secondary"}`} onClick={() => setActiveTab("categories")}>Categories</button>
        <button className={`button ${activeTab === "subcategories" ? "" : "secondary"}`} onClick={() => setActiveTab("subcategories")}>Subcategories</button>
      </div>

      {activeTab === "services" && (
        <>
          <div className="section">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Create New Service</h3>
              <button className="button secondary" onClick={seedDefaults}>Import Defaults</button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
              <input className="input" placeholder="Service Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Base Price (₹)" value={form.basePriceInr} onChange={(e) => setForm({ ...form, basePriceInr: e.target.value })} />
              <input className="input" placeholder="Commission %" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} />
              <input className="input" placeholder="Duration (mins)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 16 }}>
              <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-alt)" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Category Assignment</h4>
                <select className="input" value={form.categoryId} onChange={(e) => { const next = e.target.value; setForm({ ...form, categoryId: next, subCategoryId: "" }); fetchSubCategories(next); }} style={{ width: "100%", marginBottom: 8 }}>
                  <option value="">Select an existing category</option>
                  {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                </select>
                <div className="muted" style={{ marginBottom: 8, textAlign: "center", fontWeight: "bold" }}>— OR —</div>
                <input className="input" placeholder="Create new category name" value={form.newCategoryName} onChange={(e) => setForm({ ...form, newCategoryName: e.target.value })} style={{ width: "100%" }} />
              </div>

              <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, background: "var(--panel-alt)" }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Subcategory Assignment</h4>
                <select className="input" value={form.subCategoryId} onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })} style={{ width: "100%", marginBottom: 8 }}>
                  <option value="">Select an existing subcategory</option>
                  {subCategories.map((sub) => <option key={sub._id} value={sub._id}>{sub.name}</option>)}
                </select>
                <div className="muted" style={{ marginBottom: 8, textAlign: "center", fontWeight: "bold" }}>— OR —</div>
                <input className="input" placeholder="Create new subcategory name" value={form.newSubCategoryName} onChange={(e) => setForm({ ...form, newSubCategoryName: e.target.value })} style={{ width: "100%", marginBottom: 8 }} />
                <div className="row" style={{ gap: 8 }}>
                  <input className="input" placeholder="Image URL (optional)" value={form.newSubCategoryImageUrl} onChange={(e) => setForm({ ...form, newSubCategoryImageUrl: e.target.value })} style={{ flex: 1 }} />
                  <label className="button secondary upload-button">
                    {subCategoryUploadBusy ? "..." : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 1 / 1, handleSubCategoryImageUpload); e.target.value = ''; }} />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Service Details & Media</h4>
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <input className="input" placeholder="Service Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} style={{ flex: 1 }} />
                    <label className="button secondary upload-button">
                      {serviceUploadBusy ? "Uploading..." : "Upload Image"}
                      <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 8 / 11, handleServiceImageUpload); e.target.value = ''; }} />
                    </label>
                  </div>
                  <textarea className="input" placeholder="Detailed service description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%", height: 80, resize: "vertical" }} />
                </div>
                
                {(form.newSubCategoryImageUrl || form.imageUrl) ? (
                  <div className="row" style={{ gap: 12 }}>
                    {form.newSubCategoryImageUrl ? (
                      <div className="image-preview-block">
                        <div className="muted">Subcategory Preview</div>
                        <img className="image-preview" src={form.newSubCategoryImageUrl} alt="Subcategory preview" style={{ height: 80 }} />
                      </div>
                    ) : null}
                    {form.imageUrl ? (
                      <div className="image-preview-block">
                        <div className="muted">Service Preview</div>
                        <img className="image-preview" src={form.imageUrl} alt="Service preview" style={{ height: 80 }} />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <button className="button" style={{ width: "100%", padding: "12px", fontSize: 16, fontWeight: "bold" }} onClick={createService}>Create Service</button>
          </div>

          <div className="section">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Existing Services</h3>
                <div className="muted">
                  {rows.length} services across {categories.length} categories
                </div>
              </div>
            </div>
            {pageError ? <div className="error-banner">{pageError}</div> : null}
            {rows.length === 0 && !pageError ? <div className="muted">No services loaded yet.</div> : null}
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Subcategory</th>
                  <th>Price</th>
                  <th>Commission %</th>
                  <th>Image URL</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id || row.id}>
                    <td>{row.name}</td>
                    <td>{row.category?.name || "-"}</td>
                    <td>{row.subCategory?.name || "-"}</td>
                    <td>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        defaultValue={row.price}
                        onBlur={(e) => updateService(row._id, { basePriceInr: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        style={{ width: 70 }}
                        defaultValue={row.commissionPercent}
                        onBlur={(e) => updateService(row._id, { commissionPercent: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <div className="service-image-cell">
                        <input
                          className="input"
                          style={{ width: 220 }}
                          defaultValue={row.imageUrl || ""}
                          onBlur={(e) => updateService(row._id, { imageUrl: e.target.value })}
                        />
                        <label className="button secondary upload-button inline-upload">
                          {rowUploadBusy[row._id] ? "Uploading..." : "Upload"}
                          <input type="file" accept="image/*" onChange={(e) => {
                            startCrop(e.target.files?.[0], 8 / 11, (f) => handleRowImageUpload(row._id, f));
                            e.target.value = '';
                          }} />
                        </label>
                        {row.imageUrl ? <img className="table-image-preview" src={row.imageUrl} alt={row.name} /> : null}
                      </div>
                    </td>
                    <td><span className="tag">{row.isActive ? "ENABLED" : "DISABLED"}</span></td>
                    <td>
                      <div className="row">
                        <button className="button secondary" onClick={() => toggleService(row._id, !row.isActive)}>
                          {row.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "categories" && (
        <div className="section">
          <h3>Home Screen Category Photos</h3>
          <div className="muted" style={{ marginBottom: 12 }}>
            These images are for the main service cards on the QuickQare home screen.
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Home image</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category._id}>
                  <td>{category.name}</td>
                  <td>
                    <div className="service-image-cell">
                      <input
                        className="input"
                        style={{ width: 220 }}
                        defaultValue={category.imageUrl || ""}
                        onBlur={(e) => updateCategory(category._id, { imageUrl: e.target.value })}
                      />
                      <label className="button secondary upload-button inline-upload">
                        {categoryUploadBusy[category._id] ? "Uploading..." : "Upload"}
                        <input type="file" accept="image/*" onChange={(e) => {
                          startCrop(e.target.files?.[0], 4 / 3, (f) => handleCategoryImageUpload(category._id, f));
                          e.target.value = '';
                        }} />
                      </label>
                      {category.imageUrl ? <img className="table-image-preview" src={category.imageUrl} alt={category.name} /> : null}
                    </div>
                  </td>
                  <td><span className="tag">{category.isActive ? "ENABLED" : "DISABLED"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "subcategories" && (
        <div className="section">
          <h3>Subcategory Photos</h3>
          <div className="muted" style={{ marginBottom: 12 }}>
            These can be used as section-level or option-level fallback images where subcategories are grouped.
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Subcategory</th>
                <th>Category</th>
                <th>Image</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {subCategories.map((subCategory) => {
                const parentCategory = categories.find((category) => category._id === subCategory.category);
                return (
                  <tr key={subCategory._id}>
                    <td>{subCategory.name}</td>
                    <td>{parentCategory?.name || "-"}</td>
                    <td>
                      <div className="service-image-cell">
                        <input
                          className="input"
                          style={{ width: 220 }}
                          defaultValue={subCategory.imageUrl || ""}
                          onBlur={(e) => updateSubCategory(subCategory._id, { imageUrl: e.target.value })}
                        />
                        <label className="button secondary upload-button inline-upload">
                          {subCategoryRowUploadBusy[subCategory._id] ? "Uploading..." : "Upload"}
                          <input type="file" accept="image/*" onChange={(e) => {
                            startCrop(e.target.files?.[0], 1 / 1, (f) => handleSubCategoryRowImageUpload(subCategory._id, f));
                            e.target.value = '';
                          }} />
                        </label>
                        {subCategory.imageUrl ? <img className="table-image-preview" src={subCategory.imageUrl} alt={subCategory.name} /> : null}
                      </div>
                    </td>
                    <td><span className="tag">{subCategory.isActive ? "ENABLED" : "DISABLED"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cropModalInfo ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "#fff", padding: 24, borderRadius: 12, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", width: 600 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Crop Image</h3>
            <p className="muted" style={{ marginBottom: 16 }}>Drag the box to frame exactly what will be visible in the app.</p>
            <div style={{ display: "flex", justifyContent: "center", backgroundColor: "#f1f3f7", padding: 20, borderRadius: 8, marginBottom: 20 }}>
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
