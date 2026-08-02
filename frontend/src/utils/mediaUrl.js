/**
 * Resolve uploaded asset paths for display.
 * Photos are stored as `/uploads/...` relative to the API origin.
 */
export function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  // VITE_API_URL is typically `https://host/api` — strip trailing /api for static uploads
  const origin = apiBase.replace(/\/api$/i, '');
  if (origin) return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  return path.startsWith('/') ? path : `/${path}`;
}
