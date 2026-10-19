/**
 * Portfolio gallery content.
 *
 * IMPORTANT: every entry below currently uses a SAMPLE placeholder image (see
 * src/assets/photos/CREDITS.md) and a generic title. None of them is a completed
 * White Elephant Creative Studio project (a note above the gallery says so; see SITE.showPortfolioNotice).
 *
 * To replace one with a real project: drop the photo into src/assets/photos/, point
 * `photo` at its file name (without extension), edit `title` / `caption`, and set
 * `sample: false`. Full steps are in docs/OWNER_GUIDE.md.
 */
export const PORTFOLIO_CATEGORIES = ['Residential', 'Commercial', 'Furniture', 'Renovation'];

export const PORTFOLIO_ITEMS = [
  {
    id: 'living',
    category: 'Residential',
    title: 'Living room concept',
    caption: 'Warm timber tones, soft light and relaxed seating.',
    photo: 'portfolio-living',
    aspect: 'aspect-[4/3]',
    alt: 'Sunlit living room with a grey sofa, pale armchair, wooden sideboard and tall window',
    sample: true,
  },
  {
    id: 'restaurant',
    category: 'Commercial',
    title: 'Restaurant seating concept',
    caption: 'Upholstered banquette seating with a calm, intimate mood.',
    photo: 'portfolio-restaurant',
    aspect: 'aspect-[3/4]',
    alt: 'Restaurant corner with a blue upholstered banquette, round tables and a wall light',
    sample: true,
  },
  {
    id: 'side-table',
    category: 'Furniture',
    title: 'Timber side table',
    caption: 'A compact piece combining a tabletop and open shelf.',
    photo: 'portfolio-side-table',
    aspect: 'aspect-[4/3]',
    alt: 'Wooden side table with an integrated book shelf and a tray of cups on top',
    sample: true,
  },
  {
    id: 'kitchen',
    category: 'Residential',
    title: 'Timber kitchen concept',
    caption: 'Warm wood cabinetry paired with dark worktops.',
    photo: 'portfolio-kitchen',
    aspect: 'aspect-[4/3]',
    alt: 'Modern kitchen with wooden cabinets, a dark island worktop and a steel extractor hood',
    sample: true,
  },
  {
    id: 'renovation-progress',
    category: 'Renovation',
    title: 'Renovation in progress',
    caption: 'Opening up a room: structural support and clearance.',
    photo: 'portfolio-renovation-progress',
    aspect: 'aspect-[4/3]',
    alt: 'Room undergoing renovation with steel support props, exposed floor and building debris',
    sample: true,
  },
  {
    id: 'office',
    category: 'Commercial',
    title: 'Workspace concept',
    caption: 'Open meeting space with generous natural light.',
    photo: 'portfolio-office',
    aspect: 'aspect-[4/3]',
    alt: 'Spacious glass-walled office with a long wooden meeting table and pink chairs',
    sample: true,
  },
  {
    id: 'bench',
    category: 'Furniture',
    title: 'Sculpted timber bench',
    caption: 'A curved slatted bench with an integrated planter.',
    photo: 'portfolio-bench',
    aspect: 'aspect-[3/2]',
    alt: 'Curved bench made of slatted timber ribs with a green plant growing from its centre',
    sample: true,
  },
  {
    id: 'bedroom',
    category: 'Residential',
    title: 'Bedroom with cove lighting',
    caption: 'Layered ceiling light and a restful neutral palette.',
    photo: 'portfolio-bedroom',
    aspect: 'aspect-[6/5]',
    alt: 'Bedroom visual with a cove-lit ceiling, upholstered bed and soft striped blinds',
    sample: true,
  },
  {
    id: 'retail',
    category: 'Commercial',
    title: 'Boutique retail concept',
    caption: 'Fluted timber backdrop and a warm display counter.',
    photo: 'portfolio-retail',
    aspect: 'aspect-square',
    alt: 'Boutique with a fluted wooden wall, hanging clothing and a display counter',
    sample: true,
  },
  {
    id: 'chest',
    category: 'Furniture',
    title: 'Carved timber chest',
    caption: 'Rich grain and traditional hardware detail.',
    photo: 'portfolio-chest',
    aspect: 'aspect-[3/2]',
    alt: 'Close view of a dark wooden chest of drawers with carved trim and iron handles',
    sample: true,
  },
  {
    id: 'renovation-refresh',
    category: 'Renovation',
    title: 'Refreshed open-plan living space',
    caption: 'A bright, reconfigured living and dining area.',
    photo: 'portfolio-renovation-refresh',
    aspect: 'aspect-[4/3]',
    alt: 'Bright open-plan living room with a tan leather sofa, grey armchair and teal accent wall',
    sample: true,
  },
];
