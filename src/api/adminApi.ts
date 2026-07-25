import type { ApiResponse, Tokens } from "../types/admin";

const API_BASE =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_ADMIN_API_BASE_URL ||
  "http://localhost:4000/api/v1/admin";
const BACKEND_BASE = API_BASE.replace(/\/api\/v1\/admin\/?$/, "");

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  const text = await res.text();
  if (!text) {
    return { success: false, data: null as T, error: { code: "EMPTY", message: "Empty response" }, meta: {} };
  }
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    // Non-JSON response — proxy error or backend unreachable
    const hint = res.status === 502 || res.status === 503 || res.status === 504
      ? `Backend unreachable (${res.status}). Check that port 4000 is open on the server.`
      : `Unexpected response from server (HTTP ${res.status}).`;
    return { success: false, data: null as T, error: { code: "PROXY_ERROR", message: hint }, meta: {} };
  }
}

// Single-flight refresh, shared across all api client instances.
//
// The backend ROTATES the refresh token on every /auth/refresh — the old one is
// invalidated the moment a new pair is issued. A dashboard burst that straddles
// the 15-minute access-token expiry produces several 401s at once; if each of
// them called /auth/refresh independently, only the first would win — the rest
// would present the already-rotated token, get REFRESH_MISMATCH, and wipe the
// session (the intermittent "Unauthorized" logout). Instead, the first 401
// starts ONE refresh and every concurrent 401 awaits the same promise, then
// retries with the tokens it produced.
let sharedRefresh: Promise<Tokens | null> | null = null;

function refreshTokens(
  getTokens: () => Tokens | null,
  setTokens: (tokens: Tokens | null) => void
): Promise<Tokens | null> {
  if (!sharedRefresh) {
    sharedRefresh = (async (): Promise<Tokens | null> => {
      const current = getTokens();
      if (!current?.refreshToken) return null;

      let response: Response;
      try {
        response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
      } catch {
        // Network hiccup — keep the session so a later request can retry;
        // only a server-side rejection means the session is actually dead.
        return null;
      }

      if (response.ok) {
        const refreshJson = await parseJson<{ accessToken: string; refreshToken: string }>(response);
        if (refreshJson.success && refreshJson.data?.accessToken) {
          const next: Tokens = {
            accessToken: refreshJson.data.accessToken,
            refreshToken: refreshJson.data.refreshToken,
          };
          setTokens(next);
          return next;
        }
      }

      // The server genuinely rejected the refresh token (expired or revoked
      // session, or a changed secret). Clear tokens so the app drops back to
      // the login screen instead of getting stuck on "Unauthorized admin".
      setTokens(null);
      return null;
    })().finally(() => {
      sharedRefresh = null;
    });
  }
  return sharedRefresh;
}

export function createAdminApi(getTokens: () => Tokens | null, setTokens: (tokens: Tokens | null) => void) {
  const request = async <T,>(
    path: string,
    options: RequestInit & { retry?: boolean; accessToken?: string } = {}
  ): Promise<ApiResponse<T>> => {
    // accessToken override: after a refresh, getTokens() still reads the React
    // state snapshot captured before setTokens re-rendered, so the retry must
    // carry the fresh token explicitly rather than re-reading stale state.
    const { retry, accessToken, ...init } = options;
    const access = accessToken ?? getTokens()?.accessToken;
    const headers: Record<string, string> = {};
    if (!(init.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (access) headers.Authorization = `Bearer ${access}`;

    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } catch {
      return {
        success: false,
        data: null as T,
        error: { code: "NETWORK_ERROR", message: "Cannot connect to backend. Make sure the backend is running on port 4000." },
        meta: {},
      };
    }

    if (response.status === 401 && !retry && getTokens()?.refreshToken) {
      const next = await refreshTokens(getTokens, setTokens);
      if (next?.accessToken) {
        return request<T>(path, { ...options, retry: true, accessToken: next.accessToken });
      }
    }

    return parseJson<T>(response);
  };

  // Multipart upload. Kept separate from request() because it must NOT set a
  // JSON Content-Type, but it mirrors request()'s 401 -> refresh -> retry so an
  // expired admin token re-auths instead of failing opaquely (the upload route
  // is now admin-authenticated). Named so it can retry itself after refresh.
  const uploadFile = async <T,>(path: string, file: File, fieldName = "image", retry = false, accessTokenOverride?: string): Promise<T> => {
    const access = accessTokenOverride ?? getTokens()?.accessToken;
    const headers: Record<string, string> = {};
    if (access) headers.Authorization = `Bearer ${access}`;

    const formData = new FormData();
    formData.append(fieldName, file);

    let response: Response;
    try {
      response = await fetch(`${BACKEND_BASE}${path}`, { method: "POST", headers, body: formData });
    } catch {
      throw new Error("Cannot connect to backend. Check your connection and that the server is running.");
    }

    if (response.status === 401 && !retry && getTokens()?.refreshToken) {
      const next = await refreshTokens(getTokens, setTokens);
      if (next?.accessToken) {
        return uploadFile<T>(path, file, fieldName, true, next.accessToken);
      }
    }

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // Non-JSON body (proxy 413/502/504, HTML error page) — surface the real
        // cause instead of a raw "Unexpected token <" SyntaxError.
        throw new Error(
          response.status === 413
            ? "Image too large (max 5MB)."
            : response.status >= 502
              ? `Backend unreachable (HTTP ${response.status}).`
              : `Unexpected server response (HTTP ${response.status}).`,
        );
      }
    }
    if (!response.ok) {
      const msg = (json as { message?: string; error?: { message?: string } } | null);
      throw new Error(msg?.message || msg?.error?.message || `Upload failed (HTTP ${response.status}).`);
    }
    if (!json) throw new Error("Empty upload response");
    return json as T;
  };

  // Multi-file variant of uploadFile — used for cake photo galleries. Same
  // 401 -> refresh -> retry behaviour; field name matches upload.array("images").
  const uploadFiles = async <T,>(path: string, files: File[], fieldName = "images", retry = false, accessTokenOverride?: string): Promise<T> => {
    const access = accessTokenOverride ?? getTokens()?.accessToken;
    const headers: Record<string, string> = {};
    if (access) headers.Authorization = `Bearer ${access}`;

    const formData = new FormData();
    for (const file of files) formData.append(fieldName, file);

    let response: Response;
    try {
      response = await fetch(`${BACKEND_BASE}${path}`, { method: "POST", headers, body: formData });
    } catch {
      throw new Error("Cannot connect to backend. Check your connection and that the server is running.");
    }

    if (response.status === 401 && !retry && getTokens()?.refreshToken) {
      const next = await refreshTokens(getTokens, setTokens);
      if (next?.accessToken) {
        return uploadFiles<T>(path, files, fieldName, true, next.accessToken);
      }
    }

    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          response.status === 413
            ? "Images too large (max 5MB each)."
            : response.status >= 502
              ? `Backend unreachable (HTTP ${response.status}).`
              : `Unexpected server response (HTTP ${response.status}).`,
        );
      }
    }
    if (!response.ok) {
      const msg = (json as { message?: string; error?: { message?: string } } | null);
      throw new Error(msg?.message || msg?.error?.message || `Upload failed (HTTP ${response.status}).`);
    }
    if (!json) throw new Error("Empty upload response");
    return json as T;
  };

  return {
    get: <T,>(path: string) => request<T>(path, { method: "GET" }),
    post: <T,>(path: string, body?: unknown) =>
      request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    patch: <T,>(path: string, body?: unknown) =>
      request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    put: <T,>(path: string, body?: unknown) =>
      request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
    delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
    uploadFile,
    uploadFiles,

    // Complaints APIs
    getComplaints: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : "";
      return request(`/complaints${query}`);
    },
    getComplaint: (id: string) => request(`/complaints/${id}`),
    updateComplaintStatus: (id: string, data: { status: string; notes?: string }) =>
      request(`/complaints/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
    resolveComplaint: (id: string, data: { resolution: string; refundAmount?: number; reServiceScheduled?: boolean }) =>
      request(`/complaints/${id}/resolution`, { method: "PATCH", body: JSON.stringify(data) }),
  };
}

export type ApiClient = ReturnType<typeof createAdminApi>;
