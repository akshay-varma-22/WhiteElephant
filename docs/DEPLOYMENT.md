# Deployment guide

This guide takes the site from this folder to a live, working site on Netlify with real email delivery.
Steps marked **(you)** need your accounts, credentials or DNS access — they cannot be done for you.

Provider facts below were checked against the vendors’ documentation on **15 October 2026**. Plans and limits change, so
re-check the linked pages before relying on a number.

## 0. What you need

| Item | Why | Cost note |
| --- | --- | --- |
| A **Netlify** account | Hosts the site and runs the form function | Credit-based plans; a low-traffic site is expected to use very little, but confirm in your Netlify billing page. |
| **A way to send email** — choose one (section 2): **Gmail with an App Password** *(simplest, no extra service)* or **Resend** | Delivers each lead to the studio inbox | Gmail: free, about 500 messages/day for a regular account. Resend: free plan 100/day, 3,000/month ([limits](https://resend.com/docs/knowledge-base/resend-sending-limits)). |
| Access to the **DNS settings** of whiteelephantcreativestudio.in | Custom domain (and Resend domain verification, if you use Resend) | Usually at your domain registrar. |
| The inbox `whiteelephantcreativestudio@gmail.com` | Receives leads | — |
| (Optional) A **Cloudflare** account | Free Turnstile CAPTCHA | See section 9. |
| (Optional) A **GitHub** account | Auto-deploy on every change | You can deploy without it (section 4, option B). |

The form posts to a small **server function** (`netlify/functions/quotation.mjs`, JavaScript). Your Python snippet
(`smtplib` + Gmail app password) does the same job in a different language; the site does not run Python, so the
function does it with Node.js using the same Gmail server (`smtp.gmail.com`, port 465, SSL). The password is only ever read
on the server from an environment variable and is never sent to a visitor’s browser.

## 1. Install and run locally

```bash
npm install
npm run dev:mock      # try everything with a FAKE email service (no credentials, nothing real is sent)
npm test              # unit, component and SMTP-protocol tests
npm run build         # production build into dist/ (3 steps: the site, the same page built for Node, then the page's HTML is written into dist/index.html)
npm run preview       # serve the production build locally
```

On Windows you can simply double-click `Start-Website.bat` instead of typing commands. Never open `index.html` directly
from a folder: it is only the page shell and shows a blank page.

## 2. Choose how email is sent (you)

### Option A — Gmail with an App Password (what your snippet does)

**What you need:** a Google account with **2-Step Verification** turned on. Google does not offer app passwords when 2-Step
Verification uses security keys only, on Advanced Protection accounts, or on some work/school accounts
([Google](https://support.google.com/accounts/answer/185833)).

> **Security — please read.** A Gmail app password is **not limited to sending**: anyone holding it can read that account’s
> mail too. If it leaks (for example from a mis-shared Netlify setting), the attacker reaches the whole mailbox. So we recommend
> creating a **separate free Gmail account just for the website** (e.g. `whiteelephantwebsite@gmail.com`) to send from, and
> keeping the main business inbox as the *recipient* (`LEAD_TO_EMAIL`). If you decide to use the main business account
> instead, you accept that risk. Either way, never paste the password into chat, email or code.

Steps:

1. Sign in to the Google account that will **send** the emails. Turn on 2-Step Verification (Google Account → Security).
2. Open **https://myaccount.google.com/apppasswords**, name it “Website”, and copy the 16-character password (it is shown as
   four groups of four letters; spaces don’t matter). You can’t view it again, only delete it and make a new one.
3. Put these in your local `.env` (copy `.env.example` first; `.env` is git-ignored):
   ```
   MAIL_PROVIDER=gmail
   GMAIL_USER=the-sending-account@gmail.com
   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
   LEAD_TO_EMAIL=whiteelephantcreativestudio@gmail.com
   ```
4. Prove it works — section 3.

How it behaves:

* **From address:** Gmail always sends from the authenticated account (shown as “White Elephant Creative Studio Website”). The
  customer’s email, if they gave one, is set as **Reply-To**, so pressing Reply writes to the customer.
* **Sent copies:** every lead is also stored in the sending account’s **Sent** folder (if sender and recipient are the same
  address, you will see it in both Inbox and Sent).
* **Deliverability:** the message leaves Google’s own servers, so no SPF/DKIM/DNS setup is needed.
* **Limits:** roughly **500 messages per rolling 24 hours** for a regular Gmail account (2,000 for Google Workspace); Google can
  change this, and going over blocks sending for up to a day. One lead = one message (two if you enable customer confirmations).
* **If the password stops working** — Google revokes **all** app passwords whenever the account’s Google password is changed —
  visitors will see the “couldn’t send, please call us” message and **no lead will arrive** until you create a new app password,
  update it in Netlify, and redeploy. Run `npm run send-test-lead -- --url https://www.whiteelephantcreativestudio.in`
  occasionally (for example monthly) to check.
* **Duplicates:** unlike Resend, SMTP has no built-in duplicate protection. The site gives each message a fixed Message-ID and
  remembers recently sent ones while the server instance is warm, so a visitor’s retry normally cannot create a second email.
  In rare cases (a retry landing on a freshly started server right after a lost response) a duplicate is possible.

### Option B — Resend (a separate email service)

1. Create an account at https://resend.com (sign up with `whiteelephantcreativestudio@gmail.com`, see below).
2. **API key:** dashboard → *API Keys* → *Create API Key*, permission **Sending access**. Copy it once.
3. **Sender:**
   * **Quick start (testing only):** leave `MAIL_FROM=White Elephant Website <onboarding@resend.dev>`. Resend only lets this test
     sender deliver to the address that **owns the Resend account** ([errors reference](https://resend.com/docs/api-reference/errors)) —
     hence signing up with the studio’s Gmail. Leads may land in Spam, and customer confirmation emails can’t work.
   * **Recommended for launch:** dashboard → *Domains* → *Add Domain* → `whiteelephantcreativestudio.in` (Resend suggests a
     subdomain such as `updates.…`). Add the DNS records the dashboard displays (**copy exactly what it shows**), click *Verify*,
     then set `MAIL_FROM=White Elephant Website <leads@updates.whiteelephantcreativestudio.in>`. Adding DMARC afterwards helps
     ([Resend domains](https://resend.com/docs/dashboard/domains/introduction)).
4. In `.env`: `MAIL_PROVIDER=resend`, `RESEND_API_KEY=…`, `MAIL_FROM=…`, `LEAD_TO_EMAIL=…`.

Resend’s advantage over Gmail: a send-only key (a leak can’t read your mail), built-in duplicate protection, and a delivery log.

## 3. Prove email delivery **before** deploying (you)

```bash
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

Fill in the settings for your chosen option (section 2), then:

```bash
npm run send-test-lead -- --direct
```

This sends **one** clearly labelled test lead (“Website Test Lead … please ignore”) through the real lead pipeline and the
real mail service to `LEAD_TO_EMAIL`. On success it prints `SUCCESS`; open the inbox (check Spam) and confirm the email
arrived. If it fails, the script prints what went wrong in plain language (for example “Google rejected the login — use an App
Password”). Acceptance by the mail service is the strongest signal the code can see; **arrival in your inbox is the final
proof, and only you can confirm it.**

## 4. Deploy to Netlify (you)

The repository is not a Git repository yet. Choose one option.

### Option A — via GitHub (recommended: every change redeploys automatically)

```bash
git init
git add .
git status        # CHECK: .env must NOT be listed. Only .env.example should appear.
git commit -m "White Elephant Creative Studio website"
```

Create an empty repository on GitHub, then follow its “push an existing repository” commands. In Netlify:
*Add new project → Import an existing project → GitHub →* pick the repository. Netlify reads `netlify.toml`, so the
settings are pre-filled:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node version | 22 (set in `netlify.toml`) |

### Option B — without GitHub (Netlify CLI)

```bash
npm install
npx netlify-cli login                # opens a browser; sign in to Netlify
npm run build
npx netlify-cli deploy               # first run: choose "Create & configure a new site". Gives a DRAFT test URL.
```

Then add the environment variables (next section) in the Netlify website, and publish for real:

```bash
npx netlify-cli deploy --prod        # re-run so the function picks up the variables; this is the live site
```

(The first `deploy` links the folder to your Netlify site; `netlify.toml` already tells it to publish `dist` and deploy the
functions in `netlify/functions`. Do **not** drag-and-drop the `dist` folder onto Netlify: that uploads the pages but not
the form function, so the quotation form would not work.)

### Environment variables (both options)

Netlify → your site → **Project configuration → Environment variables → Add a variable**
([docs](https://docs.netlify.com/build/environment-variables/get-started/)). Add the ones for your option:

| Name | Value | Notes |
| --- | --- | --- |
| `MAIL_PROVIDER` | `gmail` (or `resend`) | |
| `LEAD_TO_EMAIL` | `whiteelephantcreativestudio@gmail.com` | Optional; this is the default. Commas allowed for several. |
| `GMAIL_USER` | the sending Gmail address | **Gmail option.** |
| `GMAIL_APP_PASSWORD` | the 16-character app password | **Gmail option. Tick *Contains secret values*.** |
| `RESEND_API_KEY` | your Resend key | **Resend option.** Tick *Contains secret values*. |
| `MAIL_FROM` | e.g. `White Elephant Website <leads@updates.whiteelephantcreativestudio.in>` | **Resend option** (ignored for Gmail). |
| `SEND_CUSTOMER_CONFIRMATION` | `false` | See section 10 before enabling. |
| `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY` | from Cloudflare | Optional; see section 9. |

**Environment variable changes only take effect after a new deploy** (Netlify docs): *Deploys → Trigger deploy → Deploy site*.
Never prefix a secret with `VITE_` — anything with that prefix is published to the browser. (`npm run check:bundle` scans the
built site for leaked secrets.)

## 5. Production test (you)

1. Open the Netlify URL (`https://<your-site>.netlify.app`). Submit the form with a real phone number and a note like
   “Production test — please ignore”. Confirm the success message **and** the email in the inbox.
2. Or from your computer: `npm run send-test-lead -- --url https://<your-site>.netlify.app`.
3. Check **Netlify → Logs → Functions → quotation**: you should see `quotation_email_sent` with a reference. Logs never contain
   names, phone numbers, email addresses or message text — only event names and short error codes.
4. Resend users: also check **Resend → Emails** for delivery status. Gmail users: the message is in the sender account’s Sent folder.
5. In the Netlify deploy log, search “post-processing” to confirm the function’s rate-limit rule (10 requests/minute/IP) was
   applied. Netlify notes invalid rules do not fail a deploy, so this check is worth doing
   ([rate limiting docs](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/)).
6. Failure drill (optional): temporarily remove the app password / API key, redeploy, submit — the form must show an error message
   and **not** a success message. Restore it and redeploy.

## 6. Custom domain and DNS (you)

Netlify → **Domain management → Add a domain** → `whiteelephantcreativestudio.in`. **Current setup (21 Oct 2026):** the primary domain is
`www.whiteelephantcreativestudio.in`; the bare `whiteelephantcreativestudio.in` redirects to it, HTTP redirects to HTTPS (HTTPS is forced, with a
Let’s Encrypt certificate that Netlify renews by itself), and the site's canonical address, sitemap and search data all use the `www` address.
If you keep the DNS at another provider, these are the records ([Netlify docs](https://docs.netlify.com/manage/domains/configure-domains/configure-external-dns/)):

| Host | Type | Value |
| --- | --- | --- |
| `www` | `CNAME` | your Netlify subdomain, e.g. `your-site.netlify.app` (Netlify displays the exact value) |
| `@` (apex) | `ALIAS` / `ANAME` / flattened CNAME | `apex-loadbalancer.netlify.com` *(preferred)* |
| `@` (apex) | `A` | `75.2.60.5` *(fallback if your provider has no ALIAS)* |

**The studio's domain is `whiteelephantcreativestudio.in`, bought at GoDaddy (21 Oct 2026), and its nameservers were moved to Netlify the same day**
(Netlify DNS: `dns1`–`dns4.p03.nsone.net`; the .in registry showed the new nameservers immediately, while resolvers that had cached the old
GoDaddy answer took longer). The code, sitemap, robots.txt and search data use `https://www.whiteelephantcreativestudio.in`. Two ways to connect a domain:

* **Easiest, recommended — let Netlify manage the DNS.** In Netlify: *Domain management → Add a domain* → `whiteelephantcreativestudio.in` →
  *Set up Netlify DNS*; Netlify shows four nameservers. In GoDaddy: *My Products → the domain → DNS → Nameservers → Change nameservers → Enter my
  own nameservers (advanced)* → paste the four Netlify nameservers → Save. Netlify then creates every record (apex and `www`) and the HTTPS
  certificate by itself. Only use this if the domain has no email or other services on GoDaddy that depend on its DNS records.
* **Keep DNS at GoDaddy.** In GoDaddy *DNS → Records*, delete the default “Parked” `A` record for `@` and the default `www` record, then add `www`
  `CNAME` → `exquisite-beijinho-3476dc.netlify.app` and `@` `A` → `75.2.60.5` (GoDaddy has no ALIAS at the apex). Then, as above, `www` is the
  primary domain in Netlify and the bare domain redirects to it.

A brand-new domain can take from minutes to several hours to appear on the internet at all (on 21 Oct 2026, right after the purchase, public
resolvers still answered “domain does not exist”). If it still does not resolve after a day, check GoDaddy for a pending purchase or an
unanswered verification email.

Propagation can take several hours up to a day. If you use Resend with a verified domain, do **not** delete its verification
records — they are separate records that must stay in place. If you prefer, you can move the whole domain to Netlify DNS instead.

## 7. Verify HTTPS (you)

Netlify provisions a Let’s Encrypt certificate automatically once DNS points at it ([docs](https://docs.netlify.com/manage/domains/secure-domains-with-https/https-ssl/)).
If it does not appear, check *Domain management → HTTPS*.

```bash
curl -I https://www.whiteelephantcreativestudio.in/        # expect: HTTP/2 200 and a strict-transport-security header
curl -I http://www.whiteelephantcreativestudio.in/         # expect a redirect to https://
curl -I https://whiteelephantcreativestudio.in/            # expect a redirect to https://www.whiteelephantcreativestudio.in/
```

In a browser, confirm the padlock, then repeat the production test (section 5) on the real domain. The security headers in
`netlify.toml` (CSP, HSTS, no framing, nosniff) are served automatically; you can scan the site at https://securityheaders.com.
The site’s canonical URLs, sitemap and structured data already point at `https://www.whiteelephantcreativestudio.in`.
Submit `https://www.whiteelephantcreativestudio.in/sitemap.xml` in Google Search Console once the domain is live.

## 8. Change where leads are sent

1. Netlify → Environment variables → set `LEAD_TO_EMAIL` to the new address (several addresses may be separated by commas, e.g.
   `owner@example.com, designer@example.com`).
2. Redeploy (*Deploys → Trigger deploy*).
3. Resend users still on the test sender (`onboarding@resend.dev`): the new address must be the Resend account owner’s own address;
   otherwise verify your domain first.
4. Run `npm run send-test-lead -- --url https://www.whiteelephantcreativestudio.in` to confirm.

The public contact email shown on the website is separate: edit `shared/business.js`.

## 9. Optional: Cloudflare Turnstile CAPTCHA

The form already has a honeypot and rate limiting. For stronger protection add Turnstile (free):

1. https://dash.cloudflare.com → *Turnstile* → *Add widget* → add `www.whiteelephantcreativestudio.in` (and the bare `whiteelephantcreativestudio.in` if you want it too).
2. In Netlify set `VITE_TURNSTILE_SITE_KEY` (public) and `TURNSTILE_SECRET_KEY` (secret). Redeploy.
3. The widget appears above the submit button. Tokens are single-use and verified on the server.
4. Note that `send-test-lead --url` is then rejected by design — use the website form or `--direct`.

## 10. Optional: acknowledgement email to the customer

Set `SEND_CUSTOMER_CONFIRMATION=true` to also email the visitor a short acknowledgement. It is sent only when the visitor typed
an email address, contains no promised callback time, and never affects the visitor’s success message if it fails.

* **Gmail option:** works straight away, sent from the same Gmail account.
* **Resend option:** needs a verified sending domain (it cannot work with the test sender).

Be aware that anyone can type any address into a public form, so each enabled confirmation could land in a stranger’s inbox;
rate limiting and the minimal content reduce, but do not remove, that risk. With Gmail it also counts toward the ~500/day limit.

## 11. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Form says “couldn’t send”, Netlify log shows `quotation_not_configured` | The mail settings are missing (the log lists which: `GMAIL_APP_PASSWORD` or `RESEND_API_KEY`), or you set them but did not redeploy. |
| Log shows `smtp_auth_failed` | Gmail rejected the login. Use an **App Password** (not the normal password), made for the same account as `GMAIL_USER`. Changing the Google password revokes app passwords — create a new one, update Netlify, redeploy. |
| Log shows `smtp_connection_failed` | The mail server couldn’t be reached (rare from Netlify; common locally if a firewall, antivirus or VPN blocks port 465). |
| Log shows `smtp_quota_exceeded` | Gmail’s daily sending limit was hit; it clears within about 24 hours. |
| Log shows `providerStatus: 403`, `validation_error` (Resend) | Using `onboarding@resend.dev` to send to an address that does not own the Resend account, or `MAIL_FROM` isn’t on a verified domain. |
| Log shows `providerStatus: 401` (Resend) | API key wrong or revoked. Create a new one. |
| Log shows `429 daily_quota_exceeded` (Resend) | Resend free limit reached (100/day, resets 00:00 UTC). |
| Emails arrive in Spam | Gmail option: mark one “Not spam”. Resend option: verify your domain and add DMARC. |
| Form shows a network error | Browser could not reach `/api/quotation`; check the function deployed (*Netlify → Functions*). |
| Form always says “verify you are human” | Turnstile site key and secret do not match, or the domain is not on the widget’s allow-list. |
| HTTP 429 from the site | Rate limit hit (10 requests/min per visitor at Netlify; 6 per 10 min inside the function). Wait and retry. |
| “Preview mode” notice on the success screen | The site is connected to a local test mail server (`npm run dev:mock`); no real email was sent. Not shown on the live site. |

## 12. What is stored, and where

See [LEAD_DATA_MAP.md](LEAD_DATA_MAP.md#where-lead-data-lives).
