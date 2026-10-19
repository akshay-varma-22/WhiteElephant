import { describe, expect, it } from 'vitest';
import { FIELD_ORDER, cleanLine, isValidEmail, normalisePhone, validateQuotation } from '../../shared/quotation-validation.js';
import { validPayload } from '../fixtures.js';

const run = (overrides) => validateQuotation(validPayload(overrides));

describe('valid submissions', () => {
  it('accepts a name, a mobile number and an email address', () => {
    const r = run();
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
    expect(r.values.name).toBe('Test Customer');
    expect(r.values.phone).toBe('+919949621569');
    expect(r.values.phoneDisplay).toBe('+91 99496 21569');
    expect(r.values.email).toBe('test.customer@example.com');
  });

  it('needs all three: a name and a mobile number alone are not enough any more', () => {
    expect(validateQuotation({ name: 'Asha Rao', phone: '99496 21569', email: 'asha@example.com' }).valid).toBe(true);
    const noEmail = validateQuotation({ name: 'Asha Rao', phone: '99496 21569' });
    expect(noEmail.valid).toBe(false);
    expect(Object.keys(noEmail.errors)).toEqual(['email']);
    expect(noEmail.errors.email).toMatch(/enter your email/i);
  });

  it('asks for exactly three things, in this order', () => {
    expect(FIELD_ORDER).toEqual(['name', 'phone', 'email']);
    expect(Object.keys(run().values).sort()).toEqual(['email', 'name', 'phone', 'phoneDisplay']);
  });

  it('ignores any other fields in the payload (they never reach the email)', () => {
    const r = run({ services: ['architecture'], consent: false, location: 'x', description: 'y', callDate: '2020-01-01' });
    expect(r.valid).toBe(true);
    expect(Object.keys(r.values).sort()).toEqual(['email', 'name', 'phone', 'phoneDisplay']);
  });

  it('reports a problem for each required field that is missing', () => {
    const r = validateQuotation({});
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['email', 'name', 'phone']);
  });
});

describe('name', () => {
  it('requires a name', () => {
    for (const name of ['', '   ', undefined]) {
      const r = run({ name });
      expect(r.valid).toBe(false);
      expect(r.errors.name).toMatch(/full name/i);
    }
  });

  it('trims and collapses whitespace', () => {
    expect(run({ name: '  Asha   Rao  ' }).values.name).toBe('Asha Rao');
  });

  it('allows apostrophes, hyphens, initials and non-Latin letters', () => {
    for (const name of ["D'Souza", 'Mary-Anne Smith', 'A. K. Reddy', 'శ్రీనివాస్', 'प्रिया शर्मा']) {
      expect(run({ name }).errors.name, name).toBeUndefined();
    }
  });

  it('rejects digits, markup and links', () => {
    for (const name of ['1234', '<script>x</script>', 'http://spam.example']) {
      expect(run({ name }).errors.name, name).toBeDefined();
    }
  });

  it('rejects names over the limit', () => {
    expect(run({ name: 'A'.repeat(81) }).errors.name).toBeDefined();
  });

  it('strips control and invisible characters', () => {
    const r = run({ name: 'Test\u0000 Cus​tomer‮' });
    expect(r.values.name).toBe('Test Customer');
  });
});

describe('mobile number', () => {
  it('is required', () => {
    for (const phone of ['', '   ', undefined]) {
      const r = run({ phone });
      expect(r.valid).toBe(false);
      expect(r.errors.phone).toMatch(/mobile number/i);
    }
  });

  it.each([
    ['9949621569', '+919949621569'],
    ['99496 21569', '+919949621569'],
    ['+91 99496 21569', '+919949621569'],
    ['+91-99496-21569', '+919949621569'],
    ['919949621569', '+919949621569'],
    ['09949621569', '+919949621569'],
    ['0091 99496 21569', '+919949621569'],
    ['(+91) 76720 20294', '+917672020294'],
  ])('accepts Indian mobile %s', (input, e164) => {
    const r = normalisePhone(input);
    expect(r.valid).toBe(true);
    expect(r.e164).toBe(e164);
  });

  it.each(['+44 7911 123456', '+1 (415) 555 0132', '0044 7911 123456', '+971 50 123 4567'])(
    'accepts international number %s without rejecting it',
    (input) => {
      const r = normalisePhone(input);
      expect(r.valid).toBe(true);
      expect(r.e164).toMatch(/^\+[1-9]\d{7,14}$/);
    },
  );

  it.each([
    '',
    'abc',
    '12345',
    '5949621569', // Indian mobiles start 6-9
    '+91 5949621569',
    '+91 99496 2156', // 9 digits
    '99496 215690', // 11 digits
    '+',
    '++919949621569',
    '99496+21569',
    '+0 1234567890',
    '+1234567', // too short for E.164
    '+1234567890123456', // too long
    '9949621569<script>',
  ])('rejects %j', (input) => {
    expect(normalisePhone(input).valid).toBe(false);
    expect(run({ phone: input }).errors.phone).toBeDefined();
  });
});

describe('email', () => {
  it('is required', () => {
    for (const email of ['', '   ', undefined, null, {}, []]) {
      const r = run({ email });
      expect(r.valid, JSON.stringify(email)).toBe(false);
      expect(r.errors.email, JSON.stringify(email)).toMatch(/enter your email/i);
    }
  });

  it('accepts valid addresses and lowercases the domain', () => {
    const r = run({ email: 'Asha.Rao+quote@Example.COM' });
    expect(r.errors.email).toBeUndefined();
    expect(r.values.email).toBe('Asha.Rao+quote@example.com');
  });

  it.each(['plainaddress', '@example.com', 'a@b', 'a@@b.com', 'a b@example.com', 'a@exa mple.com', 'a..b@example.com', 'a@example.c', 'a@-example.com'])(
    'rejects %j',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
      expect(run({ email }).errors.email).toBeDefined();
    },
  );

  it('rejects CR/LF header-injection attempts', () => {
    expect(run({ email: 'a@example.com\r\nBcc: victim@example.com' }).errors.email).toBeDefined();
  });
});

describe('text cleaning', () => {
  it('collapses whitespace and limits the length', () => {
    expect(cleanLine('  a \n\t b  ')).toBe('a b');
    expect(cleanLine('x'.repeat(5000), 10).length).toBe(20);
  });

  it('turns hostile (non-text) values into empty text', () => {
    for (const v of [{}, [], true, null, undefined]) expect(cleanLine(v)).toBe('');
  });
});

describe('robustness', () => {
  it('never throws on hostile input shapes', () => {
    for (const input of [null, undefined, 'string', 42, [], { name: { toString: 1 } }, { phone: ['9949621569'] }, { email: {} }]) {
      expect(() => validateQuotation(input)).not.toThrow();
      expect(validateQuotation(input).valid).toBe(false);
    }
  });
});
