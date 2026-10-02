# Releasing

1. Bump `version` in `package.json`. The manifest reads it from there, and the Web Store rejects an
   upload whose version isn't higher than the last one.
2. `npm run release` typechecks, tests, builds, and writes `release/easymerge-<version>.zip`. A build
   fails if `VITE_INBOXSDK_APP_ID` is missing from `.env`.
3. Upload the zip in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), update
   the listing from [LISTING.md](LISTING.md) if anything changed, and submit for review.

## The InboxSDK app ID

The app ID from inboxsdk.com is a public identifier, not a secret. Vite inlines it into the content
script at build time from `.env`, so it ships inside the zip. That's all the published extension needs.
There is no OAuth or API key because the extension never calls a Google API: it works in the user's
own signed-in Gmail tab.

## Keeping up with Gmail

Manifest V3 doesn't allow remotely hosted code, so InboxSDK is bundled into each release rather than
loaded live. When Gmail changes its page structure and InboxSDK ships a fix, users only get it after
we update `@inboxsdk/core` and publish a new version. If EasyMerge stops catching sends, check
[InboxSDK's releases](https://github.com/InboxSDK/InboxSDK/releases) first.
