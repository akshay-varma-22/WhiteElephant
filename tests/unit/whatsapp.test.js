import { describe, expect, it } from 'vitest';
import { BUSINESS, SITE } from '../../src/config/site.js';
import { WHATSAPP_LABEL, whatsappUrl } from '../../src/lib/whatsapp.js';

describe('the WhatsApp link', () => {
  it('goes to the studio number 7672020294 (with the Indian country code) in WhatsApp\'s official click-to-chat form', () => {
    const url = new URL(whatsappUrl());
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/917672020294'); // digits only: no +, spaces or dashes
  });

  it('uses the number given for WhatsApp, which is one of the two numbers already published on the site', () => {
    expect(BUSINESS.whatsapp.e164).toBe('+917672020294');
    expect(BUSINESS.whatsapp.display).toBe('+91 76720 20294');
    expect(BUSINESS.phones.map((p) => p.e164)).toContain(BUSINESS.whatsapp.e164);
  });

  it('carries the ready-to-send message, safely encoded', () => {
    const url = new URL(whatsappUrl());
    expect(url.searchParams.get('text')).toBe(SITE.whatsappMessage);
    expect(SITE.whatsappMessage).toMatch(/interior design services/i);
    expect(SITE.whatsappMessage).toMatch(/White Elephant Creative Studio/);
    // Nothing unencoded that could break the address (spaces, line breaks, quotes, & or #).
    expect(whatsappUrl()).not.toMatch(/[\s"<>#]/);
    expect(whatsappUrl().split('?text=')[1]).toBe(encodeURIComponent(SITE.whatsappMessage));
  });

  it("types the owner's exact message, with its line breaks and curly apostrophe, into the WhatsApp box", () => {
    const owners = [
      'Hello White Elephant Creative Studio,',
      '',
      'I’m interested in your interior design services and would appreciate it if you could share more details about your offerings.',
      '',
      'I look forward to hearing from you.',
      '',
      'Thank you!',
    ].join('\n');
    expect(SITE.whatsappMessage).toBe(owners);
    const url = whatsappUrl();
    expect(new URL(url).searchParams.get('text')).toBe(owners); // WhatsApp reads the same text back, line breaks included
    expect(url).toContain('%0A%0A'); // blank lines between the paragraphs
    expect(url).toContain('I%E2%80%99m'); // the curly apostrophe, encoded
    expect(url).not.toMatch(/[\r\n]/); // no raw line break in the address itself
  });

  it('can build a link for another number or message, and leaves the text off when there is none', () => {
    expect(whatsappUrl({ number: '+44 7911 123456', message: 'Hi & hello #1' })).toBe('https://wa.me/447911123456?text=Hi%20%26%20hello%20%231');
    expect(whatsappUrl({ message: '' })).toBe('https://wa.me/917672020294');
  });

  it('has an accessible name that says what it does', () => {
    expect(WHATSAPP_LABEL).toBe('Chat with us on WhatsApp');
  });
});
