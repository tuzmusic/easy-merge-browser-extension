# EasyMerge Privacy Policy

_Last updated: October 7, 2026_

EasyMerge is a Chrome extension for Gmail. When you click Send, it checks your draft for wildcards
like `_FIRST_NAME` and, if it finds any, shows a dialog so you can fill them in before the message goes out.
If the draft has several recipients, each one gets a separate copy with their own values.

## What EasyMerge reads

To do that, EasyMerge reads the following from the Gmail compose window you are sending from:

- the subject and body of the draft, to find wildcards and replace them with your values;
- the names and email addresses of the "To" recipients, to suggest a name and company;
- the "Cc" and "Bcc" recipients and the "From" address, so each separate copy of a multi-recipient email
  goes from the same address with the same Cc and Bcc.

## What EasyMerge does with it

All of this happens inside your browser. Separate copies are sent one of two ways:

- **Through the Gmail API**, if you allow it. The first time, Google asks you to let EasyMerge "send
  email on your behalf" (and see your email address, which EasyMerge only uses to check that Google
  signed in the same account as your Gmail tab). EasyMerge then sends each copy straight from your
  browser to Google's Gmail API. The access token Google issues is kept in the browser's session storage,
  is never written to disk, and is gone when the browser closes. EasyMerge can't read your mail with it.
  You can revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).
- **Through Gmail itself**, if you don't: EasyMerge opens a Gmail compose window for each copy, fills it
  in, and clicks Send.

- EasyMerge does **not** send your email content, recipients, or the values you type to the developer
  or to any server. The developer has no server and receives none of your data.
- The last value you typed for each wildcard is kept in memory so the dialog can offer it next time.
  It is never written to disk and is gone when you close or reload the Gmail tab.
- When you send an email that had wildcards, EasyMerge saves its subject and body (as written, before
  the wildcards were filled) in your browser's extension storage, so the "Insert last EasyMerge email"
  button can put it back into a new draft. Only the most recent one is kept, and it stays on your device.
  Removing the extension deletes it.
- EasyMerge does not use cookies, does not track you, does not show ads, and does not sell or share data.

## Third-party component: InboxSDK

EasyMerge is built on [InboxSDK](https://www.inboxsdk.com/), a library maintained by Streak that lets
extensions work with Gmail's interface. EasyMerge turns off InboxSDK's usage analytics. InboxSDK may
still send reports about errors inside the library itself to its maintainers, so they can fix
compatibility problems when Gmail changes. These reports contain technical details (such as error
messages, stack traces, the extension's ID, and a one-way hash of the Gmail account's address). They are
not used to read your email. See InboxSDK's [terms](https://www.inboxsdk.com/terms) for how Streak
handles them.

## Permissions

- **Access to mail.google.com**: required to show the dialog in Gmail and read the draft you are sending.
- **storage**: keeps your last EasyMerge email on your device for the "Insert last EasyMerge email" button.
- **scripting**: used by InboxSDK to load its Gmail integration into the Gmail page.
- **identity**: shows Google's sign-in and consent window for sending through the Gmail API.
- **Access to gmail.googleapis.com and oauth2.googleapis.com**: sends the merged emails, and checks which
  account Google signed in.

EasyMerge does not run on any other website.

## Limited Use

EasyMerge's use of information received from Gmail and Google APIs complies with the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)
and the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Data is used only to provide the wildcard-filling feature
described above, is not transferred to anyone, and is not used for advertising, credit-worthiness, or
any purpose unrelated to that feature.

## Changes and contact

If this policy changes, the updated version will be posted here with a new date. Questions:
[open an issue](https://github.com/tuzmusic/easy-merge-browser-extension/issues) or email
tuzmusic@gmail.com.
