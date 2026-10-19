/**
 * Settings shared by the quotation form (browser) and the quotation endpoint (server).
 *
 * The form asks for a name, a mobile number and an email address (all three required).
 * Nothing else is collected, so there are no option lists here any more.
 */
export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
};

/** Where the form posts to, and the hidden anti-spam field name (must stay empty for real visitors). */
export const QUOTATION_ENDPOINT = '/api/quotation';
export const HONEYPOT_FIELD = 'company_website';
