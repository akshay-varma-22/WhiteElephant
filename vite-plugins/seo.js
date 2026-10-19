/**
 * SEO helpers, built only from verified business details (shared/business.js):
 *  - injects schema.org LocalBusiness JSON-LD into index.html (no ratings, reviews, hours or street address)
 *  - emits sitemap.xml and robots.txt at build time
 */
import { BUSINESS, SERVICES_OFFERED } from '../shared/business.js';

export function buildJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${BUSINESS.url}/#business`,
    name: BUSINESS.name,
    url: `${BUSINESS.url}/`,
    description:
      'Interior design, architecture and furniture design studio in Hyderabad, Telangana, India.',
    slogan: 'Thoughtful Spaces for Every Story.',
    logo: `${BUSINESS.url}/icon-512.png`,
    image: `${BUSINESS.url}/og-image.jpg`,
    email: BUSINESS.email,
    telephone: BUSINESS.phones[0].e164,
    contactPoint: BUSINESS.phones.map((p) => ({
      '@type': 'ContactPoint',
      telephone: p.e164,
      email: BUSINESS.email,
      contactType: 'customer service',
      areaServed: 'IN',
      availableLanguage: ['en'],
    })),
    address: {
      '@type': 'PostalAddress',
      addressLocality: BUSINESS.address.locality,
      addressRegion: BUSINESS.address.region,
      postalCode: BUSINESS.address.postalCode,
      addressCountry: BUSINESS.address.country,
    },
    makesOffer: SERVICES_OFFERED.map((name) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name },
    })),
  };
}

export function seo() {
  return {
    name: 'we-seo',
    transformIndexHtml(html, ctx) {
      if (!html.includes('<!--JSON_LD-->')) return html;
      const json = JSON.stringify(buildJsonLd(), null, 2).replace(/</g, '\\u003c');
      return html.replace('<!--JSON_LD-->', `<script type="application/ld+json">\n${json}\n    </script>`);
    },
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = [
        { loc: `${BUSINESS.url}/`, priority: '1.0' },
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
          .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`)
          .join('\n')}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${BUSINESS.url}/sitemap.xml\n`,
      });
    },
  };
}
