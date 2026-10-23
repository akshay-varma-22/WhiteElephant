import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { BUSINESS } from '../config/site.js';
import { useQuote } from './quotation/QuoteDialog.jsx';
import WhatsAppLink from './WhatsAppLink.jsx';

/**
 * Sticky call / WhatsApp / quotation bar for phones. Appears after the hero and hides while the
 * quote banner, the contact section or the footer is on screen (where it would only get in the way; the footer
 * therefore needs no spare room at its end for the bar).
 */
export default function MobileCtaBar() {
  const [visible, setVisible] = useState(false);
  const { openQuote } = useQuote();

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const hero = document.getElementById('home');
    const hide = ['get-quote', 'contact', 'site-footer'].map((id) => document.getElementById(id)).filter(Boolean);
    const state = { heroVisible: true, hideCount: 0 };
    const update = () => setVisible(!state.heroVisible && state.hideCount === 0);
    const heroObs = new IntersectionObserver(([e]) => {
      state.heroVisible = e.isIntersecting;
      update();
    }, { threshold: 0.2 });
    const open = new Set();
    const hideObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? open.add(e.target.id) : open.delete(e.target.id)));
      state.hideCount = open.size;
      update();
    }, { threshold: 0.1 });
    if (hero) heroObs.observe(hero);
    hide.forEach((el) => hideObs.observe(el));
    return () => {
      heroObs.disconnect();
      hideObs.disconnect();
    };
  }, []);

  const phone = BUSINESS.phones[0];
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-[auto_3.75rem_minmax(0,1fr)] border-t border-line bg-ivory shadow-[0_-8px_24px_-12px_rgb(43_36_32/0.35)] transition-transform duration-300 md:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <a
        href={`tel:${phone.e164}`}
        tabIndex={visible ? 0 : -1}
        className="flex min-h-[56px] items-center justify-center gap-2 pl-[1.125rem] pr-4 text-[0.76rem] font-medium uppercase tracking-[0.16em] text-copper max-[359px]:tracking-[0.1em]"
      >
        <Phone aria-hidden="true" className="h-4 w-4" /> Call us
      </a>
      {/* The same frameless brown WhatsApp logo as in the header and the popup, with a fine divider line on its left (.cta-bar-wa in index.css).
          The room right of "Call us" (1rem padding + the letter-spacing after its last letter) equals the room left of the logo
          ((3.75rem - 1.5rem) / 2 = 1.125rem), so the line sits midway between them. */}
      <WhatsAppLink
        tabIndex={visible ? 0 : -1}
        className="cta-bar-wa flex min-h-[56px] items-center justify-center text-copper [&>svg]:h-6 [&>svg]:w-6"
      />
      <button
        type="button"
        onClick={openQuote}
        tabIndex={visible ? 0 : -1}
        className="flex min-h-[56px] items-center justify-center bg-copper text-[0.76rem] font-medium uppercase tracking-[0.16em] text-ivory max-[359px]:tracking-[0.1em]"
      >
        Free Quotation
      </button>
    </div>
  );
}
