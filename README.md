# EasyMerge

Mail merge without leaving the Gmail composer (Chrome, MV3, [InboxSDK](https://www.inboxsdk.com/)).
Write `_FIRST_NAME` / `_COMPANY` / `_ROLE` in any draft; on Send, a dialog asks for each value, fills
them in, and sends. The compose-toolbar button reinserts your last EasyMerge email, wildcards unfilled.

- Wildcard syntax: `_ALLCAPS` (min 2 chars, inner underscores OK). Double-click selects the whole token.
- Autofills first, last, or full name and company from the first `To` recipient (display name, else the
  email's local part; free-mail domains like gmail are ignored for company). Aliases live in `src/lib/autofill.ts`.
- Last value used per wildcard shows as `⇥ value` ghost text: Tab (or →) accepts it, and "Fill N previous
  values" accepts all. Remembered for the Gmail tab only.
- Compose toolbar button "Insert last EasyMerge email" fills subject and body with the last sent email that
  had wildcards, as it was before filling (i.e. the template). Stored in `chrome.storage.local`.
- "Send anyway" skips those wildcards for that compose window; closing the dialog does not.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_INBOXSDK_APP_ID (free at inboxsdk.com)
npm run dev            # or: npm run build, then load dist/ at chrome://extensions
npm test
```

Without an app ID, `npm run dev` loads but InboxSDK won't initialize, and `npm run build` refuses to run.

## Publishing

`npm run release` builds `release/easymerge-<version>.zip` for the Chrome Web Store. See
[store/RELEASING.md](store/RELEASING.md) for the steps, [store/LISTING.md](store/LISTING.md) for the
dashboard text, and [store/PRIVACY.md](store/PRIVACY.md) for the privacy policy.

See [FUTURE.md](FUTURE.md) for ideas not in v1.
