const STEPS = [
  { title: 'Understand', text: 'We listen to your needs and ideas.' },
  { title: 'Design', text: 'We create concepts and space plans.' },
  { title: 'Execute', text: 'Our team brings the design to life.' },
  { title: 'Handover', text: 'A beautifully finished space.' },
];

/** "A simple, transparent journey": the four steps from first conversation to handover. */
export default function Process() {
  return (
    <section id="process" aria-labelledby="process-heading" className="process">
      <p className="eyebrow">Our process</p>
      <h2 id="process-heading" className="process-title">
        A simple, transparent journey
      </h2>
      <ol className="process-steps">
        {STEPS.map(({ title, text }, i) => (
          <li key={title} className="process-step">
            <span aria-hidden="true" className="process-num">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="process-step-title">{title}</h3>
            <p className="process-step-text">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
