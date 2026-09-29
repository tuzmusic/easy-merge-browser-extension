import { replaceWildcardsInElement, replaceWildcardsInText } from './wildcards';

/** Minimal slice of InboxSDK's ComposeView, so this stays testable. */
export interface ComposeLike {
  getSubject(): string;
  setSubject(text: string): void;
  getBodyElement(): HTMLElement;
}

export function applyValues(compose: ComposeLike, values: Record<string, string>): void {
  const filled = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
  compose.setSubject(replaceWildcardsInText(compose.getSubject(), filled));
  replaceWildcardsInElement(compose.getBodyElement(), filled);
}
