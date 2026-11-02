/**
 * @format
 */

import { isValidEmail, validateSignup } from '@/utils/validation';

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'first.last@sub.domain.org',
    'a@b.c',
    'a@b_c.com',
    'first.last@mail.school.co.uk',
    'user+tag@a-b.example.com',
  ])('accepts %s', email => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    '',
    'abc',
    'abc@',
    'abc@domain',
    '@domain.com',
    'a b@c.com',
    'a@.com',
    'a@com.',
    'a@b@c.com',
    'a@b..c',
    'a@...',
    'a@-.-',
    'a@.b.c',
    'a@b.-c',
    'a@b-.c',
    'a@-b.com',
    'a@b..com',
  ])('rejects "%s"', email => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('rejects missing values', () => {
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });

  it('stays fast on a long malformed email (no regex backtracking)', () => {
    const malformed = `a@${'x.'.repeat(50000)} `;
    const start = Date.now();
    expect(isValidEmail(malformed)).toBe(false);
    expect(Date.now() - start).toBeLessThan(100);
  });
});

describe('validateSignup email check', () => {
  const base = { accountType: 'Individual', password: 'secret123' };

  it('still rejects an invalid email with the same message', () => {
    expect(validateSignup({ ...base, email: 'abc' })).toBe(
      'Please enter a valid email address',
    );
  });

  it('still accepts a valid email', () => {
    expect(validateSignup({ ...base, email: 'user@example.com' })).toBeNull();
  });
});

describe('validateSignup (organisation account)', () => {
  const validOrganisation = {
    accountType: 'Organization',
    orgName: 'Acme',
    email: 'user@example.com',
    password: 'secret1',
    country: 'Nigeria',
  };

  test('asks for an organisation name when it is missing', () => {
    expect(validateSignup({ ...validOrganisation, orgName: '  ' })).toBe(
      'Organisation name is required',
    );
  });

  test("asks for the organisation's country when it is missing", () => {
    expect(validateSignup({ ...validOrganisation, country: '' })).toBe(
      "Please select your organisation's country",
    );
  });

  test('accepts a complete organisation sign up', () => {
    expect(validateSignup(validOrganisation)).toBeNull();
  });
});
