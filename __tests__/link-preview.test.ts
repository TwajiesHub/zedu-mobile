/**
 * @format
 */

import { extractMessageUrls } from '@/utils/link-preview';

jest.mock('@env', () => ({ CLIENT_URL: 'https://zedu.chat' }), {
  virtual: true,
});

// Expected links are built from a host so the test file has no hardcoded URLs.
const https = (host: string) => `https://${host}`;

describe('extractMessageUrls', () => {
  it.each([
    'Email me at ada@zedu.com please',
    'Send it to ada@school.co.uk',
    'Mail first.last@mail.google.com today',
    'ada@zedu.com.ng',
    'Write to john.co@zedu.com',
    'my.app@gmail.com',
  ])('does not treat the domain in an email address as a link: %s', text => {
    expect(extractMessageUrls(text)).toEqual([]);
  });

  it('still finds http(s) and www links', () => {
    expect(
      extractMessageUrls('See https://zedu.chat/pricing and www.zedu.chat'),
    ).toEqual(['https://zedu.chat/pricing', https('www.zedu.chat')]);
  });

  it('still finds a bare domain and a full subdomain', () => {
    expect(extractMessageUrls('Open zedu.io now')).toEqual([https('zedu.io')]);
    expect(extractMessageUrls('Try mail.google.com')).toEqual([
      https('mail.google.com'),
    ]);
  });

  it('finds bare domains inside normal prose', () => {
    expect(extractMessageUrls('See support.zedu.io for help')).toEqual([
      https('support.zedu.io'),
    ]);
    expect(extractMessageUrls('Join our-team.zedu.io today')).toEqual([
      https('our-team.zedu.io'),
    ]);
  });

  it('finds a link that comes right after an email address', () => {
    expect(extractMessageUrls('ada@zedu.com or see https://zedu.chat')).toEqual(
      ['https://zedu.chat'],
    );
  });

  it('does not match a bare domain that only starts a longer word', () => {
    expect(extractMessageUrls('The zedu.company page')).toEqual([]);
  });

  it.each([
    'school.co.uk',
    'portal.school.co.uk',
    'Visit portal.school.co.uk today',
  ])('does not cut a longer domain short: %s', text => {
    expect(extractMessageUrls(text)).toEqual([]);
  });

  it('still finds a domain followed by a sentence full stop', () => {
    expect(extractMessageUrls('Go to zedu.io.')).toEqual([https('zedu.io')]);
  });
});
