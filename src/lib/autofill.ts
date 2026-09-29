export interface Recipient {
  emailAddress: string;
  name?: string | null;
}

export type FillKind = 'firstName' | 'company';

// Edit these to teach EasyMerge new wildcard names. Keys are the wildcard with the leading
// underscore and inner underscores removed, so `_FIRST_NAME` and `_FIRSTNAME` are the same.
const ALIASES: Record<string, FillKind> = {
  FIRST: 'firstName',
  FIRSTNAME: 'firstName',
  NAME: 'firstName',
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export function kindForWildcard(wildcard: string): FillKind | undefined {
  return ALIASES[wildcard.replace(/^_/, '').replace(/_/g, '')];
}

export function firstNameFromRecipient(r: Recipient): string | undefined {
  const name = r.name?.trim();
  if (name && name.toLowerCase() !== r.emailAddress.toLowerCase()) {
    const token = name.includes(',')
      ? name.split(',')[1]?.trim().split(/\s+/)[0] // "Doe, Jane"
      : name.split(/\s+/)[0];
    if (token && /^[\p{L}'’-]+$/u.test(token)) return capitalize(token);
  }
  const local = r.emailAddress.split('@')[0]?.split(/[._+-]/)[0];
  if (local && /^[a-z]{2,}$/i.test(local)) return capitalize(local);
  return undefined;
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
      : kind === 'company' ? companyFromEmail(first.emailAddress)
      : undefined;
    if (value) out[wildcard] = value;
  }
  return out;
}
