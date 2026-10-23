import { SERVICES } from '../data/services.js';
import Photo from './Photo.jsx';

/**
 * "Spaces for Every Need": six arched photo cards, each with a round brown icon badge and the service name below.
 * The cards are informational only (they do not link anywhere).
 * (The short description is shown from large screens up; on phones it is kept for screen readers.)
 */
export default function Services() {
  return (
    <section id="services" aria-labelledby="services-heading" className="services">
      <p className="eyebrow services-eyebrow">Our services</p>
      <h2 id="services-heading" className="services-title">
        Spaces for Every Need
      </h2>
      <p className="services-intro">From homes to commercial spaces, we offer end-to-end design solutions tailored to your vision.</p>

      <ul className="arch-grid">
        {SERVICES.map(({ id, lines, icon: Icon, photo, position, zoom, description }) => (
          <li key={id} className="arch">
            <div className="arch-media">
              <div className="arch-photo">
                <Photo
                  name={photo}
                  alt=""
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 28vw, 30vw"
                  position={position}
                  zoom={zoom}
                />
              </div>
              <span aria-hidden="true" className="arch-badge">
                <Icon strokeWidth={1.3} />
              </span>
            </div>
            <div className="arch-label">
              <h3 className="arch-title">
                {lines.map((line, i) => (
                  <span key={line}>
                    {i > 0 && ' '}
                    <span className="block">{line}</span>
                  </span>
                ))}
              </h3>
              <p className="arch-desc sr-only lg:not-sr-only">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
