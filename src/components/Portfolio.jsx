import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { SITE } from '../config/site.js';
import { PORTFOLIO_CATEGORIES, PORTFOLIO_ITEMS } from '../data/portfolio.js';
import Photo from './Photo.jsx';

const FILTERS = ['All', ...PORTFOLIO_CATEGORIES];

function Lightbox({ items, index, onClose, onNavigate }) {
  const ref = useRef(null);
  const item = index == null ? null : items[index];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  return (
    <dialog
      ref={ref}
      aria-label={item ? item.title : 'Portfolio image'}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onNavigate(1);
        if (e.key === 'ArrowLeft') onNavigate(-1);
      }}
      className="m-auto max-h-[92vh] w-[min(1100px,94vw)] border-0 bg-espresso p-0 text-ivory backdrop:bg-espresso/85"
    >
      {item && (
        <div className="on-dark flex max-h-[92vh] flex-col">
          <div className="relative min-h-0 flex-1 bg-espresso">
            <div className="relative mx-auto aspect-[4/3] max-h-[72vh] w-full">
              <Photo name={item.photo} alt={item.alt} sizes="94vw" className="!object-contain" />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close image"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center bg-espresso/80 text-ivory transition hover:bg-bronze"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(-1)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-espresso/80 text-ivory transition hover:bg-bronze"
                >
                  <ChevronLeft aria-hidden="true" className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(1)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-espresso/80 text-ivory transition hover:bg-bronze"
                >
                  <ChevronRight aria-hidden="true" className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          <div className="border-t border-ivory/15 px-6 py-5">
            <p className="eyebrow">{item.category}</p>
            <h3 className="mt-1 font-serif text-2xl !text-ivory">{item.title}</h3>
            <p className="mt-1 text-sm text-ivory/80">
              {item.caption}
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** The three projects shown first when "All" is selected: one large and two smaller. Others appear under "View all projects". */
const FEATURED_IDS = ['living', 'office', 'side-table'];

export default function Portfolio() {
  const [filter, setFilter] = useState('All');
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState(null);
  const lastTrigger = useRef(null);

  const showNotice = SITE.showPortfolioNotice && PORTFOLIO_ITEMS.some((i) => i.sample);
  const pool = filter === 'All' ? PORTFOLIO_ITEMS : PORTFOLIO_ITEMS.filter((i) => i.category === filter);
  const featured = (filter === 'All' ? FEATURED_IDS.map((id) => pool.find((i) => i.id === id)).filter(Boolean) : pool.slice(0, 3));
  const rest = pool.filter((i) => !featured.includes(i));
  const items = showAll ? [...featured, ...rest] : featured;
  const openIndex = openId ? items.findIndex((i) => i.id === openId) : -1;

  const close = () => {
    setOpenId(null);
    lastTrigger.current?.focus();
  };
  const navigate = (step) => {
    if (openIndex < 0) return;
    setOpenId(items[(openIndex + step + items.length) % items.length].id);
  };

  return (
    <section id="projects" aria-labelledby="projects-heading" className="projects">
      <p className="eyebrow">Featured work</p>
      <h2 id="projects-heading" className="projects-title">
        A glimpse of the spaces we design for
      </h2>

      <div role="group" aria-label="Filter projects by category" className="project-filters">
        {FILTERS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            onClick={() => {
              setFilter(name);
              setShowAll(false);
            }}
            className="project-chip"
          >
            {name}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Showing {items.length} {filter === 'All' ? 'projects' : `${filter.toLowerCase()} projects`}.
      </p>

      <ul className="project-grid">
        {items.map((item, index) => (
          <li key={item.id} className={index === 0 ? 'project project-feature' : 'project'}>
            <figure className="project-card">
              <Photo
                name={item.photo}
                alt={item.alt}
                sizes={index === 0 ? '(min-width: 1024px) 60vw, 94vw' : '(min-width: 1024px) 30vw, 47vw'}
              />
              <span aria-hidden="true" className="project-shade" />
              <figcaption className="project-caption">
                <span className="project-cat">{item.category}</span>
                <span className="project-name">{item.title}</span>
              </figcaption>
              {/* Transparent button covering the whole card: keyboard- and screen-reader-operable. */}
              <button
                type="button"
                onClick={(e) => {
                  lastTrigger.current = e.currentTarget;
                  setOpenId(item.id);
                }}
                aria-label={`View larger: ${item.title}`}
                className="project-hit"
              />
            </figure>
          </li>
        ))}
      </ul>

      {rest.length > 0 && (
        <div className="projects-more">
          <button type="button" className="projects-btn" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show fewer projects' : 'View all projects'} <ArrowRight aria-hidden="true" className="h-[1.5em] w-[1.5em]" strokeWidth={1.3} />
          </button>
        </div>
      )}

      {showNotice && (
        <p role="note" className="projects-note">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-medium">Sample images.</strong> These photographs are placeholders that illustrate the kinds of
            spaces we design for; they are not completed White Elephant Creative Studio projects. Our own project photographs will
            appear here.
          </span>
        </p>
      )}

      <Lightbox items={items} index={openIndex >= 0 ? openIndex : null} onClose={close} onNavigate={navigate} />
    </section>
  );
}
