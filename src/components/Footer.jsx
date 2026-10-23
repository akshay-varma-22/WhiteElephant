import { BUSINESS } from '../config/site.js';
import Logo from './Logo.jsx';

/**
 * A deliberately small footer, as the owner asked: just the logo with the copyright line to the right of it, the two
 * together in the middle. (`site-footer` is how the sticky call bar on phones knows to step aside while it is on screen.)
 */
export default function Footer() {
  const year = new Date().getFullYear();
  // The studio name is split in the middle only so the narrowest phones (under 360 px) can show three short, even lines.
  const words = BUSINESS.name.split(' ');
  const firstHalf = words.slice(0, Math.ceil(words.length / 2)).join(' ');
  const secondHalf = words.slice(Math.ceil(words.length / 2)).join(' ');
  return (
    <footer id="site-footer" className="site-footer">
      <div className="footer-inner">
        <a href="#home" aria-label="White Elephant Creative Studio — home" className="footer-logo-link">
          <Logo light className="footer-logo" />
        </a>
        {/* The year is written when the site is built and again in the visitor's browser; they differ only across New Year, which is harmless. */}
        <p className="footer-copy" suppressHydrationWarning>
          © {year} {firstHalf}
          <br className="hidden max-[359px]:inline" /> {secondHalf}.<br className="sm:hidden" /> All rights reserved.
        </p>
      </div>
    </footer>
  );
}
