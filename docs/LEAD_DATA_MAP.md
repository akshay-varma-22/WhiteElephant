# Where lead data lives

_The privacy-policy page was removed on 17 October 2026 at the owner's request, so this file is now only a reference for where the
website's enquiries end up and how to delete them. The form shows a one-line note (“We’ll only use your details to contact you about your enquiry.”) and has no consent tick box.
Whether a website that collects names and phone numbers needs a privacy notice (for example under India's Digital Personal Data
Protection Act, 2023) is a legal question for the studio and its lawyer, not something this project can decide. If you want the
page back, ask and it can be rebuilt._

## Where lead data lives

| Place | What is there | Who can access it | How long | How to delete |
| --- | --- | --- | --- | --- |
| **Studio Gmail inbox** (`whiteelephantcreativestudio@gmail.com`) | The full lead email (all form fields) | Whoever has access to that mailbox | Until the studio deletes it | Delete the email in Gmail, then empty Trash. |
| **Sending Gmail account — Sent folder** (*if you use the Gmail option*) | A copy of each lead (and customer acknowledgement) the website sent | Whoever can open that Gmail account — **an app password gives full mailbox access, so guard it** | Until deleted | Delete from Sent (and Trash). Use a dedicated sender account to keep this separate from the business inbox. |
| **Resend** (*if you use the Resend option*) | A copy of each sent message and its delivery status in the *Emails* log | Whoever has the Resend login | Third-party sources report 30 days on the free plan; **confirm on your Resend plan** — we could not find an official statement | Resend dashboard → Emails (check their docs/support for deleting individual messages), or let it expire. |
| **Netlify function logs** | Event names and error codes only (`quotation_email_sent`, provider status). **No names, phones, emails or message text** — enforced by an automated test. | Netlify account holders | Per Netlify’s log retention | Not applicable (no personal data). |
| **Visitor’s browser** | Nothing. The site does not use cookies or `localStorage`/`sessionStorage` for form answers (checked by an automated test). | — | — | — |
| **Cloudflare Turnstile** (only if you enable it) | Technical browser signals used to tell people from bots | Cloudflare | Per Cloudflare | See Cloudflare’s privacy documentation. |
| **Customer acknowledgement email** (only if you enable it) | A short email to the address the visitor typed | The recipient and Resend | As above | — |

There is **no database**. Because the studio’s inbox is the system of record, answering an access or deletion request
means searching the inbox (and Resend’s log) for the person’s name, phone number or email address.

## What the form collects (and does not)

Collected: full name, mobile number and email address (all three required); and the time the form was sent (IST) with a reference.
**Not collected:** project details, ID numbers, financial details, address, photos or files.

## If you add tracking later

Google Analytics, a chat widget, social embeds, a map, a newsletter sign-up or any new form field would collect more data than the
table above describes. Update this file (and think about whether a notice is then needed) before adding them.
