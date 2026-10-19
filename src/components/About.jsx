import { ArrowRight } from 'lucide-react';
import Photo from './Photo.jsx';

/** About: the story on the left and a tall arched photo on the right (as in the studio's design). */
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
        <Photo
          name="portfolio-living"
          alt="Bright living room with a timber sideboard, a tall plant and a large window"
          sizes="(min-width: 1024px) 40vw, 30vw"
          position="22% 50%"
        />
      </div>
    </section>
  );
}
