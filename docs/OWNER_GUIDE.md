# Owner guide — editing the site

Everything below is a small edit to a plain text file. After any change, preview it and check the build:

```bash
npm run dev:mock     # live preview with a fake email provider
npm run verify       # tests + production build + secret scan (run before every deploy)
```

If you use Git/Netlify auto-deploy, committing and pushing the change redeploys the site.

## 1. Replace the placeholder photos with real project photographs

The photos currently on the site are **stock placeholders** (credits in `src/assets/photos/CREDITS.md`). A one-line note
under the featured projects says they are placeholders so visitors are not misled. Replace them as soon as you have real
photographs.

**Featured projects (portfolio)**

1. Copy your photos into `src/assets/photos/`. JPG, PNG or WebP; ideally **at least 1800 px on the long side** and under
   ~2 MB each. The build automatically creates small, medium and large WebP versions, so you do not need to resize them.
   Use plain file names without spaces, e.g. `kondapur-living-room.jpg`.
2. Open `src/data/portfolio.js`. For each tile change:
   * `photo` → the file name **without** the extension (`'kondapur-living-room'`)
   * `title` and `caption` → short, factual text about the project
   * `alt` → one sentence describing what the photo shows (for screen readers and search engines)
   * `category` → one of `Residential`, `Commercial`, `Furniture`, `Renovation` (add more names to `PORTFOLIO_CATEGORIES`
     at the top of the file to create new filter buttons)
   * **`sample: false`** → marks the tile as a real project
3. To add a tile, copy an entry and give it a new unique `id`. To remove one, delete its entry. The page first shows three projects (one large, two small: `FEATURED_IDS` at the top of `src/components/Portfolio.jsx`, or the first three of a chosen category); “View all projects” shows the rest.
4. The “Sample images.” note (with its description) at the end of the gallery is **switched off** since 21 Oct 2026, at the owner's
   request: `showPortfolioNotice` is `false` in `src/config/site.js`. Set it to `true` to show it again (it then shows only while some
   tile still has `sample: true`, and disappears by itself once every tile is `sample: false`). While the gallery holds stock photos, the
   page itself no longer says so, so visitors may take them for completed studio projects: replace them with your own project
   photographs as soon as you have them.
5. Delete the placeholder files you no longer use from `src/assets/photos/` and update `CREDITS.md`.

Only describe projects accurately. Do not add testimonials, ratings, awards or statistics unless they are real and you can
prove them.

**Hero photo and text:** the home-page background is `src/assets/photos/hero.webp`. To change it, put your image in that folder as
`hero.webp` (or `hero.jpg`/`hero.png` — but keep exactly **one** file named `hero.*`, so delete the old one). It works best as a **bright**
photograph, at least 2000 px wide, with a **plain, light wall on its left side**: the eyebrow line, headline, button and location are
written straight onto the photo (there is no overlay), exactly as in the studio's mobile design. Then update the `alt` text in
`src/components/Hero.jsx`, where all the hero wording lives. (The hero has no description paragraph at the owner's request; the wording
“From the first idea to the finishing touches, we create elegant, functional spaces…” was removed.)

**Key highlights (“15+ Years of Experience”, “500+ Projects Completed”, “400+ Happy Clients”, “150+ Team of Experts”; the last three were
changed on 21 Oct 2026 at the owner's request):** the `HIGHLIGHTS`
list at the top of `src/components/Highlights.jsx`. **These figures were supplied with the studio's design and have not been checked by
anyone else — keep them true, and change them there as the numbers change.**

**Video intro:** the video in the picture card under the hero is `public/videos/interior-loop.mp4` (your “Interior Video”), with its still
picture `public/videos/interior-loop-poster.webp`. It plays by itself, silently, in a loop, with no play or pause button; it plays while it
is on screen and rests while it is not, and visitors who have asked their device for less motion (“reduce motion”) see the still picture
instead. The words you see in the video (“Thoughtful Spaces for Every Story”, “To design”, “Spaces that feels like you” and so on) are part
of the video itself, not text on the website, so they cannot be changed in the page's code. **“To desing” was a misspelling in your
original video; on 18 Oct 2026 it was repainted as “To design” in the website's copy of the video (your original file is untouched).**
**One more looks like a mistake and is still there: “Spaces that feels like you” (it should be “feel”); it can be repainted the same
way, just ask.** How the website's video is made from your original, and how to repeat it, is in `scripts/video-edit/README.md`.

To change the clip, replace both files (keep the names) **and raise the `VIDEO_VERSION` number at the top of
`src/components/VideoIntro.jsx` by one**: the files are cached by browsers for a week, and the new number is what makes every visitor
(and you) get the new video at once instead of the old copy. The video must be **H.264 MP4 with no sound, with its “fast start” index at the front
(`-movflags +faststart`), ideally under about 5 MB** — a video straight from a phone or an editor is often HEVC (H.265), which many browsers
cannot play, so convert it first, for example with `ffmpeg -i in.mp4 -an -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart
interior-loop.mp4`. The still picture should be the video's first frame. The site's card has the same shape as the current video (1028 × 544; your original was 1080 × 584, with a black frame around its edges that was cropped off);
a video with a very different shape will be cropped. The text describing it for screen readers is the `aria-label` in `VideoIntro.jsx` —
update it if you change the clip. (The original 19 MB `Interior Video.MP4` is kept in the project folder for reference only; it is not
published.)

**Testimonials (“What our clients say”):** hidden on purpose until you have real ones. To show the section, add testimonials that real
clients have agreed to publish to `src/data/testimonials.js` (the instructions and format are in that file). Never write one yourself or use
a made-up person.

**About, Why choose us, Process, Contact, footer:** the wording is in `About.jsx`, `WhyUs.jsx`, `Process.jsx`, `Contact.jsx` and
`Footer.jsx` in `src/components/`. The quote banner (“Get a Free Quotation”) is `CtaBanner.jsx`; its button, like the other
“Get a Quote” buttons, opens the quotation popup (`src/components/quotation/`). The About arch has **two pictures of one room that you supplied on 22 Oct 2026**: `about-mobile.jpg` (tall, for phones) and `about-desktop.jpg` (wide, from 640 px wide up), both in `src/assets/photos` and set in `About.jsx` (your originals, `About white elephant mobile.jpeg` and `About white elephant dessktop.jpeg`, stay in the project folder, unpublished); the `object-position` lines in `src/index.css` (`.about-img`) choose which part of each shows in the arch; the banner photo is `portfolio-bench` in
`CtaBanner.jsx`. **The footer is deliberately small** (changed on 18 Oct 2026 at the owner's request): just the logo with the line
“© 2026 White Elephant Creative Studio. All rights reserved.” beside it, the two together in the middle, on every screen size. The tagline,
the “Quick Links” list, the round “up” button and the spare room under the copyright line are gone (the year updates by itself). It is
`Footer.jsx`; the look is the `.footer-*` rules in `src/index.css`. (On phones the sticky call bar slides away while the footer is on
screen.) The footer has no social-media icons because no real accounts were supplied; to add them, give the links and I (or a
developer) can add the icons.

**Colours:** the page colours were taken from the studio's mobile design and are defined at the top of `src/index.css`
(`--color-header` header cream, `--color-page` page cream, `--color-panel` panel cream, `--color-label` service name panels,
`--color-copper` the brown of the buttons and badges, `--color-footer` the dark footer, `--color-ink` / `--color-ink-soft` text). Change them there. The automated tests check that the
hero stays bright and that its text stays readable against the photo behind it, so a change that makes the page hard to read is caught by
`npm run test:e2e`.

**Layout:** on phones everything is sized in proportion to the screen width (`--u` = 1/900 of the width), so the page keeps the shape of
the design on every phone; text has a minimum size so it stays readable on small screens. From 640 px wide (tablets) and 1024 px (desktops)
the same arrangement is used with fixed, comfortable sizes and the page navigation appears in the header.

## 2. Edit services

* **Cards on the page (“Spaces for Every Need”):** `src/data/services.js` — six cards, three across, in the order listed. Change `title`, `lines`
  (the same name split over two lines, as shown on the card), `description` (shown on desktop screens), the icon (any name from
  https://lucide.dev, imported at the top of the file), and the `photo` (a file in `src/assets/photos`; `position` and `zoom` choose which
  part of the photo shows inside the arch). The cards are for information only: they do not link or scroll anywhere. Keep the number a
  multiple of three so the rows stay even.
The quotation form no longer has a list of services to tick (see section 3), so changing the cards above changes only the page.
* **Furniture** is described, in the owner's words (21 Oct 2026), as “Customised and personalised furnishing.”: made-to-measure work, not a
  list of ready-made pieces (sofas, dining sets, tables, chairs, work desks, beds, side tables, centre tables). The “Timber side table” was
  removed from the featured projects for the same reason. In its place (the second small card under the big one) there is now
  “Personalised furnishing”, a wooden work desk (`portfolio-work-desk.jpg`, chosen by you from ten free photos): the three featured projects are
  the living room, the workspace and Personalised furnishing. The Furniture filter shows it first, then the sculpted timber bench and the
  carved timber chest.
* **All six card pictures are your own images** (supplied on 21 Oct 2026): `service-residential.jpg`, `service-commercial.jpg`,
  `service-architecture.jpg`, `service-false-ceiling.jpg`, `service-furniture.jpg` and `service-renovation.jpg` in `src/assets/photos` (your
  originals, with the names you gave them, stay in the project folder and are not published). Each picture fills its arch completely (no gaps,
  bars or blur). Most are taller than the arch, so `position` in `src/data/services.js` chooses which part shows (Architecture is lined up from the bottom to
  skip its empty dark top; False Ceiling from the top so the whole lit ceiling shows (your newest picture, a bedroom with a recessed tray ceiling, grey panelled walls and a blue bed; please confirm you may use it, see `src/assets/photos/CREDITS.md`); Furniture and Residential on the sofa area; Renovation on the middle, which shows
  nearly all three before/during/after panels). A picture in the arch's own proportions (portrait 317 : 415, about 3 : 4) would show completely. To change a
  picture, replace the file (keep the name) or point `photo` at another file, as in section 1.

## 3. The quotation form (a popup)

The form is **not a section of the page**: it opens as a popup (a dimmed page with a card in the middle) when a visitor presses any
“Get a Quote” / “Get a Free Quotation” / “Free Quotation” button: the one in the header (and the phone menu), the one on the home
picture, the banner near the bottom, and the sticky bar on phones. The popup closes with the × button, the Escape key or a click on the
dimmed page; the page behind it does not scroll while it is open. Whatever a visitor has typed is kept if they close it by accident, and
after an enquiry has been sent it opens as a fresh form next time. An old link to `…/#quotation` still opens the popup.

The popup is kept short on purpose so that it does not need scrolling on a laptop or a phone: a title, one sentence, the three fields, the
button, one small line and “Let’s connect?” with the two phone numbers and the WhatsApp logo. (On a short screen the sentence under the title is left out, and
the hint under the mobile number is hidden; a wrong number still gets its full explanation.)

The form asks for three things only, and **all three are required**:

| Field | Required? | Notes |
| --- | --- | --- |
| Full name | **Yes** | Letters, spaces, full stops, hyphens and apostrophes (any language); no digits. |
| Mobile number | **Yes** | Indian mobiles (with or without +91) and international numbers with a country code. |
| Email address | **Yes** (since 17 Oct 2026, at the owner’s request) | Must look like a real address. It becomes the reply-to of the lead email, so replying to the lead reaches the customer. |

Each empty field shows a prompt inside it: “Please enter your name”, “Please enter your mobile number” and “Please enter your email” (the
`placeholder` of each field in `src/components/quotation/QuotationForm.jsx`). The prompt disappears as soon as the visitor types, and every
field still keeps its label above it.

Each submission is emailed to the studio inbox with the subject “New Quotation Lead — Name — Number”, the name, number, email, the time it
was received (IST) and a reference. There is no consent tick any more; under the button a short, non-blocking line says “We’ll only use your
details to contact you about your enquiry.” (it is the last paragraph in `src/components/quotation/QuotationForm.jsx`).

Where things are:

* The form itself: `src/components/quotation/QuotationForm.jsx`; the popup around it (its heading, the sentence under it and the “Let’s
  connect?” phone numbers) is `src/components/quotation/QuoteDialog.jsx`, and its look is the `.quote-*` rules in `src/index.css`.
* The rules (what counts as a valid name, number and email) and the length limits: `shared/quotation-validation.js` and
  `shared/quotation-options.js`. The browser form and the server use the same files, so they always agree.
* The email that arrives: `server/email-template.js`.

To **add a field again** later (for example a project description), it has to be added in four places: the form, the validator, the email
template and the tests. Ask for it and it can be done in one go.

### WhatsApp buttons (added 21 Oct 2026)

The same frameless brown WhatsApp logo (it follows the site's brown, not WhatsApp green) appears in **three** places, and each one opens a
WhatsApp chat with the studio in a new tab, with a message already typed that the visitor only has to send:

* in the **header**, to the left of “Get a Quote”, from tablet width (768 px) up. **On phones the header does not show it** (changed 21 Oct 2026 at your
  request: the bottom bar has it, and “Get a Quote” in the phone header is about 10% smaller);
* in the **quotation popup**, after the two phone numbers (one logo for both numbers, not one per number);
* in the **sticky bar at the bottom on phones**, between “Call us” and “Free Quotation”, with a fine brown divider line between “Call us” and the logo
  (centred, short of the top and bottom of the bar; the `.cta-bar-wa` rule in `src/index.css`). That bar only exists on phones and slides away over
  the quote banner, the contact section and the footer.

The chat goes to **+91 76720 20294** (`whatsapp` in `shared/business.js`; it is one of the two numbers already on the site). The typed
message is `whatsappMessage` in `src/config/site.js`: since 22 Oct 2026 it is your four-paragraph greeting (“Hello White Elephant Creative Studio, … I’m interested in
your interior design services and would appreciate it if you could share more details about your offerings. … I look forward to hearing from you. … Thank you!”), with the
blank lines kept (`
` is a line break in that file); change either line and all three logos follow. The link is `https://wa.me/917672020294?text=…`, WhatsApp's own
click-to-chat address: it opens the WhatsApp app on a phone and WhatsApp Web on a computer. Nothing is sent until the visitor presses
Send, and the website itself stores nothing. The code is `src/components/WhatsAppLink.jsx` and `src/lib/whatsapp.js`.

## 4. Business details

Phone numbers, email, domain and location live in **one** file, `shared/business.js`, and flow into the website, the
structured data for search engines, and the notification emails. Only put **verified** facts there. (Do not add a street
address, opening hours or ratings unless they are real; the site deliberately does not claim any.)

Changing the domain? Also search for `whiteelephantcreativestudio.in` in `index.html` (canonical
and social-sharing URLs).

Where leads go is a *server* setting, not code: see [DEPLOYMENT.md §8](DEPLOYMENT.md#8-change-where-leads-are-sent).

## 5. Logo, icons, colours, fonts

* The logo (`src/assets/brand/logo.png`) was cropped from the supplied business-card photo and its paper background made
  transparent; the artwork itself is untouched. If you have the **original logo files** (SVG or a large transparent PNG),
  replace `logo.png` (full logo) and `mark.png` (the “WE” monogram) with them for crisper results.
* `npm run brand` regenerates the favicon set and the social-sharing image (`public/`) from the business card; adapt
  `scripts/make-brand-assets.mjs` if you switch to new source files.
* Colours and fonts are defined once at the top of `src/index.css` (`@theme`).

## 6. Wording

Headlines and paragraphs are in the component files in `src/components/` (Hero, About, WhyUs, Contact, Footer) and
`src/components/quotation/QuoteDialog.jsx` (the popup's wording).
Keep claims factual and avoid promising turnaround times or guarantees the studio has not approved.

## 7. Privacy policy

The privacy-policy page was removed on 17 October 2026 at the owner's request. The form shows only a short note (no tick box). See [LEAD_DATA_MAP.md](LEAD_DATA_MAP.md) for where enquiries are stored. Whether a privacy notice is legally needed is a
question for the studio's lawyer.

## 8. Getting found on Google (“White Elephant”, “White Elephant Interiors”, “White Elephant Creative Studio”)

Nobody can promise a position on Google, and nobody can make **only** one website appear for a search: Google chooses the results. What the site
can do is make itself easy to recognise, and that is set up (21 Oct 2026):

* One public address, `https://www.whiteelephantcreativestudio.in` (the bare `.in` and the old `…netlify.app` address redirect to it; HTTPS is on).
* The page title “White Elephant Creative Studio | Interior Design in Hyderabad”, a description that names “White Elephant Creative Studio (White
  Elephant Interiors)”, a canonical address, a sitemap (`/sitemap.xml`) and a robots file; all built from `shared/business.js` and `index.html`.
* Search-engine data (`vite-plugins/seo.js`) that tells Google the business is called White Elephant Creative Studio, also written **White Elephant
  Interiors** or **White Elephant** (`alternateNames` in `shared/business.js`), and that it works in Hyderabad. Only verified facts: no reviews, ratings,
  hours, street address or social links are claimed.

**The page's text is in the HTML itself (22 Oct 2026).** The site is a React app, which normally builds its text in the visitor's browser; many crawlers,
including most AI assistants' crawlers, do not run that JavaScript and would have seen an empty page. So every build now renders the whole page to HTML in
advance (`npm run build` → `scripts/prerender.mjs`, using `src/entry-server.jsx`) and the browser then takes that HTML over (`src/main.jsx`). Visitors see no
difference. Things to know: (1) if you or a developer add a component that touches `window`, `document` or the screen size **while rendering** (outside
`useEffect` or an event handler), the build stops with an error instead of publishing a broken page, so move that code into `useEffect`; (2) `npm run dev`
shows the page built in the browser, as before; the pre-rendered HTML only exists in `dist/` after a build; (3) a bare `index.html` still has an empty
`<div id="root"></div>`: that is the marker the build fills in.

What to expect, honestly: a brand-new website is not known to Google at first. It usually takes **days to a few weeks** to be found, and longer to
settle. **“White Elephant Creative Studio”** is a distinctive name and is realistic to rank first for. **“White Elephant Interiors”** should work too, but other
businesses may use similar names. **“White elephant” on its own** is also an everyday phrase (gift swaps, sayings, other companies) and cannot realistically be won.
Adding **Hyderabad** to a search (“white elephant interiors Hyderabad”) helps a lot.

The steps that make the biggest difference are yours, because they need your Google account and your business details:

1. **Google Search Console** (https://search.google.com/search-console): add the property `https://www.whiteelephantcreativestudio.in`, verify it (the DNS is
   in Netlify, so a TXT record added in *Netlify → Domains → DNS records* does it), submit `https://www.whiteelephantcreativestudio.in/sitemap.xml`, then use
   *URL inspection → Request indexing* on the home page.
2. **Google Business Profile** (https://business.google.com): create “White Elephant Creative Studio”, category *Interior designer*, your phone number and
   website; if you do not want to show an address, set it up as a business that serves customers at their locations (Hyderabad). This is what produces the box with
   your name, phone and website next to the search results, and it matters most for “white elephant interiors”.
3. **Profiles that link to the site**: Instagram, Facebook, LinkedIn and listings such as Justdial or Sulekha, all using exactly the same name, phone numbers and website. When
   you have the real links, ask for them to be added to the search-engine data (`sameAs`); they have not been added because none were supplied.
4. **Real project photos and wording** (sections 1 and 6) and, later, a page for each service, give Google more to show for searches such as “false ceiling designers in Hyderabad”.
