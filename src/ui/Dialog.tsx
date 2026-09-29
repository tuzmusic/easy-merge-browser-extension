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
  const reusable = wildcards.filter((w) => isEmpty(w) && lastValues[w]);
  const complete = wildcards.every((w) => !isEmpty(w));
  const firstEmptyWildcard = wildcards.find(isEmpty);

  const submit = (e: Event) => {
    e.preventDefault();
    if (complete) onSend(values);
  };

  return (
    <div class="backdrop" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form class="dialog" onSubmit={submit} role="dialog" aria-label="Fill wildcards">
        <h2>Fill in before sending</h2>
        <p class="hint">This email still has wildcards.</p>

        {wildcards.map((w) => (
          <label key={w}>
            <span class="name">{w}</span>
            <span class="row">
              <input
                ref={w === firstEmptyWildcard ? firstEmpty : undefined}
                value={values[w] ?? ''}
                placeholder={lastValues[w] ?? ''}
                onInput={(e) => set(w, (e.target as HTMLInputElement).value)}
              />
              {isEmpty(w) && lastValues[w] && (
                <button type="button" class="ghost" onClick={() => set(w, lastValues[w])}>
                  Use “{lastValues[w]}”
                </button>
              )}
            </span>
            {autofilled[w] && values[w] === autofilled[w] && <span class="auto">autofilled</span>}
          </label>
        ))}

        {reusable.length > 1 && (
          <button
            type="button"
            class="ghost"
            onClick={() => setValues((prev) => ({ ...prev, ...Object.fromEntries(reusable.map((w) => [w, lastValues[w]])) }))}
          >
            Use last values for all empty
          </button>
        )}

        <div class="actions">
          <button type="button" class="ghost" onClick={onCancel}>Cancel</button>
          <button type="button" class="ghost" onClick={onSendAnyway}>Send anyway</button>
          <button type="submit" class="primary" disabled={!complete}>Fill &amp; send</button>
        </div>
      </form>
    </div>
  );
}

export const dialogCss = `
  :host { all: initial; font-family: system-ui, sans-serif; }
  .backdrop { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.4);
    display: flex; align-items: center; justify-content: center; }
  .dialog { background: #fff; color: #202124; border-radius: 12px; padding: 20px 24px; width: 420px;
    max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,.3); display: flex; flex-direction: column; gap: 12px; }
  h2 { margin: 0; font-size: 18px; }
  .hint { margin: 0; color: #5f6368; font-size: 13px; }
  label { display: flex; flex-direction: column; gap: 4px; }
  .name { font: 600 12px ui-monospace, monospace; color: #5f6368; }
  .row { display: flex; gap: 8px; }
  input { flex: 1; padding: 8px 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; }
  input::placeholder { color: #9aa0a6; }
  .auto { font-size: 11px; color: #188038; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  button { font: inherit; font-size: 13px; padding: 8px 14px; border-radius: 6px; cursor: pointer; border: 1px solid transparent; }
  .ghost { background: none; border-color: #dadce0; color: #3c4043; white-space: nowrap; }
  .primary { background: #1a73e8; color: #fff; }
  .primary:disabled { opacity: .5; cursor: not-allowed; }
`;
