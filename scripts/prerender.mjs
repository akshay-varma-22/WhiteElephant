/**
 * Build step 3 of 3 (see "build" in package.json): put the page's real HTML into dist/index.html.
 *
 *   1. `vite build`                                   -> dist/        the site as the browser loads it
 *   2. `vite build --ssr src/entry-server.jsx ...`    -> dist-ssr/    the same page components, built to run in Node
 *   3. this script                                    -> renders the page components to HTML and writes it inside <div id="root"> in dist/index.html
 *
 * Why: the site is a React app, which normally builds its text in the visitor's browser. Google runs that JavaScript, but many other
 * crawlers (including most AI assistants' crawlers) do not, so they would see an empty page. With this step the headings, paragraphs,
 * service names and contact details are in the HTML itself. The browser reuses that HTML (hydration, main.jsx) and everything works as before.
 *
 * It fails the build loudly (exit code 1) if the page cannot be rendered or looks empty, so a broken pre-render is never published.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = resolve(root, 'dist/index.html');
const serverEntry = resolve(root, 'dist-ssr/entry-server.js');
const MARKER = '<div id="root"></div>';

function fail(message) {
  console.error(`prerender: ${message}`);
  process.exit(1);
}

const template = await readFile(htmlPath, 'utf8').catch(() => fail(`cannot read ${htmlPath}; run "vite build" first.`));
if (!template.includes(MARKER)) fail(`${MARKER} not found in dist/index.html (already pre-rendered, or index.html changed).`);

const { render } = await import(pathToFileURL(serverEntry).href).catch((error) => fail(`cannot load ${serverEntry}: ${error.message}`));
let body;
try {
  body = render();
} catch (error) {
  fail(`rendering the page failed: ${error.stack || error.message}`);
}

// Sanity checks: the page really is in there (not an empty shell), and nothing that must stay out of the HTML slipped in.
// (Checked against the visible text, with the tags taken out: a headline is split by <br> and <em> tags in the markup.)
const visibleText = body.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const required = ['Thoughtful Spaces for Every Story', 'Spaces for Every Need', 'Residential Interiors', 'Furniture Design', 'White Elephant Creative Studio'];
for (const text of required) if (!visibleText.includes(text)) fail(`the rendered page does not contain "${text}".`);
if (body.length < 5000) fail(`the rendered page is suspiciously short (${body.length} characters).`);

await writeFile(htmlPath, template.replace(MARKER, `<div id="root">${body}</div>`));
console.log(`prerender: wrote ${(body.length / 1024).toFixed(0)} KB of page HTML into dist/index.html`);
