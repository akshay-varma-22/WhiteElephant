/**
 * Photo registry. Every image dropped into src/assets/photos/ is optimised at build time by
 * vite-imagetools into responsive WebP variants (480/800/1200/1800 px wide) and is looked up here
 * by file name without extension, e.g. 'hero' -> src/assets/photos/hero.webp.
 */
const modules = import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
  // withoutEnlargement: a photo smaller than a requested width is never up-scaled (no blur, no wasted bytes).
  query: { w: '480;800;1200;1800', format: 'webp', quality: '72', withoutEnlargement: 'true', as: 'srcset' },
});

const photos = Object.fromEntries(
  Object.entries(modules).map(([path, srcSet]) => [path.split('/').pop().replace(/\.[^.]+$/, ''), srcSet]),
);

/** @returns {string | undefined} a `srcset` string, or undefined when the photo does not exist */
export const getPhotoSrcSet = (name) => photos[name];

/** Fallback `src` (the middle size) for browsers/crawlers that ignore srcset. */
export function getPhotoSrc(name) {
  const set = photos[name];
  if (!set) return undefined;
  const parts = set.split(',').map((s) => s.trim().split(' ')[0]);
  return parts[Math.min(2, parts.length - 1)];
}
