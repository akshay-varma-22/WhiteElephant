import { ArrowRight } from 'lucide-react';
import Photo from './Photo.jsx';

/** About: the story on the left and a tall arched photo on the right (as in the studio's design); phones and wider screens get their own picture. */
export default function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="about">
      <div className="about-text">
        <p className="eyebrow">About White Elephant</p>
        <h2 id="about-heading" className="about-title">
          Interiors, architecture and furniture, designed as one idea.
        </h2>
        <p className="about-copy">
          We are a design studio based in Hyderabad, creating homes, workplaces and commercial spaces that are thoughtful,
          functional and timeless. From concept to completion, we bring interiors, architecture and furniture together to shape
          spaces around the way you live, work and feel.
        </p>
        <a href="#services" className="about-btn">
          Learn more <ArrowRight aria-hidden="true" className="h-[1.5em] w-[1.5em]" strokeWidth={1.3} />
        </a>
      </div>
      <div className="about-photo">
        {/* Two pictures of the same room, supplied by the owner: the tall one for phones (the narrow arch), the wide one from 640 px up (where the layout changes). */}
        <Photo
          name="about-mobile"
          alt="Sunlit living room with a light timber sideboard, a tall potted plant, linen curtains and a large window"
          sizes="30vw"
          wide={{ name: 'about-desktop', media: '(min-width: 640px)', sizes: '(min-width: 1024px) 24rem, 38vw' }}
          className="about-img"
        />
      </div>
    </section>
  );
}
