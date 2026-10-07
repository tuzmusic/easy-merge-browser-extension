// Builds the RFC 2822 message the Gmail API's `messages.send` takes as `raw`.
import type { Recipient } from './autofill';
import type { OutgoingMessage } from './merge';

const utf8 = new TextEncoder();

function base64(text: string): string {
  let binary = '';
  for (const byte of utf8.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** URL-safe base64 without padding, as the Gmail API wants `raw`. */
export const base64Url = (text: string) => base64(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const isAscii = (text: string) => /^[\x20-\x7e]*$/.test(text);
// Header values come from Gmail, but a stray line break would start a new header.
const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ');

/**
 * RFC 2047 encoded words for non-ASCII header text, split so each stays under the 75-char limit and no
 * UTF-8 character is cut in half.
 */
export function encodeHeader(text: string): string {
  text = oneLine(text);
  if (isAscii(text)) return text;
  const chunks: string[] = [];
  let chunk = '';
  for (const char of text) {
    if (utf8.encode(chunk + char).length > 45) {
      chunks.push(chunk);
      chunk = '';
    }
    chunk += char;
  }
  chunks.push(chunk);
  return chunks.map((c) => `=?UTF-8?B?${base64(c)}?=`).join('\r\n ');
}

export function mimeAddress(r: Recipient): string {
  const email = oneLine(r.emailAddress);
  const name = r.name ? oneLine(r.name).trim() : '';
  if (!name || name.toLowerCase() === email.toLowerCase()) return email;
  return `${isAscii(name) ? `"${name.replace(/["\\]/g, '\\$&')}"` : encodeHeader(name)} <${email}>`;
}

const wrap = (b64: string) => b64.match(/.{1,76}/g)?.join('\r\n') ?? '';

/** A multipart/alternative message: `text` as the plain-text part, `message.html` as the HTML part. */
export function buildMime(message: OutgoingMessage, text: string, boundary = `easymerge-${crypto.randomUUID()}`): string {
  const { from, to, cc, bcc, subject, html } = message;
  const part = (type: string, body: string) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap(base64(body)),
  ];
  return [
    ...(from ? [`From: ${mimeAddress(from)}`] : []),
    `To: ${mimeAddress(to)}`,
    ...(cc.length ? [`Cc: ${cc.map(mimeAddress).join(', ')}`] : []),
    // Gmail strips Bcc from what recipients see and delivers to these addresses.
    ...(bcc.length ? [`Bcc: ${bcc.map(mimeAddress).join(', ')}`] : []),
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    ...part('text/plain', text),
    ...part('text/html', html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}
