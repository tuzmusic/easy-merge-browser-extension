import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyValues } from './apply';
import {
  autofill, companyFromEmail, firstNameFromRecipient, fullNameFromRecipient, lastNameFromRecipient,
} from './autofill';
import { IgnoreList } from './guard';
import {
  attachFiles, buildMessage, composeSender, formatAddress, readAttachments, runMerge, sendOne, sharedValues, uniqueRecipients,
  type OutgoingMessage, type RowStatus, type Sender,
} from './merge';
import {
  fillHTML, findWildcards, isBlankDraft, replaceWildcardsInElement, replaceWildcardsInText, textOfElement,
} from './wildcards';

describe('findWildcards', () => {
  it('finds distinct _ALLCAPS tokens including inner underscores', () => {
    expect(findWildcards('Hi _FIRST_NAME, at _COMPANY. _COMPANY rocks, _ROLE')).toEqual([
      '_FIRST_NAME', '_COMPANY', '_ROLE',
    ]);
  });
  it('ignores lookalikes', () => {
    expect(findWildcards('snake_case_var __DUNDER__ _a _1 https://x.com/a_B foo_BAR _Mixed')).toEqual([]);
  });
  it('handles trailing punctuation', () => {
    expect(findWildcards('Dear _NAME, hello _NAME.')).toEqual(['_NAME']);
  });
});

describe('replace', () => {
  it('replaces in text and leaves unknown ones', () => {
    expect(replaceWildcardsInText('Hi _NAME at _CO', { _NAME: 'Jane' })).toBe('Hi Jane at _CO');
  });
  it('replaces a wildcard split across spans', () => {
    const div = document.createElement('div');
    div.innerHTML = 'Hi <b>_FIR</b><i>ST_</i>NAME, welcome to _COMPANY!';
    replaceWildcardsInElement(div, { _FIRST_NAME: 'Jane', _COMPANY: 'Acme' });
    expect(div.textContent).toBe('Hi Jane, welcome to Acme!');
    expect(div.innerHTML).not.toContain('_');
  });
  it('finds and replaces wildcards on separate Gmail lines', () => {
    const div = document.createElement('div');
    div.innerHTML = 'full _FULLNAME<div>first _FIRST_NAME</div><div>last _LAST_NAME<br>month _MONTH</div>';
    expect(findWildcards(textOfElement(div))).toEqual(['_FULLNAME', '_FIRST_NAME', '_LAST_NAME', '_MONTH']);
    replaceWildcardsInElement(div, { _FULLNAME: 'Jane Doe', _FIRST_NAME: 'Jane', _LAST_NAME: 'Doe', _MONTH: 'May' });
    expect(div.innerHTML).toBe('full Jane Doe<div>first Jane</div><div>last Doe<br>month May</div>');
  });
});

describe('autofill', () => {
  it('first names', () => {
    expect(firstNameFromRecipient({ emailAddress: 'a@b.com', name: 'jane doe' })).toBe('Jane');
    expect(firstNameFromRecipient({ emailAddress: 'a@b.com', name: 'Doe, Jane' })).toBe('Jane');
    expect(firstNameFromRecipient({ emailAddress: 'john.smith@b.com' })).toBe('John');
    expect(firstNameFromRecipient({ emailAddress: 'x1@b.com' })).toBeUndefined();
  });
  it('last and full names', () => {
    expect(lastNameFromRecipient({ emailAddress: 'a@b.com', name: 'jane q. doe' })).toBe('Doe');
    expect(fullNameFromRecipient({ emailAddress: 'a@b.com', name: 'jane q. doe' })).toBe('Jane Q. Doe');
    expect(fullNameFromRecipient({ emailAddress: 'a@b.com', name: 'Doe, Jane' })).toBe('Jane Doe');
    expect(fullNameFromRecipient({ emailAddress: 'a@b.com', name: "Sean O'Brien-McDonald" })).toBe("Sean O'Brien-McDonald");
    expect(fullNameFromRecipient({ emailAddress: 'JOHN.SMITH+news@b.com' })).toBe('John Smith');
    expect(lastNameFromRecipient({ emailAddress: 'a@b.com', name: 'Cher' })).toBeUndefined();
    expect(fullNameFromRecipient({ emailAddress: 'x1@b.com' })).toBeUndefined();
  });
  it('companies', () => {
    expect(companyFromEmail('a@acme.com')).toBe('Acme');
    expect(companyFromEmail('a@mail.acme.co.uk')).toBe('Acme');
    expect(companyFromEmail('a@gmail.com')).toBeUndefined();
  });
  it('maps aliases', () => {
    expect(
      autofill(['_FIRST_NAME', '_CO', '_ROLE'], [{ emailAddress: 'jane@acme.com', name: 'Jane Doe' }]),
    ).toEqual({ _FIRST_NAME: 'Jane', _CO: 'Acme' });
  });
});

describe('IgnoreList', () => {
  it('only ignores what was explicitly ignored', () => {
    const list = new IgnoreList();
    const compose = {};
    expect(list.pending(compose, '', 'hi _A1')).toEqual(['_A1']);
    list.ignore(compose, ['_A1']);
    expect(list.pending(compose, '', 'hi _A1')).toEqual([]);
    expect(list.pending(compose, '', 'hi _A1 _NEW')).toEqual(['_NEW']);
    expect(list.pending({}, '', 'hi _A1')).toEqual(['_A1']);
  });
});

describe('applyValues', () => {
  it('fills subject and body', () => {
    const body = document.createElement('div');
    body.textContent = 'Hello _NAME';
    let subject = 'About _COMPANY';
    applyValues(
      { getSubject: () => subject, setSubject: (s) => (subject = s), getBodyElement: () => body },
      { _NAME: 'Jane', _COMPANY: 'Acme' },
    );
    expect(subject).toBe('About Acme');
    expect(body.textContent).toBe('Hello Jane');
  });
});

describe('isBlankDraft', () => {
  const body = (html: string) => Object.assign(document.createElement('div'), { innerHTML: html });
  const signature = '<div><br></div><span class="gmail_signature_prefix">-- </span>'
    + '<div dir="ltr" class="gmail_signature" data-smartmail="gmail_signature">Jonathan<div>555-1234</div></div>';
  it('treats a signature-only draft as blank', () => {
    expect(isBlankDraft('', body(signature))).toBe(true);
    expect(isBlankDraft('', body(''))).toBe(true);
  });
  it('is not blank with a subject or body text', () => {
    expect(isBlankDraft('Hello', body(signature))).toBe(false);
    expect(isBlankDraft('', body(`<div>Hi there</div>${signature}`))).toBe(false);
  });
});

describe('fillHTML', () => {
  it('fills split spans and Gmail lines, and leaves unknown wildcards', () => {
    expect(fillHTML('Hi <b>_FIR</b>ST_NAME,<div>at _COMPANY</div><div>_OTHER</div>', { _FIRST_NAME: 'Jane', _COMPANY: 'Acme' }))
      .toBe('Hi <b>Jane</b>,<div>at Acme</div><div>_OTHER</div>');
  });
});

describe('merge helpers', () => {
  it('dedupes recipients by address', () => {
    expect(uniqueRecipients([
      { emailAddress: 'a@x.com', name: 'A' }, { emailAddress: 'b@x.com' }, { emailAddress: 'A@X.com' },
    ])).toEqual([{ emailAddress: 'a@x.com', name: 'A' }, { emailAddress: 'b@x.com' }]);
  });
  it('formats addresses', () => {
    expect(formatAddress({ emailAddress: 'jane@acme.com', name: 'Jane Doe' })).toBe('"Jane Doe" <jane@acme.com>');
    expect(formatAddress({ emailAddress: 'jane@acme.com', name: 'Jane "JD" Doe' })).toBe('"Jane \\"JD\\" Doe" <jane@acme.com>');
    expect(formatAddress({ emailAddress: 'jane@acme.com' })).toBe('jane@acme.com');
    expect(formatAddress({ emailAddress: 'jane@acme.com', name: 'jane@acme.com' })).toBe('jane@acme.com');
  });
  it('builds one message per row', () => {
    const message = buildMessage(
      { subject: 'For _COMPANY', html: '<div>Hi _NAME</div>' },
      { cc: [{ emailAddress: 'c@x.com' }], bcc: [], from: { emailAddress: 'me@x.com', name: 'Me' } },
      { recipient: { emailAddress: 'jane@acme.com', name: 'Jane' }, values: { _NAME: 'Jane', _COMPANY: 'Acme' } },
    );
    expect(message).toEqual({
      to: { emailAddress: 'jane@acme.com', name: 'Jane' }, cc: [{ emailAddress: 'c@x.com' }], bcc: [],
      from: { emailAddress: 'me@x.com', name: 'Me' },
      subject: 'For Acme', html: '<div>Hi Jane</div>',
    });
  });
  it('remembers only values shared by every row', () => {
    const row = (values: Record<string, string>) => ({ recipient: { emailAddress: 'a@x.com' }, values });
    expect(sharedValues([row({ _NAME: 'Jane', _MONTH: 'May' }), row({ _NAME: 'Bob', _MONTH: 'May' })]))
      .toEqual({ _MONTH: 'May' });
    expect(sharedValues([])).toEqual({});
  });
});

/** A compose element with Gmail's attachment chips: an `attach` input and a download link each. */
function composeWithAttachments(...names: string[]) {
  const el = document.createElement('div');
  el.innerHTML = '<input type="file" name="Filedata" multiple>' + names.map((name, i) =>
    `<input type="${i % 2 ? 'checkbox' : 'hidden'}" name="attach" checked><a href="https://mail.google.com/mail/u/0/?view=att&attid=${i}">` +
    `<div class="vI">${name}</div> (1K)</a>`).join('');
  return el;
}

describe('attachments', () => {
  const fetchFile = (async (url: string) => new Response(new Blob([`file ${url.slice(-1)}`], { type: 'text/plain' }))) as typeof fetch;

  it('downloads the draft\'s attachments', async () => {
    const files = await readAttachments(composeWithAttachments('a.txt', 'b.txt'), fetchFile);
    expect(files.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(await files[1].text()).toBe('file 1');
    expect(files[0].type).toBe('text/plain');
  });
  it('reads none from a draft without attachments', async () => {
    expect(await readAttachments(document.createElement('div'), fetchFile)).toEqual([]);
  });
  it('refuses when an attachment has no download link yet', async () => {
    const el = composeWithAttachments('a.txt');
    el.querySelector('a')!.remove();
    await expect(readAttachments(el, fetchFile)).rejects.toThrow("Couldn't read");
  });
  it('refuses when a download fails', async () => {
    const failing = (async () => new Response('', { status: 404 })) as typeof fetch;
    await expect(readAttachments(composeWithAttachments('a.txt'), failing)).rejects.toThrow('a.txt');
  });
  it('attaches through the file input and waits for the uploads', async () => {
    const el = composeWithAttachments();
    const input = el.querySelector('input')!;
    input.addEventListener('change', () => {
      // Gmail adds a chip with a download link once each upload finishes.
      setTimeout(() => [...input.files!].forEach((f) => el.append(composeWithAttachments(f.name))), 300);
    });
    await attachFiles(el, [new File(['x'], 'a.txt')], 5000);
    expect(el.querySelectorAll('a').length).toBe(1);
  });
  it('gives up when the uploads never finish', async () => {
    await expect(attachFiles(composeWithAttachments(), [new File(['x'], 'a.txt')], 0)).rejects.toThrow('uploading');
  });
});

const message = (to: string): OutgoingMessage => ({ to: { emailAddress: to }, cc: [], bcc: [], subject: 's', html: 'h' });

describe('runMerge', () => {
  const run = (sender: Sender, opts: { shouldStop?(): boolean } = {}) => {
    const reports: [number, RowStatus][] = [];
    const result = runMerge({
      messages: ['a', 'b', 'c'].map(message), sender, pauseMs: 0, report: (i, s) => reports.push([i, s]), ...opts,
    });
    return { result, reports };
  };

  it('sends in order', async () => {
    const sent: string[] = [];
    const { result, reports } = run({ send: async (m) => void sent.push(m.to.emailAddress) });
    expect(await result).toEqual(['sent', 'sent', 'sent']);
    expect(sent).toEqual(['a', 'b', 'c']);
    expect(reports).toEqual([[0, 'sending'], [0, 'sent'], [1, 'sending'], [1, 'sent'], [2, 'sending'], [2, 'sent']]);
  });
  it('stops at the first failure', async () => {
    const sent: string[] = [];
    const { result } = run({
      send: async (m) => {
        if (m.to.emailAddress === 'b') throw new Error('quota');
        sent.push(m.to.emailAddress);
      },
    });
    expect(await result).toEqual(['sent', 'failed', 'queued']);
    expect(sent).toEqual(['a']);
  });
  it('stops when asked', async () => {
    let calls = 0;
    const { result } = run({ send: async () => void calls++ }, { shouldStop: () => calls >= 1 });
    expect(await result).toEqual(['sent', 'queued', 'queued']);
  });
});

/** Stand-in for an InboxSDK ComposeView that records what was set and emits events on demand. */
function fakeCompose() {
  const listeners: Record<string, (() => void)[]> = {};
  const fields: Record<string, unknown> = {};
  const body = document.createElement('div');
  const compose = {
    fields,
    emit: (event: string) => listeners[event]?.forEach((fn) => fn()),
    on: (event: string, fn: () => void) => void (listeners[event] ??= []).push(fn),
    setToRecipients: (v: string[]) => void (fields.to = v),
    setCcRecipients: (v: string[]) => void (fields.cc = v),
    setBccRecipients: (v: string[]) => void (fields.bcc = v),
    setFromEmail: (v: string) => void (fields.from = v),
    setSubject: (v: string) => void (fields.subject = v),
    setBodyHTML: (v: string) => void (fields.html = body.innerHTML = v),
    getBodyElement: () => body,
    getElement: () => body,
    send: () => void (fields.sent = true),
  };
  return compose;
}

describe('sendOne', () => {
  afterEach(() => vi.useRealTimers());

  it('fills the compose and resolves when Gmail starts sending', async () => {
    const compose = fakeCompose();
    const done = sendOne(compose, {
      ...message('j@x.com'), to: { emailAddress: 'j@x.com', name: 'Jane' }, cc: [{ emailAddress: 'c@x.com' }],
      from: { emailAddress: 'me@x.com', name: 'Me' },
    }, 1000, 0);
    await vi.waitFor(() => expect(compose.fields.sent).toBe(true));
    expect(compose.fields).toEqual({
      to: ['"Jane" <j@x.com>'], cc: ['c@x.com'], bcc: [], from: 'me@x.com', subject: 's', html: 'h', sent: true,
    });
    compose.emit('sending');
    await expect(done).resolves.toBeUndefined();
  });
  it('fails when the send is canceled', async () => {
    const compose = fakeCompose();
    const done = sendOne(compose, message('a'), 1000, 0);
    compose.emit('sendCanceled');
    await expect(done).rejects.toThrow('canceled');
  });
  it('fails when Gmail never sends', async () => {
    vi.useFakeTimers();
    const done = expect(sendOne(fakeCompose(), message('a'), 1000, 0)).rejects.toThrow("didn't send");
    await vi.advanceTimersByTimeAsync(1000);
    await done;
  });
  it('re-sets a body that Gmail wipes before sending it', async () => {
    const compose = fakeCompose();
    let wipes = 2;
    const set = compose.setBodyHTML;
    compose.setBodyHTML = (v) => set(wipes-- > 0 ? '' : v);
    const done = sendOne(compose, message('a'), 1000, 0);
    await vi.waitFor(() => expect(compose.fields.sent).toBe(true));
    expect(compose.getBodyElement().innerHTML).toBe('h');
    compose.emit('sending');
    await expect(done).resolves.toBeUndefined();
  });
  it("doesn't send when the body never sticks", async () => {
    const compose = fakeCompose();
    const set = compose.setBodyHTML;
    compose.setBodyHTML = () => set('');
    await expect(sendOne(compose, message('a'), 1000, 0)).rejects.toThrow("didn't keep");
    expect(compose.fields.sent).toBeUndefined();
  });
  it('opens a new compose per message', async () => {
    const opened: ReturnType<typeof fakeCompose>[] = [];
    const sender = composeSender(async () => {
      const compose = fakeCompose();
      opened.push(compose);
      compose.send = () => void compose.emit('sending');
      return compose;
    });
    await sender.send(message('a'));
    await sender.send(message('b'));
    expect(opened.map((c) => c.fields.to)).toEqual([['a'], ['b']]);
  });
});
