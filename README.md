# EasyMerge

Mail merge without leaving the Gmail composer (Chrome, MV3, [InboxSDK](https://www.inboxsdk.com/)).
Write `_FIRST_NAME` / `_COMPANY` / `_ROLE` in any draft; on Send, a dialog asks for each value, fills
them in, and sends. With several `To` recipients, each one gets their own email with their own values.
The compose-toolbar button reinserts your last EasyMerge email, wildcards unfilled.

- Wildcard syntax: `_ALLCAPS` (min 2 chars, inner underscores OK). Double-click selects the whole token.
- Autofills first, last, or full name and company from the `To` recipient (display name, else the
  email's local part; free-mail domains like gmail are ignored for company). Aliases live in `src/lib/autofill.ts`.
- Last value used per wildcard shows as `⇥ value` ghost text: Tab (or →) accepts it, and "Fill N previous
  values" accepts all. Remembered for the Gmail tab only.
- Compose toolbar button "Insert last EasyMerge email" fills subject and body with the last sent email that
  had wildcards, as it was before filling (i.e. the template). Stored in `chrome.storage.local`.
- "Send anyway" skips those wildcards for that compose window; closing the dialog does not.

### Several recipients

- Two or more `To` recipients turn the dialog into a table: one row per recipient, one column per
  wildcard, each row autofilled from its own recipient. "↓ all" copies a column's value to the empty
  cells (not offered for names and companies). × drops a recipient.
- Send sends each row its own copy through the Gmail API, after a one-time Google consent popup. Without
  an OAuth client ID (or if you decline), it opens a Gmail compose window per row behind the dialog,
  fills it, and sends it instead. The original draft is discarded once everyone has their copy.
- Cc and Bcc go on every email, and the From address (send-as alias) is kept.
- Stop, or a failure, ends the run. The draft stays open, addressed to whoever didn't get it yet, and
  Send picks up where it left off with the values you typed.
- "Send anyway" asks first, then sends the original single email to everyone, wildcards unfilled.
- Not split: replies and forwards (threading, forwarded attachments). They fill in place as before.
- Drafts with attachments can't be merged yet (they can't be copied to the new emails).
- Gmail's daily sending limits apply (about 500 recipients a day for personal accounts).

## Setup

```bash
npm install
cp .env.example .env   # set VITE_INBOXSDK_APP_ID (free at inboxsdk.com); Gmail API vars are optional
npm run dev            # or: npm run build, then load dist/ at chrome://extensions
npm test
```

Without an app ID, `npm run dev` loads but InboxSDK won't initialize, and `npm run build` refuses to run.
For sending through the Gmail API, see "Gmail API setup" in [store/RELEASING.md](store/RELEASING.md).

## Publishing

`npm run release` builds `release/easymerge-<version>.zip` for the Chrome Web Store. See
[store/RELEASING.md](store/RELEASING.md) for the steps, [store/LISTING.md](store/LISTING.md) for the
dashboard text, and [store/PRIVACY.md](store/PRIVACY.md) for the privacy policy.

See [FUTURE.md](FUTURE.md) for ideas not in v1.
