export interface Recipient {
  emailAddress: string;
  name?: string | null;
}

export type FillKind = 'firstName' | 'lastName' | 'fullName' | 'company';

// Edit these to teach EasyMerge new wildcard names. Keys are the wildcard with the leading
// underscore and inner underscores removed, so `_FIRST_NAME` and `_FIRSTNAME` are the same.
const ALIASES: Record<string, FillKind> = {
  FIRST: 'firstName',
  FIRSTNAME: 'firstName',
  NAME: 'firstName',
  LAST: 'lastName',
  LASTNAME: 'lastName',
  SURNAME: 'lastName',
  FULLNAME: 'fullName',
  COMPANY: 'company',
  COMPANYNAME: 'company',
  CO: 'company',
};

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com',
  'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'fastmail.com', 'hey.com', 'comcast.net',
  'verizon.net', 'att.net', 'sbcglobal.net', 'qq.com', '163.com',
]);

// Second-level labels that are part of the public suffix (acme.co.uk -> Acme).
const SLD_SUFFIXES = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu']);

// Only fix case when the name is all one case, so "McDonald" and "O'Brien" survive.
const fixCase = (word: string) =>
  word === word.toLowerCase() || word === word.toUpperCase()
    ? word.toLowerCase().replace(/(^|[-'’])\p{L}/gu, (c) => c.toUpperCase())
    : word;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export function kindForWildcard(wildcard: string): FillKind | undefined {
  return ALIASES[wildcard.replace(/^_/, '').replace(/_/g, '')];
}

/** The recipient's name as words in first-to-last order, from the display name or the email. */
export function nameWords(r: Recipient): string[] {
  const name = r.name?.trim();
  if (name && name.toLowerCase() !== r.emailAddress.toLowerCase()) {
    const [before, after] = name.split(',', 2).map((part) => part.trim().split(/\s+/).filter(Boolean));
    const words = after?.length ? [...after, ...before] : before; // "Doe, Jane" -> Jane Doe
    if (words.length && words.every((w) => /^[\p{L}'’.-]+$/u.test(w))) return words.map(fixCase);
  }
  const parts = r.emailAddress.split('@')[0]?.split('+')[0]?.split(/[._-]/) ?? [];
  if (parts.length && parts.every((p) => /^[a-z]{2,}$/i.test(p))) return parts.map(capitalize);
  return [];
}

export function firstNameFromRecipient(r: Recipient): string | undefined {
  return nameWords(r)[0];
}

/** Undefined for a single-word name: better to ask than to guess the first name is the last. */
export function lastNameFromRecipient(r: Recipient): string | undefined {
  const words = nameWords(r);
  return words.length > 1 ? words[words.length - 1] : undefined;
}

export function fullNameFromRecipient(r: Recipient): string | undefined {
  return nameWords(r).join(' ') || undefined;
}

export function companyFromEmail(email: string): string | undefined {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || FREE_EMAIL_DOMAINS.has(domain)) return undefined;
  const labels = domain.split('.');
  labels.pop(); // TLD
  if (labels.length > 1 && SLD_SUFFIXES.has(labels[labels.length - 1])) labels.pop();
  const label = labels[labels.length - 1];
  return label ? capitalize(label) : undefined;
}

/** Best-guess values for the wildcards we recognize, from the first recipient. */
export function autofill(wildcards: string[], recipients: Recipient[]): Record<string, string> {
  const first = recipients[0];
  const out: Record<string, string> = {};
  if (!first) return out;
  for (const wildcard of wildcards) {
    const kind = kindForWildcard(wildcard);
    const value =
      kind === 'firstName' ? firstNameFromRecipient(first)
      : kind === 'lastName' ? lastNameFromRecipient(first)
      : kind === 'fullName' ? fullNameFromRecipient(first)
      : kind === 'company' ? companyFromEmail(first.emailAddress)
      : undefined;
    if (value) out[wildcard] = value;
  }
  return out;
}
