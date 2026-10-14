import * as InboxSDK from '@inboxsdk/core';
import { applyValues } from '../lib/apply';
import { autofill, type Recipient } from '../lib/autofill';
import { IgnoreList } from '../lib/guard';
import { hideCompose } from '../lib/hide';
import {
  attachmentCount, buildMessage, composeSender, formatAddress, readAttachments, runMerge, sharedValues, uniqueRecipients,
  type Envelope
} from '../lib/merge';
import { getLastValues, rememberValues } from '../lib/memory';
import { loadTemplate, saveTemplate, type Template } from '../lib/template';
import { showDialog, showMergeDialog } from '../ui/mount';
import { showPopover } from '../ui/Popover';
import { isBlankDraft, textOfElement } from '../lib/wildcards';

const appId = import.meta.env.VITE_INBOXSDK_APP_ID;
if (!appId) {
  console.warn('[EasyMerge] VITE_INBOXSDK_APP_ID is not set (see .env.example); InboxSDK will not load.');
}

const ignoreList = new IgnoreList();
// Values typed per recipient (keyed by lowercased email), so a stopped or failed merge reopens with them.
const typedRows = new WeakMap<object, Map<string, Record<string, string>>>();
// While a merge runs, the compose windows it opens send themselves and must not be intercepted.
let merging = false;
let mergeReveals: (() => void)[] = [];

// eventTracking off: InboxSDK's usage analytics are of no use to us, and off keeps the privacy policy simple.
// InboxSDK still reports its own internal errors to its maintainers (disclosed in store/PRIVACY.md).
InboxSDK.load(2, appId ?? '', { appName: 'EasyMerge', eventTracking: false, globalErrorLogging: false }).then((sdk) => {
  sdk.Compose.registerComposeViewHandler((compose) => {
    // Hide the merge's windows as soon as they exist, so they don't flash on screen.
    if (merging) mergeReveals.push(hideCompose(compose.getElement()));

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
      }
    });

    compose.on('sent', () => {
      if (unfilled) saveTemplate(unfilled);
    });

    const sendAnyway = (wildcards: string[]) => {
      ignoreList.ignore(compose, wildcards);
      sendingNow = true;
      compose.send();
    };

    // One recipient (or a reply/forward): fill this draft in place and send it.
    const fillAndSend = (wildcards: string[], recipients: Recipient[]) => {
      showDialog({
        wildcards,
        autofilled: autofill(wildcards, recipients),
        lastValues: getLastValues()
      }).then((result) => {
        if (result.action === 'cancel') return;
        unfilled = { subject: compose.getSubject(), html: compose.getHTMLContent() };
        if (result.action === 'sendAnyway') return sendAnyway(wildcards);
        rememberValues(result.values);
        applyValues(compose, result.values);
        sendingNow = true;
        compose.send();
      });
    };

    // Several recipients: this draft is the template; each recipient gets their own email.
    const merge = (wildcards: string[], recipients: Recipient[]) => {
      const template: Template = { subject: compose.getSubject(), html: compose.getHTMLContent() };
      const envelope: Envelope = {
        cc: compose.getCcRecipients(),
        bcc: compose.getBccRecipients(),
        from: compose.getFromContact()
      };
      const typed = typedRows.get(compose);
      let showDraft = () => {
      };

      showMergeDialog({
        wildcards,
        initialRows: recipients.map((recipient) => ({
          recipient,
          values: { ...autofill(wildcards, [recipient]), ...typed?.get(recipient.emailAddress.toLowerCase()) }
        })),
        lastValues: getLastValues(),
        hasCopies: envelope.cc.length + envelope.bcc.length > 0,
        hasAttachments: attachmentCount(compose.getElement()) > 0,
        run: async (rows, report, shouldStop) => {
          // Read before anything is sent, so a file we can't copy stops the whole merge.
          const attachments = await readAttachments(compose.getElement());
          const messages = rows.map((row) => buildMessage(template, { ...envelope, attachments }, row));
          // The last email goes out from this draft rather than a new window, once all the others have.
          // That leaves no draft to discard, and if anything fails first, the draft is still here.
          // It already has the attachments.
          const fromDraft = { ...messages.pop()!, attachments: [] };
          messages.push(fromDraft);
          merging = true;
          // Gmail hides a draft while it sends; do the same until we know whether it's needed again.
          showDraft = hideCompose(compose.getElement());
          try {
            return await runMerge({
              messages,
              sender: composeSender(async (m) => (m === fromDraft ? compose : sdk.Compose.openNewComposeView())),
              report,
              shouldStop
            });
          } finally {
            merging = false;
            // Windows that successfully send are removed from the page (but are still in mergeReveals, and revealing is a no-op).
            // If a window still exists that means the message failed so we need to actually see it.
            mergeReveals.forEach((reveal) => reveal());
            mergeReveals = [];
          }
        }
      }).then((result) => {
        if (result.action === 'cancel') return showDraft();
        if (result.action === 'sendAnyway') {
          showDraft();
          unfilled = template;
          return sendAnyway(wildcards);
        }
        const sent = result.rows.filter((_, i) => result.statuses[i] === 'sent');
        const unsent = result.rows.filter((_, i) => result.statuses[i] !== 'sent');
        if (sent.length) {
          saveTemplate(template);
          rememberValues(sharedValues(sent));
        }
        if (unsent.length) {
          showDraft();
          typedRows.set(compose, new Map(unsent.map((row) => [row.recipient.emailAddress.toLowerCase(), row.values])));
          compose.setToRecipients(unsent.map((row) => formatAddress(row.recipient)));
        }
      });
    };

    compose.on('presending', (event) => {
      if (sendingNow || merging) return;
      const wildcards = ignoreList.pending(compose, compose.getSubject(), textOfElement(compose.getBodyElement()));
      if (!wildcards.length) return;

      // Must be synchronous; the dialog is async and re-sends afterwards.
      event.cancel();

      const recipients = uniqueRecipients(compose.getToRecipients());
      const canSplit = !compose.isReply() && !compose.isForward();
      if (recipients.length > 1 && canSplit) merge(wildcards, recipients);
      else fillAndSend(wildcards, recipients);
    });
  });
});
