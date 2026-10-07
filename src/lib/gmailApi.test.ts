import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiSender, authUrl, describeGmailError, parseAuthRedirect } from './gmailApi';
import type { OutgoingMessage } from './merge';
import { base64Url, buildMime, encodeHeader, mimeAddress } from './mime';

const fromBase64Url = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
const fromBase64 = (s: string) => fromBase64Url(s.replace(/\r\n/g, ''));

const message: OutgoingMessage = {
  from: { emailAddress: 'me@x.com', name: 'Jonathan Tuzman' },
  to: { emailAddress: 'jane@acme.com', name: 'Jane Doe' },
  cc: [{ emailAddress: 'c@x.com' }],
  bcc: [{ emailAddress: 'b@x.com', name: 'CRM' }],
  subject: 'Hello Jane',
  html: '<div>Hi Jane</div>',
};

describe('mime', () => {
  it('encodes headers only when needed', () => {
    expect(encodeHeader('Hello')).toBe('Hello');
    expect(encodeHeader('Café')).toBe(`=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode('Café')))}?=`);
    expect(encodeHeader('a\r\nBcc: x@y.com')).toBe('a Bcc: x@y.com');
  });
  it('splits long encoded subjects without cutting characters', () => {
    const subject = 'Ünïcödé '.repeat(12);
    const words = encodeHeader(subject).split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    expect(words.every((w) => w.length <= 75)).toBe(true);
    expect(words.map((w) => fromBase64(w.slice(10, -2))).join('')).toBe(subject);
  });
  it('formats addresses', () => {
    expect(mimeAddress({ emailAddress: 'j@x.com', name: 'Jane "JD" Doe' })).toBe('"Jane \\"JD\\" Doe" <j@x.com>');
    expect(mimeAddress({ emailAddress: 'j@x.com', name: 'José' })).toMatch(/^=\?UTF-8\?B\?.+\?= <j@x.com>$/);
    expect(mimeAddress({ emailAddress: 'j@x.com' })).toBe('j@x.com');
  });
  it('builds a multipart message', () => {
    const mime = buildMime(message, 'Hi Jane', 'BOUNDARY');
    const [head, body] = mime.split('\r\n\r\n');
    expect(head.split('\r\n')).toEqual([
      'From: "Jonathan Tuzman" <me@x.com>',
      'To: "Jane Doe" <jane@acme.com>',
      'Cc: c@x.com',
      'Bcc: "CRM" <b@x.com>',
      'Subject: Hello Jane',
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="BOUNDARY"',
    ]);
    expect(body).toBe('--BOUNDARY\r\nContent-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: base64');
    const parts = mime.split('--BOUNDARY');
    expect(fromBase64(parts[1].split('\r\n\r\n')[1].trim())).toBe('Hi Jane');
    expect(fromBase64(parts[2].split('\r\n\r\n')[1].trim())).toBe('<div>Hi Jane</div>');
    expect(mime.endsWith('--BOUNDARY--\r\n')).toBe(true);
  });
  it('base64url-encodes UTF-8', () => {
    const encoded = base64Url('Ünïcödé ✓ ?>');
    expect(encoded).not.toMatch(/[+/=]/);
    expect(fromBase64Url(encoded)).toBe('Ünïcödé ✓ ?>');
  });
});

describe('auth', () => {
  it('builds the authorize URL', () => {
    const url = new URL(authUrl({ clientId: 'cid', redirectUri: 'https://abc.chromiumapp.org/', account: 'me@x.com', interactive: false }));
    expect(url.searchParams.get('login_hint')).toBe('me@x.com');
    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.send email');
    expect(new URL(authUrl({ clientId: 'c', redirectUri: 'r', account: 'a', interactive: true })).searchParams.has('prompt')).toBe(false);
  });
  it('parses the redirect', () => {
    expect(parseAuthRedirect('https://abc.chromiumapp.org/#access_token=T&expires_in=3599&token_type=Bearer'))
      .toEqual({ accessToken: 'T', expiresIn: 3599 });
    expect(() => parseAuthRedirect('https://abc.chromiumapp.org/#error=access_denied')).toThrow('declined');
    expect(() => parseAuthRedirect('https://abc.chromiumapp.org/#error=interaction_required')).toThrow('interaction_required');
    expect(() => parseAuthRedirect(undefined)).toThrow('no token');
  });
});

describe('describeGmailError', () => {
  it('names the sending limit', () => {
    expect(describeGmailError(429, undefined)).toMatch(/sending limit/);
    expect(describeGmailError(403, { error: { message: 'x', errors: [{ reason: 'dailyLimitExceeded' }] } })).toMatch(/sending limit/);
  });
  it("passes Google's message through", () => {
    expect(describeGmailError(400, { error: { message: 'Invalid To header' } })).toBe('Invalid To header');
    expect(describeGmailError(500, undefined)).toBe('Gmail returned an error (500).');
  });
});

describe('apiSender', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the raw message through the background worker', async () => {
    const sendMessage = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('chrome', { runtime: { sendMessage } });
    await apiSender('me@x.com').send(message);
    const [request] = sendMessage.mock.calls[0];
    expect(request).toMatchObject({ easymerge: 'send', account: 'me@x.com' });
    expect(fromBase64Url(request.raw)).toContain('To: "Jane Doe" <jane@acme.com>');
    expect(fromBase64Url(request.raw)).toContain(btoa('Hi Jane'));
  });
  it('throws the background error', async () => {
    vi.stubGlobal('chrome', { runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: false, error: 'nope' }) } });
    await expect(apiSender('me@x.com').send(message)).rejects.toThrow('nope');
  });
});
