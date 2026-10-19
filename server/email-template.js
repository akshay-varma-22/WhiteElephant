/**
 * Builds the lead-notification email (HTML + plain text) and the optional
 * customer acknowledgement. Every dynamic value is HTML-escaped; nothing from the
 * visitor is ever interpolated into a header except the (already cleaned,
 * single-line) subject text.
 *
 * A lead is just a name, a mobile number and an email address (the form requires all three; the "Not provided" placeholder
 * below only keeps this formatter safe if it is ever given a lead without one).
 */
import { formatIstTimestamp } from '../shared/ist.js';

export const BUSINESS_NAME = 'White Elephant Creative Studio';

const BRAND = { ink: '#2b2622', gold: '#8a6a3a', line: '#e4dac6', paper: '#faf6ee', card: '#ffffff', muted: '#6b6259' };

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "New Quotation Lead — Asha Rao — +91 99496 21569" */
export function buildSubject(values) {
  return `New Quotation Lead — ${values.name} — ${values.phoneDisplay}`;
}

/* ------------------------------------------------------------------ */
/* Lead notification (to the studio)                                   */
/* ------------------------------------------------------------------ */

function rows(values, reference, receivedAt) {
  return [
    {
      title: 'Contact',
      items: [
        ['Name', values.name],
        ['Phone', values.phoneDisplay, { tel: values.phone }],
        ['Email', values.email || null, values.email ? { mailto: values.email } : undefined],
      ],
    },
    {
      title: 'Submission',
      items: [
        ['Received', receivedAt],
        ['Reference', reference],
      ],
    },
  ];
}

export function buildLeadEmail(values, { reference, now = new Date() }) {
  const receivedAt = formatIstTimestamp(now);
  const sections = rows(values, reference, receivedAt);
  const subject = buildSubject(values);

  /* ---- plain text ---- */
  const text = [
    `NEW QUOTATION LEAD  (${reference})`,
    `Received: ${receivedAt}`,
    '',
    ...sections.flatMap((s) => [
      s.title.toUpperCase(),
      ...s.items.map(([label, value]) => `${label}: ${value ?? 'Not provided'}`),
      '',
    ]),
    `— Sent by the ${BUSINESS_NAME} website quotation form.`,
  ].join('\n');

  /* ---- HTML ---- */
  const cell = (label, value, opt = {}) => {
    let body;
    if (value === null || value === undefined || value === '') {
      body = `<span style="color:${BRAND.muted};font-style:italic;">Not provided</span>`;
    } else if (opt.tel) {
      body = `<a href="tel:${escapeHtml(opt.tel)}" style="color:${BRAND.gold};font-weight:600;text-decoration:none;">${escapeHtml(value)}</a>`;
    } else if (opt.mailto) {
      body = `<a href="mailto:${escapeHtml(encodeURIComponent(opt.mailto).replace(/%40/g, '@'))}" style="color:${BRAND.gold};text-decoration:none;">${escapeHtml(value)}</a>`;
    } else {
      body = escapeHtml(value);
    }
    return `<tr>
      <td class="stack" style="padding:8px 16px 8px 0;width:38%;vertical-align:top;font-size:13px;color:${BRAND.muted};">${escapeHtml(label)}</td>
      <td class="stack" style="padding:8px 0;vertical-align:top;font-size:15px;color:${BRAND.ink};line-height:1.5;">${body}</td>
    </tr>`;
  };

  const sectionHtml = sections
    .map(
      (s) => `<tr><td style="padding:22px 28px 6px 28px;">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:${BRAND.gold};border-bottom:1px solid ${BRAND.line};padding-bottom:8px;">${escapeHtml(s.title)}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:4px;">
          ${s.items.map(([label, value, opt]) => cell(label, value, opt)).join('')}
        </table>
      </td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
<style>
  @media only screen and (max-width:520px){ .stack{display:block !important;width:100% !important;padding-right:0 !important;} .stack + .stack{padding-top:0 !important;} }
</style></head>
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(values.name)} — ${escapeHtml(values.phoneDisplay)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:6px;">
    <tr><td style="padding:26px 28px 18px 28px;border-bottom:3px solid ${BRAND.gold};">
      <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.gold};">${escapeHtml(BUSINESS_NAME)}</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:${BRAND.ink};margin-top:6px;">New quotation lead</div>
      <div style="font-size:13px;color:${BRAND.muted};margin-top:6px;">Received ${escapeHtml(receivedAt)} · Ref ${escapeHtml(reference)}</div>
    </td></tr>
    ${sectionHtml}
    <tr><td style="padding:20px 28px 26px 28px;font-size:12px;color:${BRAND.muted};line-height:1.5;">
      Sent automatically by the website quotation form. Reply to this email to respond to the customer directly, or call the number above.
    </td></tr>
  </table>
</td></tr></table></body></html>`;

  return { subject, html, text };
}

/* ------------------------------------------------------------------ */
/* Customer acknowledgement (optional)                                 */
/* ------------------------------------------------------------------ */

/**
 * Deliberately minimal: only the visitor's name is echoed back, and there is no promised callback date or
 * turnaround time (the business has not approved any).
 */
export function buildAcknowledgementEmail(values, { reference, businessEmail, businessPhones = [] }) {
  const subject = `We’ve received your enquiry — ${BUSINESS_NAME}`;
  const lines = [
    `Hello ${values.name},`,
    '',
    `Thank you for your enquiry to ${BUSINESS_NAME}. We have received your request for a free quotation.`,
    '',
    `Reference: ${reference}`,
    '',
    'Our team will review your details and get in touch to discuss the next steps.',
    '',
    `Questions? Reply to this email${businessPhones.length ? ` or call ${businessPhones.join(' / ')}` : ''}.`,
    '',
    `— ${BUSINESS_NAME}, Hyderabad`,
  ];
  const text = lines.join('\n');

  const p = (s) => `<p style="margin:0 0 14px 0;line-height:1.6;">${s}</p>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:${BRAND.paper};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<div style="max-width:560px;margin:0 auto;background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:6px;padding:28px;">
  <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${BRAND.gold};">${escapeHtml(BUSINESS_NAME)}</div>
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:500;font-size:24px;margin:8px 0 18px 0;">Thank you, ${escapeHtml(values.name)}</h1>
  ${p('We have received your request for a free quotation.')}
  <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0;font-size:14px;">
    <tr><td style="padding:4px 14px 4px 0;color:${BRAND.muted};">Reference</td><td>${escapeHtml(reference)}</td></tr>
  </table>
  ${p('Our team will review your details and get in touch to discuss the next steps.')}
  ${p(`Questions? Reply to this email${businessPhones.length ? ` or call ${escapeHtml(businessPhones.join(' / '))}` : ''}.`)}
  <p style="margin:18px 0 0 0;font-size:12px;color:${BRAND.muted};">${escapeHtml(BUSINESS_NAME)}, Hyderabad${businessEmail ? ` · ${escapeHtml(businessEmail)}` : ''}</p>
</div></body></html>`;

  return { subject, html, text };
}
