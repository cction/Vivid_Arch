import { withRetry } from '@/utils/retry';

const WHATAI_BASE_URL = process.env.WHATAI_BASE_URL || 'https://api.whatai.cc';
const WHATAI_API_KEY = process.env.WHATAI_API_KEY;
const PROXY_VIA_VITE = (process.env.PROXY_VIA_VITE || 'true') === 'true';
const IS_BROWSER = typeof window !== 'undefined';

export function isWhataiEnabled(): boolean {
  try {
    const clientKey = IS_BROWSER ? (localStorage.getItem('WHATAI_API_KEY') || '') : '';
    return Boolean(clientKey || WHATAI_API_KEY || PROXY_VIA_VITE);
  } catch {
    return Boolean(WHATAI_API_KEY || PROXY_VIA_VITE);
  }
}

export async function whataiFetch(path: string, init: RequestInit): Promise<Response> {
  const useDevProxy = IS_BROWSER;
  const proxyUrl = `/proxy-whatai${path}`;
  const directUrl = `${WHATAI_BASE_URL}${path}`;
  const headers = new Headers(init.headers || {});
  const clientKey = IS_BROWSER ? localStorage.getItem('WHATAI_API_KEY') || '' : '';
  if (!headers.has('Authorization')) {
    if (clientKey) headers.set('Authorization', `Bearer ${clientKey}`);
    else if (!useDevProxy && WHATAI_API_KEY) headers.set('Authorization', `Bearer ${WHATAI_API_KEY}`);
  }
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const finalInit: RequestInit = { ...init, headers };
  let resp: Response | null = null;
  let firstError: unknown = null;
  const primaryUrl = useDevProxy ? proxyUrl : directUrl;
  try {
    resp = await withRetry(() => fetch(primaryUrl, finalInit), { retries: 3, baseDelayMs: 800 });
    if (useDevProxy && (!resp.ok && resp.status === 404)) { resp = null; throw new Error('proxy 404'); }
  } catch (err) { firstError = err; }
  if (!resp) {
    if (!IS_BROWSER) {
      try { resp = await withRetry(() => fetch(directUrl, finalInit), { retries: 3, baseDelayMs: 800 }); }
      catch (err2) { const e = firstError || err2; throw e instanceof Error ? e : new Error(String(e)); }
    } else {
      const e = firstError || new Error('proxy fetch failed');
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
  if (!resp.ok) { const text = await resp.text().catch(() => ''); throw new Error(`whatai API Error: ${resp.status} ${resp.statusText} ${text}`); }
  return resp;
}

export interface UserSelfResponse {
  data: {
    id: number;
    username: string;
    display_name: string;
    quota: number;
    used_quota: number;
  };
  success: boolean;
  message?: string;
}

export async function fetchUserSelf(userId?: string, systemToken?: string): Promise<UserSelfResponse> {
  const headers = new Headers();
  if (systemToken) headers.set('Authorization', `Bearer ${systemToken}`);
  headers.set('Pragma', 'no-cache');
  if (userId) headers.set('New-API-User', userId);
  const resp = await whataiFetch('/api/user/self', { method: 'GET', headers });
  return resp.json() as Promise<UserSelfResponse>;
}

export async function fetchTokenQuota(): Promise<{ id: number; name: string; quota: number }> {
  const resp = await whataiFetch('/v1/token/quota', { method: 'GET' });
  return resp.json() as Promise<{ id: number; name: string; quota: number }>;
}
