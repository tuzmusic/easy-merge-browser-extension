import { findWildcards } from './wildcards';

/**
 * Per-compose record of wildcards the user chose to "send anyway" with. Closing the dialog does
 * not add to it, so the next Send retriggers; only an explicit skip does. If new wildcards are
 * typed later, those still trigger.
 */
export class IgnoreList {
  private ignored = new WeakMap<object, Set<string>>();

  ignore(compose: object, wildcards: string[]): void {
    const set = this.ignored.get(compose) ?? new Set<string>();
    wildcards.forEach((w) => set.add(w));
    this.ignored.set(compose, set);
  }

  /** Wildcards in the draft that still need attention. */
  pending(compose: object, subject: string, body: string): string[] {
    const ignored = this.ignored.get(compose);
    return findWildcards(`${subject}\n${body}`).filter((w) => !ignored?.has(w));
  }
}
