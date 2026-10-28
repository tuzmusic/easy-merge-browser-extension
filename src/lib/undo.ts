// One level of undo for a change we make to a compose window (Gmail's own undo can't see it, since
// InboxSDK sets the subject and body directly). Cmd/Ctrl+Z inside the window restores what was saved,
// until the user edits the draft themselves; after that, Cmd+Z is Gmail's again.
export class UndoSlot<T> {
  #saved: T | undefined;

  constructor(element: HTMLElement, private restore: (saved: T) => void) {
    element.addEventListener('keydown', (event) => {
      const isUndo = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z';
      if (!isUndo || this.#saved === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      this.undo();
    }, true);
    // Only real typing counts: InboxSDK fakes key events to make Gmail save the draft after it's changed.
    element.addEventListener('input', (event) => {
      if (event.isTrusted) this.#saved = undefined;
    }, true);
  }

  save(value: T): void {
    this.#saved = value;
  }

  get canUndo(): boolean {
    return this.#saved !== undefined;
  }

  undo(): void {
    if (this.#saved === undefined) return;
    const saved = this.#saved;
    this.#saved = undefined;
    this.restore(saved);
  }
}
