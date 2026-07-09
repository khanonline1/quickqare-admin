// Encrypts small credential values (the admin access/refresh tokens) at rest in
// localStorage using AES-GCM. The AES key is generated once and kept as a
// NON-EXTRACTABLE CryptoKey in IndexedDB, so the raw key bytes never exist in JS
// and the ciphertext in localStorage cannot be decrypted by copying localStorage
// alone.
//
// Scope of protection: this is defense-in-depth. It stops naive localStorage
// scraping (browser extensions / third-party scripts looking for Bearer-shaped
// tokens), casual inspection, and accidental exposure (screen-share, logs). It
// does NOT stop a targeted XSS that reuses this module's own decrypt path — only
// an httpOnly cookie achieves that.

const DB_NAME = "qq_secure";
const DB_STORE = "keys";
const KEY_ID = "token-key";

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbRead(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbWrite(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Cache the key handle so repeated reads/writes don't re-open IndexedDB.
let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const db = await openKeyDb();
      const existing = await idbRead(db, KEY_ID);
      if (existing) return existing as CryptoKey;
      // Non-extractable: the raw key material can never be read back out.
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
      await idbWrite(db, KEY_ID, key);
      return key;
    })().catch((e) => {
      // Don't memoize a rejected promise — let the next call retry.
      keyPromise = null;
      throw e;
    });
  }
  return keyPromise;
}

const toB64 = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};

const fromB64 = (b64: string) => {
  const s = atob(b64);
  // Back with an explicit ArrayBuffer so the result is Uint8Array<ArrayBuffer>,
  // which the WebCrypto BufferSource types accept (TS 5.7+ typed-array generics).
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

export async function secureSet(name: string, value: string): Promise<void> {
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(value),
    );
    localStorage.setItem(name, `${toB64(iv)}.${toB64(ct)}`);
  } catch {
    // Crypto unavailable/blocked — never fall back to plaintext. The session
    // just won't survive a reload (the admin re-authenticates).
    localStorage.removeItem(name);
  }
}

export async function secureGet(name: string): Promise<string | null> {
  const blob = localStorage.getItem(name);
  if (!blob) return null;
  const dot = blob.indexOf(".");
  try {
    if (dot < 0) throw new Error("not encrypted");
    const key = await getKey();
    const iv = fromB64(blob.slice(0, dot));
    const ct = fromB64(blob.slice(dot + 1));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    // Legacy plaintext, corruption, or a missing key — discard the stale value
    // so it can't be read, and treat the admin as logged out.
    localStorage.removeItem(name);
    return null;
  }
}

export function secureRemove(name: string): void {
  localStorage.removeItem(name);
}
