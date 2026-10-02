import * as InboxSDK from '@inboxsdk/core';
import { applyValues } from '../lib/apply';
import { autofill } from '../lib/autofill';
import { IgnoreList } from '../lib/guard';
import { getLastValues, rememberValues } from '../lib/memory';
import { loadTemplate, saveTemplate, type Template } from '../lib/template';
import { showDialog } from '../ui/mount';
import { showPopover } from '../ui/Popover';
import { isBlankDraft, textOfElement } from '../lib/wildcards';

const appId = import.meta.env.VITE_INBOXSDK_APP_ID;
if (!appId) {
  console.warn('[EasyMerge] VITE_INBOXSDK_APP_ID is not set (see .env.example); InboxSDK will not load.');
}

const ignoreList = new IgnoreList();

// eventTracking off: InboxSDK's usage analytics are of no use to us, and off keeps the privacy policy simple.
// InboxSDK still reports its own internal errors to its maintainers (disclosed in store/PRIVACY.md).
InboxSDK.load(2, appId ?? '', { appName: 'EasyMerge', eventTracking: false, globalErrorLogging: false }).then((sdk) => {
  sdk.Compose.registerComposeViewHandler((compose) => {
    // The send we trigger ourselves after the dialog must not be intercepted again.
    let sendingNow = false;
    // The draft as it was before wildcards were filled; saved as the template once the send goes through.
    let unfilled: Template | undefined;

    compose.addButton({
      title: 'Insert last EasyMerge email',
      iconUrl: chrome.runtime.getURL('icons/icon-32.png'),
      type: 'MODIFIER',
      hasDropdown: true,
      onClick: async ({ dropdown }) => {
        if (!dropdown) return;
        // Hidden until we know whether there's anything to ask, so a straight insert doesn't flash it.
        dropdown.el.style.visibility = 'hidden';
        const template = await loadTemplate();
        const insert = () => {
          dropdown.close();
          compose.setSubject(template!.subject);
          compose.setBodyHTML(template!.html);
        };
        const close = () => dropdown.close();

        if (template && isBlankDraft(compose.getSubject(), compose.getBodyElement())) return insert();
        showPopover(dropdown.el, template
          ? { message: 'Replace this draft with your last EasyMerge email?', onConfirm: insert, onClose: close }
          : { message: 'No EasyMerge email sent yet.', onClose: close });
        dropdown.el.style.visibility = '';
      },
    });

    compose.on('sent', () => {
      if (unfilled) saveTemplate(unfilled);
    });

    compose.on('presending', (event) => {
      if (sendingNow) return;
      const wildcards = ignoreList.pending(compose, compose.getSubject(), textOfElement(compose.getBodyElement()));
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
        unfilled = { subject: compose.getSubject(), html: compose.getHTMLContent() };
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
