import { ArrowRight } from 'lucide-react';
import Photo from './Photo.jsx';
import { useQuote } from './quotation/QuoteDialog.jsx';

/** Short call-to-action banner; its button opens the free-quotation popup. */
export default function CtaBanner() {
  const { openQuote } = useQuote();
  return (
    <section id="get-quote" aria-labelledby="cta-heading" className="cta">
      <div className="cta-card">
        <div className="cta-photo" aria-hidden="true">
          <Photo name="portfolio-bench" alt="" sizes="(min-width: 1024px) 40vw, 45vw" position="62% 35%" zoom={1.3} />
        </div>
        <div className="cta-text">
          <p className="cta-eyebrow">Let’s bring your vision to life</p>
          <h2 id="cta-heading" className="cta-title">
            Get a Free Quotation
          </h2>
          <p className="cta-copy">Tell us about your space and requirements, and we’ll take it from there.</p>
          <button type="button" onClick={openQuote} className="cta-btn">
            Get a Quote <ArrowRight aria-hidden="true" className="h-[1.5em] w-[1.5em]" strokeWidth={1.3} />
          </button>
        </div>
      </div>
    </section>
  );
}
