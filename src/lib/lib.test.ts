import { describe, expect, it } from 'vitest';
import { applyValues } from './apply';
import { autofill, companyFromEmail, firstNameFromRecipient } from './autofill';
import { IgnoreList } from './guard';
import { findWildcards, replaceWildcardsInElement, replaceWildcardsInText } from './wildcards';

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
});

describe('autofill', () => {
  it('first names', () => {
    expect(firstNameFromRecipient({ emailAddress: 'a@b.com', name: 'jane doe' })).toBe('Jane');
    expect(firstNameFromRecipient({ emailAddress: 'a@b.com', name: 'Doe, Jane' })).toBe('Jane');
    expect(firstNameFromRecipient({ emailAddress: 'john.smith@b.com' })).toBe('John');
    expect(firstNameFromRecipient({ emailAddress: 'x1@b.com' })).toBeUndefined();
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
