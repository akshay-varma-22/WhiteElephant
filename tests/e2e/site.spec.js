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
    // The line under the button says INDIA (owner's wording, 22 Oct 2026), not the city and state it used to name.
    await expect(hero.locator('.hero-location-text')).toHaveText('INDIA');
    await expect(hero).not.toContainText('Hyderabad');
    await expect(hero).not.toContainText('Telangana');
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
    // The addresses carry a version number (?v=2 ...): browsers keep these files for a week, so a replaced video only shows up at once
    // for everyone if its address changes too. The versioned addresses must serve the files.
    await expect(video).toHaveAttribute('src', /^\/videos\/interior-loop\.mp4\?v=\d+$/);
    await expect(video).toHaveAttribute('poster', /^\/videos\/interior-loop-poster\.webp\?v=\d+$/);
    expect((await page.request.get((await video.getAttribute('src')) ?? '')).status()).toBe(200);
    expect((await page.request.get((await video.getAttribute('poster')) ?? '')).status()).toBe(200);
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
    expect(await video.evaluate((v) => v.poster)).toMatch(/interior-loop-poster\.webp\?v=\d+$/);
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

  // The line under the hero button: "INDIA" in bold, close to the map pin, and both larger than the design's (owner's request, 22 Oct 2026).
  // Before: phones 10.9 px text / 16.8 px pin / 6 px gap; wider screens 16.8 px text / 20.8 px pin / 9.6 px gap, normal weight.
  for (const width of [320, 390, 700, 1280]) {
    test(`the hero location line is a bold "INDIA", close to a larger map pin, at ${width}px wide`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openSite(page);
      const m = await page.evaluate(() => {
        const t = document.querySelector('#home .hero-location-text');
        const p = document.querySelector('#home .hero-pin');
        const tr = t.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        const s = getComputedStyle(t);
        return {
          text: t.textContent,
          weight: Number(s.fontWeight),
          fontSize: parseFloat(s.fontSize),
          pinHeight: pr.height,
          gap: tr.left - pr.right,
          sameLine: Math.abs((tr.top + tr.bottom) / 2 - (pr.top + pr.bottom) / 2) <= 3,
          insideScreen: tr.right <= document.documentElement.clientWidth,
          pinIsLeftOfText: pr.right <= tr.left,
        };
      });
      expect(m.text).toBe('INDIA');
      expect(m.weight, 'thick text').toBeGreaterThanOrEqual(600);
      expect(m.gap, 'close to the pin (it was 6 px on phones and 9.6 px on wider screens)').toBeLessThanOrEqual(width >= 640 ? 7 : 5);
      expect(m.gap).toBeGreaterThanOrEqual(2);
      expect(m.pinIsLeftOfText).toBe(true);
      expect(m.sameLine).toBe(true);
      expect(m.insideScreen).toBe(true);
      expect(m.fontSize, 'larger than before').toBeGreaterThanOrEqual(width >= 640 ? 20 : 13);
      expect(m.pinHeight, 'larger than before').toBeGreaterThanOrEqual(width >= 640 ? 26 : 20);
    });
  }

  // The About picture is art-directed: the owner's tall picture on phones (the narrow arch), the owner's wide picture from 640 px up (where the layout changes).
  for (const width of [390, 639, 640, 768, 1280, 1920]) {
    test(`the About arch shows the ${width >= 640 ? 'wide (desktop)' : 'tall (mobile)'} picture at ${width}px wide, filling the arch`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openSite(page);
      const frame = page.locator('#about .about-photo');
      await frame.scrollIntoViewIfNeeded();
      const img = frame.locator('img');
      await expect(img).toHaveCount(1);
      await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
      await expect(frame.locator('picture source')).toHaveAttribute('media', '(min-width: 640px)');
      const m = await img.evaluate((i) => {
        const f = i.closest('.about-photo').getBoundingClientRect();
        const s = getComputedStyle(i);
        return {
          current: i.currentSrc,
          ratio: f.width / f.height,
          frameWidth: f.width,
          fit: s.objectFit,
          position: s.objectPosition,
          alt: i.alt,
          boxFillsFrame: Math.abs(i.getBoundingClientRect().width - f.width) < 1.5 && Math.abs(i.getBoundingClientRect().height - f.height) < 1.5,
        };
      });
      expect(m.current).toContain(width >= 640 ? 'about-desktop' : 'about-mobile');
      expect(m.current).not.toContain(width >= 640 ? 'about-mobile' : 'about-desktop');
      expect(m.fit).toBe('cover');
      expect(m.boxFillsFrame, 'the picture fills the whole arch').toBe(true);
      expect(m.alt).toMatch(/living room.*sideboard.*plant/i);
      if (width >= 640) {
        expect(m.ratio, 'the 4:5 arch on wider screens').toBeCloseTo(0.8, 1);
        expect(m.position).toBe('45% 50%');
      } else {
        expect(m.ratio, 'a narrow, tall arch on phones').toBeLessThan(0.45);
        expect(m.position).toBe('68% 50%');
      }
    });
  }

  test('key highlights show the four figures', async ({ page }) => {
    await openSite(page);
    const items = page.locator('#highlights li');
    await expect(items).toHaveCount(4);
    await expect(items.locator('.highlight-value')).toHaveText(['15+', '500+', '400+', '150+']);
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
    // Furniture is described as custom work only: no list of ready-made pieces (sofa, dining, tables, chairs, desks, beds ...).
    const furniture = cards.nth(4);
    await expect(furniture.locator('.arch-desc')).toHaveText('Customised and personalised furnishing.');
    await expect(furniture).not.toContainText(/sofa|dining|table|chair|desk|bed|seating/i);
    // All six cards show pictures the owner supplied (not the old stock photos or the video stills).
    await expect(cards.nth(0).locator('img')).toHaveAttribute('src', /service-residential/);
    await expect(cards.nth(1).locator('img')).toHaveAttribute('src', /service-commercial/);
    await expect(cards.nth(2).locator('img')).toHaveAttribute('src', /service-architecture/);
    await expect(cards.nth(3).locator('img')).toHaveAttribute('src', /service-false-ceiling/);
    await expect(furniture.locator('img')).toHaveAttribute('src', /service-furniture/);
    await expect(cards.nth(5).locator('img')).toHaveAttribute('src', /service-renovation/);
    // Clicking a card must not move the page.
    await cards.first().scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await cards.first().click();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });

  // The False Ceiling and Renovation & Remodeling pictures are tall (902 x 1600 and 1024 x 1536), taller than the arch, so the card shows part of
  // them. False Ceiling is lined up from the top so the whole lit ceiling stays in view; Renovation shows almost all of its three stacked panels
  // (before, during, after). Both fill the arch completely (object-fit: cover), with no blur, bars or gaps.
  const pictures = [
    { name: 'False Ceiling', index: 3, file: /service-false-ceiling/, size: [902, 1600], top: 0.02, bottom: 0.7, maxBottom: 1 },
    { name: 'Renovation & Remodeling', index: 5, file: /service-renovation/, size: [1024, 1536], top: 0.08, bottom: 0.9, maxBottom: 1 },
  ];
  for (const width of [390, 768, 1280, 1920]) {
    for (const pic of pictures) {
      test(`the ${pic.name} card (${width}px wide) shows the owner's picture, framed so its important part is inside the arch`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await openSite(page);
        const card = page.locator('#services ul.arch-grid > li').nth(pic.index);
        await card.scrollIntoViewIfNeeded();
        const img = card.locator('img');
        await expect(img).toHaveCount(1); // one picture per card: no blurred copy or second layer
        await expect(img).toHaveAttribute('src', pic.file);
        await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
        const m = await img.evaluate((i, [w, h]) => {
          const b = i.getBoundingClientRect();
          const s = getComputedStyle(i);
          const scale = Math.max(b.width / w, b.height / h);
          const shownHeight = h * scale;
          const posY = parseFloat(s.objectPosition.split(' ')[1]) / 100;
          const offset = (shownHeight - b.height) * posY;
          return { fit: s.objectFit, filter: s.filter, transform: s.transform, shownTop: offset / shownHeight, shownBottom: (offset + b.height) / shownHeight };
        }, pic.size);
        expect(m.fit).toBe('cover');
        expect(m.filter, 'no blur').toBe('none');
        expect(m.transform, 'not zoomed or shifted').toBe('none');
        expect(m.shownTop, 'the top of the picture is in view').toBeLessThanOrEqual(pic.top);
        expect(m.shownBottom, 'enough of the picture is in view').toBeGreaterThanOrEqual(pic.bottom);
        expect(m.shownBottom, 'the card does not run past the picture').toBeLessThanOrEqual(pic.maxBottom);
      });
    }
  }

  test('featured projects: three cards first, filters, View all projects, and the lightbox', async ({ page }) => {
    await openSite(page);
    await page.locator('#projects').scrollIntoViewIfNeeded();
    const tiles = page.locator('#projects ul.project-grid > li');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.first()).toHaveClass(/project-feature/);
    await expect(page.locator('#projects .project-name')).toHaveText(['Living room concept', 'Workspace concept', 'Personalised furnishing']);
    // The third card, in the place of the removed side table, shows a wooden work desk (its own picture and description).
    await expect(tiles.nth(2).locator('img')).toHaveAttribute('src', /portfolio-work-desk/);
    await expect(tiles.nth(2).locator('img')).toHaveAttribute('alt', /wooden work desk/i);
    // The cards are just the picture with its title: no arrow (or any other icon) in the corner of any image.
    const cardIcons = page.locator('#projects .project-card svg, #projects .project-arrow');
    await expect(cardIcons).toHaveCount(0);
    // The section ends with its cards and the "View all projects" button: the "Sample images." note and its description are switched
    // off (the owner asked for them to go; `showPortfolioNotice` in src/config/site.js brings them back).
    await expect(page.locator('#projects [role="note"]')).toHaveCount(0);
    await expect(page.locator('#projects')).not.toContainText('Sample images');
    await expect(page.locator('#projects')).not.toContainText('placeholders that illustrate');
    // View all / show fewer
    const more = page.getByRole('button', { name: /View all projects/i });
    await more.click();
    await expect(tiles).toHaveCount(11);
    await expect(cardIcons).toHaveCount(0);
    // The "Timber side table" is gone (the owner asked for it to be removed), by title and by picture description.
    await expect(page.locator('#projects')).not.toContainText(/side table/i);
    await expect(page.locator('#projects img[alt*="side table" i]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Show fewer projects/i })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: /Show fewer projects/i }).click();
    await expect(tiles).toHaveCount(3);
    // Filters
    await page.getByRole('button', { name: 'Furniture', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Furniture', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tiles).toHaveCount(3); // personalised furnishing (the work desk), the sculpted timber bench and the carved timber chest
    await expect(page.locator('#projects .project-name')).toHaveText(['Personalised furnishing', 'Sculpted timber bench', 'Carved timber chest']);
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
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.whiteelephantcreativestudio.in/');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /^White Elephant Creative Studio \(White Elephant Interiors\)/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    // Two structured-data blocks: the business, and the website (its name and other names, for the name shown in search results).
    const blocks = page.locator('script[type="application/ld+json"]');
    await expect(blocks).toHaveCount(2);
    const ld = JSON.parse(await blocks.nth(0).textContent());
    const site = JSON.parse(await blocks.nth(1).textContent());
    expect(ld['@type']).toBe('LocalBusiness');
    expect(ld.name).toBe('White Elephant Creative Studio');
    expect(ld.alternateName).toEqual(['White Elephant Interiors', 'White Elephant']);
    expect(ld.areaServed).toMatchObject({ '@type': 'City', name: 'Hyderabad' });
    expect(site['@type']).toBe('WebSite');
    expect(site.name).toBe('White Elephant Creative Studio');
    expect(site.alternateName).toEqual(['White Elephant Interiors', 'White Elephant']);
    expect(site.url).toBe('https://www.whiteelephantcreativestudio.in/');
    expect(JSON.stringify(site)).not.toContain('sameAs'); // no social profiles are listed: none have been supplied
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

  // ---- The page's text is in the HTML itself (built in advance), so crawlers that do not run JavaScript, such as most AI assistants' crawlers, can read it ----
  const textOf = (html) => html.replace(/<!-- -->/g, '').replace(/<(script|style|noscript)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

  test('the HTML the server sends (before any JavaScript runs) already contains the page text, headings, services and contact details', async ({ page }) => {
    const html = await (await page.request.get('/')).text();
    const root = html.match(/<div id="root">([\s\S]*)<\/div>\s*<noscript>/)?.[1] ?? '';
    expect(root.length, 'the page is already inside #root').toBeGreaterThan(20_000);
    const text = textOf(root);
    expect(text.split(' ').length, 'a full page of words, not an empty shell').toBeGreaterThan(300);
    // exactly one main heading, plus the section headings
    expect(root.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(root.match(/<h2[\s>]/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    for (const phrase of [
      'Thoughtful Spaces for Every Story.',
      'Spaces for Every Need',
      'Residential Interiors',
      'Commercial Interiors',
      'Architecture',
      'False Ceiling',
      'Furniture Design',
      'Renovation & Remodeling',
      'Customised and personalised furnishing.',
      '+91 99496 21569',
      '+91 76720 20294',
      'whiteelephantcreativestudio@gmail.com',
      'Hyderabad',
      'All rights reserved',
    ]) {
      expect(text, phrase).toContain(phrase);
    }
    // The About picture's two versions are in the built-in HTML too (a wide-screen source and a phone picture).
    expect(root).toMatch(/<source[^>]*media="\(min-width: 640px\)"[^>]*about-desktop/i);
    expect(root).toMatch(/<img[^>]*about-mobile/i);
    // The head still has its title, description, canonical address and both structured-data blocks.
    expect(html).toContain('<title>White Elephant Creative Studio | Interior Design in Hyderabad</title>');
    expect(html.match(/<script type="application\/ld\+json">/g)).toHaveLength(2);
    // The pictures written into the HTML point at real files.
    const srcs = [...root.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThanOrEqual(10);
    for (const src of new Set(srcs)) expect((await page.request.get(src)).status(), src).toBe(200);
  });

  test('with JavaScript switched off the page is still there: headline, services, pictures and contact details are visible', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Thoughtful');
    await expect(page.getByRole('heading', { level: 2, name: 'Spaces for Every Need' })).toBeVisible();
    for (const name of ['Residential Interiors', 'Commercial Interiors', 'Architecture', 'False Ceiling', 'Furniture Design', 'Renovation & Remodeling']) {
      await expect(page.locator('#services').getByRole('heading', { level: 3, name: new RegExp(name.replace('&', '&')) }), name).toBeVisible();
    }
    await expect(page.locator('#contact').getByRole('link', { name: '+91 76720 20294' })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('All rights reserved');
    await context.close();
  });

  test('the browser takes over the built-in HTML without errors or rebuilding it (no hydration problems, page content kept, form still works)', async ({ page }) => {
    const problems = [];
    page.on('console', (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    // Count how many page nodes get thrown away while the page starts up: taking over the built-in HTML removes almost none; building the page again would remove them all.
    await page.addInitScript(() => {
      window.__removedNodes = 0;
      new MutationObserver((records) => records.forEach((r) => (window.__removedNodes += r.removedNodes.length))).observe(document, { childList: true, subtree: true });
    });
    await openSite(page);
    await page.waitForTimeout(800);
    expect(problems, 'no console errors or warnings, in particular none about the page not matching').toEqual([]);
    const removed = await page.evaluate(() => window.__removedNodes);
    expect(removed, `${removed} nodes were thrown away at start-up (0 when the built-in HTML is reused, 8+ when the page is rebuilt)`).toBeLessThanOrEqual(1);
    await expect(page.locator('#services ul.arch-grid > li')).toHaveCount(6);
    // Interactive after the take-over: the popup opens.
    await page.getByRole('banner').getByRole('button', { name: 'Get a Quote', exact: true }).click();
    await expect(quoteDialog(page)).toBeVisible();
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
    await expect(dialog.locator('.quote-call li a')).toHaveText(['+91 99496 21569', '+91 76720 20294']);
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

/*
 * WhatsApp buttons: a frameless brown WhatsApp logo to the left of "Get a Quote" in the header, and the same logo beside the two phone
 * numbers in the quotation popup. Both open a WhatsApp chat with 7672020294 and a message that is already typed.
 */
const WA_MESSAGE =
  'Hello White Elephant Creative Studio,\n\nI’m interested in your interior design services and would appreciate it if you could share more details about your offerings.\n\nI look forward to hearing from you.\n\nThank you!';
const WA_HREF = 'https://wa.me/917672020294?text=' + encodeURIComponent(WA_MESSAGE);

test.describe('WhatsApp buttons', () => {
  test('the header has a WhatsApp logo to the left of "Get a Quote", with no circle or frame, in the site\'s brown', async ({ page }) => {
    await openSite(page);
    const wa = page.getByRole('banner').getByRole('link', { name: /WhatsApp/ });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute('href', WA_HREF);
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', /noopener/);
    await expect(wa).toHaveAccessibleName(/Chat with us on WhatsApp/);
    await expect(wa.locator('svg')).toBeVisible();

    const m = await page.evaluate(() => {
      const link = document.querySelector('.header-wa');
      const cta = document.querySelector('.header-cta');
      const header = document.querySelector('.site-header');
      const l = link.getBoundingClientRect();
      const c = cta.getBoundingClientRect();
      const s = getComputedStyle(link);
      const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const rgb = (x) => x.match(/[\d.]+/g).slice(0, 3).map(Number);
      const a = lum(rgb(s.color));
      const b = lum(rgb(getComputedStyle(header).backgroundColor));
      return {
        left: l.right <= c.left,
        gap: c.left - l.right,
        sameMiddle: Math.abs((l.top + l.bottom) / 2 - (c.top + c.bottom) / 2),
        border: s.borderTopWidth,
        radius: s.borderTopLeftRadius,
        background: s.backgroundColor,
        color: s.color,
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
    expect(m.left, 'the logo is to the left of the Get a Quote button').toBe(true);
    expect(m.gap).toBeLessThan(40);
    expect(m.sameMiddle).toBeLessThanOrEqual(3);
    expect(m.border, 'no frame').toBe('0px');
    expect(m.radius, 'no circle').toBe('0px');
    expect(m.background, 'no filled circle behind it').toBe('rgba(0, 0, 0, 0)');
    expect(m.color, "the site's brown (copper), not WhatsApp green").toBe('rgb(104, 70, 43)');
    expect(m.contrast, 'the logo stands out from the header (needs 3:1)').toBeGreaterThanOrEqual(3);
  });

  test('the quotation popup has the same logo beside the two phone numbers, on the same row, with no frame', async ({ page }) => {
    await openSite(page);
    await openQuote(page);
    const dialog = quoteDialog(page);
    const wa = dialog.getByRole('link', { name: /WhatsApp/ });
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute('href', WA_HREF);
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', /noopener/);
    await expect(dialog.locator('.quote-call li a')).toHaveText(['+91 99496 21569', '+91 76720 20294']); // the numbers are still there, as phone links
    await expect(dialog.getByRole('link', { name: '+91 76720 20294' })).toHaveAttribute('href', 'tel:+917672020294');
    await page.waitForTimeout(400); // the opening animation
    const m = await dialog.evaluate((d) => {
      const call = d.querySelector('.quote-call');
      const link = call.querySelector('.quote-wa');
      const numbers = [...call.querySelectorAll('li a')].map((a) => a.getBoundingClientRect());
      const l = link.getBoundingClientRect();
      const s = getComputedStyle(link);
      const middle = (r) => (r.top + r.bottom) / 2;
      return {
        rightOfNumbers: numbers.every((n) => l.left >= n.right),
        sameRow: numbers.every((n) => Math.abs(middle(n) - middle(l)) <= 3),
        inside: l.right <= d.getBoundingClientRect().right,
        border: s.borderTopWidth,
        radius: s.borderTopLeftRadius,
        color: s.color,
        size: l.width,
        scrolls: d.scrollHeight > d.clientHeight + 1,
      };
    });
    expect(m.rightOfNumbers).toBe(true);
    expect(m.sameRow).toBe(true);
    expect(m.inside).toBe(true);
    expect(m.border).toBe('0px');
    expect(m.radius).toBe('0px');
    expect(m.color).toBe('rgb(104, 70, 43)');
    expect(m.size).toBeGreaterThanOrEqual(40);
    expect(m.scrolls, 'adding the logo must not make the popup scroll').toBe(false);
  });

  test('tapping either logo opens a new tab on WhatsApp with the message ready (WhatsApp itself is not contacted in this test)', async ({ page, context }) => {
    const opened = [];
    await context.route('https://wa.me/**', (route) => {
      opened.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp (test double)</title>' });
    });
    await openSite(page);

    const [headerTab] = await Promise.all([context.waitForEvent('page'), page.getByRole('banner').getByRole('link', { name: /WhatsApp/ }).click()]);
    await headerTab.waitForLoadState();
    expect(headerTab.url()).toBe(WA_HREF);
    await headerTab.close();
    expect(new URL(page.url()).pathname, 'the site itself stays where it was').toBe('/');

    await openQuote(page);
    const [popupTab] = await Promise.all([context.waitForEvent('page'), quoteDialog(page).getByRole('link', { name: /WhatsApp/ }).click()]);
    await popupTab.waitForLoadState();
    expect(popupTab.url()).toBe(WA_HREF);
    await popupTab.close();
    await expect(quoteDialog(page), 'the popup is still open behind the new tab').toBeVisible();
    expect(opened).toEqual([WA_HREF, WA_HREF]);
    const text = new URL(opened[0]).searchParams.get('text');
    expect(text, "the owner's exact message, line breaks included, is what WhatsApp gets").toBe(WA_MESSAGE);
    expect(text).toContain('interior design services');
  });

  test('on a computer screen there is no bottom bar: the header logo is the only WhatsApp logo on the page (the popup has its own)', async ({ page }) => {
    await openSite(page);
    await page.evaluate(() => window.scrollBy(0, 1400));
    await expect(page.locator('.fixed.inset-x-0.bottom-0')).toBeHidden();
    await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveCount(1);
  });

  // Does everything in the header fit on one line, in order, inside the screen? (The WhatsApp logo is only there from 768 px wide: on phones the
  // sticky bar at the bottom has it.)
  const headerFits = (page) =>
    page.evaluate(() => {
      const R = (e) => e.getBoundingClientRect();
      const logo = R(document.querySelector('.site-logo'));
      const waEl = document.querySelector('.header-wa');
      const waShown = getComputedStyle(waEl).display !== 'none';
      const wa = R(waEl);
      const ctaEl = document.querySelector('.header-cta');
      const cta = R(ctaEl);
      const ctaStyle = getComputedStyle(ctaEl);
      const menu = document.querySelector('.site-header button[aria-controls="mobile-menu"]');
      const menuBox = menu && menu.offsetParent !== null ? R(menu) : null;
      const lastRight = (menuBox ?? cta).right;
      const screenWidth = document.documentElement.clientWidth;
      const afterWa = waShown ? wa.right <= cta.left : true;
      return {
        waShown,
        order: logo.right <= (waShown ? wa.left : cta.left) && afterWa && cta.right <= (menuBox ? menuBox.left : screenWidth),
        inside: lastRight <= screenWidth,
        spare: Math.round(screenWidth - lastRight),
        sideways: document.documentElement.scrollWidth - innerWidth,
        waWidth: wa.width,
        waMiddleOffset: Math.abs((wa.top + wa.bottom) / 2 - (cta.top + cta.bottom) / 2),
        ctaHeight: cta.height,
        ctaPaddingLeft: parseFloat(ctaStyle.paddingLeft),
        ctaFontSize: parseFloat(ctaStyle.fontSize),
      };
    });

  for (const width of [768, 1024, 1920]) {
    test(`at ${width}px wide the header holds the logo, the WhatsApp logo and Get a Quote in order`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openSite(page);
      const header = await headerFits(page);
      expect(header.waShown, 'the header has the WhatsApp logo from 768 px wide').toBe(true);
      expect(header.order, 'nothing overlaps in the header').toBe(true);
      expect(header.inside).toBe(true);
      expect(header.sideways).toBeLessThanOrEqual(0);
      expect(header.waWidth).toBeGreaterThanOrEqual(40);
      expect(header.waMiddleOffset).toBeLessThanOrEqual(3);
    });
  }

  for (const width of [640, 700, 767]) {
    test(`at ${width}px wide (a phone or a small tablet) the header has no WhatsApp logo: the bottom bar has it`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openSite(page);
      const header = await headerFits(page);
      expect(header.waShown).toBe(false);
      await expect(page.getByRole('banner').getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);
      expect(header.order, 'logo, Get a Quote and the menu button fit in order').toBe(true);
      expect(header.inside).toBe(true);
      // The sticky bar (shown below 768 px, once the hero is scrolled past) carries the logo instead.
      await page.locator('#about').scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, 600));
      await expect(page.locator('.fixed.inset-x-0.bottom-0').getByRole('link', { name: /WhatsApp/ })).toBeVisible();
    });
  }

  // The popup row: label, the two numbers and the logo.
  for (const width of [320, 360, 390, 412, 539, 599, 600, 700, 1280]) {
    test(`at ${width}px wide the popup row holds the logo beside the numbers (or beside the label on a phone), inside the popup`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openSite(page);
      await openQuote(page);
      await page.waitForTimeout(400);
      const row = await quoteDialog(page).evaluate((d) => {
        const call = d.querySelector('.quote-call');
        const box = d.getBoundingClientRect();
        const wa = call.querySelector('.quote-wa').getBoundingClientRect();
        const label = call.querySelector('p').getBoundingClientRect();
        const numbers = [...call.querySelectorAll('li a')].map((a) => a.getBoundingClientRect());
        const middle = (r) => (r.top + r.bottom) / 2;
        return {
          inside: wa.right <= box.right && wa.left >= box.left && numbers.every((n) => n.right <= box.right && n.left >= box.left),
          withNumbers: numbers.every((n) => Math.abs(middle(n) - middle(wa)) <= 3),
          withLabel: Math.abs(middle(label) - middle(wa)) <= 3,
          numbersBelow: numbers.every((n) => n.top >= wa.bottom - 2),
        };
      });
      expect(row.inside, 'everything stays inside the popup').toBe(true);
      // From 600 px wide: label, numbers and logo on one row. On a phone: label and logo on one row, the numbers under them.
      if (width >= 600) expect(row.withNumbers).toBe(true);
      else {
        expect(row.withLabel).toBe(true);
        expect(row.numbersBelow).toBe(true);
      }
    });
  }

  // Phones: tested in the phone emulation (overlay scrollbars, like a real phone), where the screen is the full width.
  for (const width of [320, 360, 375, 390, 393, 412]) {
    test(`@mobile at ${width}px wide the header has just the logo, a compact Get a Quote and the menu button (no WhatsApp logo), all on screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openSite(page);
      const header = await headerFits(page);
      expect(header.waShown, 'the WhatsApp logo is in the bottom bar, not the top bar').toBe(false);
      await expect(page.getByRole('banner').getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);
      expect(header.order, 'nothing overlaps in the header').toBe(true);
      expect(header.inside, `the menu button must end inside the screen (spare ${header.spare}px)`).toBe(true);
      expect(header.sideways).toBeLessThanOrEqual(0);
      // "Get a Quote" is a little smaller than it was (it was 35 px high with 23 px of padding each side at 390 px; the label stays readable).
      expect(header.ctaHeight, 'compact').toBeLessThanOrEqual(33.5);
      expect(header.ctaHeight, 'still easy to tap').toBeGreaterThanOrEqual(30);
      expect(header.ctaPaddingLeft).toBeLessThanOrEqual(22);
      expect(header.ctaFontSize, 'the label stays readable').toBeGreaterThanOrEqual(9);
    });
  }
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

  // The sticky bar on phones: Call us | WhatsApp logo | Free Quotation.
  const showCallBar = async (page) => {
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 600));
    await expect(page.getByRole('link', { name: 'Call us' })).toBeVisible();
  };
  const callBar = (page) => page.locator('.fixed.inset-x-0.bottom-0');
  // The divider is drawn on the logo's left edge (a ::before), so measure it through the logo link's computed style.
  const barDivider = (page) =>
    callBar(page).evaluate((bar) => {
      const [call, link] = [...bar.children];
      const cs = getComputedStyle(link, '::before');
      const textNode = [...call.childNodes].find((n) => n.nodeType === 3);
      const range = document.createRange();
      range.selectNodeContents(textNode);
      const textEnd = range.getBoundingClientRect().right - parseFloat(getComputedStyle(call).letterSpacing || '0'); // the last letter is followed by letter-spacing
      const lineX = link.getBoundingClientRect().left + parseFloat(cs.left || '0');
      const iconLeft = link.querySelector('svg').getBoundingClientRect().left;
      return {
        exists: cs.content !== 'none' && cs.content !== 'normal',
        width: parseFloat(cs.width),
        height: parseFloat(cs.height),
        top: parseFloat(cs.top),
        bottom: parseFloat(cs.bottom),
        background: cs.backgroundImage,
        gapBefore: lineX - textEnd,
        gapAfter: iconLeft - lineX,
        pointerEvents: cs.pointerEvents,
      };
    });

  test('@mobile the sticky bar has the WhatsApp logo between "Call us" and "Free Quotation": same brown, no frame, opens WhatsApp with the message ready', async ({ page, context }) => {
    const opened = [];
    await context.route('https://wa.me/**', (route) => {
      opened.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>WhatsApp (test double)</title>' });
    });
    await openSite(page);
    const bar = callBar(page);
    const wa = bar.getByRole('link', { name: /WhatsApp/ });
    await expect(wa, 'not there while the bar is hidden over the hero').toHaveCount(0);

    await showCallBar(page);
    await expect(wa).toBeVisible();
    await expect(wa).toHaveAttribute('href', WA_HREF);
    await expect(wa).toHaveAttribute('target', '_blank');
    await expect(wa).toHaveAttribute('rel', /noopener/);
    await expect(wa).toHaveAccessibleName(/Chat with us on WhatsApp/);
    await expect(wa.locator('svg')).toBeVisible();

    const m = await bar.evaluate((b) => {
      const [call, link, quote] = [...b.children];
      const r = (e) => e.getBoundingClientRect();
      const s = getComputedStyle(link);
      return {
        order: r(call).right <= r(link).left + 0.5 && r(link).right <= r(quote).left + 0.5,
        sameRow: [call, link, quote].every((c) => r(c).top === r(call).top && r(c).height === r(call).height),
        callText: call.textContent.trim(),
        quoteText: quote.textContent.trim(),
        border: s.borderTopWidth,
        radius: s.borderTopLeftRadius,
        background: s.backgroundColor,
        color: s.color,
        glyph: r(link.querySelector('svg')).width,
        tap: Math.min(r(link).width, r(link).height),
      };
    });
    expect(m.order, 'Call us, then WhatsApp, then Free Quotation').toBe(true);
    expect(m.sameRow).toBe(true);
    expect(m.callText).toBe('Call us');
    expect(m.quoteText).toBe('Free Quotation');
    expect(m.border, 'no frame').toBe('0px');
    expect(m.radius, 'no circle').toBe('0px');
    expect(m.background, 'nothing filled behind the logo').toBe('rgba(0, 0, 0, 0)');
    expect(m.color, "the site's brown, like the header").toBe('rgb(104, 70, 43)');
    expect(m.glyph).toBeGreaterThanOrEqual(22);
    expect(m.tap, 'big enough to tap').toBeGreaterThanOrEqual(44);

    // A fine line between "Call us" and the logo: 1px wide, centred, short of the top and bottom of the bar.
    const line = await barDivider(page);
    expect(line.exists, 'there is a divider').toBe(true);
    expect(line.width).toBe(1);
    expect(line.top, 'does not touch the top of the bar').toBeGreaterThanOrEqual(12);
    expect(line.bottom, 'does not touch the bottom of the bar').toBeGreaterThanOrEqual(12);
    expect(Math.abs(line.top - line.bottom), 'centred up and down').toBeLessThanOrEqual(1);
    expect(line.height).toBeGreaterThanOrEqual(18);
    expect(line.height, 'a short line, not the full height').toBeLessThanOrEqual(32);
    expect(line.background, 'a gradient that fades at both ends').toContain('linear-gradient');

    // The other two buttons still do their jobs.
    await expect(bar.getByRole('link', { name: 'Call us' })).toHaveAttribute('href', 'tel:+919949621569');
    await expect(bar.getByRole('button', { name: 'Free Quotation', exact: true })).toBeVisible();

    const [tab] = await Promise.all([context.waitForEvent('page'), wa.tap()]);
    await tab.waitForLoadState();
    expect(tab.url()).toBe(WA_HREF);
    await tab.close();
    expect(opened).toEqual([WA_HREF]);
    await expect(quoteDialog(page), 'the quotation popup does not open from the WhatsApp logo').toBeHidden();

    // It goes away with the rest of the bar over the quote banner and the contact section.
    await page.locator('#get-quote').scrollIntoViewIfNeeded();
    await expect(wa).toHaveCount(0);
    await expect.poll(() => callBarIsAway(page)).toBe(true);
  });

  for (const width of [320, 360, 375, 390, 412]) {
    test(`@mobile at ${width}px wide the sticky bar fits all three: Call us, the WhatsApp logo and Free Quotation, none cut off`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await openSite(page);
      await showCallBar(page);
      const m = await callBar(page).evaluate((b) => {
        const screenWidth = document.documentElement.clientWidth;
        return [...b.children].map((cell) => {
          const box = cell.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(cell);
          const content = range.getBoundingClientRect();
          return {
            name: cell.textContent.trim() || 'WhatsApp logo',
            insideScreen: box.left >= 0 && box.right <= screenWidth + 0.5,
            contentInsideCell: content.left >= box.left - 0.5 && content.right <= box.right + 0.5,
            clipped: cell.scrollWidth > cell.clientWidth,
            height: box.height,
            sideways: document.documentElement.scrollWidth - innerWidth,
          };
        });
      });
      expect(m.map((c) => c.name)).toEqual(['Call us', 'WhatsApp logo', 'Free Quotation']);
      // The fine line sits midway between the end of "Call us" and the logo (within 2 px), and ignores taps.
      const line = await barDivider(page);
      expect(line.exists).toBe(true);
      expect(Math.abs(line.gapBefore - line.gapAfter), `room left of the line ${line.gapBefore.toFixed(1)} px, right ${line.gapAfter.toFixed(1)} px`).toBeLessThanOrEqual(2);
      expect(line.gapBefore).toBeGreaterThanOrEqual(12);
      expect(line.pointerEvents).toBe('none');
      for (const cell of m) {
        expect(cell.insideScreen, `${cell.name} is inside the screen`).toBe(true);
        expect(cell.contentInsideCell, `${cell.name} fits in its own part of the bar`).toBe(true);
        expect(cell.clipped, `${cell.name} is not cut off`).toBe(false);
        expect(cell.height).toBeGreaterThanOrEqual(56);
        expect(cell.sideways).toBeLessThanOrEqual(0);
      }
    });
  }
});
