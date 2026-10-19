/** Synthetic test data only. No real customer information belongs in this repository. */

/** 2026-10-15 14:00 IST (08:30 UTC). */
export const NOW = new Date('2026-10-15T08:30:00Z');
export const TODAY_IST = '2026-10-15';

/** A valid quotation request: a name, a mobile number and an email address (all three are required). */
export const validPayload = (overrides = {}) => ({
  name: 'Test Customer',
  phone: '99496 21569',
  email: 'test.customer@example.com',
  ...overrides,
});
