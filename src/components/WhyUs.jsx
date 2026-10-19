import { ClipboardCheck, Layers, LayoutGrid, Palette } from 'lucide-react';

const REASONS = [
  {
    icon: Palette,
    title: 'Personalised design',
    text: 'We design around your space, your habits and your taste.',
  },
  {
    icon: LayoutGrid,
    title: 'Thoughtful space planning',
    text: 'Layouts that work for daily life, with storage, circulation and light.',
  },
  {
    icon: Layers,
    title: 'Considered material selection',
    text: 'Finishes, textures and fittings chosen to suit your style, budget and usage.',
  },
  {
    icon: ClipboardCheck,
    title: 'Coordinated execution',
    text: 'One team handling design decisions and on-site work for a smooth experience.',
  },
];

export default function WhyUs() {
  return (
    <section id="why-us" aria-labelledby="why-heading" className="why">
      <p className="eyebrow">Why choose us</p>
      <h2 id="why-heading" className="why-title">
        A considered approach,
        <br />
        from first sketch to finished space
      </h2>

      <ul className="why-grid">
        {REASONS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="why-card">
            <Icon aria-hidden="true" className="why-icon" strokeWidth={1.2} />
            <h3 className="why-card-title">{title}</h3>
            <p className="why-card-text">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
