# Project status — what is done, and what needs you

_Last updated 21 October 2026. The latest version is live at **https://www.whiteelephantcreativestudio.in** (your own domain; the old netlify.app address redirects to it) (last deployed 21 Oct 2026, with your own pictures on all six service cards, the phone header without the WhatsApp icon and with a smaller “Get a Quote”, the search-engine improvements (see OWNER_GUIDE section 8), the WhatsApp buttons (header, quotation popup and the sticky phone bar), your newer Furniture picture, the new key figures, your own pictures on the Residential Interiors, Architecture and Furniture Design cards, the “Personalised furnishing” project, and the “Sample images” note removed; the video's “TO DESIGN” spelling fix went live on 19 Oct): the three required quotation fields in a popup with in-field prompts, the new looping video, the project images without arrows, and the small footer (just the logo with the copyright line beside it, centred). Checked on the live site at desktop and phone width: page order, popup, prompts, required email (the API refuses a post without one), video served with range requests, the footer, no console errors. **Email delivery is verified on the live site (21 Oct 2026):** the Gmail settings were saved in Netlify and the site redeployed; one labelled test lead (“Website Test Lead”, reference WE-CE697A) was posted to the live site and, as you confirmed, the email arrived in the lead inbox._

## ✅ Complete and tested (nothing for you to do)

| Deliverable | Status |
| --- | --- |
| Responsive single-page site: header (“Get a Quote” button, mobile menu), hero, video intro, about, key highlights, services (6 arched cards), featured projects (filters + lightbox), why choose us, quote banner, process, contact, footer (testimonials: built, hidden until real ones are added); **the quotation form is a popup** opened by every “Get a Quote” button (changed 17 Oct 2026; tried first, then kept by the owner) | Built; checked from 320 px to 1920 px |
| **Design follows the studio’s own mobile designs** (17 Oct 2026: first the hero/services mock, then the full 12-section page design): cream header with brown “Get a Quote” button; sunlit hero with headline and description on the photo; video intro card; About with an arched photo; key highlights; “Spaces for Every Need” arched cards; featured projects; light “Why choose us” cards; brown quote banner; process steps; contact cards; dark footer. Colours were sampled from the designs; tablet and desktop use the same arrangement in wider form. Text on the hero is checked against the real pixels behind it | Done |
| Logo and favicons from the supplied card (artwork unaltered; background made transparent) | Done — see note on original logo files below |
| Quotation form with **three fields, all required**: full name, mobile number and email. Nothing else is asked (changed on 17 Oct 2026 at the owner’s request; the earlier version also asked for services, project type, location, area, budget, description and a call time, and for a while the email was optional). Indian and international numbers accepted. The popup is kept short enough not to need scrolling | Done |
| Validation on the client **and** the server (same code), spam protection (honeypot, rate limits, optional CAPTCHA), loading state, duplicate-submission prevention, success only after the server confirms, helpful errors, values kept after failure | Done |
| Lead email to `whiteelephantcreativestudio@gmail.com` (override with `LEAD_TO_EMAIL`, several addresses allowed): required subject format, all required fields, mobile-friendly HTML + plain text, reply-to the customer when they gave an email | Done. Verified against a mock Resend **and a real SMTP server over TCP**; **verified end to end on the live site on 21 Oct 2026:** a labelled test lead sent through Gmail from the live function reached the lead inbox (confirmed by the owner) |
| Secrets only on the server; `.env.example` with placeholders; `.gitignore` for env files; build scanned for leaks | Done |
| SEO: title, description, Open Graph/Twitter, canonical, semantic HTML, LocalBusiness data using only verified facts, sitemap, robots.txt, lazy-loaded responsive WebP images | Done |
| **WhatsApp buttons** (21 Oct 2026, owner's request; **live since 21 Oct 2026**): a frameless brown WhatsApp logo left of “Get a Quote” in the header, beside the two numbers in the quotation popup, and between “Call us” and “Free Quotation” in the sticky phone bar. Each opens a WhatsApp chat with +91 76720 20294 in a new tab with a ready-to-send message (`https://wa.me/917672020294?text=…`; nothing is sent until the visitor presses Send). Number and message are set in `shared/business.js` and `src/config/site.js` — see [OWNER_GUIDE.md](OWNER_GUIDE.md) | Built; header fit checked 320–1920 px, bar and popup row at phone and desktop widths |
| Data map: where enquiries are stored and how to delete them ([LEAD_DATA_MAP.md](LEAD_DATA_MAP.md)). **The privacy-policy page was removed at the owner's request on 17 Oct 2026** | Done |
| 323 automated tests (195 unit/component/SMTP + 128 browser) + test report | Done — see [TEST_REPORT.md](TEST_REPORT.md) |
| Deployment, DNS, HTTPS and owner documentation | Done |

## 🔑 Needs you (credentials, DNS or approval)

Do these in order. Details: [DEPLOYMENT.md](DEPLOYMENT.md).

1. ~~**Create a Gmail App Password**~~ **Done 21 Oct 2026** (sender account, app password, and the recipient address `LEAD_TO_EMAIL` are set in Netlify; the password lives only there).
2. ~~**Prove delivery**~~ **Done 21 Oct 2026:** test lead WE-CE697A sent from the live site arrived in the lead inbox (scenario 16 passed on production).
3. ~~**Deploy to Netlify** and add the mail settings~~ **Done 21 Oct 2026.** If the sender's Google password is ever changed, Google cancels its app passwords: make a new one, update `GMAIL_APP_PASSWORD` in Netlify and redeploy.
4. ~~**Production test**~~ **Done** with `send-test-lead --url …`. Worth repeating monthly, and once more after the custom domain is connected.
5. ~~**Point your domain**~~ **Done 21 Oct 2026** (`whiteelephantcreativestudio.in` from GoDaddy, nameservers moved to Netlify, HTTPS on). **Still to do:** repeat the production test on the real domain, set up **Google Search Console** and **Google Business Profile** so Google finds the site (OWNER_GUIDE section 8).
6. **One mistake is still written into your video** (“Spaces that feels like you” should be “feel”; the other one, “To desing”, was repainted as “To design” on 18 Oct 2026 — ask and the second can be repainted too, see [OWNER_GUIDE.md](OWNER_GUIDE.md)), confirm you have the rights to everything shown in it (see `src/assets/photos/CREDITS.md`), and check that the **key highlights** (“15+ Years”, “500+ Projects”, “400+ Happy Clients”, “150+ Team of Experts”) are accurate, or replace them. **Add real client testimonials** (`src/data/testimonials.js`) to show that section.
7. **Replace the placeholder photos** with the studio’s own project photographs ([OWNER_GUIDE.md](OWNER_GUIDE.md)), and flip the “sample” flags.
8. *(Optional)* Cloudflare Turnstile CAPTCHA; customer acknowledgement emails (work with Gmail straight away; Resend needs a verified domain).

## ⚠️ Things to know

* **Placeholder photography.** The images are free-to-use Unsplash stock photos, credited in `src/assets/photos/CREDITS.md`. The site labels
  them and uses generic titles. The one-line “Sample images.” note at the end of Featured work, which said they are placeholders, was **switched off on
  21 Oct 2026 at the owner’s request** (`showPortfolioNotice: false` in `src/config/site.js`; set it to `true` to bring it back), so nothing on the page
  now says they are stock pictures; there are no labels on the images themselves either. Some are computer-generated renders. None may be described as the studio’s work.
* **Logo quality.** The only logo supplied was a photo of a business card, so the web logo is a ~630 px crop. It looks good at the sizes used
  but would be sharper from your original logo file (SVG or large transparent PNG).
* **The video intro** is your own “Interior Video”, converted for the web (H.264, no sound, under 1 MB). It plays by itself, silently, on a loop,
  with no play or pause button; it rests while off screen, and shows its first frame to visitors who have asked their device to reduce motion.
  Be aware that a video that moves by itself with no way to pause it does not meet the accessibility guideline (WCAG 2.2.2) for such media; it is
  at your request, and the reduced-motion and off-screen behaviour are there to limit the impact. If you want to meet the guideline fully, a small
  pause button can be added. The original 19 MB file stays in the project folder (`Interior Video.MP4`) and is not published.
* **Names** accept letters, spaces, full stops, hyphens and apostrophes (any language) but not digits.
* **Costs/limits** (checked 15 Oct 2026; may change): Gmail ≈ 500 messages/day for a regular account; Resend free plan = 100 emails/day,
  3,000/month; Netlify bills functions in credits. Each lead is one email (two if you enable customer confirmations).
* **Gmail trade-offs:** an app password can read the whole mailbox (use a dedicated sender account); Google revokes app passwords when that
  account’s password changes (leads then fail until you create a new one and redeploy); mail is always sent *from* the Gmail account; and
  SMTP has no built-in duplicate protection (the site de-duplicates best-effort while the server is warm).
* **Netlify rate limiting** uses one of the two rules the free plan allows per project.
* The folder is **not a Git repository** yet; [DEPLOYMENT.md §4](DEPLOYMENT.md#4-deploy-to-netlify-you) shows the commands.
* The original business-card image remains in the project root, untouched; it is the source for `npm run brand`.
