import { expect } from '@playwright/test';

export const MOCK = 'http://127.0.0.1:4011';

export const mock = {
  reset: () => fetch(`${MOCK}/__reset`, { method: 'POST' }),
  emails: async () => (await fetch(`${MOCK}/__emails`)).json(),
  mode: (mode) =>
    fetch(`${MOCK}/__mode`, { method: 'POST', body: JSON.stringify({ mode }), headers: { 'content-type': 'application/json' } }),
};

export const form = (page) => page.getByTestId('quotation-form');

/** The free-quotation popup (the project lightbox is also a dialog, so it is picked out by name). */
export const quoteDialog = (page) => page.getByRole('dialog', { name: 'Request your free quotation' });

/** Opens the free-quotation popup with the header's "Get a Quote" button and waits until it is showing. */
export async function openQuote(page) {
  await page.getByRole('banner').getByRole('button', { name: 'Get a Quote', exact: true }).click();
  await expect(quoteDialog(page)).toBeVisible();
}

/** Fills the three required fields: name, mobile number and email address. */
export async function fillBasics(page, { name = 'Automated Test Customer', phone = '99496 21569', email = 'automated.test@example.com' } = {}) {
  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/mobile number/i).fill(phone);
  await page.getByLabel(/email address/i).fill(email);
}

export const submit = (page) => form(page).getByRole('button', { name: /request free quotation/i }).click();

export async function openSite(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Thoughtful Spaces');
  // The site scrolls smoothly for visitors. On the long page that animation can still be running when Playwright clicks and make the
  // click land on a stale position, so tests jump instantly (what is being tested is where things end up, not the animation).
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
}

export const fillValid = fillBasics;

/** Wait until the mock mailbox holds at least `n` messages (or time out). */
export async function waitForEmails(n, timeout = 8000) {
  const deadline = Date.now() + timeout;
  let list = await mock.emails();
  while (list.length < n && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
    list = await mock.emails();
  }
  return list;
}
