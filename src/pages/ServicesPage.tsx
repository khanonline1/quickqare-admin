import React, { useCallback, useEffect, useState, useRef } from "react";
import type { ApiClient } from "../api/adminApi";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export default function ServicesPage({ api }: { api: ApiClient }) {
  // ── Data ──────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [pageError, setPageError] = useState("");
  const [activeTab, setActiveTab] = useState<"services" | "categories" | "subcategories">("services");

  // ── Collapsible create forms ──────────────────────────────────────────
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [showSubCatForm, setShowSubCatForm] = useState(false);

  // ── Services toolbar & per-row "Manage" menu ──────────────────────────
  const [serviceSearch, setServiceSearch] = useState("");
  const [menuFor, setMenuFor] = useState<{ id: string; x: number; y: number } | null>(null);
  const [imagesServiceId, setImagesServiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuFor]);

  // ── Upload busy flags ─────────────────────────────────────────────────
  const [catImageBusy, setCatImageBusy] = useState(false);
  const [catWebImageBusy, setCatWebImageBusy] = useState(false);
  const [categoryWebUploadBusy, setCategoryWebUploadBusy] = useState<Record<string, boolean>>({});
  const [subCatImageBusy, setSubCatImageBusy] = useState(false);
  const [serviceUploadBusy, setServiceUploadBusy] = useState(false);
  const [serviceWebUploadBusy, setServiceWebUploadBusy] = useState(false);
  const [rowWebUploadBusy, setRowWebUploadBusy] = useState<Record<string, boolean>>({});
  const [rowUploadBusy, setRowUploadBusy] = useState<Record<string, boolean>>({});
  const [categoryUploadBusy, setCategoryUploadBusy] = useState<Record<string, boolean>>({});
  const [subCategoryRowUploadBusy, setSubCategoryRowUploadBusy] = useState<Record<string, boolean>>({});

  // ── Create forms ──────────────────────────────────────────────────────
  const [catForm, setCatForm] = useState({ name: "", imageUrl: "", webImageUrl: "" });
  const [catFormBusy, setCatFormBusy] = useState(false);

  const [subCatForm, setSubCatForm] = useState({ name: "", categoryId: "", imageUrl: "" });
  const [subCatFormBusy, setSubCatFormBusy] = useState(false);

  const [serviceForm, setServiceForm] = useState({
    name: "",
    categoryId: "",
    subCategoryId: "",
    basePriceInr: "",
    commissionPercent: "20",
    description: "",
    imageUrl: "",
    webImageUrl: "",
    duration: "",
  });
  const [serviceFormBusy, setServiceFormBusy] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────
  const [serviceFilterCat, setServiceFilterCat] = useState("");
  const [subCatFilterCat, setSubCatFilterCat] = useState("");

  // ── Cancellation policy modal ─────────────────────────────────────────
  const [cancelPolicyService, setCancelPolicyService] = useState<any | null>(null);
  const [cancelTiers, setCancelTiers] = useState<{ minHoursBefore: string; refundPercent: string }[]>([]);
  const [cancelPolicyType, setCancelPolicyType] = useState<"BEFORE_SERVICE" | "SINCE_BOOKING">("BEFORE_SERVICE");
  const [sinceBookingTiers, setSinceBookingTiers] = useState<{ maxHoursAfterBooking: string; refundPercent: string }[]>([]);
  const [graceWindowMinutes, setGraceWindowMinutes] = useState("0");
  const [graceLeadHours, setGraceLeadHours] = useState("0");
  const [cancelPolicyBusy, setCancelPolicyBusy] = useState(false);

  const openCancelPolicy = (row: any) => {
    const tiers = Array.isArray(row.cancellationTiers) && row.cancellationTiers.length > 0
      ? row.cancellationTiers.map((t: any) => ({ minHoursBefore: String(t.minHoursBefore), refundPercent: String(t.refundPercent) }))
      : [{ minHoursBefore: "24", refundPercent: "100" }, { minHoursBefore: "4", refundPercent: "75" }, { minHoursBefore: "1", refundPercent: "50" }, { minHoursBefore: "0", refundPercent: "25" }];
    setCancelTiers(tiers);
    setCancelPolicyType(row.cancellationPolicyType === "SINCE_BOOKING" ? "SINCE_BOOKING" : "BEFORE_SERVICE");
    const sTiers = Array.isArray(row.sinceBookingTiers) && row.sinceBookingTiers.length > 0
      ? row.sinceBookingTiers.map((t: any) => ({ maxHoursAfterBooking: String(t.maxHoursAfterBooking), refundPercent: String(t.refundPercent) }))
      : [{ maxHoursAfterBooking: "1", refundPercent: "100" }, { maxHoursAfterBooking: "8760", refundPercent: "50" }];
    setSinceBookingTiers(sTiers);
    setGraceWindowMinutes(String(row.cancellationGrace?.windowMinutes ?? 0));
    setGraceLeadHours(String(row.cancellationGrace?.appliesBelowLeadHours ?? 0));
    setCancelPolicyService(row);
  };

  const saveCancelPolicy = async () => {
    if (!cancelPolicyService) return;
    for (const t of cancelTiers) {
      const h = Number(t.minHoursBefore), r = Number(t.refundPercent);
      if (isNaN(h) || isNaN(r) || h < 0 || r < 0 || r > 100) {
        alert("Invalid values — hours must be ≥ 0 and refund % must be 0–100"); return;
      }
    }
    for (const t of sinceBookingTiers) {
      const h = Number(t.maxHoursAfterBooking), r = Number(t.refundPercent);
      if (isNaN(h) || isNaN(r) || h < 0 || r < 0 || r > 100) {
        alert("Invalid values — hours must be ≥ 0 and refund % must be 0–100"); return;
      }
    }
    const gWindow = Number(graceWindowMinutes), gLead = Number(graceLeadHours);
    if (isNaN(gWindow) || gWindow < 0 || isNaN(gLead) || gLead < 0) {
      alert("Invalid grace values — minutes and hours must be ≥ 0"); return;
    }
    setCancelPolicyBusy(true);
    try {
      const tiers = cancelTiers.map(t => ({ minHoursBefore: Number(t.minHoursBefore), refundPercent: Number(t.refundPercent) }));
      const sTiers = sinceBookingTiers.map(t => ({ maxHoursAfterBooking: Number(t.maxHoursAfterBooking), refundPercent: Number(t.refundPercent) }));
      const grace = { windowMinutes: gWindow, appliesBelowLeadHours: gLead };
      const res = await api.patch<any>(`/services/${cancelPolicyService._id}/cancellation-policy`, {
        tiers,
        policyType: cancelPolicyType,
        sinceBookingTiers: sTiers,
        grace,
      });
      if (!res.success) { alert(res.error?.message || "Failed to save policy"); return; }
      setRows(prev => prev.map(r => r._id === cancelPolicyService._id
        ? { ...r, cancellationTiers: tiers, cancellationPolicyType: cancelPolicyType, sinceBookingTiers: sTiers, cancellationGrace: grace }
        : r));
      setCancelPolicyService(null);
    } finally {
      setCancelPolicyBusy(false);
    }
  };

  // ── Cake setup modal (customization + ingredients + 360 frames) ───────
  const [cakeSetupService, setCakeSetupService] = useState<any | null>(null);
  const [cakeWeights, setCakeWeights] = useState<{ label: string; priceDelta: string }[]>([]);
  const [cakeFlavours, setCakeFlavours] = useState<{ name: string; priceDelta: string }[]>([]);
  const [cakeAddons, setCakeAddons] = useState<{ name: string; price: string }[]>([]);
  const [cakeTwoTierDelta, setCakeTwoTierDelta] = useState("0");
  const [cakeNameEnabled, setCakeNameEnabled] = useState(true);
  const [cakeFlavoursEnabled, setCakeFlavoursEnabled] = useState(true);
  const [cakeWeightsEnabled, setCakeWeightsEnabled] = useState(true);
  const [cakeTiersEnabled, setCakeTiersEnabled] = useState(true);
  const [cakeAddonsEnabled, setCakeAddonsEnabled] = useState(true);
  const [cakeRefPhotoEnabled, setCakeRefPhotoEnabled] = useState(true);
  const [cakeIngredients, setCakeIngredients] = useState("");
  const [cakeMinLeadDays, setCakeMinLeadDays] = useState("0");
  const [cakeIsEggless, setCakeIsEggless] = useState(false);
  const [cakeEgglessOptionEnabled, setCakeEgglessOptionEnabled] = useState(true);
  const [cakeEgglessPriceDelta, setCakeEgglessPriceDelta] = useState("0");
  const [cakeMedia360, setCakeMedia360] = useState<string[]>([]);
  const [cakeMedia360Busy, setCakeMedia360Busy] = useState(false);
  const [cakeSetupBusy, setCakeSetupBusy] = useState(false);

  const openCakeSetup = (row: any) => {
    const c = row.customization || {};
    setCakeWeights(
      Array.isArray(c.weights)
        ? c.weights.map((w: any) => ({ label: String(w.label || ""), priceDelta: String(w.priceDelta ?? 0) }))
        : []
    );
    setCakeFlavours(
      Array.isArray(c.flavours) && c.flavours.length > 0
        ? c.flavours.map((f: any) => ({ name: String(f.name || ""), priceDelta: String(f.priceDelta ?? 0) }))
        : [{ name: "Vanilla", priceDelta: "0" }]
    );
    setCakeAddons(
      Array.isArray(c.addons)
        ? c.addons.map((a: any) => ({ name: String(a.name || ""), price: String(a.price ?? 0) }))
        : []
    );
    setCakeTwoTierDelta(String(c.twoTierPriceDelta ?? 0));
    setCakeNameEnabled(c.nameOnCakeEnabled !== false);
    setCakeFlavoursEnabled(c.flavoursEnabled !== false);
    setCakeWeightsEnabled(c.weightsEnabled !== false);
    setCakeTiersEnabled(c.tiersEnabled !== false);
    setCakeAddonsEnabled(c.addonsEnabled !== false);
    setCakeRefPhotoEnabled(c.referencePhotoEnabled !== false);
    setCakeIngredients(Array.isArray(row.ingredients) ? row.ingredients.join(", ") : "");
    setCakeMinLeadDays(String(row.minLeadDays ?? 0));
    setCakeIsEggless(Boolean(row.isEggless));
    setCakeEgglessOptionEnabled(c.egglessOptionEnabled !== false);
    setCakeEgglessPriceDelta(String(c.egglessPriceDelta ?? 0));
    setCakeMedia360(Array.isArray(row.media360) ? row.media360 : []);
    setCakeSetupService(row);
  };

  const handleMedia360Upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCakeMedia360Busy(true);
    try {
      const res = await api.uploadFiles<{ success: boolean; imageUrls: string[]; message?: string }>(
        "/api/upload/multi?folder=services",
        Array.from(files)
      );
      if (!res.success || !Array.isArray(res.imageUrls)) throw new Error(res.message || "Upload failed");
      setCakeMedia360(prev => [...prev, ...res.imageUrls].slice(0, 12));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setCakeMedia360Busy(false);
    }
  };

  const saveCakeSetup = async () => {
    if (!cakeSetupService) return;
    const weights = cakeWeights
      .map(w => ({ label: w.label.trim(), priceDelta: Number(w.priceDelta) || 0 }))
      .filter(w => w.label);
    const flavours = cakeFlavours
      .map(f => ({ name: f.name.trim(), priceDelta: Number(f.priceDelta) || 0 }))
      .filter(f => f.name);
    const addons = cakeAddons
      .map(a => ({ name: a.name.trim(), price: Number(a.price) || 0 }))
      .filter(a => a.name);
    if (weights.some(w => w.priceDelta < 0) || flavours.some(f => f.priceDelta < 0) || addons.some(a => a.price < 0)) {
      alert("Prices must be ≥ 0"); return;
    }
    const ingredients = cakeIngredients.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    const minLeadDays = Math.max(0, Number(cakeMinLeadDays) || 0);
    const twoTierPriceDelta = Math.max(0, Number(cakeTwoTierDelta) || 0);
    const egglessPriceDelta = Math.max(0, Number(cakeEgglessPriceDelta) || 0);

    setCakeSetupBusy(true);
    try {
      const detailsRes = await api.patch<any>(`/services/${cakeSetupService._id}`, {
        ingredients,
        media360: cakeMedia360,
        minLeadDays,
        isEggless: cakeIsEggless,
      });
      if (!detailsRes.success) { alert(detailsRes.error?.message || "Failed to save cake details"); return; }

      const custRes = await api.patch<any>(`/services/${cakeSetupService._id}/customization`, {
        weights,
        flavours,
        twoTierPriceDelta,
        egglessPriceDelta,
        addons,
        nameOnCakeEnabled: cakeNameEnabled,
        flavoursEnabled: cakeFlavoursEnabled,
        weightsEnabled: cakeWeightsEnabled,
        tiersEnabled: cakeTiersEnabled,
        addonsEnabled: cakeAddonsEnabled,
        referencePhotoEnabled: cakeRefPhotoEnabled,
        egglessOptionEnabled: cakeEgglessOptionEnabled,
      });
      if (!custRes.success) { alert(custRes.error?.message || "Failed to save customization"); return; }

      setCakeSetupService(null);
      fetchRows();
    } finally {
      setCakeSetupBusy(false);
    }
  };

  // ── Photo gallery modal (any service, e.g. mehendi) ───────────────────
  // Two independent galleries, mirroring the Image / Web Image split:
  // media360 shows in the mobile app only, webMedia360 on the web only.
  // Cakes manage their (shared) gallery inside Cake Setup instead.
  const [photosService, setPhotosService] = useState<any | null>(null);
  const [appPhotosList, setAppPhotosList] = useState<string[]>([]);
  const [webPhotosList, setWebPhotosList] = useState<string[]>([]);
  // App and web slideshows are controlled independently — turning one off
  // (e.g. web) leaves the other (app) untouched.
  const [appPhotosAutoSlide, setAppPhotosAutoSlide] = useState(true);
  const [appPhotosSlideSeconds, setAppPhotosSlideSeconds] = useState("3");
  const [webPhotosAutoSlide, setWebPhotosAutoSlide] = useState(true);
  const [webPhotosSlideSeconds, setWebPhotosSlideSeconds] = useState("3");
  const [photosBusy, setPhotosBusy] = useState(false);
  const [photosSaving, setPhotosSaving] = useState(false);

  const openPhotos = (row: any) => {
    setAppPhotosList(Array.isArray(row.media360) ? row.media360 : []);
    setWebPhotosList(Array.isArray(row.webMedia360) ? row.webMedia360 : []);
    setAppPhotosAutoSlide(row.autoSlideEnabled !== false);
    setAppPhotosSlideSeconds(String(row.autoSlideSeconds ?? 3));
    setWebPhotosAutoSlide(row.webAutoSlideEnabled !== false);
    setWebPhotosSlideSeconds(String(row.webAutoSlideSeconds ?? 3));
    setPhotosService(row);
  };

  const handlePhotosUpload = async (
    files: FileList | null,
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (!files || files.length === 0) return;
    setPhotosBusy(true);
    try {
      const res = await api.uploadFiles<{ success: boolean; imageUrls: string[]; message?: string }>(
        "/api/upload/multi?folder=services",
        Array.from(files)
      );
      if (!res.success || !Array.isArray(res.imageUrls)) throw new Error(res.message || "Upload failed");
      setList(prev => [...prev, ...res.imageUrls].slice(0, 12));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPhotosBusy(false);
    }
  };

  const savePhotos = async () => {
    if (!photosService) return;
    setPhotosSaving(true);
    try {
      const res = await api.patch<any>(`/services/${photosService._id}`, {
        media360: appPhotosList,
        webMedia360: webPhotosList,
        autoSlideEnabled: appPhotosAutoSlide,
        autoSlideSeconds: Math.min(30, Math.max(1, Number(appPhotosSlideSeconds) || 3)),
        webAutoSlideEnabled: webPhotosAutoSlide,
        webAutoSlideSeconds: Math.min(30, Math.max(1, Number(webPhotosSlideSeconds) || 3)),
      });
      if (!res.success) { alert(res.error?.message || "Failed to save photos"); return; }
      setPhotosService(null);
      fetchRows();
    } finally {
      setPhotosSaving(false);
    }
  };

  // ── Crop modal ────────────────────────────────────────────────────────
  const [cropModalInfo, setCropModalInfo] = useState<{
    file: File;
    src: string;
    aspect: number;
    onComplete: (file: File) => void;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: "%", width: 90, x: 5, y: 5, height: 90 });
  const [cropZoom, setCropZoom] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────
  const fetchRows = useCallback(async () => {
    const res = await api.get<any>("/services");
    if (res.success) { setRows(res.data); setPageError(""); return; }
    setPageError(res.error?.message || "Unable to load services");
  }, [api]);

  const fetchCategories = useCallback(async () => {
    const res = await api.get<any>("/services/categories");
    if (res.success) { setCategories(res.data); return; }
    setPageError(res.error?.message || "Unable to load categories");
  }, [api]);

  const fetchSubCategories = useCallback(async (categoryId?: string) => {
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    const res = await api.get<any>(`/services/subcategories${query}`);
    if (res.success) { setSubCategories(res.data); return; }
    setPageError(res.error?.message || "Unable to load subcategories");
  }, [api]);

  useEffect(() => {
    fetchRows();
    fetchCategories();
    fetchSubCategories();
  }, [fetchRows, fetchCategories, fetchSubCategories]);

  // ── Crop helpers ──────────────────────────────────────────────────────
  const startCrop = (file: File | undefined | null, aspect: number, onComplete: (f: File) => void) => {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      setCrop({ unit: "%", width: 90, x: 5, y: 5, height: 90 });
      setCropZoom(1);
      setCropModalInfo({ file, src: reader.result as string, aspect, onComplete });
    });
    reader.readAsDataURL(file);
  };

  const handleCropComplete = () => {
    if (!imgRef.current || !crop.width || !crop.height || !cropModalInfo) return;
    const img = imgRef.current;
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;
    const px = crop.unit === "%"
      ? { x: (crop.x / 100) * img.width, y: (crop.y / 100) * img.height, width: (crop.width / 100) * img.width, height: (crop.height / 100) * img.height }
      : { x: crop.x, y: crop.y, width: crop.width, height: crop.height };
    const canvas = document.createElement("canvas");
    canvas.width = px.width * scaleX;
    canvas.height = px.height * scaleY;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, px.x * scaleX, px.y * scaleY, px.width * scaleX, px.height * scaleY, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], cropModalInfo.file.name, { type: cropModalInfo.file.type });
      cropModalInfo.onComplete(croppedFile);
      setCropModalInfo(null);
    }, cropModalInfo.file.type, 0.95);
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(3, Math.max(0.5, newZoom));
    setCropZoom(clamped);
    if (crop.unit !== "%") setCrop({ unit: "%", width: 90, x: 5, y: 5, height: 90 });
  };

  // ── Image upload ──────────────────────────────────────────────────────
  const uploadImage = async (file: File) => {
    const res = await api.uploadFile<{ success: boolean; imageUrl: string; message?: string }>("/api/upload?folder=services", file);
    if (!res.success || !res.imageUrl) throw new Error(res.message || "Image upload failed");
    return res.imageUrl;
  };

  const mkUploader = (setBusy: (b: boolean) => void, onUrl: (url: string) => void) =>
    async (file?: File | null) => {
      if (!file) return;
      setBusy(true);
      try { onUrl(await uploadImage(file)); }
      catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
      finally { setBusy(false); }
    };

  const handleCatFormImageUpload = mkUploader(setCatImageBusy, (url) => setCatForm(f => ({ ...f, imageUrl: url })));
  const handleCatFormWebImageUpload = mkUploader(setCatWebImageBusy, (url) => setCatForm(f => ({ ...f, webImageUrl: url })));
  const handleSubCatFormImageUpload = mkUploader(setSubCatImageBusy, (url) => setSubCatForm(f => ({ ...f, imageUrl: url })));
  const handleServiceImageUpload = mkUploader(setServiceUploadBusy, (url) => setServiceForm(f => ({ ...f, imageUrl: url })));
  const handleServiceWebImageUpload = mkUploader(setServiceWebUploadBusy, (url) => setServiceForm(f => ({ ...f, webImageUrl: url })));

  const handleRowImageUpload = async (serviceId: string, file?: File | null) => {
    if (!file) return;
    setRowUploadBusy(b => ({ ...b, [serviceId]: true }));
    try { await updateService(serviceId, { imageUrl: await uploadImage(file) }); }
    catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setRowUploadBusy(b => ({ ...b, [serviceId]: false })); }
  };

  const handleRowWebImageUpload = async (serviceId: string, file?: File | null) => {
    if (!file) return;
    setRowWebUploadBusy(b => ({ ...b, [serviceId]: true }));
    try { await updateService(serviceId, { webImageUrl: await uploadImage(file) }); }
    catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setRowWebUploadBusy(b => ({ ...b, [serviceId]: false })); }
  };

  const handleCategoryImageUpload = async (catId: string, file?: File | null) => {
    if (!file) return;
    setCategoryUploadBusy(b => ({ ...b, [catId]: true }));
    try { await updateCategory(catId, { imageUrl: await uploadImage(file) }); }
    catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setCategoryUploadBusy(b => ({ ...b, [catId]: false })); }
  };

  const handleCategoryWebImageUpload = async (catId: string, file?: File | null) => {
    if (!file) return;
    setCategoryWebUploadBusy(b => ({ ...b, [catId]: true }));
    try { await updateCategory(catId, { webImageUrl: await uploadImage(file) }); }
    catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setCategoryWebUploadBusy(b => ({ ...b, [catId]: false })); }
  };

  const handleSubCategoryRowImageUpload = async (subId: string, file?: File | null) => {
    if (!file) return;
    setSubCategoryRowUploadBusy(b => ({ ...b, [subId]: true }));
    try { await updateSubCategory(subId, { imageUrl: await uploadImage(file) }); }
    catch (e) { alert(e instanceof Error ? e.message : "Upload failed"); }
    finally { setSubCategoryRowUploadBusy(b => ({ ...b, [subId]: false })); }
  };

  // ── CRUD ──────────────────────────────────────────────────────────────
  const updateService = async (id: string, patch: Record<string, unknown>) => {
    const res = await api.patch<any>(`/services/${id}`, patch);
    if (!res.success) { alert(res.error?.message || "Failed to update service"); return; }
    fetchRows();
  };

  const toggleService = async (id: string, isEnabled: boolean) => {
    await api.patch(`/services/${id}/status`, { isEnabled });
    fetchRows();
  };

  const updateCategory = async (id: string, patch: Record<string, unknown>) => {
    const res = await api.patch<any>(`/services/categories/${id}`, patch);
    if (!res.success) { alert(res.error?.message || "Failed to update category"); return; }
    fetchCategories();
    fetchRows();
  };

  const updateSubCategory = async (id: string, patch: Record<string, unknown>) => {
    const res = await api.patch<any>(`/services/subcategories/${id}`, patch);
    if (!res.success) { alert(res.error?.message || "Failed to update subcategory"); return; }
    fetchSubCategories();
    fetchRows();
  };

  const createCategory = async () => {
    if (!catForm.name.trim()) { alert("Category name is required"); return; }
    setCatFormBusy(true);
    try {
      const res = await api.post<any>("/services/categories", {
        name: catForm.name.trim(),
        ...(catForm.imageUrl.trim() ? { imageUrl: catForm.imageUrl.trim() } : {}),
        ...(catForm.webImageUrl.trim() ? { webImageUrl: catForm.webImageUrl.trim() } : {}),
      });
      if (!res.success) { alert(res.error?.message || "Failed to create category"); return; }
      setCatForm({ name: "", imageUrl: "", webImageUrl: "" });
      setShowCatForm(false);
      fetchCategories();
    } finally { setCatFormBusy(false); }
  };

  const createSubCategory = async () => {
    if (!subCatForm.name.trim()) { alert("Subcategory name is required"); return; }
    if (!subCatForm.categoryId) { alert("Please select a parent category"); return; }
    setSubCatFormBusy(true);
    try {
      const res = await api.post<any>("/services/subcategories", {
        name: subCatForm.name.trim(),
        categoryId: subCatForm.categoryId,
        ...(subCatForm.imageUrl.trim() ? { imageUrl: subCatForm.imageUrl.trim() } : {}),
      });
      if (!res.success) { alert(res.error?.message || "Failed to create subcategory"); return; }
      setSubCatForm({ name: "", categoryId: "", imageUrl: "" });
      setShowSubCatForm(false);
      fetchSubCategories();
    } finally { setSubCatFormBusy(false); }
  };

  const createService = async () => {
    if (!serviceForm.name.trim()) { alert("Service name is required"); return; }
    setServiceFormBusy(true);
    try {
      const res = await api.post<any>("/services", {
        name: serviceForm.name.trim(),
        categoryId: serviceForm.categoryId || undefined,
        subCategoryId: serviceForm.subCategoryId || undefined,
        basePriceInr: Number(serviceForm.basePriceInr),
        commissionPercent: Number(serviceForm.commissionPercent),
        description: serviceForm.description,
        imageUrl: serviceForm.imageUrl,
        webImageUrl: serviceForm.webImageUrl,
        duration: Number(serviceForm.duration),
      });
      if (!res.success) { alert(res.error?.message || "Failed to create service"); return; }
      setServiceForm({ name: "", categoryId: "", subCategoryId: "", basePriceInr: "", commissionPercent: "20", description: "", imageUrl: "", webImageUrl: "", duration: "" });
      setShowServiceForm(false);
      fetchRows();
    } finally { setServiceFormBusy(false); }
  };

  const seedDefaults = async () => {
    const res = await api.post("/services/seed-defaults");
    if (!res.success) { alert(res.error?.message || "Failed to import defaults"); return; }
    fetchRows();
    fetchCategories();
    fetchSubCategories();
  };

  // ── Derived data ──────────────────────────────────────────────────────
  // Category checks for the per-row skillTier / packingRole selects.
  const rowCategoryText = (row: any) =>
    `${row.category?.slug || ""} ${row.category?.name || ""}`.toLowerCase();
  const isACServiceRow = (row: any) => /(^|[^a-z])ac([^a-z]|$)|air.?con/.test(rowCategoryText(row));
  const isMehendiServiceRow = (row: any) => rowCategoryText(row).includes("mehendi");

  const serviceSearchLower = serviceSearch.trim().toLowerCase();
  const filteredServices = rows.filter(r => {
    if (serviceFilterCat && !(r.category?._id === serviceFilterCat || r.category === serviceFilterCat)) return false;
    if (serviceSearchLower && !String(r.name || "").toLowerCase().includes(serviceSearchLower)) return false;
    return true;
  });

  const filteredSubCategories = subCatFilterCat
    ? subCategories.filter(s => s.category === subCatFilterCat || s.category?._id === subCatFilterCat)
    : subCategories;

  // ── Sub-tab components for readability ────────────────────────────────
  const subCountForCat = (catId: string) => subCategories.filter(s => s.category === catId || s.category?._id === catId).length;
  const serviceCountForCat = (catId: string) => rows.filter(r => r.category?._id === catId || r.category === catId).length;

  // ── Styles ─────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { padding: 20, border: "1px solid var(--border)", borderRadius: 10, background: "var(--panel-alt)", marginBottom: 20 };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" };

  return (
    <>
      {/* ── Tab bar ──────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid var(--border)", paddingBottom: 0 }}>
        {(["categories", "subcategories", "services"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: activeTab === t ? 700 : 400,
              fontSize: 14,
              color: activeTab === t ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: activeTab === t ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {t === "categories" ? `Categories (${categories.length})` : t === "subcategories" ? `Subcategories (${subCategories.length})` : `Services (${rows.length})`}
          </button>
        ))}
      </div>

      {pageError ? <div className="error-banner" style={{ marginBottom: 16 }}>{pageError}</div> : null}

      {/* ════════════════════════════════════════════════════════════════
          CATEGORIES TAB
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === "categories" && (
        <>
          {/* Create form (collapsible) */}
          {showCatForm && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Create New Category</h3>
              <button className="button secondary sm" onClick={() => setShowCatForm(false)}>✕ Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <span style={label}>Category Name *</span>
                <input
                  className="input"
                  placeholder="e.g. AC Repair"
                  value={catForm.name}
                  onChange={(e) => setCatForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <span style={label}>App Image</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Image URL (or upload)"
                    value={catForm.imageUrl}
                    onChange={(e) => setCatForm(f => ({ ...f, imageUrl: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <label className="button secondary upload-button" style={{ whiteSpace: "nowrap" }}>
                    {catImageBusy ? "..." : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 4 / 3, handleCatFormImageUpload); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
              <div>
                <span style={label}>Web Image</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Image URL (or upload)"
                    value={catForm.webImageUrl}
                    onChange={(e) => setCatForm(f => ({ ...f, webImageUrl: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <label className="button secondary upload-button" style={{ whiteSpace: "nowrap" }}>
                    {catWebImageBusy ? "..." : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 4 / 3, handleCatFormWebImageUpload); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            </div>
            {(catForm.imageUrl || catForm.webImageUrl) && (
              <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
                {catForm.imageUrl && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>App</div>
                    <img src={catForm.imageUrl} alt="App preview" style={{ height: 72, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }} />
                  </div>
                )}
                {catForm.webImageUrl && (
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Web</div>
                    <img src={catForm.webImageUrl} alt="Web preview" style={{ height: 72, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }} />
                  </div>
                )}
              </div>
            )}
            <button className="button" style={{ marginTop: 16 }} onClick={createCategory} disabled={catFormBusy}>
              {catFormBusy ? "Creating..." : "Create Category"}
            </button>
          </div>
          )}

          {/* Categories list */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>All Categories</h3>
              {!showCatForm && (
                <button className="button" onClick={() => setShowCatForm(true)}>+ New Category</button>
              )}
            </div>
            {categories.length === 0 && <div className="muted">No categories yet.</div>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {categories.map((cat) => (
                <div key={cat._id} style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--bg)" }}>
                  {/* Image areas — separate App / Web images */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ height: 100, background: "var(--panel-alt)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                      {cat.imageUrl
                        ? <img src={cat.imageUrl} alt={cat.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ color: "var(--muted-2)", fontSize: 12 }}>No image</span>
                      }
                      <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "1px 6px", borderRadius: 999 }}>App</span>
                      <label className="button secondary upload-button" style={{ position: "absolute", bottom: 6, right: 6, fontSize: 11, padding: "3px 8px" }}>
                        {categoryUploadBusy[cat._id] ? "..." : "Change"}
                        <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 4 / 3, (f) => handleCategoryImageUpload(cat._id, f)); e.target.value = ""; }} />
                      </label>
                    </div>
                    <div style={{ height: 100, background: "var(--panel-alt)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", borderLeft: "1px solid var(--border)" }}>
                      {cat.webImageUrl
                        ? <img src={cat.webImageUrl} alt={`${cat.name} (web)`} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <span style={{ color: "var(--muted-2)", fontSize: 12 }}>No image</span>
                      }
                      <span style={{ position: "absolute", top: 6, left: 6, fontSize: 10, fontWeight: 600, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "1px 6px", borderRadius: 999 }}>Web</span>
                      <label className="button secondary upload-button" style={{ position: "absolute", bottom: 6, right: 6, fontSize: 11, padding: "3px 8px" }}>
                        {categoryWebUploadBusy[cat._id] ? "..." : "Change"}
                        <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 4 / 3, (f) => handleCategoryWebImageUpload(cat._id, f)); e.target.value = ""; }} />
                      </label>
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{cat.name}</div>
                    <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                      <span>{subCountForCat(cat._id)} subcategories</span>
                      <span>·</span>
                      <span>{serviceCountForCat(cat._id)} services</span>
                    </div>
                    <button
                      className={`tag tag-toggle ${cat.isActive ? "tag-active" : "tag-inactive"}`}
                      title={cat.isActive ? "Click to disable this category" : "Click to enable this category"}
                      onClick={() => updateCategory(cat._id, { isActive: !cat.isActive })}
                    >
                      {cat.isActive ? "Active" : "Disabled"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SUBCATEGORIES TAB
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === "subcategories" && (
        <>
          {/* Create form (collapsible) */}
          {showSubCatForm && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Create New Subcategory</h3>
              <button className="button secondary sm" onClick={() => setShowSubCatForm(false)}>✕ Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <span style={label}>Subcategory Name *</span>
                <input
                  className="input"
                  placeholder="e.g. Split AC"
                  value={subCatForm.name}
                  onChange={(e) => setSubCatForm(f => ({ ...f, name: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <span style={label}>Parent Category *</span>
                <select
                  className="input"
                  value={subCatForm.categoryId}
                  onChange={(e) => setSubCatForm(f => ({ ...f, categoryId: e.target.value }))}
                  style={{ width: "100%" }}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <span style={label}>Image</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    placeholder="URL or upload"
                    value={subCatForm.imageUrl}
                    onChange={(e) => setSubCatForm(f => ({ ...f, imageUrl: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <label className="button secondary upload-button">
                    {subCatImageBusy ? "..." : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 1 / 1, handleSubCatFormImageUpload); e.target.value = ""; }} />
                  </label>
                </div>
              </div>
            </div>
            {subCatForm.imageUrl && (
              <div style={{ marginTop: 12 }}>
                <img src={subCatForm.imageUrl} alt="Preview" style={{ height: 64, width: 64, borderRadius: 6, objectFit: "cover", border: "1px solid var(--border)" }} />
              </div>
            )}
            <button className="button" style={{ marginTop: 16 }} onClick={createSubCategory} disabled={subCatFormBusy}>
              {subCatFormBusy ? "Creating..." : "Create Subcategory"}
            </button>
          </div>
          )}

          {/* Subcategories list */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <h3 style={{ margin: 0, marginRight: "auto" }}>All Subcategories</h3>
              <select
                className="input"
                value={subCatFilterCat}
                onChange={(e) => { setSubCatFilterCat(e.target.value); fetchSubCategories(e.target.value || undefined); }}
                style={{ width: 200 }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              {!showSubCatForm && (
                <button className="button" onClick={() => setShowSubCatForm(true)}>+ New Subcategory</button>
              )}
            </div>
            {filteredSubCategories.length === 0 && <div className="muted">No subcategories found.</div>}
            <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Subcategory</th>
                  <th>Parent Category</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubCategories.map((sub) => {
                  const parent = categories.find(c => c._id === sub.category || c._id === sub.category?._id);
                  return (
                    <tr key={sub._id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {sub.imageUrl
                            ? <img src={sub.imageUrl} alt={sub.name} loading="lazy" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />
                            : <div style={{ width: 48, height: 48, borderRadius: 6, background: "var(--panel-alt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--muted-2)" }}>none</div>
                          }
                          <label className="button secondary upload-button" style={{ fontSize: 11, padding: "4px 10px" }}>
                            {subCategoryRowUploadBusy[sub._id] ? "..." : "Change"}
                            <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 1 / 1, (f) => handleSubCategoryRowImageUpload(sub._id, f)); e.target.value = ""; }} />
                          </label>
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{sub.name}</td>
                      <td>{parent?.name || <span className="muted">—</span>}</td>
                      <td>
                        <button
                          className={`tag tag-toggle ${sub.isActive ? "tag-active" : "tag-inactive"}`}
                          title={sub.isActive ? "Click to disable this subcategory" : "Click to enable this subcategory"}
                          onClick={() => updateSubCategory(sub._id, { isActive: !sub.isActive })}
                        >
                          {sub.isActive ? "Active" : "Disabled"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SERVICES TAB
      ════════════════════════════════════════════════════════════════ */}
      {activeTab === "services" && (
        <>
          {/* Create form (collapsible) */}
          {showServiceForm && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Create New Service</h3>
              <button className="button secondary sm" onClick={() => setShowServiceForm(false)}>✕ Close</button>
            </div>

            {/* Row 1 — Core details */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <span style={label}>Service Name *</span>
                <input className="input" placeholder="e.g. Split AC Installation" value={serviceForm.name} onChange={(e) => setServiceForm(f => ({ ...f, name: e.target.value }))} style={{ width: "100%" }} />
              </div>
              <div>
                <span style={label}>Base Price (₹)</span>
                <input className="input" placeholder="0" type="number" value={serviceForm.basePriceInr} onChange={(e) => setServiceForm(f => ({ ...f, basePriceInr: e.target.value }))} style={{ width: "100%" }} />
              </div>
              <div>
                <span style={label}>Commission %</span>
                <input className="input" placeholder="20" type="number" value={serviceForm.commissionPercent} onChange={(e) => setServiceForm(f => ({ ...f, commissionPercent: e.target.value }))} style={{ width: "100%" }} />
              </div>
              <div>
                <span style={label}>Duration (mins)</span>
                <input className="input" placeholder="60" type="number" value={serviceForm.duration} onChange={(e) => setServiceForm(f => ({ ...f, duration: e.target.value }))} style={{ width: "100%" }} />
              </div>
            </div>

            {/* Row 2 — Category & Subcategory */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <span style={label}>Category</span>
                <select
                  className="input"
                  value={serviceForm.categoryId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setServiceForm(f => ({ ...f, categoryId: id, subCategoryId: "" }));
                    fetchSubCategories(id || undefined);
                  }}
                  style={{ width: "100%" }}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <span style={label}>Subcategory</span>
                <select
                  className="input"
                  value={serviceForm.subCategoryId}
                  onChange={(e) => setServiceForm(f => ({ ...f, subCategoryId: e.target.value }))}
                  style={{ width: "100%" }}
                  disabled={!serviceForm.categoryId}
                >
                  <option value="">Select subcategory</option>
                  {subCategories.filter(s => !serviceForm.categoryId || s.category === serviceForm.categoryId || s.category?._id === serviceForm.categoryId).map((s) => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3 — Images & Description */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <span style={label}>App Image (4:3)</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="input" placeholder="URL or upload" value={serviceForm.imageUrl} onChange={(e) => setServiceForm(f => ({ ...f, imageUrl: e.target.value }))} style={{ flex: 1 }} />
                  <label className="button secondary upload-button" style={{ whiteSpace: "nowrap" }}>
                    {serviceUploadBusy ? "..." : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 4 / 3, handleServiceImageUpload); e.target.value = ""; }} />
                  </label>
                  {serviceForm.imageUrl && <img src={serviceForm.imageUrl} alt="" style={{ height: 40, width: 53, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", flexShrink: 0 }} />}
                  {serviceForm.imageUrl && <button type="button" onClick={() => setServiceForm(f => ({ ...f, imageUrl: "" }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✕</button>}
                </div>
              </div>
              <div>
                <span style={label}>Web Image (16:9)</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="input" placeholder="URL or upload" value={serviceForm.webImageUrl} onChange={(e) => setServiceForm(f => ({ ...f, webImageUrl: e.target.value }))} style={{ flex: 1 }} />
                  <label className="button secondary upload-button" style={{ whiteSpace: "nowrap" }}>
                    {serviceWebUploadBusy ? "..." : "Upload"}
                    <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 16 / 9, handleServiceWebImageUpload); e.target.value = ""; }} />
                  </label>
                  {serviceForm.webImageUrl && <img src={serviceForm.webImageUrl} alt="" style={{ height: 40, width: 71, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", flexShrink: 0 }} />}
                  {serviceForm.webImageUrl && <button type="button" onClick={() => setServiceForm(f => ({ ...f, webImageUrl: "" }))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>✕</button>}
                </div>
              </div>
              <div>
                <span style={label}>Description</span>
                <textarea className="input" placeholder="Short service description..." value={serviceForm.description} onChange={(e) => setServiceForm(f => ({ ...f, description: e.target.value }))} style={{ width: "100%", height: 42, resize: "vertical" }} />
              </div>
            </div>

            <button className="button" style={{ padding: "10px 28px", fontWeight: 600 }} onClick={createService} disabled={serviceFormBusy}>
              {serviceFormBusy ? "Creating..." : "Create Service"}
            </button>
          </div>
          )}

          {/* Services list */}
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <h3 style={{ margin: 0, marginRight: "auto" }}>All Services <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 13 }}>({filteredServices.length}{serviceFilterCat || serviceSearchLower ? " filtered" : ""})</span></h3>
              <input
                className="input"
                placeholder="Search services..."
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                style={{ width: 190 }}
              />
              <select
                className="input"
                value={serviceFilterCat}
                onChange={(e) => setServiceFilterCat(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <button className="button secondary" onClick={seedDefaults}>Import Defaults</button>
              {!showServiceForm && (
                <button className="button" onClick={() => setShowServiceForm(true)}>+ New Service</button>
              )}
            </div>
            {filteredServices.length === 0 && <div className="muted">No services found.</div>}
            <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Price (₹)</th>
                  <th>Comm %</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }} title="Highlighted services appear in the Highlights row on the web home page (shows up to 4)">Highlight</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map((row) => {
                  const isCake = Boolean(row.customization?.flavours?.length);
                  const missingImages = [!row.imageUrl && "app", !row.webImageUrl && "web"].filter(Boolean) as string[];
                  const photoCount = (row.media360?.length || 0) + (row.webMedia360?.length || 0);
                  return (
                  <tr key={row._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          {row.imageUrl
                            ? <img src={row.imageUrl} alt={row.name} loading="lazy" style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }} />
                            : <div style={{ width: 48, height: 36, borderRadius: 6, background: "var(--panel-alt)", border: "1px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "var(--muted-2)" }}>no img</div>
                          }
                          {missingImages.length > 0 && (
                            <span
                              title={`Missing ${missingImages.join(" & ")} image — open Manage → Images`}
                              style={{ position: "absolute", top: -5, right: -5, width: 14, height: 14, borderRadius: 999, background: "var(--warning)", color: "#1c1917", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                            >!</span>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "var(--text)" }}>
                            {row.name}
                            {isCake && <span title="Cake — customization enabled" style={{ marginLeft: 6 }}>🎂</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>
                            {row.category?.name || "Uncategorised"}
                            {row.subCategory?.name ? ` › ${row.subCategory.name}` : ""}
                            {row.duration ? ` · ${row.duration}m` : ""}
                            {photoCount > 0 ? ` · 📷 ${photoCount}` : ""}
                          </div>
                          {isACServiceRow(row) && (
                            <select
                              className="input"
                              title="Minimum partner skill tier required — technicians only for gas/repair/installation work"
                              style={{ marginTop: 4, height: 24, fontSize: 12, padding: "0 4px", width: "auto" }}
                              value={Number(row.skillTier) === 2 ? "2" : "1"}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateService(row._id, { skillTier: Number(e.target.value) })}
                            >
                              <option value="1">Tier 1 · Serviceman (cleaning)</option>
                              <option value="2">Tier 2 · Technician (gas/repair/install)</option>
                            </select>
                          )}
                          {isMehendiServiceRow(row) && (
                            <select
                              className="input"
                              title="How team sizing treats this service — set explicitly so renaming the service can't change staffing"
                              style={{ marginTop: 4, height: 24, fontSize: 12, padding: "0 4px", width: "auto" }}
                              value={row.packingRole || ""}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateService(row._id, { packingRole: e.target.value })}
                            >
                              <option value="">Role: auto (by name)</option>
                              <option value="BRIDAL">Bridal · 2 dedicated artists</option>
                              <option value="HAND">Guest hand work</option>
                              <option value="FEET_ADDON">Feet add-on (pairs with hands)</option>
                              <option value="INDEPENDENT">Independent task</option>
                            </select>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 84 }}
                        defaultValue={row.price}
                        onBlur={(e) => updateService(row._id, { basePriceInr: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        style={{ width: 64 }}
                        defaultValue={row.commissionPercent}
                        onBlur={(e) => updateService(row._id, { commissionPercent: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <button
                        className={`tag tag-toggle ${row.isActive ? "tag-active" : "tag-inactive"}`}
                        title={row.isActive ? "Click to disable this service" : "Click to enable this service"}
                        onClick={() => toggleService(row._id, !row.isActive)}
                      >
                        {row.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        title={row.isHighlighted ? "In the web Highlights row — click to remove" : "Add to the web Highlights row (shows up to 4)"}
                        onClick={() => updateService(row._id, { isHighlighted: !row.isHighlighted })}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4, color: row.isHighlighted ? "#f59e0b" : "var(--muted-2)" }}
                      >
                        {row.isHighlighted ? "★" : "☆"}
                      </button>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="button secondary sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          setMenuFor(menuFor?.id === row._id ? null : { id: row._id, x: r.right, y: r.bottom + 4 });
                        }}
                      >
                        Manage ▾
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}

      {/* ── Row "Manage" dropdown menu ────────────────────────────────── */}
      {menuFor && (() => {
        const row = rows.find(r => r._id === menuFor.id);
        if (!row) return null;
        const isCake = Boolean(row.customization?.flavours?.length);
        const menuWidth = 230;
        const estHeight = (isCake ? 3 : 4) * 34 + 10;
        const left = Math.max(8, Math.min(menuFor.x - menuWidth, window.innerWidth - menuWidth - 8));
        const top = menuFor.y + estHeight > window.innerHeight ? Math.max(8, menuFor.y - estHeight - 38) : menuFor.y;
        return (
          <div className="menu" style={{ position: "fixed", top, left, width: menuWidth }} onClick={(e) => e.stopPropagation()}>
            <button className="menu-item" onClick={() => { setImagesServiceId(row._id); setMenuFor(null); }}>
              🖼️ Images (app & web)
            </button>
            <button className="menu-item" onClick={() => { openCancelPolicy(row); setMenuFor(null); }}>
              ↩️ Cancellation policy
            </button>
            <button className="menu-item" onClick={() => { openCakeSetup(row); setMenuFor(null); }}>
              🎂 Cake setup
            </button>
            {!isCake && (
              <button className="menu-item" onClick={() => { openPhotos(row); setMenuFor(null); }}>
                📷 Photo gallery{(row.media360?.length || row.webMedia360?.length) ? ` (${row.media360?.length || 0} app / ${row.webMedia360?.length || 0} web)` : ""}
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Images Modal (app & web images) ───────────────────────────── */}
      {(() => {
        const imagesRow = imagesServiceId ? rows.find(r => r._id === imagesServiceId) : null;
        if (!imagesRow) return null;
        return (
          <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ backgroundColor: "var(--panel)", padding: 28, borderRadius: 12, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 4 }}>🖼️ Images</h3>
              <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
                {imagesRow.name} — the App image (4:3) shows in the mobile app, the Web image (16:9) on the website.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div>
                  <span style={label}>App Image (4:3)</span>
                  {imagesRow.imageUrl
                    ? <img src={imagesRow.imageUrl} alt="App" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }} />
                    : <div style={{ width: "100%", aspectRatio: "4 / 3", borderRadius: 8, border: "1px dashed var(--border-strong)", background: "var(--panel-alt)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-2)", fontSize: 12 }}>No image</div>
                  }
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <label className="button secondary sm upload-button">
                      {rowUploadBusy[imagesRow._id] ? "Uploading..." : imagesRow.imageUrl ? "Change" : "Upload"}
                      <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 4 / 3, (f) => handleRowImageUpload(imagesRow._id, f)); e.target.value = ""; }} />
                    </label>
                    {imagesRow.imageUrl && (
                      <button className="button secondary sm" style={{ color: "var(--danger)" }} onClick={() => { if (confirm("Remove app image?")) updateService(imagesRow._id, { imageUrl: "" }); }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span style={label}>Web Image (16:9)</span>
                  {imagesRow.webImageUrl
                    ? <img src={imagesRow.webImageUrl} alt="Web" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }} />
                    : <div style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 8, border: "1px dashed var(--border-strong)", background: "var(--panel-alt)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-2)", fontSize: 12 }}>No image</div>
                  }
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <label className="button secondary sm upload-button">
                      {rowWebUploadBusy[imagesRow._id] ? "Uploading..." : imagesRow.webImageUrl ? "Change" : "Upload"}
                      <input type="file" accept="image/*" onChange={(e) => { startCrop(e.target.files?.[0], 16 / 9, (f) => handleRowWebImageUpload(imagesRow._id, f)); e.target.value = ""; }} />
                    </label>
                    {imagesRow.webImageUrl && (
                      <button className="button secondary sm" style={{ color: "var(--danger)" }} onClick={() => { if (confirm("Remove web image?")) updateService(imagesRow._id, { webImageUrl: "" }); }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="button" onClick={() => setImagesServiceId(null)}>Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Cancellation Policy Modal ─────────────────────────────────── */}
      {cancelPolicyService && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--panel)", padding: 28, borderRadius: 12, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Cancellation Policy</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>{cancelPolicyService.name}</p>

            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "block" }}>Policy Type</span>
              <select
                className="input"
                value={cancelPolicyType}
                onChange={(e) => setCancelPolicyType(e.target.value as "BEFORE_SERVICE" | "SINCE_BOOKING")}
                style={{ width: "100%" }}
              >
                <option value="BEFORE_SERVICE">Time before service (standard — AC, plumbing, mehendi)</option>
                <option value="SINCE_BOOKING">Time since booking (advance orders — cakes)</option>
              </select>
            </div>

            {cancelPolicyType === "BEFORE_SERVICE" ? (
              <>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>Refund % per time window before the service starts</p>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Hours Before Service (≥)</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Refund %</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {cancelTiers.map((tier, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            style={{ width: 90 }}
                            value={tier.minHoursBefore}
                            onChange={e => setCancelTiers(prev => prev.map((t, idx) => idx === i ? { ...t, minHoursBefore: e.target.value } : t))}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            max={100}
                            style={{ width: 70 }}
                            value={tier.refundPercent}
                            onChange={e => setCancelTiers(prev => prev.map((t, idx) => idx === i ? { ...t, refundPercent: e.target.value } : t))}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <button onClick={() => setCancelTiers(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button className="button secondary" style={{ fontSize: 12, marginBottom: 20 }} onClick={() => setCancelTiers(prev => [...prev, { minHoursBefore: "0", refundPercent: "0" }])}>
                  + Add Tier
                </button>

                <p style={{ fontSize: 12, color: "var(--muted-2)", marginBottom: 20 }}>
                  Leave empty to use global defaults (100% / 75% / 50% / 25%).
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
                  Refund % by hours <strong>elapsed since the booking was placed</strong>. The first matching row applies.
                  Use a large final value (e.g. 8760) as the "afterwards" rate.
                </p>
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Within Hours of Booking (≤)</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Refund %</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sinceBookingTiers.map((tier, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            style={{ width: 90 }}
                            value={tier.maxHoursAfterBooking}
                            onChange={e => setSinceBookingTiers(prev => prev.map((t, idx) => idx === i ? { ...t, maxHoursAfterBooking: e.target.value } : t))}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            max={100}
                            style={{ width: 70 }}
                            value={tier.refundPercent}
                            onChange={e => setSinceBookingTiers(prev => prev.map((t, idx) => idx === i ? { ...t, refundPercent: e.target.value } : t))}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <button onClick={() => setSinceBookingTiers(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button className="button secondary" style={{ fontSize: 12, marginBottom: 20 }} onClick={() => setSinceBookingTiers(prev => [...prev, { maxHoursAfterBooking: "0", refundPercent: "0" }])}>
                  + Add Tier
                </button>

                <p style={{ fontSize: 12, color: "var(--muted-2)", marginBottom: 20 }}>
                  Legacy advance-order policy. Cakes now use "Time before service" tiers
                  (48h → 100%, 24h → 50%, under 24h → 0%) plus the grace period below.
                </p>
              </>
            )}

            <div style={{ marginBottom: 20, padding: 12, border: "1px solid var(--border)", borderRadius: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6, display: "block" }}>
                Last-minute order grace period
              </span>
              <p style={{ fontSize: 12, color: "var(--muted-2)", marginTop: 0, marginBottom: 10 }}>
                Orders placed with less notice than the threshold get a free-cancel window
                (100% refund) from the moment of booking, before the tiers above apply.
                Set window to 0 to disable. Threshold 0 = applies to every order.
              </p>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  Window (minutes)
                  <input
                    className="input"
                    type="number"
                    min={0}
                    style={{ width: 90 }}
                    value={graceWindowMinutes}
                    onChange={e => setGraceWindowMinutes(e.target.value)}
                  />
                </label>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                  Only if booked under (hours before service)
                  <input
                    className="input"
                    type="number"
                    min={0}
                    style={{ width: 90 }}
                    value={graceLeadHours}
                    onChange={e => setGraceLeadHours(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setCancelPolicyService(null)}>Cancel</button>
              <button className="button primary" onClick={saveCancelPolicy} disabled={cancelPolicyBusy}>
                {cancelPolicyBusy ? "Saving..." : "Save Policy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cake Setup Modal ──────────────────────────────────────────── */}
      {cakeSetupService && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--panel)", padding: 28, borderRadius: 12, width: 640, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>🎂 Cake Setup</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>{cakeSetupService.name} — customization options, ingredients & photo gallery</p>

            {/* Weights / sizes */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={label}>Weights / sizes (leave empty for a single fixed size)</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={cakeWeightsEnabled} onChange={e => setCakeWeightsEnabled(e.target.checked)} />
                  Visible to customer
                </label>
              </div>
              {!cakeWeightsEnabled && (
                <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 8px" }}>
                  Weight selection is hidden — the cake is sold at its base size only.
                </p>
              )}
              {cakeWeights.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <input className="input" placeholder='e.g. "0.5 kg"' value={w.label} onChange={e => setCakeWeights(prev => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>+₹</span>
                  <input className="input" type="number" min={0} placeholder="0" value={w.priceDelta} onChange={e => setCakeWeights(prev => prev.map((x, idx) => idx === i ? { ...x, priceDelta: e.target.value } : x))} style={{ width: 90 }} />
                  <button onClick={() => setCakeWeights(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              <button className="button secondary" style={{ fontSize: 12 }} onClick={() => setCakeWeights(prev => [...prev, { label: "", priceDelta: "0" }])}>+ Add Weight</button>
              <p style={{ fontSize: 11, color: "var(--muted-2)", marginTop: 6 }}>
                First entry is treated as the base size — its price delta should normally be ₹0.
              </p>
            </div>

            {/* Flavours */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={label}>Flavours (price added on top of base price)</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={cakeFlavoursEnabled} onChange={e => setCakeFlavoursEnabled(e.target.checked)} />
                  Visible to customer
                </label>
              </div>
              {!cakeFlavoursEnabled && (
                <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 8px" }}>
                  Flavour selection is hidden — the first flavour below applies to every order. Keep at least one flavour: it marks this service as a cake.
                </p>
              )}
              {cakeFlavours.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <input className="input" placeholder="Flavour name" value={f.name} onChange={e => setCakeFlavours(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>+₹</span>
                  <input className="input" type="number" min={0} placeholder="0" value={f.priceDelta} onChange={e => setCakeFlavours(prev => prev.map((x, idx) => idx === i ? { ...x, priceDelta: e.target.value } : x))} style={{ width: 90 }} />
                  <button onClick={() => setCakeFlavours(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              <button className="button secondary" style={{ fontSize: 12 }} onClick={() => setCakeFlavours(prev => [...prev, { name: "", priceDelta: "0" }])}>+ Add Flavour</button>
            </div>

            {/* Tiers, lead time, name-on-cake, eggless, reference photo */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <span style={label}>Two-Tier Option</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 24, cursor: "pointer" }}>
                  <input type="checkbox" checked={cakeTiersEnabled} onChange={e => setCakeTiersEnabled(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Offer two tier</span>
                </label>
                <input
                  className="input" type="number" min={0} placeholder="Extra ₹"
                  title="Extra charge for a two-tier cake"
                  value={cakeTwoTierDelta} onChange={e => setCakeTwoTierDelta(e.target.value)}
                  disabled={!cakeTiersEnabled}
                  style={{ width: "100%", marginTop: 6, opacity: cakeTiersEnabled ? 1 : 0.5 }}
                />
              </div>
              <div>
                <span style={label}>Min Lead Days</span>
                <input className="input" type="number" min={0} title="Customer must order this many days ahead (1 = no same-day orders)" value={cakeMinLeadDays} onChange={e => setCakeMinLeadDays(e.target.value)} style={{ width: "100%" }} />
              </div>
              <div>
                <span style={label}>Name On Cake</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38, cursor: "pointer" }}>
                  <input type="checkbox" checked={cakeNameEnabled} onChange={e => setCakeNameEnabled(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Allow custom name</span>
                </label>
              </div>
              <div>
                <span style={label}>Eggless</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38, cursor: "pointer" }}>
                  <input type="checkbox" checked={cakeIsEggless} onChange={e => setCakeIsEggless(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>100% egg-free</span>
                </label>
              </div>
              <div>
                <span style={label}>Eggless Option</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 24, cursor: "pointer" }}>
                  <input type="checkbox" checked={cakeEgglessOptionEnabled} onChange={e => setCakeEgglessOptionEnabled(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Let customer choose egg / eggless</span>
                </label>
                <input
                  className="input" type="number" min={0} placeholder="Extra ₹"
                  title="Extra charge when customer picks eggless"
                  value={cakeEgglessPriceDelta} onChange={e => setCakeEgglessPriceDelta(e.target.value)}
                  disabled={!cakeEgglessOptionEnabled}
                  style={{ width: "100%", marginTop: 6, opacity: cakeEgglessOptionEnabled ? 1 : 0.5 }}
                />
              </div>
              <div>
                <span style={label}>Reference Photo</span>
                <label style={{ display: "flex", alignItems: "center", gap: 8, height: 38, cursor: "pointer" }}>
                  <input type="checkbox" checked={cakeRefPhotoEnabled} onChange={e => setCakeRefPhotoEnabled(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Allow customer photo</span>
                </label>
              </div>
            </div>

            {/* Add-ons */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={label}>Add-ons</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={cakeAddonsEnabled} onChange={e => setCakeAddonsEnabled(e.target.checked)} />
                  Visible to customer
                </label>
              </div>
              {!cakeAddonsEnabled && (
                <p style={{ fontSize: 11, color: "#d97706", margin: "4px 0 8px" }}>
                  Add-ons are hidden for this cake — the list below is kept but customers can't pick from it.
                </p>
              )}
              {cakeAddons.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <input className="input" placeholder="Add-on name (e.g. Fresh fruit topping)" value={a.name} onChange={e => setCakeAddons(prev => prev.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} style={{ flex: 1 }} />
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>₹</span>
                  <input className="input" type="number" min={0} placeholder="0" value={a.price} onChange={e => setCakeAddons(prev => prev.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} style={{ width: 90 }} />
                  <button onClick={() => setCakeAddons(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              <button className="button secondary" style={{ fontSize: 12 }} onClick={() => setCakeAddons(prev => [...prev, { name: "", price: "0" }])}>+ Add Add-on</button>
            </div>

            {/* Ingredients */}
            <div style={{ marginBottom: 20 }}>
              <span style={label}>Ingredients (comma or newline separated — shown to customers)</span>
              <textarea
                className="input"
                placeholder="Flour, Eggs, Butter, Sugar, Fresh cream..."
                value={cakeIngredients}
                onChange={e => setCakeIngredients(e.target.value)}
                style={{ width: "100%", height: 64, resize: "vertical" }}
              />
            </div>

            {/* Photo gallery */}
            <div style={{ marginBottom: 24 }}>
              <span style={label}>Photo Gallery ({cakeMedia360.length}/12 — shown in this order; customer taps thumbnails to browse)</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                {cakeMedia360.map((url, i) => (
                  <div key={`${url}-${i}`} style={{ position: "relative" }}>
                    <img src={url} alt={`Photo ${i + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                    <span style={{ position: "absolute", top: 2, left: 4, fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "0 0 3px rgba(0,0,0,0.9)" }}>{i + 1}</span>
                    <button
                      onClick={() => setCakeMedia360(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >✕</button>
                  </div>
                ))}
                {cakeMedia360.length === 0 && <span style={{ fontSize: 12, color: "var(--muted-2)" }}>No photos yet — upload 4–6 clear shots (front, top, side, a close-up of detail work).</span>}
              </div>
              <label className="button secondary upload-button" style={{ fontSize: 12 }}>
                {cakeMedia360Busy ? "Uploading..." : "+ Upload Photos"}
                <input type="file" accept="image/*" multiple onChange={(e) => { handleMedia360Upload(e.target.files); e.target.value = ""; }} />
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setCakeSetupService(null)}>Cancel</button>
              <button className="button primary" onClick={saveCakeSetup} disabled={cakeSetupBusy || cakeMedia360Busy}>
                {cakeSetupBusy ? "Saving..." : "Save Cake Setup"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo Gallery Modal (non-cake services) ───────────────────── */}
      {photosService && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--panel)", padding: 28, borderRadius: 12, width: 560, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto" }}>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>📷 Photo Gallery</h3>
            <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
              {photosService.name} — App photos show only in the mobile app (swipe + zoom); Web photos show only on the website cards. Shown in this order, max 12 each.
            </p>

            {([
              {
                title: "📱 App Photos", hint: "Shown in the mobile app only.",
                list: appPhotosList, setList: setAppPhotosList,
                autoSlide: appPhotosAutoSlide, setAutoSlide: setAppPhotosAutoSlide,
                slideSeconds: appPhotosSlideSeconds, setSlideSeconds: setAppPhotosSlideSeconds,
              },
              {
                title: "🖥️ Web Photos", hint: "Shown on the website only.",
                list: webPhotosList, setList: setWebPhotosList,
                autoSlide: webPhotosAutoSlide, setAutoSlide: setWebPhotosAutoSlide,
                slideSeconds: webPhotosSlideSeconds, setSlideSeconds: setWebPhotosSlideSeconds,
              },
            ] as const).map(({ title, hint, list, setList, autoSlide, setAutoSlide, slideSeconds, setSlideSeconds }) => (
              <div key={title} style={{ marginBottom: 24 }}>
                <span style={label}>{title}</span>
                <p style={{ fontSize: 11, color: "var(--muted-2)", margin: "2px 0 8px" }}>{hint}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {list.map((url, i) => (
                    <div key={`${url}-${i}`} style={{ position: "relative" }}>
                      <img src={url} alt={`Photo ${i + 1}`} style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                      <span style={{ position: "absolute", top: 2, left: 4, fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "0 0 3px rgba(0,0,0,0.9)" }}>{i + 1}</span>
                      <button
                        onClick={() => setList(prev => prev.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: "none", background: "#ef4444", color: "#fff", cursor: "pointer", fontSize: 10, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✕</button>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <span style={{ fontSize: 12, color: "var(--muted-2)" }}>
                      No photos yet — upload a few clear shots (designs, finished work, close-ups).
                    </span>
                  )}
                </div>
                <label className="button secondary upload-button" style={{ fontSize: 12 }}>
                  {photosBusy ? "Uploading..." : "+ Upload Photos"}
                  <input type="file" accept="image/*" multiple onChange={(e) => { handlePhotosUpload(e.target.files, setList); e.target.value = ""; }} />
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 10, padding: "8px 12px", backgroundColor: "var(--panel-alt)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={autoSlide} onChange={e => setAutoSlide(e.target.checked)} />
                    <span style={{ fontSize: 12 }}>Auto-slide</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, opacity: autoSlide ? 1 : 0.5 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>every</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={30}
                      value={slideSeconds}
                      onChange={e => setSlideSeconds(e.target.value)}
                      disabled={!autoSlide}
                      style={{ width: 56 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>sec</span>
                  </label>
                  <span style={{ color: "var(--muted-2)", fontSize: 11 }}>
                    Off = first photo stays, customers browse by tapping.
                  </span>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="button secondary" onClick={() => setPhotosService(null)}>Cancel</button>
              <button className="button primary" onClick={savePhotos} disabled={photosSaving || photosBusy}>
                {photosSaving ? "Saving..." : "Save Photos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Crop modal ────────────────────────────────────────────────── */}
      {cropModalInfo ? (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ backgroundColor: "var(--panel)", padding: 24, borderRadius: 12, maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", width: 620 }}>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Crop Image</h3>
            <p className="muted" style={{ marginBottom: 12 }}>Drag the box to frame exactly what will be visible in the app. Use zoom to fine-tune.</p>

            {/* Zoom controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 14px", backgroundColor: "var(--panel-alt)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, whiteSpace: "nowrap" }}>Zoom</span>
              <button onClick={() => handleZoomChange(cropZoom - 0.1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--panel)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>−</button>
              <input type="range" min={0.5} max={3} step={0.1} value={cropZoom} onChange={(e) => handleZoomChange(Number(e.target.value))} style={{ flex: 1, cursor: "pointer" }} />
              <button onClick={() => handleZoomChange(cropZoom + 0.1)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--panel)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)", minWidth: 42, textAlign: "right" }}>{Math.round(cropZoom * 100)}%</span>
              {cropZoom !== 1 && (
                <button onClick={() => handleZoomChange(1)} style={{ fontSize: 11, color: "#6366f1", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", whiteSpace: "nowrap" }}>Reset</button>
              )}
            </div>

            {/* Crop area */}
            <div style={{ overflow: "auto", maxHeight: "52vh", display: "flex", justifyContent: "center", backgroundColor: "var(--panel-alt)", padding: 20, borderRadius: 8, marginBottom: 20 }}>
              <ReactCrop crop={crop} onChange={(_, percentCrop) => setCrop(percentCrop)} aspect={cropModalInfo.aspect}>
                <img
                  src={cropModalInfo.src}
                  onLoad={(e) => { imgRef.current = e.currentTarget; }}
                  style={{ height: `${Math.round(42 * cropZoom)}vh`, maxWidth: cropZoom > 1 ? "none" : "100%" }}
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
