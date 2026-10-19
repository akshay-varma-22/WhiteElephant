import { Building, Landmark, Smile, Users } from 'lucide-react';

/**
 * Key figures. These were supplied by the studio owner and have not been checked by anyone else:
 * keep them true and update them here as the numbers change.
 */
const HIGHLIGHTS = [
  { icon: Landmark, value: '15+', lines: ['Years of', 'Experience'] },
  { icon: Building, value: '400+', lines: ['Projects', 'Completed'] },
  { icon: Smile, value: '100+', lines: ['Happy', 'Clients'] },
  { icon: Users, value: '8+', lines: ['Team of', 'Experts'] },
];

export default function Highlights() {
  return (
    <section id="highlights" aria-label="Key highlights" className="highlights">
      <ul className="highlights-grid">
        {HIGHLIGHTS.map(({ icon: Icon, value, lines }) => (
          <li key={value} className="highlight">
            <Icon aria-hidden="true" className="highlight-icon" strokeWidth={1.1} />
            <p className="highlight-value">{value}</p>
            <p className="highlight-label">
              {lines.map((line, i) => (
                <span key={line}>
                  {i > 0 && ' '}
                  <span className="block">{line}</span>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
