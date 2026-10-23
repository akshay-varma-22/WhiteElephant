import { Armchair, Building2, DraftingCompass, LampCeiling, PencilRuler, Sofa } from 'lucide-react';

/**
 * Services shown as arched cards ("Spaces for Every Need"), in the order listed. The cards are for information only
 * (they do not link anywhere); visitors choose what they need in the quotation form, whose options live in
 * shared/quotation-options.js.
 * `lines` is how the name breaks over two lines on the card.
 * `photo` is a file name (without extension) in src/assets/photos; `position` / `zoom` choose which part of it shows.
 * Keep claims factual (see docs/OWNER_GUIDE.md).
 */
export const SERVICES = [
  {
    id: 'residential-interiors',
    title: 'Residential Interiors',
    lines: ['Residential', 'Interiors'],
    icon: Sofa,
    // Supplied by the owner (Residential Interiors.jpeg); the picture is taller than the card, so this keeps the sofa and table in view.
    photo: 'service-residential',
    position: '50% 58%',
    description:
      'Homes, apartments and villas designed around the way you live, from layouts and finishes to lighting, storage and styling.',
  },
  {
    id: 'commercial-interiors',
    title: 'Commercial Interiors',
    lines: ['Commercial', 'Interiors'],
    icon: Building2,
    // Supplied by the owner (Commercial Interiors.jpeg, 21 Oct 2026): a meeting room with a TV wall, pendant lights and rust-coloured chairs. The picture
    // is square, so the card shows its middle: the TV wall, pendants and table, not the far left glass wall or the right-hand frames.
    photo: 'service-commercial',
    position: '55% 50%',
    description:
      'Offices, retail spaces, restaurants and cafes planned around your brand, your customers and the way your team works.',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    lines: ['Architecture'],
    icon: DraftingCompass,
    // Supplied by the owner (Architecture.jpeg): an architectural model on floor plans. Its top is empty dark space, so the picture is
    // lined up from the bottom.
    photo: 'service-architecture',
    position: '50% 100%',
    description: 'Planning and design that shape a building’s form, light and flow.',
  },
  {
    id: 'false-ceiling',
    title: 'False Ceiling',
    lines: ['False', 'Ceiling'],
    icon: LampCeiling,
    // Supplied by the owner (replaced again 21 Oct 2026 by "False Ceiling.jpeg", 902 x 1600): a bedroom with a recessed tray ceiling, spotlights, grey panelled
    // walls and a blue bed. The picture is much taller than the card (the arch shows about 74% of its height), so it is lined up from the top: the whole ceiling
    // stays in view, with the wall pictures, headboard and the top of the bed below it; the lower part of the bed and the rug are trimmed.
    photo: 'service-false-ceiling',
    position: '50% 0%',
    description:
      'Ceiling designs with integrated lighting that add depth, tidy away services and set the mood of a room.',
  },
  {
    id: 'furniture-design',
    title: 'Furniture Design',
    lines: ['Furniture', 'Design'],
    icon: Armchair,
    // Supplied by the owner (Furniture.jpeg, replaced 21 Oct 2026): a sculpted feature wall with a curved sofa, a green armchair and a round
    // table. The picture is taller than the card, so this keeps the wall art, sofa and armchair in view and trims the very top and bottom.
    photo: 'service-furniture',
    position: '50% 60%',
    description: 'Customised and personalised furnishing.',
  },
  {
    id: 'renovation-remodeling',
    title: 'Renovation & Remodeling',
    lines: ['Renovation &', 'Remodeling'],
    icon: PencilRuler,
    // Supplied by the owner (Renovation and remodeling .jpeg, 21 Oct 2026): a kitchen shown before, during and after its renovation, in three stacked
    // panels. The picture is a little taller than the card, so its middle is shown and only a thin strip at the top and bottom is trimmed.
    photo: 'service-renovation',
    position: '50% 50%',
    description:
      'Refresh, reconfigure or reimagine an existing property with a plan that respects what you already have.',
  },
];
