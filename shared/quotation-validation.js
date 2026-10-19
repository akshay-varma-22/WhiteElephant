/**
 * Quotation form validation + sanitisation.
 *
 * The form asks for three things, and all three are required: a name, a mobile number and an email address.
 *
 * Runs in the browser (instant feedback) AND on the server function (the authoritative check). It never trusts its
 * input: everything is coerced to strings, cleaned and length-limited.
 *
 *   const { valid, errors, values } = validateQuotation(payload);
 *
 * `errors` is a { fieldName: message } map; `values` is the cleaned payload (only meaningful when `valid` is true).
 */
import { LIMITS } from './quotation-options.js';

/* ------------------------------------------------------------------ */
/* Text cleaning                                                       */
/* ------------------------------------------------------------------ */

// C0/C1 control chars (keeping \n and \t where allowed), zero-width + bidi override characters.
// eslint-disable-next-line no-control-regex
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/** Only strings and numbers are accepted as text; objects/arrays/booleans (hostile JSON) become ''. */
const asText = (value) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

/** Single-line text: no newlines, collapsed whitespace, trimmed. */
export function cleanLine(value, max = 500) {
  const s = asText(value)
    .normalize('NFC')
    .replace(INVISIBLE, '')
    .replace(CONTROL_EXCEPT_NEWLINE, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max * 2 ? s.slice(0, max * 2) : s; // hard cap so oversized input cannot be amplified
}

/* ------------------------------------------------------------------ */
/* Phone                                                               */
/* ------------------------------------------------------------------ */

export const PHONE_HELP =
  'Enter a valid mobile number, for example 99496 21569 or +91 99496 21569. Numbers outside India need the country code, for example +44 7911 123456.';

/**
 * Validates and normalises a phone number.
 *  - Indian mobiles: 10 digits starting 6–9, optionally prefixed +91 / 91 / 0091 / 0.
 *  - Other countries: must start with + (or 00) and be a plausible E.164 number (8–15 digits, no leading 0).
 * @returns {{ valid: boolean, e164?: string, display?: string, message?: string }}
 */
export function normalisePhone(raw) {
  const input = cleanLine(raw, 40);
  if (!input) return { valid: false, message: 'Please enter your mobile number.' };
  if (/[^\d\s+()\-.]/.test(input)) return { valid: false, message: PHONE_HELP };

  const compact = input.replace(/[\s().-]/g, '');
  if (compact.lastIndexOf('+') > 0) return { valid: false, message: PHONE_HELP };

  const indian = (national) => ({
    valid: true,
    e164: `+91${national}`,
    display: `+91 ${national.slice(0, 5)} ${national.slice(5)}`,
  });
  const INDIAN_MOBILE = /^[6-9]\d{9}$/;

  const hasIntlPrefix = compact.startsWith('+') || compact.startsWith('00');
  if (hasIntlPrefix) {
    const digits = compact.startsWith('+') ? compact.slice(1) : compact.slice(2);
    if (!/^\d+$/.test(digits)) return { valid: false, message: PHONE_HELP };
    if (digits.startsWith('91')) {
      const national = digits.slice(2);
      return INDIAN_MOBILE.test(national)
        ? indian(national)
        : { valid: false, message: 'Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.' };
    }
    if (/^[1-9]\d{7,14}$/.test(digits)) {
      return { valid: true, e164: `+${digits}`, display: `+${digits}` };
    }
    return { valid: false, message: PHONE_HELP };
  }

  if (!/^\d+$/.test(compact)) return { valid: false, message: PHONE_HELP };
  if (INDIAN_MOBILE.test(compact)) return indian(compact);
  if (/^0[6-9]\d{9}$/.test(compact)) return indian(compact.slice(1));
  if (/^91[6-9]\d{9}$/.test(compact)) return indian(compact.slice(2));
  return { valid: false, message: PHONE_HELP };
}

/* ------------------------------------------------------------------ */
/* Email                                                               */
/* ------------------------------------------------------------------ */

const DOMAIN_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
const LOCAL_PART = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;

export function isValidEmail(value) {
  if (value.length > LIMITS.emailMax) return false;
  const at = value.lastIndexOf('@');
  if (at < 1 || at === value.length - 1) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART.test(local)) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  if (!labels.every((l) => DOMAIN_LABEL.test(l))) return false;
  return /^([a-z]{2,}|xn--[a-z0-9-]{2,})$/i.test(labels[labels.length - 1]);
}

/* ------------------------------------------------------------------ */
/* Main validator                                                      */
/* ------------------------------------------------------------------ */

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;

/**
 * @param {object} input raw form payload
 */
export function validateQuotation(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const errors = {};
  const values = {};

  /* --- Name (required) --------------------------------------------- */
  values.name = cleanLine(src.name, LIMITS.nameMax);
  if (!values.name) errors.name = 'Please enter your full name.';
  else if (values.name.length < LIMITS.nameMin) errors.name = 'Please enter your full name.';
  else if (values.name.length > LIMITS.nameMax) errors.name = `Name must be ${LIMITS.nameMax} characters or fewer.`;
  else if (!NAME_RE.test(values.name))
    errors.name = 'Please use letters only in your name (spaces, full stops, hyphens and apostrophes are fine).';

  /* --- Phone (required) --------------------------------------------- */
  const phone = normalisePhone(src.phone);
  if (phone.valid) {
    values.phone = phone.e164;
    values.phoneDisplay = phone.display;
  } else {
    values.phone = '';
    values.phoneDisplay = '';
    errors.phone = phone.message;
  }

  /* --- Email (required) --------------------------------------------- */
  values.email = cleanLine(src.email, LIMITS.emailMax);
  if (!values.email) errors.email = 'Please enter your email address.';
  else if (!isValidEmail(values.email)) errors.email = 'Please enter a valid email address, for example name@example.com.';
  else values.email = values.email.replace(/@(.+)$/, (_, d) => `@${d.toLowerCase()}`);

  return { valid: Object.keys(errors).length === 0, errors, values };
}

/** Order in which fields appear on the form; used to focus the first invalid field. */
export const FIELD_ORDER = ['name', 'phone', 'email'];
