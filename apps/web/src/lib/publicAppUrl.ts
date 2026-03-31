/**
 * Base URL of the web app for share links and QR codes.
 * Set VITE_PUBLIC_APP_URL in production when the app is opened via a different host than the audience (e.g. localhost vs ngrok).
 */
export function getPublicAppOrigin(): string {
  const raw = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const trimmed = raw.trim().replace(/\/$/, '');
    try {
      const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
      return `${u.protocol}//${u.host}`;
    } catch {
      return trimmed;
    }
  }
  const origin = globalThis.window?.location?.origin;
  if (origin) return origin;
  return '';
}

/** Short join path: `/j/CODE` redirects to `/join?code=CODE`. */
export function buildPoolJoinShareUrl(origin: string, poolCode: string): string {
  const base = origin.replace(/\/$/, '');
  const code = poolCode.trim().toUpperCase();
  return `${base}/j/${encodeURIComponent(code)}`;
}
