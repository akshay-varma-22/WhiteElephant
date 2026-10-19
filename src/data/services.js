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
    photo: 'portfolio-living',
    position: '60% 50%',
    description:
      'Homes, apartments and villas designed around the way you live, from layouts and finishes to lighting, storage and styling.',
  },
  {
    id: 'commercial-interiors',
    title: 'Commercial Interiors',
    lines: ['Commercial', 'Interiors'],
    icon: Building2,
    photo: 'portfolio-office',
    position: '70% 50%',
    description:
      'Offices, retail spaces, restaurants and cafes planned around your brand, your customers and the way your team works.',
  },
  {
    id: 'architecture',
    title: 'Architecture',
    lines: ['Architecture'],
    icon: DraftingCompass,
    photo: 'hero',
    position: '90% 40%',
    zoom: 2.1,
    description: 'Planning and design that shape a building’s form, light and flow.',
  },
  {
    id: 'false-ceiling',
    title: 'False Ceiling',
    lines: ['False', 'Ceiling'],
    icon: LampCeiling,
    photo: 'portfolio-bedroom',
    position: '50% 0%',
    zoom: 1.7,
    description:
      'Ceiling designs with integrated lighting that add depth, tidy away services and set the mood of a room.',
  },
  {
    id: 'furniture-design',
    title: 'Furniture Design',
    lines: ['Furniture', 'Design'],
    icon: Armchair,
    photo: 'portfolio-kitchen',
    position: '30% 50%',
    zoom: 1.15,
    description:
      'Furniture designed to fit your space and your routine, from storage and wardrobes to tables and seating.',
  },
  {
    id: 'renovation-remodeling',
    title: 'Renovation & Remodeling',
    lines: ['Renovation &', 'Remodeling'],
    icon: PencilRuler,
    photo: 'portfolio-renovation-progress',
    position: '50% 55%',
    zoom: 1.2,
    description:
      'Refresh, reconfigure or reimagine an existing property with a plan that respects what you already have.',
  },
];
