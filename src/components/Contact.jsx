import { Mail, MapPin, Phone } from 'lucide-react';
import { BUSINESS } from '../config/site.js';

function Card({ icon: Icon, title, children }) {
  return (
    <li className="contact-card">
      <Icon aria-hidden="true" className="contact-icon" strokeWidth={1.2} />
      <h3 className="contact-card-title">{title}</h3>
      <div className="contact-card-body">{children}</div>
    </li>
  );
}

export default function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="contact">
      <p className="eyebrow">Contact</p>
      <h2 id="contact-heading" className="contact-title">
        Let’s talk about your space
      </h2>
      <p className="contact-intro">Call, write to us, or send the quotation form and we’ll get back to you.</p>

      <ul className="contact-grid">
        <Card icon={Phone} title="Phone">
          {BUSINESS.phones.map((p) => (
            <p key={p.e164}>
              <a className="contact-link" href={`tel:${p.e164}`}>
                {p.display}
              </a>
            </p>
          ))}
        </Card>
        <Card icon={Mail} title="Email">
          <p>
            <a className="contact-link" href={`mailto:${BUSINESS.email}`}>
              {BUSINESS.email}
            </a>
          </p>
        </Card>
        <Card icon={MapPin} title="Location">
          <p>
            {BUSINESS.address.locality}, {BUSINESS.address.region} {BUSINESS.address.postalCode}, {BUSINESS.address.countryName}
          </p>
        </Card>
      </ul>
    </section>
  );
}
