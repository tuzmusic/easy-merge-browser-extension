import type { Recipient } from './autofill';
import type { Template } from './template';
import { fillHTML, replaceWildcardsInText, textOfElement } from './wildcards';

/** One recipient of a merge and the values for their copy of the email. */
export interface MergeRow {
  recipient: Recipient;
  values: Record<string, string>;
}

/**
 * What every copy shares besides the template: Cc/Bcc go on each email, the original From is kept, and
 * the draft's attachments are uploaded again to each one.
 */
export interface Envelope {
  cc: Recipient[];
  bcc: Recipient[];
  from?: Recipient;
  attachments?: File[];
}

export interface OutgoingMessage extends Envelope {
  to: Recipient;
  subject: string;
  html: string;
}

export interface Sender {
  send(message: OutgoingMessage): Promise<void>;
}

export type RowStatus = 'queued' | 'sending' | 'sent' | 'failed';

/** Recipients in order, without repeats of the same address. */
export function uniqueRecipients(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const key = r.emailAddress.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** `"Jane Doe" <jane@acme.com>`, or the bare address when there's no display name. */
export function formatAddress(r: Recipient): string {
  const name = r.name?.trim();
  if (!name || name.toLowerCase() === r.emailAddress.toLowerCase()) return r.emailAddress;
  return `"${name.replace(/["\\]/g, '\\$&')}" <${r.emailAddress}>`;
}

export function buildMessage(template: Template, envelope: Envelope, row: MergeRow): OutgoingMessage {
  const filled = Object.fromEntries(Object.entries(row.values).filter(([, v]) => v !== ''));
  return {
    ...envelope,
    to: row.recipient,
    subject: replaceWildcardsInText(template.subject, filled),
    html: fillHTML(template.html, filled),
  };
}

/**
 * Values that were the same in every row (like `_MONTH`), to remember for next time. Per-person
 * values like names would be wrong as everyone's suggestion.
 */
export function sharedValues(rows: MergeRow[]): Record<string, string> {
  const [first, ...rest] = rows;
  if (!first) return {};
  return Object.fromEntries(
    Object.entries(first.values).filter(([w, v]) => v.trim() && rest.every((r) => r.values[w] === v)),
  );
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send one message per row, in order. Stops at the first failure, since it's usually something that
 * would fail the rest too (a quota, a Gmail error), and when `shouldStop` says so. Rows it didn't get
 * to stay `queued`.
 */
export async function runMerge({
  messages, sender, report, shouldStop = () => false, pauseMs = 750,
}: {
  messages: OutgoingMessage[];
  sender: Sender;
  report?(index: number, status: RowStatus, error?: string): void;
  shouldStop?(): boolean;
  pauseMs?: number;
}): Promise<RowStatus[]> {
  const statuses: RowStatus[] = messages.map(() => 'queued');
  const set = (i: number, status: RowStatus, error?: string) => {
    statuses[i] = status;
    report?.(i, status, error);
  };

  for (const [i, message] of messages.entries()) {
    if (shouldStop()) break;
    if (i > 0 && pauseMs) await pause(pauseMs);
    set(i, 'sending');
    try {
      await sender.send(message);
      set(i, 'sent');
    } catch (e) {
      set(i, 'failed', e instanceof Error ? e.message : String(e));
      break;
    }
  }
  return statuses;
}

/** Minimal slice of InboxSDK's ComposeView needed to send one message from it. */
export interface SendableCompose {
  setToRecipients(emails: string[]): void;
  setCcRecipients(emails: string[]): void;
  setBccRecipients(emails: string[]): void;
  setFromEmail(email: string): void;
  setSubject(text: string): void;
  setBodyHTML(html: string): void;
  getBodyElement(): HTMLElement;
  getElement(): HTMLElement;
  send(): void;
  on(event: 'sending' | 'destroy' | 'sendCanceled', listener: () => void): unknown;
}

export const SEND_TIMEOUT_MS = 15_000;
export const ATTACH_TIMEOUT_MS = 120_000;
export const BODY_SETTLE_MS = 400;
const BODY_ATTEMPTS = 5;

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Set the body of a just-opened compose and wait until it sticks. Gmail is still setting the window up
 * (it inserts the signature after opening) and can wipe or ignore a body set too early, which sends
 * an empty email.
 */
async function setBody(compose: SendableCompose, html: string, settleMs: number): Promise<void> {
  const probe = document.createElement('div');
  probe.innerHTML = html;
  const expected = normalize(textOfElement(probe));
  for (let attempt = 0; attempt < BODY_ATTEMPTS; attempt++) {
    // Replaces the whole body, Gmail's auto-inserted signature included; the template has its own.
    compose.setBodyHTML(html);
    // Let Gmail's editor know the body changed, as typing would.
    compose.getBodyElement().dispatchEvent(new Event('input', { bubbles: true }));
    await pause(settleMs);
    if (normalize(textOfElement(compose.getBodyElement())) === expected) return;
  }
  throw new Error("Gmail didn't keep the email's body, so it wasn't sent.");
}

/** Fill a fresh compose window and send it. Resolves once Gmail starts sending. */
export function sendOne(
  compose: SendableCompose, message: OutgoingMessage, timeoutMs = SEND_TIMEOUT_MS, settleMs = BODY_SETTLE_MS,
  attachTimeoutMs = ATTACH_TIMEOUT_MS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve();
    };
    compose.on('sending', () => settle());
    compose.on('destroy', () => settle());
    compose.on('sendCanceled', () => settle('The send was canceled.'));

    (async () => {
      compose.setToRecipients([formatAddress(message.to)]);
      compose.setCcRecipients(message.cc.map(formatAddress));
      compose.setBccRecipients(message.bcc.map(formatAddress));
      if (message.from) compose.setFromEmail(message.from.emailAddress);
      compose.setSubject(message.subject);
      await setBody(compose, message.html, settleMs);
      if (message.attachments?.length) await attachFiles(compose.getElement(), message.attachments, attachTimeoutMs);
      if (settled) return;
      // Started only now, so a slow upload doesn't count against it.
      // Gmail stops to ask (no subject, a bad address) without sending; the window stays open for the user.
      timer = setTimeout(() => settle("Gmail didn't send it. Check the compose window."), timeoutMs);
      compose.send();
    })().catch((e) => settle(e instanceof Error ? e.message : String(e)));
  });
}

/** Sends each message from the compose window `composeFor` gives it (usually a new one). */
export function composeSender(composeFor: (message: OutgoingMessage) => Promise<SendableCompose>): Sender {
  return {
    async send(message) {
      await sendOne(await composeFor(message), message);
    },
  };
}

/** How many attachments a Gmail draft has. Gmail marks each with an `attach` input (sometimes hidden, sometimes a checkbox). */
export const attachmentCount = (composeElement: HTMLElement) =>
  composeElement.querySelectorAll('input[name="attach"]').length;

// An attachment chip's download link. It only appears once the file has finished uploading.
const ATTACHMENT_LINK = 'a[href*="view=att"]';

const attachmentLinks = (composeElement: HTMLElement) =>
  [...composeElement.querySelectorAll<HTMLAnchorElement>(ATTACHMENT_LINK)];

/** The name on an attachment chip, without the size Gmail adds to the link text ("notes.pdf (12K)"). */
function attachmentName(link: HTMLAnchorElement): string {
  const label = link.querySelector('.vI')?.textContent?.trim();
  return label || link.textContent!.trim().replace(/\s*\([\d.]+\s*[KMG]?B?\)$/i, '');
}

/**
 * Download the files attached to a Gmail draft, to attach to each merged copy. Throws rather than
 * returning fewer files than the draft has (one still uploading, or a kind we can't read), so nobody
 * gets an email missing an attachment.
 */
export async function readAttachments(composeElement: HTMLElement, fetchFile = fetch): Promise<File[]> {
  const expected = attachmentCount(composeElement);
  const links = attachmentLinks(composeElement);
  if (links.length !== expected) {
    throw new Error("Couldn't read all of this draft's attachments (inline images can't be copied yet), so nothing was sent.");
  }
  return Promise.all(links.map(async (link) => {
    const name = attachmentName(link);
    const response = await fetchFile(link.href, { credentials: 'include' });
    if (!response.ok) throw new Error(`Couldn't download the attachment ${name}, so nothing was sent.`);
    const blob = await response.blob();
    return new File([blob], name, { type: blob.type });
  }));
}

/**
 * Attach files to a compose window through its own file picker input, as choosing them by hand would,
 * and wait until Gmail has uploaded them all.
 */
export async function attachFiles(composeElement: HTMLElement, files: File[], timeoutMs = ATTACH_TIMEOUT_MS) {
  const win = composeElement.closest<HTMLElement>('.AD') ?? composeElement;
  const input = win.querySelector<HTMLInputElement>('input[type="file"][name="Filedata"]');
  if (!input) throw new Error("Couldn't attach files to the email, so it wasn't sent.");
  const expected = attachmentLinks(composeElement).length + files.length;
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const deadline = Date.now() + timeoutMs;
  while (attachmentLinks(composeElement).length < expected) {
    if (Date.now() > deadline) throw new Error("The attachments didn't finish uploading, so the email wasn't sent.");
    await pause(250);
  }
}
