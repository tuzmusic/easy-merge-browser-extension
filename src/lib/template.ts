// The last sent email that had wildcards, captured before they were filled, so it can be reused as a
// template. Persisted in chrome.storage.local so it survives reloading Gmail.
export interface Template {
  subject: string;
  html: string;
}

const KEY = 'lastTemplate';

export async function saveTemplate(template: Template): Promise<void> {
  await chrome.storage.local.set({ [KEY]: template });
}

export async function loadTemplate(): Promise<Template | undefined> {
  const stored = await chrome.storage.local.get(KEY);
  return stored[KEY] as Template | undefined;
}

// Whether inserting the template also replaces the subject (the "Include subject" checkbox).
const INCLUDE_SUBJECT_KEY = 'includeSubject';

export async function saveIncludeSubject(include: boolean): Promise<void> {
  await chrome.storage.local.set({ [INCLUDE_SUBJECT_KEY]: include });
}

export async function loadIncludeSubject(): Promise<boolean> {
  const stored = await chrome.storage.local.get(INCLUDE_SUBJECT_KEY);
  return stored[INCLUDE_SUBJECT_KEY] !== false;
}
