import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { BUSINESS } from '../config/site.js';
import { useQuote } from './quotation/QuoteDialog.jsx';

/**
 * Sticky call / quotation bar for phones. Appears after the hero and hides while the
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
      className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 border-t border-line bg-ivory shadow-[0_-8px_24px_-12px_rgb(43_36_32/0.35)] transition-transform duration-300 md:hidden ${
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
    >
      <a
        href={`tel:${phone.e164}`}
        tabIndex={visible ? 0 : -1}
        className="flex min-h-[56px] items-center justify-center gap-2 text-[0.76rem] font-medium uppercase tracking-[0.16em] text-copper"
      >
        <Phone aria-hidden="true" className="h-4 w-4" /> Call us
      </a>
      <button
        type="button"
        onClick={openQuote}
        tabIndex={visible ? 0 : -1}
        className="flex min-h-[56px] items-center justify-center bg-copper text-[0.76rem] font-medium uppercase tracking-[0.16em] text-ivory"
      >
        Free Quotation
      </button>
    </div>
  );
}
