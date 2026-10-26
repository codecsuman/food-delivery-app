/**
 * Pincode lookup shared by the address forms.
 *
 * The backend exposes `GET /api/v1/map/pincode/:pincode`, which proxies and
 * caches the free pincode API. Older backend deployments (and a frontend
 * deployed ahead of its backend) do not have that route yet. A missing route
 * used to show up as a 404 in the browser console on every valid pincode.
 *
 * This helper probes `/health` once. Newer backend builds expose `version` and
 * `checks`; when those are absent it calls the same public API directly, which
 * serves the identical data and allows browser CORS. The result is cached for
 * an hour, matching the server-side cache. No credentials or API keys are
 * involved.
 */

import { API_BASE_URL } from "@/lib/api";

const PINCODE_API_BASE = "https://api.pincodeapi.in/api/v1";
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface PincodeOffice {
  office_name?: string;
  office_type?: string;
  delivery_status?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

export interface PincodeLookupResult {
  success: boolean;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  postOffices?: PincodeOffice[];
}

interface RawPostOffice {
  office_name?: string;
  office_type?: string;
  delivery_status?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

const cache = new Map<string, { data: PincodeLookupResult; expiry: number }>();
let backendSupportsPincodeRoute: Promise<boolean> | null = null;

const healthUrl = (): string | null => {
  if (!API_BASE_URL) return null;

  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin);
    return new URL("/health", apiUrl.origin).toString();
  } catch {
    return null;
  }
};

const detectBackendSupport = (): Promise<boolean> => {
  if (!backendSupportsPincodeRoute) {
    backendSupportsPincodeRoute = (async () => {
      const url = healthUrl();
      if (!url) return false;

      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) return false;

        const data = await res.json();
        // 7a2708f added the pincode route and the richer health payload in the
        // same release, so this is a reliable capability signal.
        return Boolean(data?.version && data?.checks);
      } catch {
        return false;
      }
    })();
  }

  return backendSupportsPincodeRoute;
};

const fetchJson = async (url: string): Promise<unknown> => {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

const fromBackend = async (pincode: string): Promise<PincodeLookupResult | null> => {
  if (!API_BASE_URL) return null;

  const data = (await fetchJson(
    `${API_BASE_URL.replace(/\/$/, "")}/map/pincode/${encodeURIComponent(pincode)}`,
  )) as PincodeLookupResult | null;

  return data?.success ? data : null;
};

const fromPublicApi = async (pincode: string): Promise<PincodeLookupResult | null> => {
  const body = (await fetchJson(
    `${PINCODE_API_BASE}/pincode/${encodeURIComponent(pincode)}`,
  )) as { success?: boolean; data?: { post_offices?: RawPostOffice[] } } | null;

  const offices = body?.data?.post_offices;
  if (!body?.success || !Array.isArray(offices) || offices.length === 0) return null;

  const first = offices[0];
  return {
    success: true,
    pincode,
    city: first.district || "",
    district: first.district || "",
    state: first.state || "",
    country: "India",
    postOffices: offices.map((office) => ({
      office_name: office.office_name,
      office_type: office.office_type,
      delivery_status: office.delivery_status,
      district: office.district,
      state: office.state,
      latitude: office.latitude,
      longitude: office.longitude,
    })),
  };
};

/**
 * Look up a six-digit pincode. Returns `null` for malformed/unknown pincodes
 * or when both lookup paths are unavailable; callers treat this as optional
 * auto-fill data and leave the manual fields editable.
 */
export const lookupPincode = async (pincode: string): Promise<PincodeLookupResult | null> => {
  if (!/^\d{6}$/.test(pincode)) return null;

  const cached = cache.get(pincode);
  if (cached && cached.expiry > Date.now()) return cached.data;

  const supportsBackend = await detectBackendSupport();
  let result = supportsBackend ? await fromBackend(pincode) : null;

  // The server route may be temporarily unavailable even when `/health` says
  // the build is new. Falling back keeps auto-fill working without surfacing
  // an error in the form.
  if (!result) result = await fromPublicApi(pincode);

  if (result?.success) {
    cache.set(pincode, { data: result, expiry: Date.now() + CACHE_TTL_MS });
  }

  return result;
};
