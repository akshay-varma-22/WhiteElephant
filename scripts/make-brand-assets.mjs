/**
 * Builds web brand assets from the supplied business-card photograph.
 *
 *   npm run brand
 *
 * The artwork itself is NOT redrawn or altered: this script only crops the logo
 * from "White Elephant business card.jpeg" and converts the card's ivory paper
 * into transparency so the logo sits cleanly on the site's ivory/cream backgrounds.
 *
 * If the studio later supplies the original logo files (SVG/PNG with transparency),
 * drop them into src/assets/brand/ as logo.png (or update the imports) and the
 * favicons / social image can be regenerated from them by editing SOURCE below.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'White Elephant business card.jpeg');
const brandDir = resolve(root, 'src/assets/brand');
const publicDir = resolve(root, 'public');

// Crop boxes measured on the 1280x853 card photograph (front of the card).
const LOGO_BOX = { left: 325, top: 78, width: 630, height: 340 };
const MARK_BOX = { left: 452, top: 116, width: 286, height: 162 }; // "WE" monogram + elephant
// Pendant-lamp artwork that overlaps the monogram crop (absolute card-photo pixels) is masked out of the icon only.
const MARK_MASK = { fromX: 722, toY: 152 };

// Site palette (keep in sync with src/index.css).
const IVORY = { r: 250, g: 246, b: 238 };
const CHARCOAL = '#2b2622';

/** Estimate the card paper colour from a blank patch (top-left of the card). */
async function paperColour() {
  const { data, info } = await sharp(SOURCE)
    .extract({ left: 300, top: 62, width: 40, height: 40 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  const n = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    sum[0] += data[i];
    sum[1] += data[i + 1];
    sum[2] += data[i + 2];
  }
  return sum.map((v) => v / n);
}

/** Convert "ink on paper" to an RGBA image: paper -> transparent, ink colour recovered. */
async function inkOnTransparent(box, paper, mask) {
  const { data, info } = await sharp(SOURCE).extract(box).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0, o = 0; i < data.length; i += info.channels, o += 4) {
    const px = (i / info.channels) % info.width;
    const py = Math.floor(i / info.channels / info.width);
    if (mask && box.left + px >= mask.fromX && box.top + py < mask.toY) continue; // stays transparent
    // Normalise so paper == 255 (removes the card's slightly warm/grey tint and vignette).
    const r = Math.min(255, (data[i] / paper[0]) * 255);
    const g = Math.min(255, (data[i + 1] / paper[1]) * 255);
    const b = Math.min(255, (data[i + 2] / paper[2]) * 255);
    let a = 1 - Math.min(r, g, b) / 255;
    if (a < 0.05) a = 0; // drop paper grain / JPEG noise
    if (a === 0) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      continue;
    }
    // Recover ink colour so that  ink*a + white*(1-a) == normalised pixel.
    const c = (v) => Math.max(0, Math.min(255, Math.round((v - 255 * (1 - a)) / a)));
    out[o] = c(r);
    out[o + 1] = c(g);
    out[o + 2] = c(b);
    out[o + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Wrap a PNG buffer in a single-image .ico container. */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);
  return Buffer.concat([header, entry, png]);
}

async function squareIcon(markPng, size, padRatio = 0.14) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const mark = await sharp(markPng)
    .resize({ width: inner, height: inner, fit: 'inside' })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: IVORY } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(brandDir, { recursive: true });
  await mkdir(publicDir, { recursive: true });

  const paper = await paperColour();
  console.log('Card paper colour (rgb):', paper.map(Math.round).join(', '));

  const logo = await inkOnTransparent(LOGO_BOX, paper);
  const logoPng = await logo.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(brandDir, 'logo.png'), logoPng);

  // Compact logo for the site header: the same artwork without the small "Interiors | Architecture | Furniture" line
  // (rows 296+ of logo.png), because the hero shows that line in large type right below.
  const logoMeta = await sharp(logoPng).metadata();
  const compactPng = await sharp(logoPng)
    .extract({ left: 0, top: 8, width: logoMeta.width, height: 288 })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(brandDir, 'logo-compact.png'), compactPng);

  // Cream, single-colour version of the compact logo for the dark brown footer: same shapes (same transparency), cream ink.
  const { data: ink, info: inkInfo } = await sharp(compactPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < ink.length; i += 4) {
    ink[i] = 243;
    ink[i + 1] = 226;
    ink[i + 2] = 203;
  }
  const lightPng = await sharp(ink, { raw: { width: inkInfo.width, height: inkInfo.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(resolve(brandDir, 'logo-compact-light.png'), lightPng);

  const mark = await inkOnTransparent(MARK_BOX, paper, MARK_MASK);
  const markPng = await mark.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(resolve(brandDir, 'mark.png'), markPng);

  // Favicons / app icons: monogram on ivory.
  const i512 = await squareIcon(markPng, 512);
  const i192 = await squareIcon(markPng, 192);
  const i180 = await squareIcon(markPng, 180, 0.1);
  const i48 = await squareIcon(markPng, 48, 0.08);
  const i32 = await squareIcon(markPng, 32, 0.06);
  await writeFile(resolve(publicDir, 'icon-512.png'), i512);
  await writeFile(resolve(publicDir, 'icon-192.png'), i192);
  await writeFile(resolve(publicDir, 'apple-touch-icon.png'), i180);
  await writeFile(resolve(publicDir, 'favicon-32.png'), i32);
  await writeFile(resolve(publicDir, 'favicon.ico'), pngToIco(i48, 48));

  // Social share image 1200x630: logo centred on ivory with a fine gold frame.
  const W = 1200;
  const H = 630;
  const logoForOg = await sharp(logoPng).resize({ width: 760 }).toBuffer();
  const frame = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <rect x="28" y="28" width="${W - 56}" height="${H - 56}" fill="none" stroke="#b08d57" stroke-width="1.5"/>
       <rect x="38" y="38" width="${W - 76}" height="${H - 76}" fill="none" stroke="#b08d57" stroke-opacity=".45" stroke-width="1"/>
     </svg>`,
  );
  await sharp({ create: { width: W, height: H, channels: 3, background: IVORY } })
    .composite([
      { input: frame, left: 0, top: 0 },
      { input: logoForOg, gravity: 'centre' },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(resolve(publicDir, 'og-image.jpg'));

  console.log('Brand assets written to src/assets/brand and public/. Charcoal ref:', CHARCOAL);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
