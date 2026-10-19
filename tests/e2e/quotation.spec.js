import { expect, test } from '@playwright/test';
import { fillBasics, fillValid, form, mock, openQuote, openSite, submit, waitForEmails } from './helpers.js';

// The form is a popup: every test starts with it open, as a visitor would have it.
test.beforeEach(async ({ page }) => {
  await mock.reset();
  await openSite(page);
  await openQuote(page);
});

const success = (page) => page.getByTestId('quotation-success');
const formError = (page) => page.getByTestId('form-error');

test.describe('the form has only three fields', () => {
  test('name, mobile number and email are all required, and nothing else is asked', async ({ page }) => {
    const fields = form(page).locator('input:not([tabindex="-1"]), select, textarea');
    await expect(fields).toHaveCount(3);
    await expect(page.getByLabel(/full name/i)).toHaveAttribute('aria-required', 'true');
    await expect(page.getByLabel(/mobile number/i)).toHaveAttribute('aria-required', 'true');
    await expect(page.getByLabel(/email address/i)).toHaveAttribute('aria-required', 'true');
    await expect(form(page)).not.toContainText('(optional)');
  });

  test('each empty field shows its prompt, which disappears as soon as typing starts and is dark enough to read', async ({ page }) => {
    const name = page.getByLabel(/full name/i);
    const phone = page.getByLabel(/mobile number/i);
    const email = page.getByLabel(/email address/i);
    await expect(name).toHaveAttribute('placeholder', 'Please enter your name');
    await expect(phone).toHaveAttribute('placeholder', 'Please enter your mobile number');
    await expect(email).toHaveAttribute('placeholder', 'Please enter your email');
    // The prompt is only shown while the field is empty.
    for (const field of [name, phone, email]) {
      expect(await field.evaluate((el) => el.matches(':placeholder-shown'))).toBe(true);
      await field.fill('x');
      expect(await field.evaluate((el) => el.matches(':placeholder-shown'))).toBe(false);
      await field.fill('');
    }
    // Each prompt has real contrast against the white field (WCAG AA for text is 4.5:1).
    const ratios = await page.evaluate(() => {
      const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
      return ['field-name', 'field-phone', 'field-email'].map((id) => {
        const el = document.getElementById(id);
        const fg = lum(rgb(getComputedStyle(el, '::placeholder').color));
        const bg = lum(rgb(getComputedStyle(el).backgroundColor));
        return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      });
    });
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
    await expect(form(page).getByRole('checkbox')).toHaveCount(0);
    await expect(form(page).getByRole('radio')).toHaveCount(0);
  });
});

test.describe('lead delivery (end to end through the real handler)', () => {
  test('a name, a mobile number and an email reach the studio inbox', async ({ page }) => {
    await fillValid(page);
    await submit(page);
    await expect(success(page)).toContainText('Thank you, Automated');

    const [mail] = await waitForEmails(1);
    expect(mail.to).toEqual(['whiteelephantcreativestudio@gmail.com']);
    expect(mail.subject).toBe('New Quotation Lead — Automated Test Customer — +91 99496 21569');
    expect(mail.html).toContain('+91 99496 21569');
    expect(mail.text).toContain('Name: Automated Test Customer');
    expect(mail.text).toContain('Phone: +91 99496 21569');
    expect(mail.text).toContain('Email: automated.test@example.com');
    expect(mail.idempotencyKey).toMatch(/^wecs-/);
  });

  test('the email address is delivered, tappable, and used as the reply-to', async ({ page }) => {
    await fillBasics(page, { email: 'asha@example.com' });
    await submit(page);
    await expect(success(page)).toBeVisible();
    const [mail] = await waitForEmails(1);
    expect(mail.text).toContain('Email: asha@example.com');
    expect(mail.html).toContain('mailto:asha@example.com');
    expect(mail.reply_to).toEqual(['asha@example.com']);
  });

  test('an international number is accepted and delivered', async ({ page }) => {
    await fillBasics(page, { phone: '+44 7911 123456' });
    await submit(page);
    await expect(success(page)).toBeVisible();
    const [mail] = await waitForEmails(1);
    expect(mail.text).toContain('Phone: +447911123456'); // international numbers are shown in the international form, without spaces
  });
});

test.describe('validation in a real browser', () => {
  test('an empty form reports the name, the mobile number and the email, and sends nothing', async ({ page }) => {
    await submit(page);
    const summary = page.getByTestId('error-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Full name');
    await expect(summary).toContainText('Mobile number');
    await expect(summary).toContainText('Email address');
    await expect(page.getByLabel(/full name/i)).toBeFocused();
    expect(await waitForEmails(1, 800)).toHaveLength(0);
  });

  test('a bad mobile number is reported and nothing is sent', async ({ page }) => {
    await fillBasics(page, { phone: '12345' });
    await submit(page);
    await expect(page.getByTestId('error-summary')).toContainText(/valid mobile number/i);
    await expect(page.getByLabel(/mobile number/i)).toBeFocused();
    expect(await waitForEmails(1, 800)).toHaveLength(0);
  });

  test('a bad email address and a missing one are both reported, and nothing is sent until it is right', async ({ page }) => {
    await fillBasics(page, { email: 'not-an-email' });
    await submit(page);
    await expect(page.getByTestId('error-summary')).toContainText(/valid email address/i);
    await expect(page.getByLabel(/email address/i)).toBeFocused();
    expect(await waitForEmails(1, 800)).toHaveLength(0);
    await page.getByLabel(/email address/i).fill('');
    await submit(page);
    await expect(page.getByTestId('error-summary')).toContainText(/enter your email address/i);
    expect(await waitForEmails(1, 800)).toHaveLength(0);
    await page.getByLabel(/email address/i).fill('asha@example.com');
    await submit(page);
    await expect(success(page)).toBeVisible();
    expect(await waitForEmails(1)).toHaveLength(1);
  });

  test('errors clear and submission works once the fields are fixed', async ({ page }) => {
    await submit(page);
    await expect(page.getByTestId('error-summary')).toBeVisible();
    await fillValid(page);
    await submit(page);
    await expect(success(page)).toBeVisible();
    await expect(page.getByTestId('error-summary')).toHaveCount(0);
  });

  test('typing a bad number and pressing the button right away still sends on the first click once it is fixed', async ({ page }) => {
    await fillBasics(page, { phone: '999' });
    await page.getByLabel(/mobile number/i).fill('99496 21569');
    await submit(page);
    await expect(success(page)).toBeVisible();
  });
});

test.describe('failure handling', () => {
  test('a network failure keeps the form and a retry succeeds without duplicates', async ({ page }) => {
    await fillBasics(page, { email: 'keep@example.com' });
    await page.route('**/api/quotation', (route) => route.abort('failed'));
    await submit(page);

    await expect(formError(page)).toContainText(/couldn’t reach our server/i);
    await expect(success(page)).toHaveCount(0);
    await expect(page.getByLabel(/full name/i)).toHaveValue('Automated Test Customer');
    await expect(page.getByLabel(/mobile number/i)).toHaveValue('99496 21569');
    await expect(page.getByLabel(/email address/i)).toHaveValue('keep@example.com');
    expect(await mock.emails()).toHaveLength(0);

    await page.unroute('**/api/quotation');
    await submit(page);
    await expect(success(page)).toBeVisible();
    expect(await waitForEmails(1)).toHaveLength(1);
  });

  test('an email-provider failure is reported as a failure, never as success', async ({ page }) => {
    await mock.mode('server_error');
    await fillValid(page);
    await submit(page);
    await expect(formError(page)).toContainText(/couldn’t send your enquiry/i);
    await expect(formError(page)).toContainText('+91 76720 20294');
    await expect(success(page)).toHaveCount(0);
    expect(await mock.emails()).toHaveLength(0);
    await expect(page.getByLabel(/full name/i)).toHaveValue('Automated Test Customer');

    await mock.mode('ok');
    await submit(page);
    await expect(success(page)).toBeVisible();
    expect(await waitForEmails(1)).toHaveLength(1);
  });

  test('a rejected sender / unverified domain (403) is reported as failure', async ({ page }) => {
    await mock.mode('forbidden');
    await fillValid(page);
    await submit(page);
    await expect(formError(page)).toBeVisible();
    await expect(success(page)).toHaveCount(0);
  });

  test('rapid double-clicking sends exactly one lead', async ({ page }) => {
    await fillValid(page);
    let posts = 0;
    await page.route('**/api/quotation', async (route) => {
      posts += 1;
      await new Promise((r) => setTimeout(r, 700)); // keep the first request in flight
      await route.continue();
    });
    const button = form(page).getByRole('button', { name: /request free quotation/i });
    await button.dblclick();
    await button.click({ force: true, trial: false }).catch(() => {}); // may already be disabled: that's the point
    await expect(success(page)).toBeVisible();
    expect(posts).toBe(1);
    expect(await waitForEmails(1)).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 800));
    expect(await mock.emails()).toHaveLength(1);
  });

  test('a lost response after the server accepted the lead does not create a duplicate on retry', async ({ page }) => {
    await fillValid(page);
    let first = true;
    await page.route('**/api/quotation', async (route) => {
      if (first) {
        first = false;
        await route.fetch(); // the server receives and processes the lead ...
        await route.abort('failed'); // ... but the browser never sees the answer
        return;
      }
      await route.continue();
    });
    await submit(page);
    await expect(formError(page)).toBeVisible();
    expect(await waitForEmails(1)).toHaveLength(1);

    await submit(page); // visitor retries
    await expect(success(page)).toBeVisible();
    await new Promise((r) => setTimeout(r, 500));
    expect(await mock.emails()).toHaveLength(1); // idempotency key de-duplicated the retry
  });

  test('a spam bot filling the honeypot gets no email', async ({ request }) => {
    const res = await request.post('/api/quotation', {
      data: { name: 'Bot Person', phone: '9949621569', email: 'bot@example.com', company_website: 'http://spam.example' },
    });
    expect(res.status()).toBe(200);
    expect(await mock.emails()).toHaveLength(0);
  });

  test('the API accepts a name, a number and an email, rejects invalid or incomplete direct posts and non-POST methods', async ({ request }) => {
    const ok = await request.post('/api/quotation', { data: { name: 'Direct Post', phone: '9949621569', email: 'direct@example.com' } });
    expect(ok.status()).toBe(200);
    expect(await waitForEmails(1)).toHaveLength(1);

    const bad = await request.post('/api/quotation', { data: { name: '', phone: 'x' } });
    expect(bad.status()).toBe(400);
    const body = await bad.json();
    expect(body.code).toBe('validation_error');
    expect(Object.keys(body.errors).sort()).toEqual(['email', 'name', 'phone']);
    // A name and a number without an email are no longer enough.
    const noEmail = await request.post('/api/quotation', { data: { name: 'Direct Post', phone: '9949621569' } });
    expect(noEmail.status()).toBe(400);
    expect(Object.keys((await noEmail.json()).errors)).toEqual(['email']);
    const get = await request.get('/api/quotation');
    expect(get.status()).toBe(405);
    expect(await mock.emails()).toHaveLength(1); // only the valid one
  });
});
