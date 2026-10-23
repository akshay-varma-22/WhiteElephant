import { describe, expect, it, vi } from 'vitest';
import { classifySmtpError, createSmtpMailer, gmailConfig } from '../../server/smtp-mailer.js';
import { resolveMail, selectProvider } from '../../server/mail.js';

const message = (over = {}) => ({
  to: ['studio@example.test'],
  subject: 'New Quotation Lead — Test — +91 99496 21569',
  html: '<p>hi</p>',
  text: 'hi',
  replyTo: 'customer@example.com',
  idempotencyKey: 'wecs-abc123',
  ...over,
});
const cfg = (over = {}) => ({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: 'studio@gmail.com',
  pass: 'abcdefghijklmnop',
  isTestServer: false,
  ...over,
});

function fakeTransport({ sendMail = vi.fn(async () => ({ messageId: '<x@y>', accepted: ['studio@example.test'] })) } = {}) {
  const createTransport = vi.fn(() => ({ sendMail, close: vi.fn() }));
  return { createTransport, sendMail };
}

describe('gmailConfig', () => {
  it('defaults to Gmail over SSL and strips the spaces Google puts in app passwords', () => {
    const c = gmailConfig({ GMAIL_USER: ' studio@gmail.com ', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' });
    expect(c).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: 'studio@gmail.com',
      pass: 'abcdefghijklmnop',
      isTestServer: false,
    });
  });

  it('falls back to the business email as the account and flags test servers', () => {
    const c = gmailConfig({ GMAIL_APP_PASSWORD: 'x', SMTP_HOST: '127.0.0.1', SMTP_PORT: '2525', SMTP_SECURE: 'false' });
    expect(c).toMatchObject({
      user: 'whiteelephantcreativestudio@gmail.com',
      host: '127.0.0.1',
      port: 2525,
      secure: false,
      isTestServer: true,
    });
  });
});

describe('sending', () => {
  it('connects to Gmail with the account + app password and sends from that account (not a spoofed address)', async () => {
    const t = fakeTransport();
    const mailer = createSmtpMailer({ createTransport: t.createTransport });
    const result = await mailer.send(cfg(), message());
    expect(result.ok).toBe(true);

    const options = t.createTransport.mock.calls[0][0];
    expect(options).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'studio@gmail.com', pass: 'abcdefghijklmnop' },
    });
    expect(options.tls).toEqual({ minVersion: 'TLSv1.2' });
    const sent = t.sendMail.mock.calls[0][0];
    expect(sent.from).toEqual({ name: 'White Elephant Creative Studio Website', address: 'studio@gmail.com' });
    expect(sent.to).toEqual(['studio@example.test']);
    expect(sent.replyTo).toBe('customer@example.com');
    expect(sent.subject).toBe('New Quotation Lead — Test — +91 99496 21569');
    expect(sent.messageId).toBe('<wecs-abc123@whiteelephantcreativestudio.in>');
  });

  it('omits replyTo when the visitor gave no email', async () => {
    const t = fakeTransport();
    await createSmtpMailer({ createTransport: t.createTransport }).send(cfg(), message({ replyTo: undefined }));
    expect(t.sendMail.mock.calls[0][0]).not.toHaveProperty('replyTo');
  });

  it('does not send the same message twice (duplicate/retry protection)', async () => {
    const t = fakeTransport();
    const mailer = createSmtpMailer({ createTransport: t.createTransport });
    await mailer.send(cfg(), message());
    const again = await mailer.send(cfg(), message());
    expect(again).toMatchObject({ ok: true, deduped: true });
    expect(t.sendMail).toHaveBeenCalledTimes(1);
    await mailer.send(cfg(), message({ idempotencyKey: 'wecs-other' }));
    expect(t.sendMail).toHaveBeenCalledTimes(2);
  });

  it('forgets keys after 24 hours', async () => {
    let clock = 1_000;
    const t = fakeTransport();
    const mailer = createSmtpMailer({ createTransport: t.createTransport, now: () => clock });
    await mailer.send(cfg(), message());
    clock += 25 * 60 * 60 * 1000;
    await mailer.send(cfg(), message());
    expect(t.sendMail).toHaveBeenCalledTimes(2);
  });

  it('does not remember a failed send, so the visitor can retry', async () => {
    const sendMail = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('nope'), { code: 'EAUTH', responseCode: 535 }))
      .mockResolvedValue({ messageId: '<x>', accepted: ['a@b.test'] });
    const mailer = createSmtpMailer({ createTransport: fakeTransport({ sendMail }).createTransport });
    expect((await mailer.send(cfg(), message())).ok).toBe(false);
    expect((await mailer.send(cfg(), message())).ok).toBe(true);
  });

  it('treats "no recipient accepted" as a failure', async () => {
    const t = fakeTransport({
      sendMail: vi.fn(async () => ({ messageId: '<x>', accepted: [], rejected: ['studio@example.test'] })),
    });
    const r = await createSmtpMailer({ createTransport: t.createTransport }).send(cfg(), message());
    expect(r).toMatchObject({ ok: false, code: 'smtp_rejected' });
  });

  it('retries once only when the connection failed before any data was sent', async () => {
    const connectFail = Object.assign(new Error('connect'), { code: 'ECONNECTION', command: 'CONN' });
    const sendMail = vi
      .fn()
      .mockRejectedValueOnce(connectFail)
      .mockResolvedValueOnce({ messageId: '<x>', accepted: ['a@b.test'] });
    const sleep = vi.fn(async () => {});
    const mailer = createSmtpMailer({ createTransport: fakeTransport({ sendMail }).createTransport, sleep });
    expect((await mailer.send(cfg(), message())).ok).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);

    // A timeout *after* the connection was made could mean the mail was delivered: never retry (it would duplicate).
    const lateTimeout = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', command: 'DATA' });
    const send2 = vi.fn().mockRejectedValue(lateTimeout);
    const m2 = createSmtpMailer({ createTransport: fakeTransport({ sendMail: send2 }).createTransport, sleep });
    const r = await m2.send(cfg(), message({ idempotencyKey: 'wecs-late' }));
    expect(r).toMatchObject({ ok: false, code: 'smtp_connection_failed', retryable: false });
    expect(send2).toHaveBeenCalledTimes(1);
  });
});

describe('error classification (never exposes server text or addresses)', () => {
  it.each([
    [{ code: 'EAUTH', responseCode: 535, response: '535-5.7.8 Username and Password not accepted' }, 'smtp_auth_failed', false],
    [{ responseCode: 534, response: '534 5.7.9 Application-specific password required' }, 'smtp_auth_failed', false],
    [{ responseCode: 550, response: '550 5.4.5 Daily user sending limit exceeded' }, 'smtp_quota_exceeded', false],
    [{ code: 'ECONNECTION', command: 'CONN' }, 'smtp_connection_failed', true],
    [{ code: 'ECONNREFUSED' }, 'smtp_connection_failed', true],
    [{ code: 'EDNS' }, 'smtp_connection_failed', true],
    [{ code: 'ETIMEDOUT', command: 'DATA' }, 'smtp_connection_failed', false],
    [{ responseCode: 451, response: '451 temporary' }, 'smtp_temporary_failure', false],
    [{ responseCode: 553, response: '553 bad recipient' }, 'smtp_rejected', false],
    [{ code: 'EENVELOPE' }, 'smtp_bad_message', false],
    [{}, 'smtp_error', false],
  ])('%j -> %s (retryable: %s)', (err, code, retryable) => {
    const c = classifySmtpError(Object.assign(new Error('secret.person@gmail.com leaked?'), err));
    expect(c.code).toBe(code);
    expect(c.retryable).toBe(retryable);
    expect(JSON.stringify(c)).not.toMatch(/secret|gmail\.com|leaked/);
  });
});

describe('provider selection', () => {
  it('picks Gmail when an app password is present, otherwise Resend, unless MAIL_PROVIDER says otherwise', () => {
    expect(selectProvider({ GMAIL_APP_PASSWORD: 'x' })).toBe('gmail');
    expect(selectProvider({ RESEND_API_KEY: 'k' })).toBe('resend');
    expect(selectProvider({})).toBe('resend');
    expect(selectProvider({ MAIL_PROVIDER: 'gmail' })).toBe('gmail');
    expect(selectProvider({ MAIL_PROVIDER: 'SMTP' })).toBe('gmail');
    expect(selectProvider({ MAIL_PROVIDER: 'resend', GMAIL_APP_PASSWORD: 'x' })).toBe('resend');
  });

  it('reports exactly which settings are missing for each provider', () => {
    expect(resolveMail({ MAIL_PROVIDER: 'gmail' }).missing).toEqual(['GMAIL_APP_PASSWORD']);
    expect(resolveMail({ MAIL_PROVIDER: 'gmail', GMAIL_APP_PASSWORD: 'x' }).missing).toEqual([]);
    expect(resolveMail({ MAIL_PROVIDER: 'resend' }).missing).toEqual(['RESEND_API_KEY']);
  });

  it('flags preview mode only for test servers', () => {
    expect(resolveMail({ GMAIL_APP_PASSWORD: 'x' }).demo).toBe(false);
    expect(resolveMail({ GMAIL_APP_PASSWORD: 'x', SMTP_HOST: '127.0.0.1' }).demo).toBe(true);
    expect(resolveMail({ RESEND_API_KEY: 'k', RESEND_API_URL: 'https://api.resend.com/emails' }).demo).toBe(false);
    expect(resolveMail({ RESEND_API_KEY: 'k', RESEND_API_URL: 'http://127.0.0.1:4010/emails' }).demo).toBe(true);
  });
});
