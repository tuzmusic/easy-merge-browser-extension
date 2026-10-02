# Chrome Web Store submission

Copy-paste source for the Developer Dashboard. Text in code blocks goes into the form exactly as
written (line breaks included). Keep it in sync with the manifest and [PRIVACY.md](PRIVACY.md).

## Store listing tab

**Name:** EasyMerge

**Summary** (132 chars max; mirrors the manifest `description`):

```text
Mail merge without the spreadsheet. Type wildcards like _FIRST_NAME in any Gmail draft and fill them in when you hit Send.
```

**Category:** Productivity → Workflow & Planning (or Communication)

**Language:** English

**Description:**

```text
Mail merge, minus the mail merge.

Write your email the way you always do. Type wildcards directly in the email: _FIRST_NAME, _COMPANY, _ETC. Anything in all caps that starts with an underscore is a wildcard. When you hit Send, EasyMerge asks for values for each wildcard, and sends the filled-in email.

That's it. Really.

Ready for the next recipient? Open a new message and click the EasyMerge button in the compose toolbar. Your last EasyMerge email comes back with its wildcards intact. Add a recipient, hit Send, and fill in the wildcards. (Support for sending to multiple recipients at a time coming soon.)

Private by design. Everything happens in your Gmail tab. EasyMerge has no server and never sends your email content anywhere.
```

**Graphic assets** (in `store/assets/`; regenerate with `npm run store-assets`):

- Store icon 128×128: `public/icons/icon-128.png` (96px artwork + 16px transparent padding, per store spec)
- Screenshots 1280×800, upload in this order:
  1. `screenshot-1-template.png`: your draft is the template, next to the email it became
  2. `screenshot-2-fill.png`: Send opens the dialog; first name and company autofilled
  3. `screenshot-3-reuse.png`: last time's values offered in each field, plus "Fill 2 previous values"
- Small promo tile 440×280: `promo-small-440x280.png` (or one of the `promo-small-*` options)

The dialog in the screenshots is the real component with the real autofill (source in
`store/assets-src/`). The compose window around it is modeled on real Gmail captures.

**Homepage URL:** https://github.com/tuzmusic/easy-merge-browser-extension

**Support URL:** https://github.com/tuzmusic/easy-merge-browser-extension/issues

## Privacy practices tab

**Single purpose:**

```text
EasyMerge turns any Gmail draft into a mail-merge template: the user types wildcards like _FIRST_NAME, and when they click Send, EasyMerge asks for each wildcard's value, fills it in, and sends. It can also reinsert the user's last such email into a new draft to send it again.
```

**Permission justifications** (one field per permission):

Host permission `https://mail.google.com/*`:

```text
The extension's only function runs in Gmail: it reads the draft being sent to find wildcards, shows the fill-in dialog, writes the values into the draft, and adds a compose-toolbar button that reinserts the last EasyMerge email. It does not run on any other site.
```

`storage`:

```text
Saves the user's most recent EasyMerge email (subject and body, with its wildcards unfilled) in chrome.storage.local, so the compose-toolbar button can reinsert it into a new draft. Only one email is kept, it never leaves the device, and it is deleted when the extension is removed.
```

`scripting`:

```text
Required by InboxSDK, the Gmail integration library the extension is built on. Its background script uses chrome.scripting to load its bundled page script (pageWorld.js, shipped in the package) into the Gmail tab so it can hook into Gmail's Send button.
```

**Remote code:** No, I am not using remote code. (All JavaScript, including InboxSDK, is bundled in
the package.)

**Data usage, what's collected.** "Collected" in the dashboard means handled by the extension, even
if only locally. Check:

- [x] **Personally identifiable information**: recipient names and email addresses, read from the
      draft to autofill name and company.
- [x] **Personal communications**: the draft's subject and body, read to find and fill wildcards. The last
      EasyMerge email is also stored locally (unfilled) for the reinsert button.
- [x] **Website content**: the Gmail compose window.

Leave everything else unchecked (health, financial, authentication, location, web history, user
activity).

**Certifications** (check all three):

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
https://github.com/tuzmusic/easy-merge-browser-extension/blob/main/store/PRIVACY.md

## Distribution tab

- Visibility: **Unlisted** for a first round with friends, then switch to Public.
- Regions: all.

## Notes for the reviewer (optional field)

```text
To test: open Gmail, compose a message to any address with the body "Hi _FIRST_NAME, I saw _COMPANY is hiring." and click Send. EasyMerge cancels the send and opens a dialog with both wildcards. Fill them in and click "Fill & send" to deliver the message with the values in place. Then open a new message and click the EasyMerge icon in the compose toolbar: the same email comes back with its wildcards unfilled. No account or setup is needed.
```
