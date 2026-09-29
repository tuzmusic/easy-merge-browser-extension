# EasyMerge

Gmail extension (Chrome, MV3, [InboxSDK](https://www.inboxsdk.com/)) that stops you sending a draft
with unfilled wildcards. Write `_FIRST_NAME` / `_COMPANY` / `_ROLE` in your template; on Send, a dialog
appears to fill them in.

- Wildcard syntax: `_ALLCAPS` (min 2 chars, inner underscores OK). Double-click selects the whole token.
- Autofills first name and company from the first `To` recipient (free-mail domains like gmail are ignored
  for company). Aliases live in `src/lib/autofill.ts`.
- Last value used per wildcard is offered as placeholder + one-click "Use ..." (per cell, or all empty).
  Remembered for the Gmail tab only.
- "Send anyway" skips those wildcards for that compose window; closing the dialog does not.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_INBOXSDK_APP_ID (free at inboxsdk.com)
npm run dev            # or: npm run build, then load dist/ at chrome://extensions
npm test
```

Without an app ID the extension loads but InboxSDK won't initialize.

See [FUTURE.md](FUTURE.md) for ideas not in v1.
