import { useEffect, useRef, useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { NAV_LINKS } from '../config/site.js';
import { useActiveSection } from '../hooks/useActiveSection.js';
import Logo from './Logo.jsx';
import { useQuote } from './quotation/QuoteDialog.jsx';

/**
 * @param {{ homeHref?: string, spy?: boolean }} props
 * homeHref: '' on the home page, '/' on other pages so section links point back to the home page.
 */
export default function Navbar({ homeHref = '', spy = true }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const { openQuote } = useQuote();
  // Observe every page section (not just nav targets) so no nav item stays lit while a non-nav section is on screen.
  const active = useActiveSection(spy ? [...NAV_LINKS.map((l) => l.id), 'video', 'highlights', 'why-us', 'testimonials', 'get-quote', 'process'] : []);
  const href = (hash) => `${homeHref}${hash}`;

  /** The "Get a Quote" button: opens the popup here; on other pages (homeHref set) it goes to the home page, which opens it. */
  const quoteButton = (className, children, onClick) =>
    homeHref ? (
      <a href={href('#quotation')} onClick={onClick} className={className}>
        {children}
      </a>
    ) : (
      <button
        type="button"
        onClick={() => {
          onClick?.();
          openQuote();
        }}
        className={className}
      >
        {children}
      </button>
    );

  // Close the mobile menu with Escape (and return focus to its button), and when the viewport widens.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    mq.addEventListener?.('change', onChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      mq.removeEventListener?.('change', onChange);
    };
  }, [open]);

  return (
    <header className="site-header">
      <a
        href="#main"
        className="sr-only z-[60] bg-espresso px-4 py-3 text-ivory focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <div className="site-header-inner">
        <a href={href('#home')} className="shrink-0" aria-label="White Elephant Creative Studio — home">
          <Logo compact className="site-logo" />
        </a>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {NAV_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={href(link.href)}
                  aria-current={spy && active === link.id ? 'true' : undefined}
                  className={`relative py-2 text-[0.8rem] font-medium uppercase tracking-[0.2em] transition-colors hover:text-copper after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:bg-copper after:transition-transform after:duration-300 ${
                    spy && active === link.id ? 'text-copper after:scale-x-100' : 'text-ink-soft after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          {quoteButton(
            'header-cta',
            <>
              Get a Quote <ArrowRight aria-hidden="true" className="h-[1.5em] w-[1.5em]" strokeWidth={1.3} />
            </>,
          )}
          <button
            ref={buttonRef}
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center text-ink transition hover:text-copper lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <X aria-hidden="true" className="h-7 w-7" strokeWidth={1.3} />
            ) : (
              <svg aria-hidden="true" viewBox="0 0 44 36" className="header-menu-icon" focusable="false">
                <path d="M0 6h44M0 18h44M0 30h44" fill="none" stroke="currentColor" strokeWidth="2.4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav
        id="mobile-menu"
        ref={menuRef}
        aria-label="Mobile"
        hidden={!open}
        className="border-t border-copper/15 bg-header lg:hidden"
      >
        <ul className="container-page divide-y divide-copper/15 py-2">
          {NAV_LINKS.map((link) => (
            <li key={link.id}>
              <a
                href={href(link.href)}
                onClick={() => setOpen(false)}
                aria-current={spy && active === link.id ? 'true' : undefined}
                className={`flex min-h-[52px] items-center text-[0.9rem] font-medium uppercase tracking-[0.2em] ${
                  spy && active === link.id ? 'text-copper' : 'text-ink-soft'
                }`}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li className="py-4">
            {quoteButton(
              'btn btn-primary w-full',
              <>
                Get a Quote <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>,
              () => setOpen(false),
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}
