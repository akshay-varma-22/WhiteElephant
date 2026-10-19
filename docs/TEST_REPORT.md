# Test report

Last run **17 October 2026** (first written 15 October) on Windows 11, Node 24, Vite 8, Vitest 5, Playwright 1.64 driving Microsoft Edge (Chromium).
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
| End-to-end: production build + real function handler + mock email provider, in Edge (72 desktop tests + 4 phone-emulation tests) | `npm run test:e2e` | **76 passed** (in the last full run; see the notes on two flaky tests below) |
| Production build | `npm run build` | passes (≈1 s) |
| Secret scan of the browser bundle | `npm run check:bundle` | passes — no `RESEND_API_KEY`, key patterns or server code in `dist/` |
| Total automated tests | | **263 passed, 0 failed** (187 unit/component/SMTP + 76 browser) |

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
  accounts), the extra sticky “Call us / Free quotation” bar on phones, the “Sample images” note under the projects, and minimum text sizes on
  phones. The page order is tested: Hero → Video intro → About → Key highlights → Services → Featured projects → Why choose us → Quote
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
* **Privacy page removed:** no page, link or sitemap entry remains (tested); the form keeps its short notice and a consent tick, and its
  component test checks there is no policy link.
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

* **Real email delivery** (scenario 16) and how the email renders in Gmail/Outlook/Apple Mail (it uses a conservative table layout; I viewed
  the HTML in a browser at phone width only).
* **A real Netlify deployment**, the Netlify platform rate-limit rule, the custom domain and HTTPS (needs your accounts and DNS).
* **Gmail itself:** the SMTP path is verified against a local SMTP server, not against smtp.gmail.com (that needs your credentials). Gmail’s
  own behaviour (spam placement, quotas, revoked app passwords) is described from Google’s documentation, not observed.
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
