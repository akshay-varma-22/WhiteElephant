// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuotationForm from '../../src/components/quotation/QuotationForm.jsx';
import { NOW } from '../fixtures.js';

vi.mock('../../src/components/quotation/Turnstile.jsx', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef(function FakeTurnstile({ onToken }, ref) {
      React.useImperativeHandle(ref, () => ({ reset: () => onToken('') }));
      return React.createElement(
        'button',
        { type: 'button', onClick: () => onToken('fake-turnstile-token') },
        'Solve fake captcha',
      );
    }),
  };
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const okResponse = () => json(200, { ok: true, reference: 'WE-TEST01' });

let user;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); // only Date is faked so user-event timers keep working
  vi.setSystemTime(NOW);
  user = userEvent.setup({ delay: null });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const nameInput = () => screen.getByLabelText(/full name/i);
const phoneInput = () => screen.getByLabelText(/mobile number/i);
const emailInput = () => screen.getByLabelText(/email address/i);
const submitButton = () => screen.getByRole('button', { name: /request free quotation|sending/i });
const payloadOf = (fetchImpl, call = 0) => JSON.parse(fetchImpl.mock.calls[call][1].body);

async function fillValid({ name = 'Test Customer', phone = '99496 21569', email = 'test.customer@example.com' } = {}) {
  await user.type(nameInput(), name);
  await user.type(phoneInput(), phone);
  if (email) await user.type(emailInput(), email);
}

const renderForm = (props = {}) => {
  const fetchImpl = props.fetchImpl ?? vi.fn(async () => okResponse());
  render(<QuotationForm fetchImpl={fetchImpl} {...props} />);
  return fetchImpl;
};

describe('structure and accessibility', () => {
  it('asks for exactly three things, and all three are required: name, mobile number and email', () => {
    renderForm();
    expect(nameInput()).toHaveAttribute('aria-required', 'true');
    expect(phoneInput()).toHaveAttribute('aria-required', 'true');
    expect(emailInput()).toHaveAttribute('aria-required', 'true');
    expect(screen.queryByText('(optional)')).toBeNull();
    const form = screen.getByTestId('quotation-form');
    const visibleFields = [...form.querySelectorAll('input, select, textarea')].filter((el) => el.tabIndex !== -1);
    expect(visibleFields.map((el) => el.name)).toEqual(['name', 'phone', 'email']);
  });

  it('shows a prompt inside each empty field, in the owner’s words', () => {
    renderForm();
    expect(nameInput()).toHaveAttribute('placeholder', 'Please enter your name');
    expect(phoneInput()).toHaveAttribute('placeholder', 'Please enter your mobile number');
    expect(emailInput()).toHaveAttribute('placeholder', 'Please enter your email');
    // They are prompts, not labels: every field keeps its own visible label too.
    for (const input of [nameInput(), phoneInput(), emailInput()]) expect(input.labels.length).toBe(1);
  });

  it('has no service, project, location, budget, description, call-time or consent fields any more', () => {
    renderForm();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByLabelText(/location|budget|description|call date|call time/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /privacy/i })).toBeNull();
  });

  it('uses the right keyboard types for a phone and an email address', () => {
    renderForm();
    expect(phoneInput()).toHaveAttribute('type', 'tel');
    expect(phoneInput()).toHaveAttribute('autocomplete', 'tel');
    expect(emailInput()).toHaveAttribute('type', 'email');
    expect(nameInput()).toHaveAttribute('autocomplete', 'name');
  });

  it('keeps the honeypot out of the tab order and away from assistive tech', () => {
    renderForm();
    const trap = document.querySelector('input[name="company_website"]');
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows a short, non-blocking note about how the details are used', () => {
    renderForm();
    expect(screen.getByText(/only use your details to contact you about your enquiry/i)).toBeInTheDocument();
  });
});

describe('successful submissions', () => {
  it('sends the name, number and email, and shows the success message only after the server confirms', async () => {
    let finish;
    const fetchImpl = vi.fn(() => new Promise((resolve) => (finish = () => resolve(okResponse()))));
    renderForm({ fetchImpl });
    await fillValid();
    await user.click(submitButton());
    expect(screen.queryByTestId('quotation-success')).toBeNull(); // not yet: the server has not answered
    expect(submitButton()).toBeDisabled();

    await act(async () => finish());
    const success = await screen.findByTestId('quotation-success');
    expect(success).toHaveTextContent('Thank you, Test');
    expect(success).toHaveTextContent('WE-TEST01');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const sent = payloadOf(fetchImpl);
    expect(sent.name).toBe('Test Customer');
    expect(sent.phone).toBe('99496 21569');
    expect(sent.email).toBe('test.customer@example.com');
    expect(sent.submissionId).toMatch(/\S{8,}/);
    expect(Object.keys(sent).sort()).toEqual(['company_website', 'email', 'name', 'phone', 'submissionId']); // nothing else is sent
  });

  it('submits the email address as typed', async () => {
    const fetchImpl = renderForm();
    await fillValid({ email: 'asha@example.com' });
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(payloadOf(fetchImpl).email).toBe('asha@example.com');
  });

  it('accepts an international phone number', async () => {
    const fetchImpl = renderForm();
    await fillValid({ phone: '+44 7911 123456' });
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(payloadOf(fetchImpl).phone).toBe('+44 7911 123456');
  });

  it('lets a visitor start another enquiry after success', async () => {
    renderForm();
    await fillValid();
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    await user.click(screen.getByRole('button', { name: /send another enquiry/i }));
    expect(screen.getByTestId('quotation-form')).toBeInTheDocument();
    expect(nameInput()).toHaveValue('');
    expect(phoneInput()).toHaveValue('');
    expect(emailInput()).toHaveValue('');
  });
});

describe('inside the quotation popup (embedded)', () => {
  it('asks for the same three things, in one column, without the card styling', () => {
    renderForm({ embedded: true });
    const form = screen.getByTestId('quotation-form');
    expect(form.className).not.toMatch(/border|shadow/);
    expect([...form.querySelectorAll('input')].filter((el) => el.tabIndex !== -1).map((el) => el.name)).toEqual(['name', 'phone', 'email']);
    expect(form.querySelector('.grid').className).not.toMatch(/grid-cols-2/);
    expect(emailInput().closest('div').className).not.toMatch(/col-span-2/);
    expect(submitButton().className).toMatch(/w-full/);
  });

  it('tells the popup when the enquiry is sent and when the visitor starts another', async () => {
    const onSuccess = vi.fn();
    const onReset = vi.fn();
    renderForm({ embedded: true, onSuccess, onReset });
    await fillValid();
    expect(onSuccess).not.toHaveBeenCalled();
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /send another enquiry/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('quotation-form')).toBeInTheDocument();
  });

  it('does not call onSuccess when the server refuses the enquiry', async () => {
    const onSuccess = vi.fn();
    renderForm({ embedded: true, onSuccess, fetchImpl: vi.fn(async () => json(502, { ok: false })) });
    await fillValid();
    await user.click(submitButton());
    await screen.findByTestId('form-error');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('keeps the card styling and two columns when it is not embedded (the default)', () => {
    renderForm();
    const form = screen.getByTestId('quotation-form');
    expect(form.className).toMatch(/border/);
    expect(form.querySelector('.grid').className).toMatch(/sm:grid-cols-2/);
  });
});

describe('client-side validation', () => {
  it('blocks an empty form and names all three required fields', async () => {
    const fetchImpl = renderForm();
    await user.click(submitButton());
    expect(fetchImpl).not.toHaveBeenCalled();
    const summary = screen.getByTestId('error-summary');
    expect(summary).toHaveTextContent('Full name');
    expect(summary).toHaveTextContent('Mobile number');
    expect(summary).toHaveTextContent('Email address');
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true');
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(nameInput()).toHaveFocus(); // focus goes to the first problem
  });

  it('blocks submission when only the name is missing', async () => {
    const fetchImpl = renderForm();
    await user.type(phoneInput(), '99496 21569');
    await user.type(emailInput(), 'asha@example.com');
    await user.click(submitButton());
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-summary')).toHaveTextContent(/please enter your full name/i);
  });

  it('rejects an invalid mobile number and explains how to fix it', async () => {
    const fetchImpl = renderForm();
    await user.type(nameInput(), 'Asha Rao');
    await user.type(phoneInput(), '12345');
    await user.click(submitButton());
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error-summary')).toHaveTextContent(/valid mobile number/i);
    expect(phoneInput()).toHaveFocus();
  });

  it('requires the email: a missing one and a malformed one are both refused, a good one is sent', async () => {
    const fetchImpl = renderForm();
    await fillValid({ email: '' });
    await user.click(submitButton());
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(emailInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('error-summary')).toHaveTextContent(/enter your email address/i);
    expect(emailInput()).toHaveFocus();

    await user.type(emailInput(), 'not-an-email');
    await user.click(submitButton());
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.getByTestId('error-summary')).toHaveTextContent(/valid email address/i);

    await user.clear(emailInput());
    await user.type(emailInput(), 'asha@example.com');
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(payloadOf(fetchImpl).email).toBe('asha@example.com');
  });

  it('shows a field error once the visitor leaves the field, and clears it when fixed', async () => {
    renderForm();
    await user.type(phoneInput(), '123');
    await user.tab();
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
    await user.clear(phoneInput());
    await user.type(phoneInput(), '99496 21569');
    expect(phoneInput()).not.toHaveAttribute('aria-invalid');
  });

  it('clears the error summary when the form is fixed and sent', async () => {
    renderForm();
    await user.click(submitButton());
    expect(screen.getByTestId('error-summary')).toBeInTheDocument();
    await fillValid();
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(screen.queryByTestId('error-summary')).toBeNull();
  });
});

describe('failure handling and duplicate protection', () => {
  it('prevents duplicate submissions while a request is in flight', async () => {
    let finish;
    const fetchImpl = vi.fn(() => new Promise((resolve) => (finish = () => resolve(okResponse()))));
    renderForm({ fetchImpl });
    await fillValid();
    const form = screen.getByTestId('quotation-form');
    const button = submitButton();
    // Rapid-fire: two clicks and two Enter-style form submits before the first response arrives.
    await user.dblClick(button);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    await screen.findByTestId('quotation-success');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps entered values and explains a network failure, then retries with the same submission id', async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(okResponse());
    renderForm({ fetchImpl });
    await fillValid({ email: 'asha@example.com' });
    await user.click(submitButton());

    const banner = await screen.findByTestId('form-error');
    expect(banner).toHaveTextContent(/couldn’t reach our server/i);
    expect(banner).toHaveTextContent('+91 99496 21569');
    expect(screen.queryByTestId('quotation-success')).toBeNull();
    // Nothing the visitor typed was lost.
    expect(nameInput()).toHaveValue('Test Customer');
    expect(phoneInput()).toHaveValue('99496 21569');
    expect(emailInput()).toHaveValue('asha@example.com');
    expect(submitButton()).toBeEnabled();

    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(payloadOf(fetchImpl, 1).submissionId).toBe(payloadOf(fetchImpl, 0).submissionId);
  });

  it('never reports success when the email provider failed', async () => {
    const fetchImpl = vi.fn(async () => json(502, { ok: false, code: 'email_failed' }));
    renderForm({ fetchImpl });
    await fillValid();
    await user.click(submitButton());
    const banner = await screen.findByTestId('form-error');
    expect(banner).toHaveTextContent(/couldn’t send your enquiry/i);
    expect(banner).toHaveTextContent('whiteelephantcreativestudio@gmail.com');
    expect(screen.queryByTestId('quotation-success')).toBeNull();
    expect(nameInput()).toHaveValue('Test Customer');
  });

  it.each([
    ['an unexpected 200 without ok:true (e.g. static host without the function)', () => new Response('<html></html>', { status: 200 })],
    ['a 500', () => json(500, { ok: false })],
    ['a 503 not-configured', () => json(503, { ok: false, code: 'not_configured' })],
  ])('treats %s as a failure, not success', async (_label, make) => {
    renderForm({ fetchImpl: vi.fn(async () => make()) });
    await fillValid();
    await user.click(submitButton());
    expect(await screen.findByTestId('form-error')).toBeInTheDocument();
    expect(screen.queryByTestId('quotation-success')).toBeNull();
  });

  it('explains rate limiting', async () => {
    renderForm({ fetchImpl: vi.fn(async () => json(429, { ok: false, code: 'rate_limited' })) });
    await fillValid();
    await user.click(submitButton());
    expect(await screen.findByTestId('form-error')).toHaveTextContent(/several requests/i);
  });

  it('shows server-side field errors next to the fields', async () => {
    const fetchImpl = vi.fn(async () => json(400, { ok: false, code: 'validation_error', errors: { phone: 'Server says this phone number is not valid.' } }));
    renderForm({ fetchImpl });
    await fillValid();
    await user.click(submitButton());
    expect(await screen.findByTestId('error-summary')).toHaveTextContent(/server says this phone number/i);
    expect(phoneInput()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByTestId('quotation-success')).toBeNull();
  });

  it('sends the honeypot field empty for real visitors', async () => {
    const fetchImpl = renderForm();
    await fillValid();
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(payloadOf(fetchImpl).company_website).toBe('');
  });
});

describe('optional CAPTCHA', () => {
  it('asks for the check, then sends the token and requests a fresh one after each attempt', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json(502, { ok: false })).mockResolvedValueOnce(okResponse());
    renderForm({ fetchImpl, turnstileSiteKey: 'test-site-key' });
    await fillValid();

    await user.click(submitButton());
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await screen.findByTestId('form-error')).toHaveTextContent(/verify that you are human/i);

    await user.click(screen.getByRole('button', { name: /solve fake captcha/i }));
    await user.click(submitButton());
    await screen.findByText(/couldn’t send your enquiry/i);
    expect(payloadOf(fetchImpl, 0).turnstileToken).toBe('fake-turnstile-token');

    // The token was single-use and has been reset: a second attempt needs a new check.
    await user.click(submitButton());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /solve fake captcha/i }));
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('preview mode', () => {
  it('says plainly that no real email was sent when the server reports a test inbox', async () => {
    renderForm({ fetchImpl: vi.fn(async () => json(200, { ok: true, reference: 'WE-DEMO01', demo: true })) });
    await fillValid();
    await user.click(submitButton());
    expect(await screen.findByTestId('demo-notice')).toHaveTextContent(/no real email was sent/i);
  });

  it('shows no preview notice for real deliveries', async () => {
    renderForm();
    await fillValid();
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(screen.queryByTestId('demo-notice')).toBeNull();
  });
});

describe('privacy', () => {
  it('never writes the visitor’s answers to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    renderForm();
    await fillValid({ email: 'asha@example.com' });
    await user.click(submitButton());
    await screen.findByTestId('quotation-success');
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
    setItem.mockRestore();
  });
});

describe('submit client', () => {
  it('waits for the response before resolving (waitFor sanity check)', async () => {
    renderForm();
    await fillValid();
    await user.click(submitButton());
    await waitFor(() => expect(screen.getByTestId('quotation-success')).toBeInTheDocument());
  });
});
