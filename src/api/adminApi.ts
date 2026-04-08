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
  return JSON.parse(text) as ApiResponse<T>;
}

export function createAdminApi(getTokens: () => Tokens | null, setTokens: (tokens: Tokens | null) => void) {
  const request = async <T,>(path: string, options: RequestInit & { retry?: boolean } = {}): Promise<ApiResponse<T>> => {
    const tokens = getTokens();
    const headers: Record<string, string> = {};
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (response.status === 401 && tokens?.refreshToken && !options.retry) {
      const refreshed = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      });

      if (refreshed.ok) {
        const refreshJson = await parseJson<{ accessToken: string; refreshToken: string }>(refreshed);
        if (refreshJson.success) {
          setTokens({ accessToken: refreshJson.data.accessToken, refreshToken: refreshJson.data.refreshToken });
          return request<T>(path, { ...options, retry: true });
        }
      }
    }

    return parseJson<T>(response);
  };

  return {
    get: <T,>(path: string) => request<T>(path, { method: "GET" }),
    post: <T,>(path: string, body?: unknown) =>
      request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    patch: <T,>(path: string, body?: unknown) =>
      request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
    delete: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
    uploadFile: async <T,>(path: string, file: File, fieldName = "image"): Promise<T> => {
      const tokens = getTokens();
      const headers: Record<string, string> = {};
      if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;

      const formData = new FormData();
      formData.append(fieldName, file);

      const response = await fetch(`${BACKEND_BASE}${path}`, {
        method: "POST",
        headers,
        body: formData,
      });

      const text = await response.text();
      if (!text) throw new Error("Empty upload response");
      const json = JSON.parse(text) as T;
      if (!response.ok) {
        throw new Error((json as { message?: string }).message || "Upload failed");
      }
      return json;
    }
  };
}

export type ApiClient = ReturnType<typeof createAdminApi>;
