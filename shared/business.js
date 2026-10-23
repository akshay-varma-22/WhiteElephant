/**
 * Verified business details, exactly as supplied by White Elephant Creative Studio
 * (business card / project brief). Do not add details that have not been confirmed
 * (street address, opening hours, ratings, social profiles, etc.).
 */
export const BUSINESS = {
  name: 'White Elephant Creative Studio',
  tagline: 'Interiors | Architecture | Furniture',
  /** Other ways people name the studio (the page itself says "About White Elephant"); used in the search-engine data only. */
  alternateNames: ['White Elephant Interiors', 'White Elephant'],
  domain: 'www.whiteelephantcreativestudio.in',
  url: 'https://www.whiteelephantcreativestudio.in',
  email: 'whiteelephantcreativestudio@gmail.com',
  phones: [
    { display: '+91 99496 21569', e164: '+919949621569' },
    { display: '+91 76720 20294', e164: '+917672020294' },
  ],
  /** The studio's WhatsApp number (one of the two phone numbers above), given by the owner on 21 Oct 2026. */
  whatsapp: { display: '+91 76720 20294', e164: '+917672020294' },
  address: {
    locality: 'Hyderabad',
    region: 'Telangana',
    postalCode: '500090',
    country: 'IN',
    countryName: 'India',
  },
};

/** The studio's services, used for the search-engine structured data (the cards on the page are in src/data/services.js). */
export const SERVICES_OFFERED = [
  'Residential Interiors',
  'Commercial Interiors',
  'Architecture',
  'False Ceiling',
  'Furniture Design',
  'Renovation and Remodeling',
  'Space Planning',
  'Custom Design Solutions',
];
