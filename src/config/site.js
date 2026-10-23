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
   * The "Sample images." note at the end of the Featured work section, saying the photos are placeholders (it shows
   * only while this is true AND at least one portfolio entry still has `sample: true` in src/data/portfolio.js).
   * Switched OFF on 21 Oct 2026 at the owner's request. Set it back to true to show the note again; it is worth doing
   * while the gallery still holds stock photographs rather than the studio's own, so visitors are not led to believe
   * they are completed projects.
   */
  showPortfolioNotice: false,
  /**
   * The message that is already typed in the WhatsApp box when a visitor taps a WhatsApp button (header, quotation popup and the phone bar),
   * ready for them to send. The number it goes to is BUSINESS.whatsapp in shared/business.js.
   * \n is a line break, so \n\n is a blank line. Wording supplied by the owner on 22 Oct 2026.
   */
  whatsappMessage:
    'Hello White Elephant Creative Studio,\n\n' +
    'I’m interested in your interior design services and would appreciate it if you could share more details about your offerings.\n\n' +
    'I look forward to hearing from you.\n\n' +
    'Thank you!',
  /** The line under the "Get a Free Quotation" button on the home picture, next to the map pin. Owner's wording, 22 Oct 2026 (it used to be "Hyderabad, Telangana"). */
  heroLocation: 'INDIA',
  /** Optional Cloudflare Turnstile site key (public). Leave unset to run without a CAPTCHA widget. */
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
};
