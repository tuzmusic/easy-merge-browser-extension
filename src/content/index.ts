import * as InboxSDK from '@inboxsdk/core';
import { applyValues } from '../lib/apply';
import { autofill } from '../lib/autofill';
import { IgnoreList } from '../lib/guard';
import { getLastValues, rememberValues } from '../lib/memory';
import { showDialog } from '../ui/mount';

const appId = import.meta.env.VITE_INBOXSDK_APP_ID;
if (!appId) {
  console.warn('[EasyMerge] VITE_INBOXSDK_APP_ID is not set (see .env.example); InboxSDK will not load.');
}

const ignoreList = new IgnoreList();

InboxSDK.load(2, appId ?? '').then((sdk) => {
  sdk.Compose.registerComposeViewHandler((compose) => {
    // The send we trigger ourselves after the dialog must not be intercepted again.
    let sendingNow = false;

    compose.on('presending', (event) => {
      if (sendingNow) return;
      const wildcards = ignoreList.pending(compose, compose.getSubject(), compose.getTextContent());
      if (!wildcards.length) return;

      // Must be synchronous; the dialog is async and re-sends afterwards.
      event.cancel();

      const recipients = compose.getToRecipients();
      showDialog({
        wildcards,
        autofilled: autofill(wildcards, recipients),
        lastValues: getLastValues(),
      }).then((result) => {
        if (result.action === 'cancel') return;
        if (result.action === 'send') {
          rememberValues(result.values);
          applyValues(compose, result.values);
        } else {
          ignoreList.ignore(compose, wildcards);
        }
        sendingNow = true;
        compose.send();
      });
    });
  });
});
