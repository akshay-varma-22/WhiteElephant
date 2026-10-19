import { BUSINESS } from '../../shared/business.js';

export { BUSINESS };

export const NAV_LINKS = [
  { id: 'home', label: 'Home', href: '#home' },
  { id: 'about', label: 'About', href: '#about' },
  { id: 'services', label: 'Services', href: '#services' },
  { id: 'projects', label: 'Projects', href: '#projects' },
  { id: 'contact', label: 'Contact', href: '#contact' },
];

export const SITE = {
  /**
   * Optional "Sample image" labels on the big hero/about photos. Off by default.
   * Set to true if you want visitors to see that a photo is a placeholder.
   */
  samplePhotos: { hero: false, about: false },
  /**
   * One-line note above the portfolio gallery saying the photos are placeholders (it shows only while at
   * least one portfolio entry still has `sample: true` in src/data/portfolio.js). Set to false to hide it.
   * Recommended to leave it on until the gallery holds the studio's own project photographs, so visitors are
   * not led to believe stock photos are completed projects.
   */
  showPortfolioNotice: true,
  /** Optional Cloudflare Turnstile site key (public). Leave unset to run without a CAPTCHA widget. */
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
};
