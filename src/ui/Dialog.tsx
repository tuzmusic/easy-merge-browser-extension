import { useEffect, useRef, useState } from 'preact/hooks';

export interface DialogProps {
  wildcards: string[];
  autofilled: Record<string, string>;
  lastValues: Record<string, string>;
  onSend(values: Record<string, string>): void;
  onSendAnyway(): void;
  onCancel(): void;
}

export function Dialog({ wildcards, autofilled, lastValues, onSend, onSendAnyway, onCancel }: DialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...autofilled }));
  const firstEmpty = useRef<HTMLInputElement>(null);
  useEffect(() => firstEmpty.current?.focus(), []);

  const set = (w: string, v: string) => setValues((prev) => ({ ...prev, [w]: v }));
  const isEmpty = (w: string) => !values[w]?.trim();
  // A field with a remembered value shows it as ghost text until accepted.
  const hasGhost = (w: string) => isEmpty(w) && !!lastValues[w];
  const reusable = wildcards.filter(hasGhost);
  const complete = wildcards.every((w) => !isEmpty(w));
  const firstEmptyWildcard = wildcards.find(isEmpty);

  // Decided once: if the "fill all" pill starts out useful, keep its space after it's used up so
  // the dialog doesn't jump; if it never applies, don't reserve anything.
  const [showsPill] = useState(() => wildcards.filter((w) => !autofilled[w]?.trim() && lastValues[w]).length > 1);

  // Tab (or → in an empty field) accepts the ghost text; Tab still moves on to the next field.
  const acceptGhost = (w: string, e: KeyboardEvent) => {
    if (!hasGhost(w)) return;
    if (e.key === 'Tab' && !e.shiftKey) set(w, lastValues[w]);
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      set(w, lastValues[w]);
    }
  };

  const submit = (e: Event) => {
    e.preventDefault();
    if (complete) onSend(values);
  };

  return (
    <div class="backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      {/* autocomplete=off plus the password managers' own opt-outs, so no dropdowns cover the fields. */}
      <form class="dialog" onSubmit={submit} role="dialog" aria-label="Fill wildcards" autocomplete="off" data-1p-ignore>
        <h2><span class="mark">_</span>Easy<span class="merge">Merge</span></h2>

        <div class="fields">
          {wildcards.map((w) => (
            <label key={w} class="field">
              <span class="name">{w}</span>
              <input
                ref={w === firstEmptyWildcard ? firstEmpty : undefined}
                value={values[w] ?? ''}
                placeholder={lastValues[w] ? `⇥ ${lastValues[w]}` : ''}
                title={hasGhost(w) ? `${lastValues[w]} (press Tab to reuse)` : undefined}
                autocomplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                data-form-type="other"
                onInput={(e) => set(w, (e.target as HTMLInputElement).value)}
                onKeyDown={(e) => acceptGhost(w, e)}
              />
            </label>
          ))}
        </div>

        {showsPill && (
          <button
            type="button"
            class={reusable.length > 1 ? 'reuse' : 'reuse spent'}
            onClick={() => setValues((prev) => ({ ...prev, ...Object.fromEntries(reusable.map((w) => [w, lastValues[w]])) }))}
          >
            ⇥ Fill {reusable.length} previous values
          </button>
        )}

        <footer>
          <button type="button" class="ghost" onClick={onCancel}>Cancel</button>
          <button type="button" class="ghost" onClick={onSendAnyway}>Send anyway</button>
          <button type="submit" class="primary" disabled={!complete}>Fill &amp; send</button>
        </footer>
      </form>
    </div>
  );
}

export const dialogCss = `
  :host { all: initial; font-family: system-ui, sans-serif; }
  .backdrop { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.4);
    display: flex; align-items: center; justify-content: center; }
  .dialog { background: #fff; color: #202124; border-radius: 12px; padding: 18px 20px; width: 520px;
    max-width: 92vw; max-height: 85vh; box-shadow: 0 8px 32px rgba(0,0,0,.3);
    display: flex; flex-direction: column; gap: 14px; box-sizing: border-box; }
  h2 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
  /* The wordmark is a wildcard itself: _EasyMerge, with the underscore and "Merge" in the accent blue. */
  .mark, .merge { color: #1a73e8; }

  .fields { display: flex; flex-wrap: wrap; gap: 14px 12px; overflow-y: auto; padding: 2px; }
  /* 200px basis in a 520px dialog: at most two fields per row. */
  .field { flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .name { font: 600 11px ui-monospace, monospace; color: #5f6368; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; }

  input { min-width: 0; padding: 7px 9px; border: 1px solid #dadce0; border-radius: 6px;
    font-size: 14px; color: #202124; background: #fff; }
  input:focus { outline: none; border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,.2); }
  input::placeholder { color: #a0a4a8; }

  footer { display: flex; justify-content: flex-end; gap: 8px; }
  button { font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 6px; cursor: pointer;
    border: 1px solid transparent; }
  .ghost { background: none; border-color: #dadce0; color: #3c4043; white-space: nowrap; }
  .primary { background: #1a73e8; color: #fff; }
  .primary:disabled { opacity: .5; cursor: not-allowed; }
  .reuse { align-self: flex-end; margin-bottom: -4px; padding: 4px 10px; border-radius: 999px;
    background: #e8f0fe; color: #1967d2; font-size: 12px; font-weight: 500; }
  .reuse:hover { background: #d2e3fc; }
  .spent { visibility: hidden; }
`;
