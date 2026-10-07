import type { Recipient } from './autofill';
import type { Template } from './template';
import { fillHTML, replaceWildcardsInText } from './wildcards';

/** One recipient of a merge and the values for their copy of the email. */
export interface MergeRow {
  recipient: Recipient;
  values: Record<string, string>;
}

/** What every copy shares besides the template: Cc/Bcc go on each email, and the original From is kept. */
export interface Envelope {
  cc: Recipient[];
  bcc: Recipient[];
  from?: Recipient;
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
  send(): void;
  on(event: 'sending' | 'destroy' | 'sendCanceled', listener: () => void): unknown;
}

export const SEND_TIMEOUT_MS = 15_000;

/** Fill a fresh compose window and send it. Resolves once Gmail starts sending. */
export function sendOne(compose: SendableCompose, message: OutgoingMessage, timeoutMs = SEND_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(new Error(error));
      else resolve();
    };
    // Gmail stops to ask (no subject, a bad address) without sending; the window stays open for the user.
    const timer = setTimeout(() => settle("Gmail didn't send it. Check the compose window."), timeoutMs);
    compose.on('sending', () => settle());
    compose.on('destroy', () => settle());
    compose.on('sendCanceled', () => settle('The send was canceled.'));

    try {
      compose.setToRecipients([formatAddress(message.to)]);
      compose.setCcRecipients(message.cc.map(formatAddress));
      compose.setBccRecipients(message.bcc.map(formatAddress));
      if (message.from) compose.setFromEmail(message.from.emailAddress);
      compose.setSubject(message.subject);
      // Replaces the whole body, Gmail's auto-inserted signature included; the template has its own.
      compose.setBodyHTML(message.html);
      compose.send();
    } catch (e) {
      settle(e instanceof Error ? e.message : String(e));
    }
  });
}

/** Sends each message from its own new Gmail compose window. */
export function composeSender(openCompose: () => Promise<SendableCompose>): Sender {
  return {
    async send(message) {
      await sendOne(await openCompose(), message);
    },
  };
}

/** Whether a Gmail compose window has file attachments, which a merge can't copy to the new emails. */
export function hasAttachments(composeElement: HTMLElement): boolean {
  return !!composeElement.querySelector('input[name="attach"]');
}
