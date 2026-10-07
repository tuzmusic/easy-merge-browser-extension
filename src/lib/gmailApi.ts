// Sending merged emails through the Gmail API. The content script builds each message; the background
// worker (src/background/gmail.ts) holds the OAuth token and makes the request, because content
// scripts can't use chrome.identity.
import type { OutgoingMessage, Sender } from './merge';
import { base64Url, buildMime } from './mime';
import { textOfElement } from './wildcards';

export type GmailRequest =
  | { easymerge: 'authorize'; account: string }
  | { easymerge: 'send'; account: string; raw: string };

export type GmailResponse = { ok: true } | { ok: false; error: string };

export const isGmailRequest = (value: unknown): value is GmailRequest =>
  typeof value === 'object' && value !== null && 'easymerge' in value;

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  // Only so we can check which account Google signed in, before sending anything from it.
  'email',
];

export function authUrl({ clientId, redirectUri, account, interactive }: {
  clientId: string;
  redirectUri: string;
  account: string;
  interactive: boolean;
}): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: GMAIL_SCOPES.join(' '),
    login_hint: account,
  });
  if (!interactive) params.set('prompt', 'none');
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** The token from the redirect Google sends back to `https://<extension-id>.chromiumapp.org/#...`. */
export function parseAuthRedirect(redirect: string | undefined): { accessToken: string; expiresIn: number } {
  const params = new URLSearchParams(new URL(redirect ?? 'about:blank').hash.slice(1));
  const error = params.get('error');
  if (error) throw new Error(error === 'access_denied' ? 'Gmail access was declined.' : `Google sign-in failed (${error}).`);
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('Google sign-in returned no token.');
  return { accessToken, expiresIn: Number(params.get('expires_in')) || 3600 };
}

interface GmailErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] };
}

export function describeGmailError(status: number, body: GmailErrorBody | undefined): string {
  const reasons = body?.error?.errors?.map((e) => e.reason ?? '') ?? [];
  if (status === 429 || reasons.some((r) => /rateLimitExceeded|dailyLimitExceeded|quotaExceeded/.test(r))) {
    return "Gmail's sending limit was reached. Try the rest later.";
  }
  return body?.error?.message ?? `Gmail returned an error (${status}).`;
}

async function request(message: GmailRequest): Promise<GmailResponse> {
  try {
    const response: GmailResponse | undefined = await chrome.runtime.sendMessage(message);
    return response ?? { ok: false, error: 'No response from EasyMerge.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Get a token for `account`, showing Google's consent popup if it's needed. */
export const authorize = (account: string) => request({ easymerge: 'authorize', account });

const textOfHTML = (html: string) => textOfElement(Object.assign(document.createElement('div'), { innerHTML: html }));

/** Sends each message with the Gmail API, from `account` (the Gmail tab's signed-in address). */
export function apiSender(account: string): Sender {
  return {
    async send(message: OutgoingMessage) {
      const raw = base64Url(buildMime(message, textOfHTML(message.html)));
      const response = await request({ easymerge: 'send', account, raw });
      if (!response.ok) throw new Error(response.error);
    },
  };
}
