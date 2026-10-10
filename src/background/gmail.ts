// Gmail API side of merging: OAuth tokens per Gmail account, and `messages.send`. The content script
// asks for these over chrome.runtime messages (see src/lib/gmailApi.ts).
import {
  apiDisabledProblem, authUrl, describeGmailError, GmailSetupError, isGmailRequest, parseAuthRedirect,
  type GmailRequest, type GmailResponse, type SetupContext,
} from '../lib/gmailApi';

const clientId = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID;

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

// Session storage: gone when the browser closes, never written to disk.
const tokenKey = (account: string) => `gmailToken:${account.toLowerCase()}`;

async function cachedToken(account: string): Promise<string | undefined> {
  const key = tokenKey(account);
  const stored = (await chrome.storage.session.get(key))[key] as StoredToken | undefined;
  // A minute's margin so a token doesn't expire mid-request.
  return stored && stored.expiresAt > Date.now() + 60_000 ? stored.accessToken : undefined;
}

/** Google may sign in a different account than the hint; never send from the wrong one. */
async function checkAccount(accessToken: string, account: string): Promise<void> {
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`);
  const { email } = (await response.json()) as { email?: string };
  if (email?.toLowerCase() !== account.toLowerCase()) {
    throw new GmailSetupError({ kind: 'wrongAccount', signedIn: email });
  }
}

async function signIn(account: string, interactive: boolean): Promise<string> {
  if (!clientId) throw new GmailSetupError({ kind: 'noClientId' });
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) throw new GmailSetupError({ kind: 'badClientId' });
  let redirect: string | undefined;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({
      url: authUrl({ clientId, redirectUri: chrome.identity.getRedirectURL(), account, interactive }),
      interactive,
    });
  } catch (e) {
    // Google's own error pages (bad client, redirect mismatch) never redirect, so Chrome only reports the window closing.
    throw new GmailSetupError({ kind: 'signInFailed', detail: e instanceof Error ? e.message : String(e) });
  }
  const { accessToken, expiresIn } = parseAuthRedirect(redirect);
  await checkAccount(accessToken, account);
  const stored: StoredToken = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  await chrome.storage.session.set({ [tokenKey(account)]: stored });
  return accessToken;
}

/** A cached token, else a silent sign-in, else Google's consent popup. */
async function getToken(account: string): Promise<string> {
  const cached = await cachedToken(account);
  if (cached) return cached;
  try {
    return await signIn(account, false);
  } catch {
    return signIn(account, true);
  }
}

const post = (accessToken: string, raw: string) =>
  fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  });

async function send(account: string, raw: string): Promise<void> {
  let response = await post(await getToken(account), raw);
  if (response.status === 401) {
    // Revoked or expired early: forget it and sign in again, once.
    await chrome.storage.session.remove(tokenKey(account));
    response = await post(await getToken(account), raw);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    const problem = apiDisabledProblem(response.status, body);
    throw problem ? new GmailSetupError(problem) : new Error(describeGmailError(response.status, body));
  }
}

async function handle(request: GmailRequest): Promise<void> {
  if (request.easymerge === 'authorize') await getToken(request.account);
  else await send(request.account, request.raw);
}

const setupContext = (account: string): SetupContext => ({
  account,
  clientId,
  extensionId: chrome.runtime.id,
  redirectUri: chrome.identity.getRedirectURL(),
  keyPinned: 'key' in chrome.runtime.getManifest(),
});

const failure = (e: unknown, account: string): GmailResponse => {
  if (e instanceof GmailSetupError) return { ok: false, error: e.message, problem: e.problem, context: setupContext(account) };
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isGmailRequest(message) || sender.id !== chrome.runtime.id) return false;
  handle(message).then(
    () => sendResponse({ ok: true } satisfies GmailResponse),
    (e) => sendResponse(failure(e, message.account)),
  );
  return true; // Responds asynchronously.
});
