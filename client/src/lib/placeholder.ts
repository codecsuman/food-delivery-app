/**
 * Shared image fallback used across the app.
 *
 * The previous code used `https://via.placeholder.com/...`, which is regularly
 * unreachable (DNS/rate limited), so broken images stayed broken. An inline
 * SVG data URI always works offline and never triggers an extra request.
 */
const FALLBACK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f3f4f6" />
  <g fill="#d1d5db">
    <circle cx="200" cy="118" r="34" />
    <path d="M200 152c-38 0-70 26-78 62h156c-8-36-40-62-78-62z" />
  </g>
  <text x="200" y="252" font-family="system-ui, sans-serif" font-size="16" fill="#9ca3af" text-anchor="middle">
    No image available
  </text>
</svg>`;

export const FALLBACK_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  FALLBACK_SVG,
)}`;

/** Resolve an optional image URL to a value that is always renderable. */
export const getImageUrl = (url?: string | null): string =>
  url && url.trim().length > 0 ? url : FALLBACK_IMAGE;

/** Swap a broken image for the inline fallback exactly once (no loops). */
export const handleImageError = (event: {
  currentTarget: HTMLImageElement;
}): void => {
  const image = event.currentTarget;
  if (image.src !== FALLBACK_IMAGE) {
    image.onerror = null;
    image.src = FALLBACK_IMAGE;
  }
};
