import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { TESTIMONIALS } from '../data/testimonials.js';
import Photo from './Photo.jsx';

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

/**
 * "What our clients say". Shows only real testimonials listed in src/data/testimonials.js (see the notes there);
 * the whole section is hidden while that list is empty. `items` is a prop only so the tests can pass their own.
 */
export default function Testimonials({ items = TESTIMONIALS }) {
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const current = items[index % items.length];
  const many = items.length > 1;
  const go = (step) => setIndex((i) => (i + step + items.length) % items.length);

  return (
    <section id="testimonials" aria-labelledby="testimonials-heading" className="testimonials">
      <p className="eyebrow">What our clients say</p>
      <h2 id="testimonials-heading" className="testimonials-title">
        Spaces that feel right.
      </h2>

      <div className="testimonial-wrap" role="group" aria-roledescription="carousel" aria-label="Client testimonials">
        {many && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial" className="testimonial-arrow">
            <ChevronLeft aria-hidden="true" strokeWidth={1.4} />
          </button>
        )}
        <figure className="testimonial-card" aria-live="polite">
          <span aria-hidden="true" className="testimonial-mark">
            “
          </span>
          <blockquote className="testimonial-quote">{current.quote}</blockquote>
          <figcaption className="testimonial-person">
            <span className="testimonial-avatar">
              {current.photo ? <Photo name={current.photo} alt="" sizes="96px" /> : <span aria-hidden="true">{initials(current.name)}</span>}
            </span>
            <span>
              <span className="testimonial-name">{current.name}</span>
              <span className="testimonial-role">{current.role}</span>
            </span>
          </figcaption>
        </figure>
        {many && (
          <button type="button" onClick={() => go(1)} aria-label="Next testimonial" className="testimonial-arrow testimonial-arrow-next">
            <ChevronRight aria-hidden="true" strokeWidth={1.4} />
          </button>
        )}
      </div>

      {many && (
        <div className="testimonial-dots" role="group" aria-label="Choose a testimonial">
          {items.map((t, i) => (
            <button
              key={t.name + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show testimonial ${i + 1} of ${items.length}`}
              aria-current={i === index % items.length ? 'true' : undefined}
              className="testimonial-dot"
            />
          ))}
        </div>
      )}
    </section>
  );
}
