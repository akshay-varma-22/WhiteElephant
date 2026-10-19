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
4. When *every* tile has `sample: false`, the “Sample images” note under the gallery disappears by itself. (To hide the note
   earlier, set `showPortfolioNotice: false` in `src/config/site.js` — we recommend keeping it until the gallery holds your
   own project photographs, so visitors are not led to think stock photos are completed projects.)
5. Delete the placeholder files you no longer use from `src/assets/photos/` and update `CREDITS.md`.

Only describe projects accurately. Do not add testimonials, ratings, awards or statistics unless they are real and you can
prove them.

**Hero photo and text:** the home-page background is `src/assets/photos/hero.webp`. To change it, put your image in that folder as
`hero.webp` (or `hero.jpg`/`hero.png` — but keep exactly **one** file named `hero.*`, so delete the old one). It works best as a **bright**
photograph, at least 2000 px wide, with a **plain, light wall on its left side**: the eyebrow line, headline, button and location are
written straight onto the photo (there is no overlay), exactly as in the studio's mobile design. Then update the `alt` text in
`src/components/Hero.jsx`, where all the hero wording lives. (The hero has no description paragraph at the owner's request; the wording
“From the first idea to the finishing touches, we create elegant, functional spaces…” was removed.)

**Key highlights (“15+ Years of Experience”, “400+ Projects Completed”, “100+ Happy Clients”, “8+ Team of Experts”):** the `HIGHLIGHTS`
list at the top of `src/components/Highlights.jsx`. **These figures were supplied with the studio's design and have not been checked by
anyone else — keep them true, and change them there as the numbers change.**

**Video intro:** the video in the picture card under the hero is `public/videos/interior-loop.mp4` (your “Interior Video”), with its still
picture `public/videos/interior-loop-poster.webp`. It plays by itself, silently, in a loop, with no play or pause button; it plays while it
is on screen and rests while it is not, and visitors who have asked their device for less motion (“reduce motion”) see the still picture
instead. The words you see in the video (“Thoughtful Spaces for Every Story”, “To desing”, “Spaces that feels like you” and so on) are part
of the video itself, not text on the website, so the site cannot correct them. **Two of them look like typos (“To desing” and “Spaces that
feels like you”); to fix them, edit your original video and send me the new file.**

To change the clip, replace both files (keep the names). The video must be **H.264 MP4 with no sound, with its “fast start” index at the front
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
“Get a Quote” buttons, opens the quotation popup (`src/components/quotation/`). The photo in the About arch is `portfolio-living` in `About.jsx`; the banner photo is `portfolio-bench` in
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

## 3. The quotation form (a popup)

The form is **not a section of the page**: it opens as a popup (a dimmed page with a card in the middle) when a visitor presses any
“Get a Quote” / “Get a Free Quotation” / “Free Quotation” button: the one in the header (and the phone menu), the one on the home
picture, the banner near the bottom, and the sticky bar on phones. The popup closes with the × button, the Escape key or a click on the
dimmed page; the page behind it does not scroll while it is open. Whatever a visitor has typed is kept if they close it by accident, and
after an enquiry has been sent it opens as a fresh form next time. An old link to `…/#quotation` still opens the popup.

The popup is kept short on purpose so that it does not need scrolling on a laptop or a phone: a title, one sentence, the three fields, the
button, one small line and “Let’s connect?” with the two phone numbers. (On a short screen the sentence under the title is left out, and
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

## 4. Business details

Phone numbers, email, domain and location live in **one** file, `shared/business.js`, and flow into the website, the
structured data for search engines, and the notification emails. Only put **verified** facts there. (Do not add a street
address, opening hours or ratings unless they are real; the site deliberately does not claim any.)

Changing the domain? Also search for `whiteelephantcreativestudio.com` in `index.html` (canonical
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
