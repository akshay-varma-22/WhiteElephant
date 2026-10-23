import { ArrowRight } from 'lucide-react';
import { SITE } from '../config/site.js';
import Photo from './Photo.jsx';
import { useQuote } from './quotation/QuoteDialog.jsx';

/**
 * Home hero, built to the studio's mobile design: the sunlit photo fills the hero and the text sits directly on
 * its cream wall (no overlay). Layout and sizes live in src/index.css (`.hero-*`).
 */
export default function Hero() {
  const { openQuote } = useQuote();
  return (
    <section id="home" className="hero">
      <div className="hero-photo">
        <Photo
          name="hero"
          alt="Sunlit living room with a curved cream sofa, a round walnut coffee table, an olive tree and a softly lit arched shelf niche"
          sizes="100vw"
          priority
        />
      </div>

      <div className="hero-copy animate-fade-up">
        <p className="hero-eyebrow">
          <span>
            Interiors <i aria-hidden="true">|</i>
          </span>{' '}
          <span>
            Architecture <i aria-hidden="true">|</i>
          </span>{' '}
          <span>Furniture</span>
        </p>

        <h1 className="hero-title">
          Thoughtful <br className="sm:hidden" />
          Spaces <br className="hidden sm:block" />
          for <br className="sm:hidden" />
          <em>Every Story.</em>
        </h1>

        <button type="button" onClick={openQuote} className="hero-cta">
          Get a Free Quotation <ArrowRight aria-hidden="true" className="h-[1.55em] w-[1.55em]" strokeWidth={1.3} />
        </button>

        <p className="hero-location">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="hero-pin" focusable="false">
            <path
              fill="currentColor"
              d="M12 1.5c-4.1 0-7.4 3.2-7.4 7.3 0 5.3 7.4 13.7 7.4 13.7s7.4-8.4 7.4-13.7c0-4.1-3.3-7.3-7.4-7.3Z"
            />
            <circle cx="12" cy="8.8" r="2.7" fill="#efe2d1" />
          </svg>
          <span className="hero-location-text">{SITE.heroLocation}</span>
        </p>
      </div>
    </section>
  );
}
