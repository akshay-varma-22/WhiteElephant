import { describe, expect, it } from 'vitest';
import { buildAcknowledgementEmail, buildLeadEmail, buildSubject, escapeHtml } from '../../server/email-template.js';
import { validateQuotation } from '../../shared/quotation-validation.js';
import { formatIstTimestamp, formatTime12, getIstNow } from '../../shared/ist.js';
import { NOW, validPayload } from '../fixtures.js';

const clean = (overrides) => validateQuotation(validPayload(overrides)).values;

describe('lead email content', () => {
  const values = clean({ name: 'Asha Rao', email: 'asha@example.com' });
  const mail = buildLeadEmail(values, { reference: 'WE-ABC123', now: NOW });

  it('has a descriptive subject with the name and number', () => {
    expect(mail.subject).toBe('New Quotation Lead — Asha Rao — +91 99496 21569');
    expect(buildSubject(clean({ name: 'Test Customer' }))).toBe('New Quotation Lead — Test Customer — +91 99496 21569');
  });

  it.each([
    'Name', 'Asha Rao', 'Phone', '+91 99496 21569', 'Email', 'asha@example.com',
    'Received', 'Thursday, 15 October 2026, 2:00 PM IST', 'Reference', 'WE-ABC123',
  ])('contains %s in both HTML and plain text', (needle) => {
    expect(mail.html).toContain(needle.includes('&') ? escapeHtml(needle) : needle);
    expect(mail.text).toContain(needle);
  });

  it('has a contact section and a submission section', () => {
    expect(mail.text).toContain('CONTACT');
    expect(mail.text).toContain('SUBMISSION');
    expect(mail.html).toContain('Contact');
  });

  it('makes the phone number and email address tappable in the HTML', () => {
    expect(mail.html).toContain('href="tel:+919949621569"');
    expect(mail.html).toContain('href="mailto:asha@example.com"');
  });

  it('contains only what the form collects (no empty project sections)', () => {
    for (const gone of ['Services requested', 'Project location', 'Estimated budget', 'Preferred call', 'Consent', 'Project description']) {
      expect(mail.html, gone).not.toContain(gone);
      expect(mail.text, gone).not.toContain(gone);
    }
  });

  it('says so plainly if a lead ever reaches the formatter without an email (the form does not allow it)', () => {
    const bare = buildLeadEmail(clean({ email: '' }), { reference: 'WE-000000', now: NOW });
    expect(bare.text).toContain('Email: Not provided');
    expect(bare.html).toContain('Not provided');
    expect(bare.html).not.toContain('mailto:');
  });

  it('escapes HTML in every visitor-supplied value', () => {
    const evil = { ...clean({ name: 'Eve' }), name: '<img src=x onerror=alert(1)> & "quotes"', email: '<b>x</b>@example.com' };
    const m = buildLeadEmail(evil, { reference: 'WE-111111', now: NOW });
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).not.toContain('<b>x</b>');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quotes&quot;');
  });

  it('keeps the subject on a single line', () => {
    const v = clean({ name: 'Test\r\nBcc: x@evil.test' });
    // Control characters are stripped by validation; the subject can never contain a line break.
    expect(buildSubject(v)).not.toMatch(/[\r\n]/);
  });

  it('uses a responsive, table-based layout', () => {
    expect(mail.html).toContain('max-width:620px');
    expect(mail.html).toContain('@media only screen and (max-width:520px)');
  });
});

describe('acknowledgement email', () => {
  it('thanks the visitor by name, gives the reference and promises no timing', () => {
    const v = clean({ name: 'Asha Rao', email: 'asha@example.com' });
    const m = buildAcknowledgementEmail(v, { reference: 'WE-ABC123', businessEmail: 'x@example.test', businessPhones: ['+91 99496 21569'] });
    expect(m.subject).toContain('We’ve received your enquiry');
    expect(m.text).toContain('Hello Asha Rao,');
    expect(m.text).toContain('WE-ABC123');
    expect(m.html).toContain('Thank you, Asha Rao');
    expect(m.text).not.toMatch(/within|hours|by tomorrow|appointment/i);
    expect(m.text).not.toContain('+919949621569'); // the visitor's own number is not echoed back
  });

  it('escapes the visitor\'s name', () => {
    const v = { ...clean({}), name: '<script>alert(1)</script>' };
    const m = buildAcknowledgementEmail(v, { reference: 'WE-1', businessEmail: 'x@example.test' });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });
});

describe('IST helpers', () => {
  it('computes the IST calendar day and minutes', () => {
    expect(getIstNow(new Date('2026-10-14T20:00:00Z'))).toEqual({ date: '2026-10-15', minutes: 90 });
    expect(getIstNow(NOW)).toEqual({ date: '2026-10-15', minutes: 840 });
  });
  it('formats times in 12-hour form', () => {
    expect(formatTime12(870)).toBe('2:30 PM');
    expect(formatTime12(0)).toBe('12:00 AM');
    expect(formatTime12(12 * 60)).toBe('12:00 PM');
  });
  it('formats timestamps in IST', () => {
    expect(formatIstTimestamp(NOW)).toBe('Thursday, 15 October 2026, 2:00 PM IST');
  });
});
