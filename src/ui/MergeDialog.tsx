import { useEffect, useRef, useState } from 'preact/hooks';
import { kindForWildcard } from '../lib/autofill';
import type { MergeRow, RowStatus } from '../lib/merge';
import { WildcardInput } from './WildcardInput';

export interface MergeDialogProps {
  wildcards: string[];
  /** One per recipient, prefilled with what we could autofill or what was typed last time. */
  initialRows: MergeRow[];
  lastValues: Record<string, string>;
  hasCopies: boolean;
  hasAttachments: boolean;
  /** Sends the rows; the dialog stays up to show progress. */
  run(
    rows: MergeRow[],
    report: (index: number, status: RowStatus, error?: string) => void,
    shouldStop: () => boolean,
  ): Promise<RowStatus[]>;
  onDone(rows: MergeRow[], statuses: RowStatus[]): void;
  onSendAnyway(): void;
  onCancel(): void;
}

type Phase = 'edit' | 'confirmAnyway' | 'sending' | 'done';

const STATUS_ICON: Record<RowStatus, string> = { queued: '○', sending: '', sent: '✓', failed: '✕' };

// How long "Sent N emails" stays up before the dialog closes itself.
const SUCCESS_LINGER_MS = 1500;

export function MergeDialog({
  wildcards, initialRows, lastValues, hasCopies, hasAttachments, run, onDone, onSendAnyway, onCancel,
}: MergeDialogProps) {
  const [rows, setRows] = useState(initialRows);
  const [phase, setPhase] = useState<Phase>('edit');
  const [statuses, setStatuses] = useState<RowStatus[]>([]);
  const [error, setError] = useState<string>();
  const [stopping, setStopping] = useState(false);
  const stopRequested = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  // Pinned when sending starts, so swapping inputs for plain values doesn't shrink the dialog.
  const [pinnedWidth, setPinnedWidth] = useState<number>();
  const firstEmpty = useRef<HTMLInputElement>(null);
  const goBack = useRef<HTMLButtonElement>(null);

  useEffect(() => firstEmpty.current?.focus(), []);
  useEffect(() => {
    if (phase === 'confirmAnyway') goBack.current?.focus();
  }, [phase]);

  const editing = phase === 'edit' || phase === 'confirmAnyway';
  const isEmpty = (row: MergeRow, w: string) => !row.values[w]?.trim();
  const set = (i: number, w: string, v: string) =>
    setRows((prev) => prev.map((row, j) => (j === i ? { ...row, values: { ...row.values, [w]: v } } : row)));
  const remove = (i: number) => setRows((prev) => prev.filter((_, j) => j !== i));

  // "↓ all": the column's first value, offered when some cells in it are still empty. Not for names and
  // companies, which are per person by definition.
  const fillDownValue = (w: string) => {
    if (kindForWildcard(w)) return undefined;
    const value = rows.find((row) => !isEmpty(row, w))?.values[w];
    return value && rows.some((row) => isEmpty(row, w)) ? value : undefined;
  };
  const fillDown = (w: string, value: string) =>
    setRows((prev) => prev.map((row) => (isEmpty(row, w) ? { ...row, values: { ...row.values, [w]: value } } : row)));

  const reusableCount = rows.reduce((n, row) => n + wildcards.filter((w) => isEmpty(row, w) && lastValues[w]).length, 0);
  const fillPrevious = () =>
    setRows((prev) => prev.map((row) => ({
      ...row,
      values: {
        ...row.values,
        ...Object.fromEntries(wildcards.filter((w) => isEmpty(row, w) && lastValues[w]).map((w) => [w, lastValues[w]])),
      },
    })));
  // Decided once, as in the single dialog: keep the pill's space after it's used so nothing jumps.
  const [showsPill] = useState(() => reusableCount > 1);

  const complete = rows.every((row) => wildcards.every((w) => !isEmpty(row, w)));
  const canSend = complete;
  // Focus lands here on open; the first cell when everything is already filled, so Enter sends.
  const firstEmptyCell = (() => {
    for (const [i, row] of rows.entries()) {
      const w = wildcards.find((w) => isEmpty(row, w));
      if (w) return `${i}:${w}`;
    }
    return `0:${wildcards[0]}`;
  })();

  const send = async (e: Event) => {
    e.preventDefault();
    if (!canSend || phase !== 'edit') return;
    setPinnedWidth(form.current?.offsetWidth);
    setPhase('sending');
    setStatuses(rows.map(() => 'queued'));
    const report = (i: number, status: RowStatus, message?: string) => {
      setStatuses((prev) => prev.map((s, j) => (j === i ? status : s)));
      if (message) setError(message);
    };
    let final: RowStatus[];
    try {
      final = await run(rows, report, () => stopRequested.current);
    } catch (err) {
      final = rows.map(() => 'queued');
      setError(err instanceof Error ? err.message : String(err));
    }
    setStatuses(final);
    setPhase('done');
    if (final.every((s) => s === 'sent')) setTimeout(() => onDone(rows, final), SUCCESS_LINGER_MS);
  };

  const stop = () => {
    stopRequested.current = true;
    setStopping(true);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (phase === 'edit') onCancel();
    else if (phase === 'confirmAnyway') setPhase('edit');
  };

  const sentCount = statuses.filter((s) => s === 'sent').length;
  const allSent = phase === 'done' && sentCount === rows.length;

  return (
    <div class="backdrop" onKeyDown={onKeyDown}>
      <form
        ref={form}
        class={pinnedWidth ? 'dialog wide pinned' : 'dialog wide'}
        style={pinnedWidth ? { width: `${pinnedWidth}px` } : undefined}
        onSubmit={send}
        role="dialog"
        aria-label="Fill wildcards for each recipient"
        autocomplete="off"
        data-1p-ignore
      >
        <h2><span class="mark">_</span>Easy<span class="merge">Merge</span></h2>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="who">To</th>
                {wildcards.map((w) => {
                  const value = editing ? fillDownValue(w) : undefined;
                  return (
                    <th key={w}>
                      <span class="name">{w}</span>
                      {value && (
                        <button type="button" class="fill-down" title={`Use “${value}” for everyone`} onClick={() => fillDown(w, value)}>
                          ↓ all
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.recipient.emailAddress}>
                  <td class="who">
                    <div class="who-inner">
                      {editing ? (
                        <button type="button" class="remove" title="Don't send to this recipient" disabled={rows.length < 2} onClick={() => remove(i)}>
                          ×
                        </button>
                      ) : (
                        <span class={`status ${statuses[i]}`} title={statuses[i]}>{STATUS_ICON[statuses[i]]}</span>
                      )}
                      <div class="who-text">
                        <span class="person">{row.recipient.name?.trim() || row.recipient.emailAddress}</span>
                        {row.recipient.name?.trim() && <span class="email">{row.recipient.emailAddress}</span>}
                      </div>
                    </div>
                  </td>
                  {wildcards.map((w) => (
                    <td key={w}>
                      {editing ? (
                        <WildcardInput
                          inputRef={`${i}:${w}` === firstEmptyCell ? firstEmpty : undefined}
                          value={row.values[w] ?? ''}
                          ghost={lastValues[w]}
                          label={`${w} for ${row.recipient.emailAddress}`}
                          onChange={(v) => set(i, w, v)}
                        />
                      ) : (
                        <span class="value">{row.values[w]}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && showsPill && (
          <button type="button" class={reusableCount > 1 ? 'reuse' : 'reuse spent'} onClick={fillPrevious}>
            ⇥ Fill {reusableCount} previous values
          </button>
        )}

        {editing && hasCopies && <p class="note">Cc and Bcc recipients get a copy of every email.</p>}
        {editing && hasAttachments && <p class="note">Every email gets the attachments.</p>}

        {phase === 'edit' && (
          <footer>
            <button type="button" class="ghost" onClick={onCancel}>Cancel</button>
            <button type="button" class="ghost" onClick={() => setPhase('confirmAnyway')}>Send anyway</button>
            <button type="submit" class="primary" disabled={!canSend}>
              Send {rows.length} emails
            </button>
          </footer>
        )}

        {phase === 'confirmAnyway' && (
          <footer class="confirm">
            <p>
              <strong>You probably don't want to do this.</strong> Everyone gets the same single email, with the
              wildcards unfilled.
            </p>
            <div class="buttons">
              <button type="button" class="ghost" onClick={onSendAnyway}>Send to all {rows.length} anyway</button>
              <button type="button" class="primary" ref={goBack} onClick={() => setPhase('edit')}>Go back</button>
            </div>
          </footer>
        )}

        {phase === 'sending' && (
          <footer>
            <p class="progress">Sending {Math.min(sentCount + 1, rows.length)} of {rows.length}…</p>
            <button type="button" class="ghost" onClick={stop} disabled={stopping}>
              {stopping ? 'Stopping…' : 'Stop'}
            </button>
          </footer>
        )}

        {phase === 'done' && (
          <footer>
            <p class={allSent ? 'progress ok' : 'progress'}>
              {allSent
                ? `Sent ${rows.length} emails.`
                : `Sent ${sentCount} of ${rows.length}. The rest are still in your draft.`}
              {!allSent && error && <span class="error"> {error}</span>}
            </p>
            {!allSent && <button type="button" class="primary" onClick={() => onDone(rows, statuses)}>Close</button>}
          </footer>
        )}
      </form>
    </div>
  );
}

export const mergeDialogCss = `
  .dialog.wide { width: auto; min-width: min(520px, 92vw); max-width: min(92vw, 1100px); }

  .table-wrap { overflow: auto; max-height: 55vh; margin: 0 -4px; padding: 0 4px; }
  table { border-collapse: separate; border-spacing: 8px 6px; margin: -6px -8px; }
  .pinned table { width: calc(100% + 16px); }
  .pinned .who { width: 1%; }
  th { text-align: left; font-weight: normal; white-space: nowrap; position: sticky; top: 0;
    background: #fff; z-index: 1; padding-bottom: 2px; }
  th .name { display: inline; }
  td { vertical-align: middle; }
  td input { width: 100%; min-width: 130px; box-sizing: border-box; }
  .who { position: sticky; left: 0; background: #fff; z-index: 2; max-width: 220px; }
  th.who { z-index: 3; font: 600 11px ui-monospace, monospace; color: #5f6368; }
  .who-inner { display: flex; align-items: center; gap: 8px; }
  .who-text { display: flex; flex-direction: column; min-width: 0; }
  .person { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .email { font-size: 11px; color: #5f6368; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Same box as the inputs it replaces while sending. */
  .value { display: block; max-width: 240px; padding: 7px 9px; border: 1px solid transparent; font-size: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .fill-down { margin-left: 6px; padding: 1px 7px; border-radius: 999px; font-size: 11px;
    background: #e8f0fe; color: #1967d2; }
  .fill-down:hover { background: #d2e3fc; }
  .remove { width: 20px; height: 20px; padding: 0; flex: none; border-radius: 50%; font-size: 15px;
    line-height: 1; background: none; color: #5f6368; }
  .remove:hover:not(:disabled) { background: #f1f3f4; color: #202124; }
  .remove:disabled { visibility: hidden; }

  .status { width: 20px; flex: none; text-align: center; font-size: 14px; color: #9aa0a6; }
  .status.sending::before { content: ''; display: inline-block; width: 10px; height: 10px; border-radius: 50%;
    border: 2px solid #d2e3fc; border-top-color: #1a73e8; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .status.sent { color: #188038; }
  .status.failed { color: #d93025; }

  .note, .progress { margin: 0; font-size: 12px; color: #5f6368; }
  .progress { flex: 1; align-self: center; font-size: 13px; color: #3c4043; }
  .progress.ok { color: #188038; }
  .error { color: #d93025; }

  .confirm { flex-direction: column; align-items: stretch; gap: 10px; }
  .confirm p { margin: 0; font-size: 13px; line-height: 1.4; color: #3c4043; }
  .confirm .buttons { display: flex; justify-content: flex-end; gap: 8px; }
`;
