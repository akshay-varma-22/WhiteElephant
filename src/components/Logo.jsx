import logoFull from '../assets/brand/logo.png?format=webp&w=630';
import logoCompact from '../assets/brand/logo-compact.png?format=webp&w=630';
import logoCompactLight from '../assets/brand/logo-compact-light.png?format=webp&w=630';

/**
 * The studio logo, cropped unaltered from the supplied business card (see scripts/make-brand-assets.mjs).
 * `compact` leaves out the small "Interiors | Architecture | Furniture" line (the hero shows that line in larger type).
 * `light` is a single-colour cream version of the compact logo for the dark brown footer.
 */
export default function Logo({ compact = false, light = false, className = '', ...rest }) {
  const src = light ? logoCompactLight : compact ? logoCompact : logoFull;
  return (
    <img
      src={src}
      alt="White Elephant Creative Studio — Interiors, Architecture, Furniture"
      width="630"
      height={compact || light ? 288 : 340}
      className={className}
      {...rest}
    />
  );
}
