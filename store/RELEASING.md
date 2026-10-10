# Releasing

1. Bump `version` in `package.json`. The manifest reads it from there, and the Web Store rejects an
   upload whose version isn't higher than the last one.
2. `npm run release` typechecks, tests, builds, and writes `release/easymerge-<version>.zip`. A build
   fails if `VITE_INBOXSDK_APP_ID` is missing from `.env`.
3. Upload the zip in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), update
   the listing from [LISTING.md](LISTING.md) if anything changed, and submit for review.

## The InboxSDK app ID

The app ID from inboxsdk.com is a public identifier, not a secret. Vite inlines it into the content
script at build time from `.env`, so it ships inside the zip.

## Gmail API setup

Merges send through the Gmail API, with no compose-window fallback: if the API isn't set up (or the user
declines access), sending a merge shows an error dialog whose "Developer message" says what to fix. The
client ID is public too; it ships in the zip.

1. Pin the extension ID. In the Web Store dashboard, open the item's **Package** tab and copy the public
   key into `.env` as `EXTENSION_PUBLIC_KEY`, so unpacked builds get the store item's ID. Rebuild, and
   note the ID shown at chrome://extensions. `npm run release` leaves the key out of the zip.
2. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the
   **Gmail API** (APIs & Services → Library).
3. **OAuth consent screen**: External. App name EasyMerge, support email, homepage and privacy policy
   URLs from [LISTING.md](LISTING.md). Scopes: `.../auth/gmail.send` and `email`. While in **Testing**,
   add every account that will use it as a test user (up to 100); they'll see an "unverified app" warning.
4. **Credentials → Create OAuth client ID → Web application**. Authorized redirect URI:
   `https://<extension-id>.chromiumapp.org/` (with the trailing slash).
5. Put the client ID in `.env` as `VITE_GOOGLE_OAUTH_CLIENT_ID` and rebuild.

To go beyond test users, submit the consent screen for verification. `gmail.send` is a *sensitive*
scope, not a *restricted* one, so it needs Google's review (a demo video of the consent flow and of
sending a merge, plus the privacy policy) but not a paid security assessment.

## Keeping up with Gmail

Manifest V3 doesn't allow remotely hosted code, so InboxSDK is bundled into each release rather than
loaded live. When Gmail changes its page structure and InboxSDK ships a fix, users only get it after
we update `@inboxsdk/core` and publish a new version. If EasyMerge stops catching sends, check
[InboxSDK's releases](https://github.com/InboxSDK/InboxSDK/releases) first.
