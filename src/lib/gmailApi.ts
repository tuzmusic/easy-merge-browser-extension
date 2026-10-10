// Sending merged emails through the Gmail API. The content script builds each message; the background
// worker (src/background/gmail.ts) holds the OAuth token and makes the request, because content
// scripts can't use chrome.identity.
import type { OutgoingMessage, Sender } from './merge';
import { base64Url, buildMime } from './mime';
import { textOfElement } from './wildcards';

export type GmailRequest =
  | { easymerge: 'authorize'; account: string }
  | { easymerge: 'send'; account: string; raw: string };

export type GmailResponse = { ok: true } | { ok: false; error: string; problem?: GmailProblem; context?: SetupContext };

/** Ways the Gmail API setup can be wrong. Merges don't fall back to compose windows; these get the setup dialog. */
export type GmailProblem =
  | { kind: 'noClientId' }
  | { kind: 'badClientId' }
  | { kind: 'signInFailed'; detail: string }
  | { kind: 'oauthError'; code: string }
  | { kind: 'declined' }
  | { kind: 'wrongAccount'; signedIn?: string }
  | { kind: 'apiDisabled'; activationUrl?: string };

/** What the background worker knows about this build's setup, for the developer message. */
export interface SetupContext {
  account: string;
  clientId?: string;
  extensionId: string;
  redirectUri: string;
  /** Whether the manifest has a `key`, which keeps the extension ID (and so the redirect URI) stable. */
  keyPinned: boolean;
}

/** An error the user can't fix by trying again; it carries what the setup dialog needs. */
export class GmailSetupError extends Error {
  constructor(public problem: GmailProblem, public context?: SetupContext) {
    super(setupSummary(problem));
  }
}

/** One line for the user. */
export function setupSummary(problem: GmailProblem): string {
  switch (problem.kind) {
    case 'noClientId':
    case 'badClientId':
      return "EasyMerge isn't set up to send through Gmail.";
    case 'signInFailed':
    case 'oauthError':
      return "Google sign-in didn't finish, so nothing was sent.";
    case 'declined':
      return 'Gmail access was declined, so nothing was sent. Send again and allow access to merge.';
    case 'wrongAccount':
      return 'Google signed in a different account than this Gmail tab, so nothing was sent.';
    case 'apiDisabled':
      return "The Gmail API isn't turned on for EasyMerge's Google Cloud project.";
  }
}

const SETUP_DOC = 'store/RELEASING.md, "Gmail API setup"';

/** For whoever builds the extension: what's wrong and what to change. Written per problem, not passed through from Google. */
export function developerMessage(problem: GmailProblem, context?: SetupContext): string {
  const redirect = context ? `  ${context.redirectUri}` : '  https://<extension-id>.chromiumapp.org/';
  const unpinned = context && !context.keyPinned
    ? [
      '',
      'Note: EXTENSION_PUBLIC_KEY is not set, so this unpacked build\'s ID',
      `(${context.extensionId}) comes from its folder path and can change.`,
      'Set it in .env so the redirect URI stays valid.',
    ]
    : [];
  const consoleChecks = [
    'In Google Cloud Console, check the OAuth client:',
    `  - Type is "Web application" and its ID matches ${context?.clientId ?? 'VITE_GOOGLE_OAUTH_CLIENT_ID'}`,
    '  - Authorized redirect URIs includes exactly (trailing slash too):',
    redirect,
    '  - OAuth consent screen: while in Testing, the signed-in account is a test user',
    '  - Scopes include .../auth/gmail.send and email',
    ...unpinned,
  ];

  const lines = ((): string[] => {
    switch (problem.kind) {
      case 'noClientId':
        return [
          'The required environment variables aren\'t present.',
          '',
          'Add to .env:',
          '  VITE_GOOGLE_OAUTH_CLIENT_ID=<id>.apps.googleusercontent.com',
          '  EXTENSION_PUBLIC_KEY=<public key from the Web Store dashboard, Package tab>',
          '',
          'Then rebuild (restart `npm run dev`, or `npm run build`) and reload the extension.',
          'The OAuth client needs this redirect URI:',
          redirect,
          '',
          `Full steps: ${SETUP_DOC}.`,
        ];
      case 'badClientId':
        return [
          'VITE_GOOGLE_OAUTH_CLIENT_ID doesn\'t look like an OAuth client ID:',
          `  ${context?.clientId ?? '(unknown)'}`,
          '',
          'It should end in .apps.googleusercontent.com. Copy the Client ID (not the',
          'client secret or project ID) from Credentials in Google Cloud Console,',
          'then rebuild and reload the extension.',
        ];
      case 'signInFailed':
        return [
          `The provided OAuth client didn't complete sign-in (Chrome said: "${problem.detail}").`,
          '',
          'If you closed the Google window yourself, just send again. If Google showed an',
          'error page instead:',
          '  invalid_client           the client ID is wrong or the client was deleted',
          '  redirect_uri_mismatch    the redirect URI below isn\'t on the client',
          '  access_denied / "Access blocked"  the account isn\'t a test user',
          '',
          ...consoleChecks,
        ];
      case 'oauthError':
        return [
          `Google rejected the OAuth request with "${problem.code}".`,
          '',
          ...consoleChecks,
        ];
      case 'declined':
        return [
          'The account declined the consent screen (access_denied).',
          '',
          'Nothing is misconfigured if that was deliberate. If Google said "Access blocked"',
          `instead, add ${context?.account ?? 'the account'} as a test user on the OAuth consent screen.`,
        ];
      case 'wrongAccount':
        return [
          `Google signed in ${problem.signedIn ?? 'an unknown account'}, but this Gmail tab is ${context?.account ?? 'another account'}.`,
          'EasyMerge refuses to send from an account other than the tab\'s.',
          '',
          'Choose the matching account in Google\'s account picker, or sign that account',
          'into Chrome\'s Google session.',
        ];
      case 'apiDisabled':
        return [
          'The OAuth client works, but the Gmail API isn\'t enabled in its Google Cloud project.',
          '',
          'Enable it (APIs & Services > Library > Gmail API):',
          `  ${problem.activationUrl ?? 'https://console.cloud.google.com/apis/library/gmail.googleapis.com'}`,
          '',
          'It can take a few minutes to take effect. Then send again.',
        ];
    }
  })();
  return lines.join('\n');
}

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
  if (error) throw new GmailSetupError(error === 'access_denied' ? { kind: 'declined' } : { kind: 'oauthError', code: error });
  const accessToken = params.get('access_token');
  if (!accessToken) throw new Error('Google sign-in returned no token.');
  return { accessToken, expiresIn: Number(params.get('expires_in')) || 3600 };
}

interface GmailErrorBody {
  error?: { message?: string; errors?: { reason?: string }[] };
}

/** The Gmail API turned off in the client's project: a setup problem, not a sending one. */
export function apiDisabledProblem(status: number, body: GmailErrorBody | undefined): GmailProblem | undefined {
  const reasons = body?.error?.errors?.map((e) => e.reason ?? '') ?? [];
  const message = body?.error?.message ?? '';
  if (status !== 403 || !(reasons.includes('accessNotConfigured') || /has not been used|is disabled/.test(message))) {
    return undefined;
  }
  const activationUrl = message.match(/https:\/\/console\.(?:developers|cloud)\.google\.com\/\S+?(?=[.,]?(?:\s|$))/)?.[0];
  return { kind: 'apiDisabled', activationUrl };
}

export function describeGmailError(status: number, body: GmailErrorBody | undefined): string {
  const reasons = body?.error?.errors?.map((e) => e.reason ?? '') ?? [];
  if (status === 429 || reasons.some((r) => /rateLimitExceeded|dailyLimitExceeded|quotaExceeded/.test(r))) {
    return "Gmail's sending limit was reached. Try the rest later.";
  }
  return body?.error?.message ?? `Gmail returned an error (${status}).`;
}

/** The background's failure as an Error to throw, a GmailSetupError when it's a setup problem. */
const toError = (response: GmailResponse & { ok: false }) =>
  response.problem ? new GmailSetupError(response.problem, response.context) : new Error(response.error);

async function request(message: GmailRequest): Promise<GmailResponse> {
  try {
    const response: GmailResponse | undefined = await chrome.runtime.sendMessage(message);
    return response ?? { ok: false, error: 'No response from EasyMerge.' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Get a token for `account`, showing Google's consent popup if it's needed. Throws if it can't. */
export async function authorize(account: string): Promise<void> {
  const response = await request({ easymerge: 'authorize', account });
  if (!response.ok) throw toError(response);
}

const textOfHTML = (html: string) => textOfElement(Object.assign(document.createElement('div'), { innerHTML: html }));

/** Sends each message with the Gmail API, from `account` (the Gmail tab's signed-in address). */
export function apiSender(account: string): Sender {
  return {
    async send(message: OutgoingMessage) {
      const raw = base64Url(buildMime(message, textOfHTML(message.html)));
      const response = await request({ easymerge: 'send', account, raw });
      if (!response.ok) throw toError(response);
    },
  };
}
