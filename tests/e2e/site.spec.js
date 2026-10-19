import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { fillBasics, form, mock, openQuote, openSite, quoteDialog, submit, waitForEmails } from './helpers.js';

const WIDTHS = [
  { name: 'phone-small', width: 360, height: 740 },
  { name: 'phone', width: 412, height: 915 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'large-desktop', width: 1920, height: 1080 },
];

/** Measures the footer: where the logo and the copyright lines are, and how much room is left on each side of the pair. */
const measureFooter = (page) =>
  page.evaluate(() => {
    const footer = document.querySelector('footer');
    const box = footer.getBoundingClientRect();
    const logo = footer.querySelector('img').getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(footer.querySelector('.footer-copy'));
    const lines = [...range.getClientRects()].filter((r) => r.width > 0);
    const textLeft = Math.min(...lines.map((l) => l.left));
    const textRight = Math.max(...lines.map((l) => l.right));
    const textTop = Math.min(...lines.map((l) => l.top));
    const textBottom = Math.max(...lines.map((l) => l.bottom));
    return {
      footerHeight: box.height,
      leftSpace: logo.left - box.left,
      rightSpace: box.right - textRight,
      gap: textLeft - logo.right,
      lineCount: new Set(lines.map((l) => Math.round(l.top))).size,
      logoMiddle: (logo.top + logo.bottom) / 2,
      textMiddle: (textTop + textBottom) / 2,
      endGap: document.documentElement.scrollHeight - (box.bottom + scrollY),
      sideways: document.documentElement.scrollWidth - innerWidth,
    };
  });

/** True once the sticky call bar on phones has slid out of sight below the screen. */
const callBarIsAway = (page) => page.evaluate(() => document.querySelector('.fixed.inset-x-0.bottom-0').getBoundingClientRect().top >= innerHeight - 1);

test.describe('responsive layout', () => {
  for (const vp of WIDTHS) {
    test(`no horizontal overflow and all sections render at ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openSite(page);
      // Scroll through the page so lazy images load, then measure.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
      });
      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth - window.innerWidth,
        body: document.body.scrollWidth - window.innerWidth,
      }));
      expect(overflow.doc).toBeLessThanOrEqual(0);
      expect(overflow.body).toBeLessThanOrEqual(0);
      // Nothing visible may poke out past the right edge, even if a parent clips it (overflow-hidden).
      const clipped = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out = [];
        for (const el of document.querySelectorAll('main *, header *, footer *')) {
          if (el.closest('[aria-hidden="true"]') || el.closest('dialog')) continue;
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || style.display === 'none' || style.position === 'fixed') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.matches('img, picture, svg, path') ) continue; // decorative/cropped imagery may bleed by design
          if (el.closest('.sr-only')) continue;
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (hasText && r.right > vw + 1) out.push(`${el.tagName.toLowerCase()}: "${el.textContent.trim().slice(0, 40)}" right=${Math.round(r.right)} > ${vw}`);
        }
        return out;
      });
      expect(clipped).toEqual([]);
      for (const id of ['home', 'video', 'about', 'highlights', 'services', 'projects', 'why-us', 'get-quote', 'process', 'contact']) {
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      }
      await expect(page.getByRole('banner').getByRole('button', { name: 'Get a Quote', exact: true })).toBeVisible();
      await page.screenshot({ path: `test-results/layout-${vp.name}.png`, fullPage: false });
    });
  }
});

test.describe('navigation', () => {
  test('desktop nav links smooth-scroll to their sections and the active item updates', async ({ page }) => {
    await openSite(page);
    const nav = page.getByRole('navigation', { name: 'Primary' });
    for (const [name, id] of [['About', 'about'], ['Services', 'services'], ['Projects', 'projects'], ['Contact', 'contact']]) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 0.15 });
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'true');
    }
    // The header's "Get a Quote" button opens the quotation popup (the form is no longer a section of the page).
    await openQuote(page);
  });

  test('the hero shows the headline and the location, and its button works', async ({ page }) => {
    await openSite(page);
    const hero = page.locator('#home');
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Thoughtful Spaces for Every Story.');
    await expect(hero.locator('.hero-eyebrow')).toHaveText(/Interiors\s*\|\s*Architecture\s*\|\s*Furniture/);
    // The hero has no description paragraph (the owner removed it): only the eyebrow and the location are text besides the headline.
    await expect(hero.locator('p')).toHaveCount(2);
    await expect(hero).not.toContainText('From the first idea to the finishing touches');
    // The icon row and the experience line are no longer in the hero (the figures moved to the key highlights).
    await expect(hero.getByRole('list')).toHaveCount(0);
    await expect(hero).not.toContainText('Years of Experience');
    await expect(hero).toContainText('Hyderabad, Telangana');
    // The background photo really loaded.
    await expect.poll(() => hero.locator('img').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    await hero.getByRole('button', { name: 'Get a Free Quotation' }).click();
    await expect(quoteDialog(page)).toBeVisible();
  });

  test('the page follows the studio design order; testimonials stay hidden until real ones exist', async ({ page }) => {
    await openSite(page);
    const ids = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((el) => el.id));
    expect(ids).toEqual(['home', 'video', 'about', 'highlights', 'services', 'projects', 'why-us', 'get-quote', 'process', 'contact']);
    const tops = await page.evaluate((list) => list.map((id) => document.getElementById(id).getBoundingClientRect().top + scrollY), ids);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    await expect(page.locator('#testimonials')).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Primary' }).getByRole('link');
    await expect(nav).toHaveText(['Home', 'About', 'Services', 'Projects', 'Contact']);
  });

  test('the video intro is the studio clip, silent, on a loop, with no play or pause button', async ({ page }) => {
    await openSite(page);
    const intro = page.locator('#video');
    await intro.scrollIntoViewIfNeeded();
    const video = intro.locator('video');
    await expect(video).toHaveAttribute('src', '/videos/interior-loop.mp4');
    await expect(video).toHaveAttribute('poster', /interior-loop-poster\.webp$/);
    expect((await page.request.get('/videos/interior-loop.mp4')).status()).toBe(200);
    expect((await page.request.get('/videos/interior-loop-poster.webp')).status()).toBe(200);
    // The old clip is gone from the build.
    expect((await page.request.get('/videos/about-studio.mp4')).headers()['content-type'] ?? '').not.toMatch(/video/);

    // No buttons, no browser controls, no overlay text or duration: just the picture.
    expect(await video.evaluate((v) => ({ loop: v.loop, muted: v.muted, controls: v.controls }))).toEqual({ loop: true, muted: true, controls: false });
    await expect(intro.getByRole('button')).toHaveCount(0);
    await expect(intro.locator('.video-play, .video-length, .video-caption')).toHaveCount(0);
    await expect(video).toHaveAccessibleName(/showreel/i);

    // It starts by itself and keeps moving.
    await expect.poll(() => video.evaluate((v) => !v.paused && v.currentTime > 0.4), { timeout: 15000 }).toBe(true);

    // The picture fills the card exactly: the card has the clip's own shape (so nothing is cropped and no card background shows),
    // and the clip's edges are not black (its original dark frame was cropped off).
    const fit = await video.evaluate((v) => {
      const r = v.getBoundingClientRect();
      return { cardRatio: r.width / r.height, clipRatio: v.videoWidth / v.videoHeight, width: v.videoWidth, height: v.videoHeight };
    });
    expect(fit.cardRatio).toBeCloseTo(fit.clipRatio, 2);
    expect(fit).toMatchObject({ width: 1028, height: 544 });
    // (Look at a fixed moment, the first scene, so the measurement does not depend on how far the clip has played.)
    await video.evaluate(async (v) => {
      v.pause();
      v.currentTime = 0.5;
      await new Promise((resolve) => v.addEventListener('seeked', resolve, { once: true }));
    });
    const poster = await sharp(await video.screenshot()).raw().toBuffer({ resolveWithObject: true });
    await video.evaluate((v) => v.play());
    const { data: px, info: pi } = poster;
    const edgeLum = [];
    for (let i = 0; i < 2; i++) {
      // the outermost 4 px of the card, on the left, right and top, away from the rounded corners
      for (let y = Math.round(pi.height * 0.2); y < pi.height * 0.8; y += 3) {
        for (const x of i === 0 ? [6, 7, 8] : [pi.width - 9, pi.width - 8, pi.width - 7]) {
          const o = (y * pi.width + x) * pi.channels;
          edgeLum.push(0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]);
        }
      }
    }
    const mean = edgeLum.reduce((s, v) => s + v, 0) / edgeLum.length;
    expect(mean, 'average brightness of the video along its left and right edges').toBeGreaterThan(30);

    // It really loops: from just before the end it carries on from the start instead of stopping.
    await video.evaluate((v) => {
      v.currentTime = v.duration - 0.5;
    });
    await expect.poll(() => video.evaluate((v) => !v.paused && !v.ended && v.currentTime < 4), { timeout: 10000 }).toBe(true);
    // No overlay appears when it wraps round either.
    await expect(intro.getByRole('button')).toHaveCount(0);

    // It rests while it is off screen (and carries on when it comes back).
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => video.evaluate((v) => v.paused)).toBe(true);
    await intro.scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((v) => !v.paused)).toBe(true);
  });

  test('visitors who ask for reduced motion see the first frame instead of a moving clip', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSite(page);
    const intro = page.locator('#video');
    await intro.scrollIntoViewIfNeeded();
    const video = intro.locator('video');
    await page.waitForTimeout(1500);
    expect(await video.evaluate((v) => ({ paused: v.paused, time: v.currentTime }))).toEqual({ paused: true, time: 0 });
    await expect(intro.getByRole('button')).toHaveCount(0);
    expect(await video.evaluate((v) => v.poster)).toMatch(/interior-loop-poster\.webp$/);
  });

  test('About has the story, a Learn more link and an arched photo on the right', async ({ page }) => {
    await openSite(page);
    const about = page.locator('#about');
    await expect(about.getByRole('heading', { level: 2 })).toHaveText('Interiors, architecture and furniture, designed as one idea.');
    await expect(about).toContainText('We are a design studio based in Hyderabad');
    await expect(about.getByRole('link', { name: /Learn more/ })).toHaveAttribute('href', '#services');
    const sides = await page.evaluate(() => {
      const t = document.querySelector('#about .about-text').getBoundingClientRect();
      const ph = document.querySelector('#about .about-photo').getBoundingClientRect();
      return { textLeft: t.left, photoLeft: ph.left, photoRight: ph.right, vw: innerWidth };
    });
    expect(sides.photoLeft).toBeGreaterThan(sides.textLeft);
    await expect(about.locator('video')).toHaveCount(0);
  });

  test('key highlights show the four figures', async ({ page }) => {
    await openSite(page);
    const items = page.locator('#highlights li');
    await expect(items).toHaveCount(4);
    await expect(items.locator('.highlight-value')).toHaveText(['15+', '400+', '100+', '8+']);
    await expect(items.locator('.highlight-label')).toHaveText(['Years of Experience', 'Projects Completed', 'Happy Clients', 'Team of Experts']);
  });

  test('services are six information-only arched cards: nothing on them is clickable', async ({ page }) => {
    await openSite(page);
    await expect(page.locator('#services').getByRole('heading', { level: 2 })).toHaveText('Spaces for Every Need');
    const cards = page.locator('#services ul.arch-grid > li');
    await expect(cards).toHaveCount(6);
    await expect(cards.getByRole('heading', { level: 3 })).toHaveText([
      'Residential Interiors',
      'Commercial Interiors',
      'Architecture',
      'False Ceiling',
      'Furniture Design',
      'Renovation & Remodeling',
    ]);
    await expect(page.locator('#services').getByRole('button')).toHaveCount(0);
    await expect(page.locator('#services').getByRole('link')).toHaveCount(0);
    // Clicking a card must not move the page.
    await cards.first().scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await cards.first().click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });

  test('featured projects: three cards first, filters, View all projects, and the lightbox', async ({ page }) => {
    await openSite(page);
    await page.locator('#projects').scrollIntoViewIfNeeded();
    const tiles = page.locator('#projects ul.project-grid > li');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.first()).toHaveClass(/project-feature/);
    // The cards are just the picture with its title: no arrow (or any other icon) in the corner of any image.
    const cardIcons = page.locator('#projects .project-card svg, #projects .project-arrow');
    await expect(cardIcons).toHaveCount(0);
    // View all / show fewer
    const more = page.getByRole('button', { name: /View all projects/i });
    await more.click();
    await expect(tiles).toHaveCount(11);
    await expect(cardIcons).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Show fewer projects/i })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: /Show fewer projects/i }).click();
    await expect(tiles).toHaveCount(3);
    // Filters
    await page.getByRole('button', { name: 'Furniture', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Furniture', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tiles).toHaveCount(3);
    await expect(page.getByRole('button', { name: /View all projects/i })).toHaveCount(0);
    await page.getByRole('button', { name: 'Renovation', exact: true }).click();
    await expect(tiles).toHaveCount(2);
    await page.getByRole('button', { name: 'Furniture', exact: true }).click();
    // Lightbox
    await tiles.first().getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Furniture/i);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(tiles).toHaveCount(3);
  });

  test('why choose us has four cards; the quote banner opens the quotation popup; the process has four steps', async ({ page }) => {
    await openSite(page);
    await expect(page.locator('#why-us li')).toHaveCount(4);
    await expect(page.locator('#why-us h3')).toHaveText(['Personalised design', 'Thoughtful space planning', 'Considered material selection', 'Coordinated execution']);
    await expect(page.locator('#process li h3')).toHaveText(['Understand', 'Design', 'Execute', 'Handover']);
    const banner = page.locator('#get-quote');
    await expect(banner.getByRole('heading', { level: 2 })).toHaveText('Get a Free Quotation');
    await banner.getByRole('button', { name: /Get a Quote/ }).click();
    await expect(quoteDialog(page)).toBeVisible();
    // The banner is followed directly by the process section: there is no quotation form section between them.
    await expect(page.locator('#quotation')).toHaveCount(0);
  });

  test('the footer is small: just the logo and, beside it, the copyright line, together in the middle', async ({ page }) => {
    await openSite(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.getByRole('contentinfo');
    // Exactly what the owner asked for ...
    await expect(footer).toHaveText(`© ${new Date().getFullYear()} White Elephant Creative Studio. All rights reserved.`);
    await expect(footer.getByRole('link')).toHaveCount(1); // the logo, which goes to the top of the page
    await expect(footer.getByRole('link', { name: /White Elephant Creative Studio — home/ })).toHaveAttribute('href', '#home');
    await expect(footer.locator('img')).toHaveCount(1);
    // ... and nothing else: no tagline, no quick links or menu, no headings, no up button, no outside links.
    await expect(footer).not.toContainText('Interiors, architecture and furniture');
    await expect(footer).not.toContainText('Quick Links');
    await expect(footer.getByRole('navigation')).toHaveCount(0);
    await expect(footer.getByRole('heading')).toHaveCount(0);
    await expect(footer.getByRole('link', { name: 'Back to top' })).toHaveCount(0);
    await expect(footer.locator('a[href^="http"]')).toHaveCount(0);

    // The logo is on the left, the line on its right, both in the middle of the strip, level with each other.
    const m = await measureFooter(page);
    expect(m.gap, 'room between the logo and the text').toBeGreaterThan(8);
    expect(m.gap).toBeLessThan(80);
    expect(Math.abs(m.leftSpace - m.rightSpace), `space left of the logo (${m.leftSpace}) against right of the text (${m.rightSpace})`).toBeLessThanOrEqual(6);
    expect(Math.abs(m.logoMiddle - m.textMiddle)).toBeLessThanOrEqual(6);
    expect(m.lineCount).toBe(1);
    expect(m.footerHeight).toBeLessThan(160);
    expect(m.endGap).toBeLessThanOrEqual(1);
  });

  for (const width of [320, 360, 390, 412, 700, 1024, 1920]) {
    test(`the small footer stays centred, level and gap-free at ${width}px wide${width < 768 ? ', and the call bar steps aside over it' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openSite(page);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const m = await measureFooter(page);
      expect(Math.abs(m.leftSpace - m.rightSpace), `space left of the logo (${m.leftSpace}) against right of the text (${m.rightSpace})`).toBeLessThanOrEqual(6);
      expect(m.gap, 'the logo and the text sit together, not at opposite edges').toBeGreaterThan(8);
      expect(m.gap).toBeLessThan(80);
      expect(Math.abs(m.logoMiddle - m.textMiddle)).toBeLessThanOrEqual(6);
      // Two short lines on a phone (three on the very narrowest), one line from tablet size up.
      expect(m.lineCount).toBe(width < 360 ? 3 : width < 640 ? 2 : 1);
      expect(m.footerHeight).toBeLessThan(width < 640 ? 110 : 160);
      expect(m.endGap, 'nothing below the footer').toBeLessThanOrEqual(1);
      expect(m.sideways).toBeLessThanOrEqual(0);
      if (width < 768) await expect.poll(() => callBarIsAway(page)).toBe(true);
    });
  }

  test('there is no privacy policy page or link; the form has a short, non-blocking note and no consent tick', async ({ page }) => {
    await openSite(page);
    await expect(page.getByRole('link', { name: /privacy/i })).toHaveCount(0);
    await openQuote(page);
    await expect(form(page)).toContainText('only use your details to contact you about your enquiry');
    await expect(form(page).getByRole('checkbox')).toHaveCount(0);
    // The old policy page is gone from the build.
    const res = await page.request.get('/privacy/');
    expect(await res.text()).not.toContain('Privacy Policy |');
  });

  test('contact details are real, clickable tel: and mailto: links', async ({ page }) => {
    await openSite(page);
    const contact = page.locator('#contact');
    await expect(contact.getByRole('link', { name: '+91 99496 21569' })).toHaveAttribute('href', 'tel:+919949621569');
    await expect(contact.getByRole('link', { name: '+91 76720 20294' })).toHaveAttribute('href', 'tel:+917672020294');
    await expect(contact.getByRole('link', { name: 'whiteelephantcreativestudio@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:whiteelephantcreativestudio@gmail.com',
    );
    await expect(contact).toContainText('Hyderabad, Telangana 500090, India');
    await expect(contact.getByRole('heading', { level: 3 })).toHaveText(['Phone', 'Email', 'Location']);
  });
});

/*
 * The owner found the earlier home page "too dark". These tests measure the REAL rendered pixels (text hidden, so we see
 * only what sits behind it) and fail if the hero ever becomes dark again or any of its text becomes hard to read.
 */
const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const parseRgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

test.describe('home page is bright, and its text is readable at every size', () => {
  for (const [name, w, h] of [
    ['small phone', 360, 740],
    ['phone', 390, 844],
    ['tablet', 820, 1180],
    ['small laptop', 1024, 768],
    ['laptop', 1366, 768],
    ['large desktop', 1920, 1080],
  ]) {
    test(`${name} (${w}px)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openSite(page);
      await expect.poll(() => page.locator('#home img').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
      await page.addStyleTag({ content: '*{animation:none!important;transition:none!important}' });
      await page.waitForTimeout(200);

      const info = await page.evaluate(() => {
        const hero = document.querySelector('#home');
        const hb = hero.getBoundingClientRect();
        const lines = [];
        const add = (label, el, large) => {
          if (!el) return;
          const r = document.createRange();
          r.selectNodeContents(el);
          for (const b of r.getClientRects()) {
            lines.push({ label, large, x: b.x, y: b.y, width: b.width, height: b.height, color: getComputedStyle(el).color });
          }
        };
        add('eyebrow', hero.querySelector('.hero-eyebrow'), false);
        add('headline', hero.querySelector('h1'), true);
        add('headline accent', hero.querySelector('h1 em'), true);
        add('location', hero.querySelector('.hero-location-text'), false); // the pin beside it is a decorative icon (needs 3:1, not text contrast)
        const pb = hero.querySelector('.hero-cta');
        const cs = getComputedStyle(pb);
        return { lines, top: Math.max(0, hb.top), bottom: Math.min(innerHeight, hb.bottom), primary: { fg: cs.color, bg: cs.backgroundColor } };
      });

      // Look at the pixels with all hero text hidden.
      await page.addStyleTag({
        content:
          '#home h1, #home h1 *, #home p, #home p *{color:transparent!important}' +
          '#home .hero-pin, #home .hero-cta{visibility:hidden!important}',
      });
      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
      const { data, info: img } = await sharp(shot).raw().toBuffer({ resolveWithObject: true });
      const lumsIn = (x, y, width, height) => {
        const out = [];
        for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(img.height, Math.ceil(y + height)); yy += 2) {
          for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(img.width, Math.ceil(x + width)); xx += 2) {
            const i = (yy * img.width + xx) * img.channels;
            out.push(luminance(data[i], data[i + 1], data[i + 2]));
          }
        }
        return out.sort((p, q) => p - q);
      };

      // 1) The hero as a whole is bright. The first, dark version measured about 0.18. The current design writes the text straight onto
      //    the owner's sunlit photo (no overlay), whose wood slats, sofa and table are dark, so it measures 0.42-0.46 at these sizes;
      //    0.38 keeps a wide margin above the dark version while allowing for that photo.
      const heroLums = lumsIn(0, info.top, w, info.bottom - info.top);
      const mean = heroLums.reduce((s, v) => s + v, 0) / heroLums.length;
      expect(mean, `average hero brightness at ${w}px`).toBeGreaterThan(0.38);

      // 2) Every line of text has real contrast against the pixels behind it (worst-case pixel, WCAG AA with headroom).
      const weak = [];
      for (const line of info.lines) {
        const L = lumsIn(line.x, line.y, line.width, line.height);
        if (!L.length) continue;
        const textL = luminance(...parseRgb(line.color));
        const worstBg = textL < 0.4 ? L[Math.floor(L.length * 0.03)] : L[Math.min(L.length - 1, Math.floor(L.length * 0.97))];
        const ratio = contrast(textL, worstBg);
        const need = (line.large ? 3 : 4.5) * 1.15;
        if (ratio < need) weak.push(`${line.label}: ${ratio.toFixed(1)}:1 (needs ${need.toFixed(1)})`);
      }
      expect(weak, 'hero text with weak contrast').toEqual([]);

      // 3) The primary button's label is readable on the button colour.
      expect(contrast(luminance(...parseRgb(info.primary.fg)), luminance(...parseRgb(info.primary.bg)))).toBeGreaterThan(7);
    });
  }

  test('the darker areas stay readable (warm brown, not black) with cream text on them', async ({ page }) => {
    await openSite(page);
    const dark = await page.evaluate(() => {
      const css = (el) => getComputedStyle(el).backgroundColor;
      return {
        footer: css(document.querySelector('footer')),
        headerButton: css(document.querySelector('.header-cta')),
        heroButton: css(document.querySelector('.hero-cta')),
        serviceBadge: css(document.querySelector('.arch-badge')),
        processCircle: css(document.querySelector('.process-num')),
      };
    });
    for (const [name, bg] of Object.entries(dark)) {
      const L = luminance(...parseRgb(bg));
      expect(L, `${name} background ${bg} should be a brown, not black`).toBeGreaterThan(0.02);
      expect(contrast(luminance(243, 227, 204), L), `cream text on ${name}`).toBeGreaterThan(4.5);
    }
  });
});

test.describe('quality checks', () => {
  test('no console errors, no failed requests, and every image loads', async ({ page }) => {
    const problems = [];
    page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    // A browser cancels a video's partial (range) downloads when the clip pauses or is scrolled away; that is normal and not a failure.
    // (That the video really plays and loops is checked by the video intro test.)
    page.on('requestfailed', (r) => {
      const cancelledVideo = r.resourceType() === 'media' && /ERR_ABORTED/.test(r.failure()?.errorText ?? '');
      if (!cancelledVideo) problems.push(`requestfailed: ${r.url()}`);
    });
    page.on('response', (r) => r.status() >= 400 && problems.push(`http ${r.status()}: ${r.url()}`));
    await openSite(page);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 80));
      }
    });
    // Bring every (lazy) image into view and wait for it, so the check is deterministic.
    await page.evaluate(async () => {
      for (const img of document.images) {
        img.scrollIntoView({ block: 'center' });
        if (!img.complete) {
          await new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 8000);
          });
        }
      }
    });
    const broken = await page.evaluate(() =>
      [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
    );
    expect(broken).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('every image has alt text, the page has one h1 and a labelled main landmark', async ({ page }) => {
    await openSite(page);
    const missing = await page.evaluate(() => [...document.images].filter((i) => !i.hasAttribute('alt')).length);
    expect(missing).toBe(0);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-IN');
  });

  test('SEO metadata and structured data contain only verified facts', async ({ page }) => {
    await openSite(page);
    await expect(page).toHaveTitle(/White Elephant Creative Studio/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Hyderabad/);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og-image\.jpg$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.whiteelephantcreativestudio.com/');
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld.address).toMatchObject({ addressLocality: 'Hyderabad', addressRegion: 'Telangana', postalCode: '500090', addressCountry: 'IN' });
    expect(ld.email).toBe('whiteelephantcreativestudio@gmail.com');
    for (const forbidden of ['aggregateRating', 'review', 'openingHours', 'openingHoursSpecification', 'geo', 'priceRange', 'streetAddress', 'award']) {
      expect(JSON.stringify(ld)).not.toContain(`"${forbidden}"`);
    }
    for (const path of ['/robots.txt', '/sitemap.xml', '/favicon.ico', '/og-image.jpg', '/site.webmanifest']) {
      const res = await page.request.get(path);
      expect(res.status(), path).toBe(200);
    }
  });

  test('automated accessibility scan (axe) finds no serious or critical violations on the home page', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSite(page);
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)).toEqual([]);
  });

  test('axe scan of the quotation popup, empty and with validation errors', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); // avoid measuring contrast mid fade-in animation
    await openSite(page);
    await openQuote(page);
    const scan = async () => {
      const results = await new AxeBuilder({ page }).include('dialog[open]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      return serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`);
    };
    expect(await scan()).toEqual([]);
    await page.getByLabel(/email address/i).fill('not-an-email');
    await submit(page);
    await expect(page.getByTestId('error-summary')).toBeVisible();
    expect(await scan()).toEqual([]);
  });

  test('keyboard-only: a visitor can open the popup, complete and submit the form without a mouse', async ({ page }) => {
    await mock.reset();
    await openSite(page);
    // Open it from the keyboard: the header button is focused, Enter opens the popup and the cursor lands in the name field.
    const opener = page.getByRole('banner').getByRole('button', { name: 'Get a Quote', exact: true });
    await opener.focus();
    await page.keyboard.press('Enter');
    await expect(quoteDialog(page)).toBeVisible();
    await expect(page.locator('#field-name')).toBeFocused();
    await page.keyboard.type('Keyboard User');
    await page.keyboard.press('Tab');
    await page.keyboard.type('9949621569');
    await page.keyboard.press('Tab'); // the email field (required as well)
    await expect(page.getByLabel(/email address/i)).toBeFocused();
    await page.keyboard.type('keyboard.user@example.com');
    await page.keyboard.press('Tab'); // the send button
    await expect(form(page).getByRole('button', { name: /request free quotation/i })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('quotation-success')).toBeVisible();
    const [mail] = await waitForEmails(1);
    expect(mail.subject).toBe('New Quotation Lead — Keyboard User — +91 99496 21569');
    expect(mail.text).toContain('Email: keyboard.user@example.com');
    // Escape closes the popup and focus goes back to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(quoteDialog(page)).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('focus indicators are visible on interactive elements', async ({ page }) => {
    await openSite(page);
    await page.keyboard.press('Tab'); // skip link
    const skip = page.getByRole('link', { name: /skip to main content/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await openQuote(page);
    await page.locator('#field-name').focus();
    const outline = await page.locator('#field-name').evaluate((el) => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
    // Inputs use a border colour change + outline on :focus-visible.
    expect(outline).not.toBe('none 0px');
  });
});

test.describe('the quotation popup', () => {
  test('the form is a popup, not a section: it is hidden until asked for, holds the phone numbers, and the page behind does not scroll', async ({ page }) => {
    await openSite(page);
    await expect(page.locator('#quotation')).toHaveCount(0);
    await expect(quoteDialog(page)).toBeHidden();
    await page.locator('#projects').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800); // let pictures that load lazily settle, so the page stops shifting under the scroll position

    await openQuote(page);
    const dialog = quoteDialog(page);
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Request your free quotation');
    await expect(dialog.getByRole('link', { name: '+91 99496 21569' })).toHaveAttribute('href', 'tel:+919949621569');
    await expect(dialog.getByRole('link', { name: '+91 76720 20294' })).toHaveAttribute('href', 'tel:+917672020294');
    // While it is open the page behind it stays where it was, even when the wheel is turned.
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('hidden');
    const locked = await page.evaluate(() => scrollY);
    await page.mouse.move(5, 300);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => scrollY)).toBe(locked);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => scrollY)).toBe(locked);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe('visible');
  });

  test('it closes with the X button, with Escape and with a click outside it, and focus goes back to the button that opened it', async ({ page }) => {
    await openSite(page);
    const heroButton = page.locator('#home').getByRole('button', { name: 'Get a Free Quotation' });
    const dialog = quoteDialog(page);

    await heroButton.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(heroButton).toBeFocused();

    await heroButton.click();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();

    await heroButton.click();
    await dialog.getByRole('heading', { level: 2 }).click(); // a click inside it does not close it
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 300); // outside it, on the dimmed page
    await expect(dialog).toBeHidden();
  });

  test('what a visitor typed is kept if they close it by accident; an empty form comes back clean; a sent enquiry comes back as a new form', async ({ page }) => {
    await mock.reset();
    await openSite(page);
    const dialog = quoteDialog(page);

    // Closed without typing: reopening shows no error left behind by the field that had the cursor.
    await openQuote(page);
    await page.keyboard.press('Escape');
    await openQuote(page);
    await expect(page.getByTestId('error-summary')).toHaveCount(0);
    await expect(dialog).not.toContainText('Please enter your full name');

    // Typed something, then closed by accident: it is still there.
    await page.getByLabel(/full name/i).fill('Keep Me');
    await page.keyboard.press('Escape');
    await openQuote(page);
    await expect(page.getByLabel(/full name/i)).toHaveValue('Keep Me');

    // Sent: the thank-you shows; after closing, the next time is a fresh form, not the thank-you.
    await page.getByLabel(/mobile number/i).fill('99496 21569');
    await page.getByLabel(/email address/i).fill('keep.me@example.com');
    await submit(page);
    await expect(page.getByTestId('quotation-success')).toBeVisible();
    await expect(dialog).not.toContainText('Let’s connect?'); // the thank-you has its own phone line
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await openQuote(page);
    await expect(page.getByTestId('quotation-success')).toHaveCount(0);
    await expect(page.getByLabel(/full name/i)).toHaveValue('');
    await expect(page.getByLabel(/mobile number/i)).toHaveValue('');
    await expect(page.getByLabel(/email address/i)).toHaveValue('');
    expect(await waitForEmails(1)).toHaveLength(1);
  });

  test('it says "Let’s connect?" above the two phone numbers, and asks for all three details with a short sentence', async ({ page }) => {
    await openSite(page);
    await openQuote(page);
    const dialog = quoteDialog(page);
    await expect(dialog).toContainText('Let’s connect?');
    await expect(dialog).not.toContainText('Prefer to talk first');
    await expect(dialog.locator('.quote-call a')).toHaveText(['+91 99496 21569', '+91 76720 20294']);
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('Request your free quotation');
    await expect(dialog.locator('.quote-intro')).toHaveText('Leave your name, mobile number and email and our team will get in touch.');
    // All three fields are marked as required (a star each), and there is no eyebrow line above the title.
    await expect(dialog.locator('label .text-error')).toHaveCount(3);
    await expect(dialog.locator('.eyebrow')).toHaveCount(0);
  });

  for (const vp of [
    { name: 'a laptop window', width: 1280, height: 640 },
    { name: 'a 1366 x 768 laptop', width: 1366, height: 660 },
    { name: 'a large monitor', width: 1920, height: 1000 },
    { name: 'a small phone', width: 360, height: 640 },
    { name: 'an ordinary phone', width: 390, height: 664 },
    { name: 'a tall phone', width: 412, height: 915 },
  ]) {
    test(`it fits ${vp.name} (${vp.width} x ${vp.height}) without needing to scroll`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openSite(page);
      await openQuote(page);
      const dialog = quoteDialog(page);
      await expect(dialog.getByRole('link', { name: '+91 76720 20294' })).toBeVisible();
      await page.waitForTimeout(400); // the opening animation
      const box = await dialog.evaluate((d) => ({
        scrolls: d.scrollHeight > d.clientHeight + 1,
        content: d.scrollHeight,
        shown: d.clientHeight,
        top: d.getBoundingClientRect().top,
        bottom: d.getBoundingClientRect().bottom,
        vh: innerHeight,
      }));
      expect(box.scrolls, `content ${box.content}px in a popup showing ${box.shown}px`).toBe(false);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(box.vh);
      // The lowest control (the second phone number) is on screen, and the narrow phone keeps the button label on one line.
      const lowest = await dialog.getByRole('link', { name: '+91 76720 20294' }).boundingBox();
      expect(lowest.y + lowest.height).toBeLessThanOrEqual(box.vh);
      const button = await form(page).getByRole('button', { name: /request free quotation/i }).boundingBox();
      expect(button.height).toBeLessThan(60);
    });
  }

  for (const width of [320, 360, 390, 768, 1280]) {
    test(`the three prompts fit inside their fields in full at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await openSite(page);
      await openQuote(page);
      await page.waitForTimeout(400); // the opening animation
      const fields = await page.evaluate(() =>
        ['field-name', 'field-phone', 'field-email'].map((id) => {
          const el = document.getElementById(id);
          const box = getComputedStyle(el);
          const prompt = getComputedStyle(el, '::placeholder');
          const ctx = document.createElement('canvas').getContext('2d');
          ctx.font = `${prompt.fontStyle} ${prompt.fontWeight} ${prompt.fontSize} ${prompt.fontFamily}`;
          return {
            id,
            text: el.placeholder,
            textWidth: ctx.measureText(el.placeholder).width,
            room: el.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight),
          };
        }),
      );
      expect(fields.map((f) => f.text)).toEqual(['Please enter your name', 'Please enter your mobile number', 'Please enter your email']);
      for (const f of fields) expect(f.textWidth, `${f.id}: "${f.text}" needs ${Math.round(f.textWidth)}px, field has ${Math.round(f.room)}px`).toBeLessThanOrEqual(f.room);
    });
  }

  test('an old link to #quotation still opens the popup (and works again the next time)', async ({ page }) => {
    await page.goto('/#quotation');
    const dialog = quoteDialog(page);
    await expect(dialog).toBeVisible();
    expect(new URL(page.url()).hash).toBe('');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.evaluate(() => {
      window.location.hash = '#quotation';
    });
    await expect(dialog).toBeVisible();
  });
});

test.describe('mobile', () => {
  test('@mobile menu opens, the form is usable by touch, and the lead is delivered', async ({ page }) => {
    await mock.reset();
    await openSite(page);

    // Mobile navigation
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await expect(toggle).toBeVisible();
    await toggle.click();
    const menu = page.getByRole('navigation', { name: 'Mobile' });
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'Services' }).click();
    await expect(menu).toBeHidden();
    await expect(page.locator('#services')).toBeInViewport({ ratio: 0.1 });

    // No sideways scrolling
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Use the hero button to open the popup, then complete the form with taps
    await page.locator('#home').scrollIntoViewIfNeeded();
    await page.locator('#home').getByRole('button', { name: 'Get a Free Quotation' }).tap();
    await expect(quoteDialog(page)).toBeVisible();
    // On a phone the keyboard stays down until a field is tapped, so the first field is not focused for the visitor.
    await expect(page.locator('#field-name')).not.toBeFocused();
    // The popup fits the phone's screen: inside it sideways, and no taller than the screen (it scrolls inside if it is).
    const fit = await page.evaluate(() => {
      const r = document.querySelector('dialog[open]').getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: innerWidth, vh: innerHeight, sideways: document.documentElement.scrollWidth - innerWidth };
    });
    expect(fit.left).toBeGreaterThanOrEqual(0);
    expect(fit.right).toBeLessThanOrEqual(fit.vw);
    expect(fit.top).toBeGreaterThanOrEqual(0);
    expect(fit.bottom).toBeLessThanOrEqual(fit.vh);
    expect(fit.sideways).toBeLessThanOrEqual(0);

    await page.getByLabel(/full name/i).fill('Mobile Tester');
    await page.getByLabel(/mobile number/i).fill('+91 76720 20294');
    await page.getByLabel(/email address/i).fill('mobile.tester@example.com');

    // Touch targets are comfortably large
    const small = await page.evaluate(() =>
      [...document.querySelectorAll('dialog[open] input:not([type=hidden]):not(.sr-only), dialog[open] button')]
        .filter((el) => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'))
        .map((el) => ({ el: el.tagName + (el.id ? '#' + el.id : ''), h: el.getBoundingClientRect().height }))
        .filter((x) => x.h > 0 && x.h < 40),
    );
    expect(small).toEqual([]);

    await form(page).getByRole('button', { name: /request free quotation/i }).tap();
    await expect(page.getByTestId('quotation-success')).toBeVisible();
    const [mail] = await waitForEmails(1);
    expect(mail.text).toContain('Name: Mobile Tester');
    expect(mail.text).toContain('+91 76720 20294');
    expect(mail.text).toContain('Email: mobile.tester@example.com');
    await page.screenshot({ path: 'test-results/mobile-success.png' });
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(quoteDialog(page)).toBeHidden();
  });

  test('@mobile every "Get a Quote" button opens the popup: the menu, the sticky bar and the banner as well as the hero', async ({ page }) => {
    await openSite(page);
    // header: the button in the bar at the top
    await page.getByRole('banner').getByRole('button', { name: 'Get a Quote', exact: true }).tap();
    await expect(quoteDialog(page)).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    await expect(quoteDialog(page)).toBeHidden();
    // the menu's button closes the menu and opens the popup
    await page.getByRole('button', { name: 'Open menu' }).tap();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('button', { name: 'Get a Quote' }).tap();
    await expect(quoteDialog(page)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeHidden();
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    // the sticky bar's "Free Quotation" button
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.getByRole('button', { name: 'Free Quotation', exact: true }).tap();
    await expect(quoteDialog(page)).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).tap();
    // the banner's button
    await page.locator('#get-quote').getByRole('button', { name: /Get a Quote/ }).tap();
    await expect(quoteDialog(page)).toBeVisible();
  });

  test('@mobile footer: just the logo and the copyright line side by side in the middle, nothing under it, and the call bar out of the way', async ({ page }) => {
    await openSite(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeInViewport();

    // Only the logo and the copyright line: no up arrow, no "Quick Links", no menu, no tagline.
    await expect(footer).toHaveText(`© ${new Date().getFullYear()} White Elephant Creative Studio. All rights reserved.`);
    await expect(footer.getByRole('link')).toHaveCount(1);
    await expect(footer.getByRole('link', { name: 'Back to top' })).toHaveCount(0);
    await expect(footer.getByRole('navigation')).toHaveCount(0);
    await expect(footer.getByRole('heading')).toHaveCount(0);

    // The logo is on the left, the two lines of text on its right, the pair centred, level with each other, inside the screen.
    const m = await measureFooter(page);
    expect(m.lineCount).toBe(2);
    expect(Math.abs(m.leftSpace - m.rightSpace), `space left of the logo (${m.leftSpace}) against right of the text (${m.rightSpace})`).toBeLessThanOrEqual(6);
    expect(m.leftSpace).toBeGreaterThanOrEqual(8);
    expect(m.rightSpace).toBeGreaterThanOrEqual(8);
    expect(m.gap).toBeGreaterThan(8);
    expect(Math.abs(m.logoMiddle - m.textMiddle)).toBeLessThanOrEqual(6);
    expect(m.footerHeight).toBeLessThan(110);
    // The copyright line is the last thing on the page: no spare band underneath (there used to be 88 px of it).
    expect(m.endGap).toBeLessThanOrEqual(1);
    expect(m.sideways).toBeLessThanOrEqual(0);

    // The sticky call bar has slid out of sight over the footer, so it never covers it.
    await expect.poll(() => callBarIsAway(page)).toBe(true);
    await page.screenshot({ path: 'test-results/mobile-footer.png' });
  });

  test('@mobile sticky call bar appears after the hero and hides over the quote banner and the contact section', async ({ page }) => {
    await openSite(page);
    const bar = page.getByRole('link', { name: 'Call us' });
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('href', 'tel:+919949621569');
    await page.locator('#get-quote').scrollIntoViewIfNeeded();
    await expect(bar).toBeHidden();
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await expect(bar).toBeHidden();
  });
});
