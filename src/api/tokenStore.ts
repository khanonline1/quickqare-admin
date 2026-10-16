import type { AdminUser, Tokens } from "../types/admin";
import { secureGet, secureRemove, secureSet } from "./secureStore";

// The signed-in session as kept (encrypted) in localStorage. Every tab of the
// admin panel reads and writes these two keys, which is how the tabs stay on
// the same tokens — see refreshTokens in adminApi.ts and the storage listener
// in App.tsx.
export const TOKENS_KEY = "qq_admin_tokens";
export const ADMIN_KEY = "qq_admin_user";

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await secureGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  if (value) await secureSet(key, JSON.stringify(value));
  else secureRemove(key);
}

export const readStoredTokens = () => readJson<Tokens>(TOKENS_KEY);
export const readStoredAdmin = () => readJson<AdminUser>(ADMIN_KEY);
export const storeTokens = (tokens: Tokens | null) => writeJson(TOKENS_KEY, tokens);
export const storeAdmin = (admin: AdminUser | null) => writeJson(ADMIN_KEY, admin);

// True when this browser can hold one refresh at a time across tabs (the Web
// Locks API). The backend is told at sign-in, and only then treats a replayed
// refresh token as a stolen copy.
export const canCoordinateRefresh = () => typeof navigator !== "undefined" && "locks" in navigator;
