import React, { useCallback, useEffect, useState } from "react";
import type { ApiClient } from "../api/adminApi";

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
      <div className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Existing Services</h3>
            <div className="muted">
              {rows.length} services, {categories.length} categories, {subCategories.length} subcategories
            </div>
          </div>
          <button className="button secondary" onClick={seedDefaults}>Import Defaults</button>
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
                      <input type="file" accept="image/*" onChange={(e) => handleRowImageUpload(row._id, e.target.files?.[0])} />
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
                      <input type="file" accept="image/*" onChange={(e) => handleCategoryImageUpload(category._id, e.target.files?.[0])} />
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
                        <input type="file" accept="image/*" onChange={(e) => handleSubCategoryRowImageUpload(subCategory._id, e.target.files?.[0])} />
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

      <div className="section">
        <h3>Create Service</h3>
        <div className="row">
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select
            className="input"
            value={form.categoryId}
            onChange={(e) => {
              const next = e.target.value;
              setForm({ ...form, categoryId: next, subCategoryId: "" });
              fetchSubCategories(next);
            }}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          <input className="input" placeholder="Or new category name" value={form.newCategoryName} onChange={(e) => setForm({ ...form, newCategoryName: e.target.value })} />
          <select
            className="input"
            value={form.subCategoryId}
            onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}
          >
            <option value="">Select subcategory</option>
            {subCategories.map((sub) => (
              <option key={sub._id} value={sub._id}>{sub.name}</option>
            ))}
          </select>
          <input className="input" placeholder="Or new subcategory name" value={form.newSubCategoryName} onChange={(e) => setForm({ ...form, newSubCategoryName: e.target.value })} />
          <input className="input" placeholder="Subcategory image URL" value={form.newSubCategoryImageUrl} onChange={(e) => setForm({ ...form, newSubCategoryImageUrl: e.target.value })} />
          <label className="button secondary upload-button">
            {subCategoryUploadBusy ? "Uploading..." : "Upload Subcategory Image"}
            <input type="file" accept="image/*" onChange={(e) => handleSubCategoryImageUpload(e.target.files?.[0])} />
          </label>
          <input className="input" placeholder="Base price" value={form.basePriceInr} onChange={(e) => setForm({ ...form, basePriceInr: e.target.value })} />
          <input className="input" placeholder="Commission %" value={form.commissionPercent} onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })} />
          <input className="input" placeholder="Duration (mins)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          <input className="input" placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          <label className="button secondary upload-button">
            {serviceUploadBusy ? "Uploading..." : "Upload Service Image"}
            <input type="file" accept="image/*" onChange={(e) => handleServiceImageUpload(e.target.files?.[0])} />
          </label>
          <button className="button" onClick={createService}>Create</button>
        </div>
        {(form.newSubCategoryImageUrl || form.imageUrl) ? (
          <div className="row" style={{ marginTop: 12 }}>
            {form.newSubCategoryImageUrl ? (
              <div className="image-preview-block">
                <div className="muted">Subcategory image preview</div>
                <img className="image-preview" src={form.newSubCategoryImageUrl} alt="Subcategory preview" />
              </div>
            ) : null}
            {form.imageUrl ? (
              <div className="image-preview-block">
                <div className="muted">Service image preview</div>
                <img className="image-preview" src={form.imageUrl} alt="Service preview" />
              </div>
            ) : null}
          </div>
        ) : null}
        <textarea className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ width: "100%", marginTop: 10 }} />
      </div>
    </>
  );
}
