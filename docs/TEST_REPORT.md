# Test report

Last run **21 October 2026** (first written 15 October) on Windows 11, Node 24, Vite 8, Vitest 5, Playwright 1.64 driving Microsoft Edge (Chromium).
All test data is synthetic; no real customer information is used or stored in this repository.

## Summary

The quotation form was simplified on 17 October 2026 to **three fields**: full name, mobile number and email. The email was optional at first
and was made **required** later the same day at the owner’s request; it is now a popup rather than a page section.
About 70 tests that covered the removed fields (services, project type, location, area, budget, description, preferred call date/time,
consent) were deleted with them, which is why the totals are lower than in earlier versions of this report.

| Suite | Command | Result |
| --- | --- | --- |
| Unit: validation (53), email templates (23), lead endpoint (38), Gmail/SMTP sender + provider selection (23) | `npm test` | **137 passed** |
| **Integration: real SMTP conversations** (lead handler → Nodemailer → a real SMTP server on localhost) (12) | `npm test` | **12 passed** |
| Component: the quotation form (34, including 4 for its use inside the popup) and the testimonials section (4) in jsdom | `npm test` | **38 passed** |
| Unit: the WhatsApp link (address, number, encoded message, exact multi-line wording) (6) | `npm test` | **6 passed** |
| Unit: `netlify.toml` (the old netlify.app address redirects to the studio domain; security headers; API never cached) (2) | `npm test` | **2 passed** |
| End-to-end: production build + real function handler + mock email provider, in Edge (112 desktop tests + 16 phone-emulation tests) | `npm run test:e2e` | **128 passed** (in the last full run; see the notes on two flaky tests below) |
| Production build (site, page built for Node, then pre-rendered into `dist/index.html`) | `npm run build` | passes (≈10 s) |
| Secret scan of the browser bundle | `npm run check:bundle` | passes — no `RESEND_API_KEY`, key patterns or server code in `dist/` |
| Total automated tests | | **323 passed, 0 failed** (195 unit/component/SMTP + 128 browser) |

## What is tested for the form

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Valid submission (name + mobile number + email) | ✅ pass | unit, endpoint, component, E2E (email captured with the subject “New Quotation Lead — Name — Number”, the name, number, the customer’s email and the received time) |
| 2 | **Required email** | ✅ pass | a missing email and a malformed one are both refused with their own message (browser form, popup, and the server API: a direct post with only a name and a number now gets a 400 naming just the email); a valid one is delivered and becomes the reply-to |
| 3 | Missing name | ✅ pass | client error summary + focus on the field; server rejects too; nothing sent |
| 4 | Missing or invalid mobile number | ✅ pass | 14 invalid shapes rejected; Indian formats (+91, 91, 0, spaces/hyphens) and international numbers accepted |
| 5 | All three fields are required, nothing else is asked | ✅ pass | an empty form reports the name, the number and the email; extra fields in a direct post are ignored and never reach the email |
| 6 | Network failure during submission | ✅ pass | request aborted in the browser → clear error, **all values kept**, no success; retry succeeds. Also: response lost *after* the server accepted the lead → retry does **not** create a second email (idempotency key) |
| 7 | Email provider failure | ✅ pass | provider 500/503 (one safe retry), 401/403/422/429, unreachable, and “not configured” all give an error and **never** a success message; form values kept |
| 8 | Duplicate-click prevention | ✅ pass | double-click and repeated form submits while in flight → exactly **one** request and **one** email; identical retries share an idempotency key |
| 9 | Spam protection | ✅ pass | honeypot silently dropped; per-IP rate limit; optional CAPTCHA; oversized / non-JSON / cross-site / non-POST requests rejected |
| 10 | Mobile form usability | ✅ pass (emulated) | Pixel 7 emulation in Edge: tap-only completion, touch targets ≥ 40 px, no horizontal overflow or clipped text at 360/412/820/1366/1920 px; also checked by eye at 450 px in the app’s browser. **Not tested on a physical phone.** |
| 11 | **Successful delivery to the actual business email** | ⚠️ **NOT PERFORMED** | Needs the owner’s Gmail App Password (or Resend key), which I do not have (and must not invent). Everything up to the mail service is proven: against a mock Resend, and against a real SMTP server over TCP for the Gmail path. **To close this gap, run `npm run send-test-lead -- --direct` with your credentials** ([DEPLOYMENT.md §3](DEPLOYMENT.md#3-prove-email-delivery-before-deploying-you)), then confirm the email arrived. |

## Other checks that were run

* **Security / privacy:** secret scan of the build; server logs verified free of names, phones, emails, message text and API keys; HTML in
  every field is escaped in the email; CR/LF header-injection attempts rejected; hostile JSON (`{"name":{"toString":1}}`) handled without a
  crash (this test found and fixed a real bug); body-size limit; cross-origin POST rejected; non-POST rejected; honeypot silently drops
  bots without sending email; per-IP rate limit; CAPTCHA required/verified when configured; no `localStorage`/cookies written by the form;
  `.gitignore` verified to exclude `.env`, `.env.*` and `dist` while keeping `.env.example`.
* **Accessibility (automated, axe-core, WCAG 2.0/2.1 A + AA):** no serious or critical violations on the home page, nor on the form while it is showing
  validation errors (earlier versions of this check found and fixed a low-contrast number and an `aria-controls` that pointed at a missing
  element). Keyboard-only completion of the whole form passes; focus indicators visible; one `<h1>`; every image has
  alt text; `lang="en-IN"`.
* **Gmail SMTP path (real protocol):** AUTH with the app password (spaces stripped), correct From/To/Reply-To/Message-ID, UTF-8
  (Śrīnivās, ₹, Hindi/Telugu) intact, HTML escaped, several recipients, optional customer acknowledgement, duplicate retries deliver once,
  wrong password / refused recipient / unreachable server / missing password all give an error (never success), and logs contain no password,
  names, phone numbers or email addresses. `npm run send-test-lead` was exercised against a local SMTP server for success, wrong-password and
  missing-config cases. **What this cannot prove:** that Google accepts *your* app password.
* **Preview mode:** when the site runs against the local fake mailbox, the server flags it and the success screen shows a visible
  “Preview mode — no real email was sent” notice (so a local test is never mistaken for real delivery); no notice appears for real delivery.
* **Content integrity:** the structured data contains no ratings, reviews, hours, geo-coordinates, price range or street address; business
  details match the supplied card; every image loads; no console errors or failed requests.
* **Home page brightness and readability** (the owner found an earlier home page "too dark"; the page now follows the owner's own mobile
  designs, with the text written straight onto the owner's sunlit photo and no overlay). Measured on the real rendered pixels at 360, 390,
  820, 1024, 1366 and 1920 px (and checked by a script at 320, 375, 412, 450 and 600 px): the hero's mean brightness is **about 0.44–0.46**
  (the first, dark version measured **0.18**). The automated threshold is **0.38**; it was 0.45 for an earlier design that had a cream wash
  over the photo — I lowered it for this design because the photo's wood slats, sofa and table are dark, and 0.38 is still twice the dark
  version. Text contrast is measured per line against the pixels behind it (worst-case pixel, text hidden, the cream halo around the small
  hero lines left in place because the visitor sees it): every line — eyebrow, headline, location — is at least 15%
  above the AA minimum at all those sizes, the primary-button label is above 7:1, and the brown areas (footer, buttons, service badges,
  process circles) keep cream/white text above 4.5:1. The map-pin icon beside the location is a decorative graphic (needs 3:1, not text
  contrast) and is measured separately by eye. (The hero's description paragraph, which the owner added and later removed, had first failed
  this check on phones and tablets because it ran over the plant and sofa in the photo; the photo shift and stronger halo from that fix
  remain.) A mutation check on the current hero — a dark overlay temporarily laid over it — made the guard **fail at all six sizes**, and the
  overlay was then removed.
* **Layout:** an element-level check found and fixed text clipped at the edge on a 375 px phone (the hero tagline), which the page-level
  overflow check alone could not see. The page was compared section by section with the owner's two mobile designs at 450 px wide, by eye on
  rendered images (not a pixel-diff score): the first mock for the hero/services, then the 12-section sheet for the whole page. Hero text,
  buttons, cards, headings and spacing line up to within a few percent. Differences that remain on purpose or by necessity: the photographs
  (placeholders, not the mock's pictures), the client testimonial (not shown, see below), the social-media icons in the footer (no real
  accounts), the extra sticky “Call us / Free quotation” bar on phones, and minimum text sizes on phones. The page order is tested: Hero → Video intro → About → Key highlights → Services → Featured projects → Why choose us → Quote
  banner → Process → Contact → Footer (the quotation form is a popup, not a section: see the next item).
* **Quotation popup** (17 Oct 2026, tried at the owner's request and then kept by the owner): tested in Edge
  and looked at in the app's browser on desktop and a 375 px phone. Every “Get a Quote” button opens it (header, phone menu, home picture,
  banner, sticky phone bar; the phone ones are tapped in the phone-emulation tests); it closes with ×, Escape and a click outside, and
  focus returns to the button that opened it; the page behind does not scroll while it is open (a mutation check, with that rule removed,
  made the test fail); typed values survive an accidental close, an untouched form comes back without a stale error, and a sent enquiry
  comes back as a fresh form; an old `#quotation` link opens it; on a phone it fits the screen, the keyboard stays down until a field is
  tapped, and every control is at least 40 px tall; axe finds no serious or critical problem in it, empty or showing errors; keyboard-only
  opening, filling and sending works. The earlier form tests (delivery, validation, failures, duplicates) all run inside the popup.
  The popup was then trimmed so that it does not scroll (title, one sentence, three fields, button, one small line, “Let’s connect?” and the
  two numbers): its height was measured in the app's browser and in six automated screen sizes (laptop windows of 640 and 660 px high, a
  1920 × 1000 monitor, and phones 360 × 640, 390 × 664 and 412 × 915), and none of them needs scrolling; when every field is wrong the error
  summary shows one short line (the full list stays for screen readers) so the popup still fits a 862 px-high window. On a very short
  phone (320 × 568) it still scrolls inside itself.
  Each empty field shows a prompt (“Please enter your name”, “Please enter your mobile number”, “Please enter your email”): tested to be
  there, to disappear when typing starts, to have at least 4.5:1 contrast against the white field (the old prompt colour was lighter and
  was darkened), and to fit inside its field in full at 320, 360, 390, 768 and 1280 px wide. The longest one, the mobile-number prompt, was
  cut off at 320 px until the padding and prompt size were reduced there (a mutation check with that fix switched off made the test fail).
  Not tested: other browsers (Safari/Firefox), a physical phone.
* **Testimonials:** the section is built (carousel with arrows and dots, 4 component tests) but **hidden while `src/data/testimonials.js` is
  empty**, which it is on purpose: the design's example quote and named client were not published because no real client has given one.
* **Video intro** (tested in Edge, and looked at in the app's browser on a desktop and a 375 px phone): the new clip and its poster are served
  and the old clip is gone; the video is muted and set to loop, has no controls, and the card has no button, caption or duration; it
  starts by itself and keeps moving; from half a second before its end it carries on from the start (looped) instead of stopping; it
  pauses when scrolled off screen and resumes when it returns; with “reduce motion” switched on it stays on its first frame. The card has the
  clip's own shape (1028 × 544) so the words in the video are not cut off. The video as supplied had a black, rounded frame baked into its
  edges (solid for about 10 px, fading out over about 25 px), so it was measured on ten frames and cropped off in the file (26 px left and
  right, 22 px top, 18 px bottom); a contact sheet of the result shows no black edge and all the words intact. Not tested: other browsers (Safari/Firefox), a slow mobile
  connection, a phone in low-power mode (where the browser may refuse to autoplay; touching the video then starts it), or a physical phone.
  The clip is under 1 MB (converted from the 19 MB original, which was HEVC).
  **Spelling fix in the video (18 Oct 2026):** the burned-in “TO DESING” was repainted as “TO DESIGN” on the 90 frames where it shows
  (5.93 s to 8.9 s), by swapping the two last letters N and G in the video's own typeface (`scripts/video-edit/`). Checked, but **by eye and
  by measurement, not by an automated test**: the corrected frames at 6.5, 7.5 and 8.5 s were compared side by side with the old ones and
  read “TO DESIGN” with the same letter shape, colour and spacing; the frames just before (5.9 s) and after (8.95 s) the word are
  unchanged; the end logo card was left alone; the repainted area changes from frame to frame no more than the original does (largest
  jump 1.7 against 2.0 grey levels; a first version with per-frame letter positions had visible one-pixel jumps in 6 frames and was
  fixed by fixing the positions); and the saved script reproduces the installed file byte for byte. The unedited pipeline matches the
  earlier encode of the same video (PSNR 41.8 dB, colours the same). **Not fixed:** “Spaces that feels like you.” in the fourth scene.
* **The small footer** (18 Oct 2026, at the owner's request; tested at 320, 360, 390, 412, 700, 1024 and 1280/1920 px and on the phone
  emulation, and looked at in the app's browser): the footer is only the logo with “© 2026 White Elephant Creative Studio. All rights
  reserved.” beside it, the two together in the middle. Tested: the footer's text is exactly that line (no tagline, “Quick Links”, menu,
  heading, up button or outside link), the logo is on the left and the text on its right with a visible gap and level with each other,
  the space left of the logo equals the space right of the text (within 6 px) at every width, the text is two lines on a phone (three
  below 360 px, one from tablet size up), the footer is under 110 px high on a phone, nothing is under it (there used to be an 88 px empty
  band, reserved for the sticky call bar; the bar now slides away while the footer is on screen), and there is no sideways scrolling.
  A mutation check with that old band put back made the test fail (88 px).
* **Services cards:** six cards, none of them a link or button (tested: clicking one does not move the page). **Featured projects:** three
  cards first, filters, “View all projects” / “Show fewer”, and the lightbox are tested; the image cards carry no arrow or other icon in their
  corner (tested with three cards and with all eleven showing).
* **Content changes of 21 Oct 2026** (made at the owner's request, run through the suites above, and looked at in the app's browser):
  the key figures read 15+ Years, **500+** Projects Completed, **400+** Happy Clients, **150+** Team of Experts (tested); the Furniture card
  says exactly “Customised and personalised furnishing.” with no list of ready-made pieces, and the Architecture and Furniture cards showed
  their own pictures, stills from the owner's video (tested by file name; **later replaced, see the next item**);
  the “Timber side table” project is gone (tested: no “side table” in any title or picture description) and the third featured card is now
  **“Personalised furnishing”**, a wooden work desk (tested: title, picture and description; the Furniture filter lists it, the bench and
  the chest; “View all” shows 11); and the “Sample images.” note with its description at the end of Featured work is switched off
  (tested: no note, none of its words) — so nothing on the page now says the project pictures are stock photos.
* **The three service pictures were replaced afterwards with the owner's own images** (Residential Interiors, Architecture, Furniture
  Design; `service-residential.jpg`, `service-architecture.jpg`, `service-furniture.jpg`). Looked at in the app's browser on a desktop and a
  390 px phone (the whole image fits the arch; Architecture is lined up from the bottom, Furniture from near the top, so the model and the
  sideboard are in view), and the services test now checks the three file names. The full suites were run after this change: 187 unit/component
  tests and 76 browser tests all passed, and the secret scan was clean (the counts above are from that run).
* **WhatsApp buttons** (21 Oct 2026, owner's request; a frameless brown WhatsApp logo in the header, beside the two numbers in the popup and
  between “Call us” and “Free Quotation” in the sticky phone bar; each opens `https://wa.me/917672020294?text=…`). Unit tests check the
  address (digits only, number is one of the studio's two published numbers, message encoded, no characters that could break the link).
  Browser tests check, in each of the three places: the link, new tab and `noopener`, the accessible name, that it is the site's brown
  with no circle, border or fill, and the position (left of “Get a Quote”; right of the numbers on the same row; between the two bar
  buttons); that tapping it opens a new tab on that exact address while **WhatsApp itself is never contacted** (the test intercepts
  `wa.me`), the page stays where it was, and the popup does not open from the logo. Layout is checked at 700/1024/1920 px (header),
  320–1280 px (popup row: one row from 600 px; on a phone the label and the logo share a row and the numbers sit under them, everything
  inside the popup, popup still needs no scrolling) and, in phone emulation, 320–412 px (header: logo, WhatsApp, Get a Quote and the
  menu button all on screen; sticky bar: all three parts inside the screen and none cut off). On a computer screen the bar does not exist.
  Found and fixed while testing: the header overflowed the screen on 320–390 px phones when the icon was added (gaps and logo size reduced;
  extra rules below 360 px), and the popup's phone row wrapped the icon onto its own line (popup widened, spacing tightened); one old test
  that counted every link in the popup's “Let’s connect?” row now counts only the phone numbers. **Not tested:** the real WhatsApp app or
  WhatsApp Web (no message was sent to the number), and a physical phone.
* **The Furniture Design card picture was replaced again** (21 Oct 2026, with the owner's newer `Furniture.jpeg`: a sculpted feature wall, curved
  sofa and green armchair; 544 × 1024, so a little softer than the other two on large screens; it is never enlarged: the site serves 480 and
  544 px versions). Looked at in the app's browser at 390 px and 1280 px (the leaf wall art, sofa and armchair all show in the arch); the services
  test still checks the file name. The full suites were run after this change (see the counts above).
* **Commercial Interiors, False Ceiling and Renovation & Remodeling pictures, and the phone-bar divider** (21 Oct 2026, owner's requests): the three cards now
  show the owner's own images (`service-commercial.jpg`, `service-false-ceiling.jpg`, `service-renovation.jpg`; the old stock photos stay in use by the
  projects). Each fills its arch completely, framed by `position` in `src/data/services.js`. Eight browser tests (False Ceiling and Renovation at
  390/768/1280/1920 px) check the right file, one picture per card, `cover` fit, no blur or zoom, and that the important part is inside the arch (the lit
  ceiling; nearly all three Renovation panels). The False Ceiling picture was replaced several more times by the owner on the same day; the current one is `False Ceiling.jpeg` (902 × 1600, a bedroom with a recessed tray ceiling, grey panelled walls and a blue bed; no logo or watermark seen), framed from the top by the same tests (the owner is responsible for the right to use it). **A “zoom out so the whole picture shows, with a blurred fill” version was tried the same day and the owner
  rejected it (“I didn't like the blurred corners”); it was removed, and its tests with it.** The earlier False Ceiling picture with another firm's logo is no
  longer used. In the phone bar, a fine 1 px brown line now sits between “Call us” and the WhatsApp logo: tested to be centred up and down, at least 12 px short
  of the top and bottom edges, fading at both ends, ignoring taps, and midway (within 2 px) between the end of “Call us” and the logo at 320/360/375/390/412 px;
  the bar still fits all three parts with nothing cut off. Looked at in the app's browser at 390 px and 1280 px.
* **Own domain and search data** (21 Oct 2026): the site now lives at `https://www.whiteelephantcreativestudio.in` (GoDaddy domain, Netlify DNS, Let's Encrypt
  certificate, HTTPS forced). Checked live: `https` www → 200; `http` → `https`; the bare domain → `www`; the old `…netlify.app` address → `www` (301); robots.txt and
  the sitemap name only the `www` address; the quotation endpoint accepts the `www` origin and refuses others (tested with a payload that sends nothing). Search data: the
  page title, a description naming “White Elephant Creative Studio (White Elephant Interiors)”, a robots meta, and two structured-data blocks (LocalBusiness and WebSite, both with
  the other names “White Elephant Interiors” and “White Elephant”, Hyderabad as the area served, no reviews/ratings/hours/address/social links) — tested in the browser; the
  `netlify.toml` redirect is tested in a unit test. **Not tested:** whether or when Google shows the site (it is not indexed yet; that depends on Google).
* **Phone header** (21 Oct 2026, owner's request): below 768 px wide the WhatsApp logo is no longer in the top bar (the sticky bottom bar has it), and “Get a Quote”
  there is about 10% smaller (32 px high at 390 px, was 35; 9.6 px label, was 9.9). Tests: at 320–412 px in phone emulation the header holds just the logo, the compact
  button (30–33.5 px high, padding ≤ 22 px, label ≥ 9 px) and the menu button, with no WhatsApp link in the header and nothing off-screen; at 640/700/767 px the header has no
  WhatsApp logo and the bottom bar does; at 768/1024/1920 px the header still has the logo, in order beside “Get a Quote”. Looked at in the app's browser at 390 px.
* **Pre-rendered page (readable without JavaScript)** (22 Oct 2026, so search and AI crawlers that do not run JavaScript can read the site): every build now writes
  the whole page's HTML into `dist/index.html` (about 41 KB, 500 words, one `h1`, 8 `h2`, 17 `h3`, 14 pictures, the six services, both phone numbers, the email) and the browser
  takes it over. Three browser tests: (1) the HTML the server sends, fetched without running any script, contains the headline, headings, services, contact details,
  footer and both structured-data blocks, and every picture it names exists; (2) in a browser with JavaScript switched off the headline, six service cards, contact link
  and footer are visible; (3) with JavaScript on, start-up produces no console errors or warnings (in particular no “page does not match” messages), throws away at most 1
  page node (0 when healthy; a mutation check that rebuilt the page instead of reusing it gave 8, and the test failed), keeps all six cards, and the quote popup still opens.
  The whole existing suite (including the accessibility scan, the readable-text and layout checks) also passes against the pre-rendered build. **Not tested:** what
  ChatGPT, Gemini, Perplexity or Claude actually do with the site (that is up to them, and it takes weeks).
* **About section pictures** (22 Oct 2026, owner's request): the About arch now shows the owner's tall picture on phones and the owner's wide picture from 640 px wide up
  (a `<picture>` element; the pre-rendered HTML contains both). Six browser tests (390, 639, 640, 768, 1280, 1920 px) check which file the browser actually loaded
  (`about-mobile` below 640 px, `about-desktop` from 640 px, tested on both sides of the switch), that it fills the whole arch (`cover`), the arch shape (about 0.31 wide-to-tall on
  phones, 4:5 on wider screens), the framing, and the alt text; the raw-HTML test checks the picture source is in the built-in page. Looked at in the app's browser at 390 px and
  1280 px (the whole plant, its pot and the curtain show in both arches).
* **WhatsApp draft message and the hero location** (22 Oct 2026, owner's requests): the message that is already typed when someone taps a WhatsApp logo is now the owner's exact
  four-paragraph greeting. A unit test checks the exact text, the line breaks (`%0A%0A`) and the curly apostrophe (`%E2%80%99`) in the address, and that WhatsApp reads the
  same text back; the browser test checks that the new tab's address carries that exact message (WhatsApp itself is never contacted: the test intercepts `wa.me`). The line under the
  hero button, which said “Hyderabad, Telangana”, now says **INDIA** (`heroLocation` in `src/config/site.js`; the Contact card, the page title and the search-engine data
  still say Hyderabad), in bold, 4 px from the map pin (it was 6 px) and larger (text 13.6 px, was 10.9; pin 20.8 px high, was 16.8 on phones; 20.8 px text / 26.4 px pin on
  wider screens, was 16.8 / 20.8). Four browser tests (320, 390, 700, 1280 px) check the text, weight 600, the gap, the sizes, the alignment and that it stays on screen; the existing
  readable-text check still passes for it.
* **Privacy page removed:** no page, link or sitemap entry remains (tested); the form has a short, non-blocking note and no consent tick (tested
  in the browser and in the component tests, which also check there is no policy link).
* **Two real bugs found by the tests while making earlier changes, both fixed:** (1) the grey service descriptions on desktop were only about
  4.0:1 on the tan cards (AA needs 4.5:1) — now darker. (2) When a visitor typed an invalid call date and then clicked “Request free
  quotation”, the field's error message appeared at that moment, pushed the button down by 25 px, and the click was lost; the button now
  keeps focus where it is on mouse-down, so the first click counts.
* **Test-harness note:** the site scrolls smoothly for visitors; the browser tests switch that off (`openSite` in `tests/e2e/helpers.js`)
  because on the now longer page a click could land while the animation was still running (the trace showed this for one form test, which
  failed every time until the animation was switched off; it then passed repeatedly).
* **A second flaky test, honestly reported:** once on 18 Oct, in a full run started right after a code change, one unit/component test
  failed (its name was not captured because only the summary was kept). The same suite then passed in 5 repeated runs and in every later
  full run, so it was not reproduced or explained; it is probably a timing-sensitive test under load.
* **One flaky test, honestly reported:** in one of the full runs on 17 Oct the navigation test “desktop nav links … the active item
  updates” failed once (the “Projects” link did not get its highlight within 10 s). It passed 4 of 4 when repeated on its own and in the
  next full run, and it does not touch the popup or the form. The cause was not found; it is probably the page shifting while lazy pictures
  above it load, which also moved the scroll position by about 400 px in another test that jumps straight to a section.

## Not tested — please be aware

* **How the email renders** in Gmail/Outlook/Apple Mail (it uses a conservative table layout; I viewed the HTML in a browser at phone width
  only). *Real delivery itself is no longer in this list: on 21 Oct 2026 a labelled test lead (reference WE-CE697A) was sent from the live site through
  Gmail and the owner confirmed it reached the lead inbox.*
* **A real Netlify deployment**, the Netlify platform rate-limit rule, the custom domain and HTTPS (needs your accounts and DNS).
* **Gmail's longer-term behaviour:** one live test through smtp.gmail.com succeeded on 21 Oct 2026, but spam placement over time, daily quotas and
  revoked app passwords are described from Google’s documentation, not observed.
* **The real Cloudflare Turnstile widget** (the server check is tested with a stub; Cloudflare publishes dummy keys you can use to try it).
* **Browsers other than Chromium (Edge)** — Safari and Firefox were not run; **screen readers** (NVDA, VoiceOver) were not run; **Lighthouse**
  performance scores were not measured. Automated accessibility tools find only part of real-world problems.
* The mock mail server imitates Resend’s documented behaviour (bearer auth, `Idempotency-Key`, error shapes) but is not Resend; exact
  production error bodies could differ slightly.

## Re-running

```bash
npm install
npm test                 # 182 unit, component and SMTP tests
npm run test:e2e         # 49 browser tests (builds the site, starts a mock mailbox, uses installed Edge)
npm run verify           # tests + build + bundle scan
```
`PW_CHANNEL=chrome npm run test:e2e` uses Chrome instead of Edge; `PW_CHANNEL= npm run test:e2e` uses Playwright’s own Chromium
(run `npx playwright install chromium` first).
