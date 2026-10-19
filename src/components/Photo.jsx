import markUrl from '../assets/brand/mark.png?w=300&format=webp';
import { getPhotoSrc, getPhotoSrcSet } from '../lib/photos.js';

/**
 * Responsive, lazy-loaded photo from src/assets/photos. Fills its (positioned) parent.
 * If the named photo is missing, a clearly-labelled tile is shown instead of a broken image.
 */
export default function Photo({ name, alt, sizes = '100vw', priority = false, className = '', position, zoom }) {
  const srcSet = getPhotoSrcSet(name);

  if (!srcSet) {
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`absolute inset-0 flex items-center justify-center bg-sand ${className}`}
      >
        <span
          aria-hidden="true"
          className="h-1/2 w-1/2 max-w-[10rem] bg-gold/50"
          style={{
            maskImage: `url(${markUrl})`,
            WebkitMaskImage: `url(${markUrl})`,
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
          }}
        />
        <span className="absolute bottom-3 left-3 text-[0.7rem] uppercase tracking-[0.18em] text-brown">
          Photo coming soon
        </span>
      </div>
    );
  }

  return (
    <img
      src={getPhotoSrc(name)}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      style={{
        ...(position ? { objectPosition: position, transformOrigin: position } : {}),
        ...(zoom ? { '--zoom': zoom } : {}),
      }}
    />
  );
}
