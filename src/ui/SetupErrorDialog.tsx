import { useEffect, useRef } from 'preact/hooks';

export interface SetupErrorDialogProps {
  summary: string;
  developerMessage: string;
  onClose(): void;
}

/** Shown instead of sending when the Gmail API isn't usable; there's no compose-window fallback. */
export function SetupErrorDialog({ summary, developerMessage, onClose }: SetupErrorDialogProps) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => ok.current?.focus(), []);
  // The first paragraph says what's wrong; the steps to fix it stay folded until asked for.
  const [headline, ...rest] = developerMessage.split('\n\n');
  const details = rest.join('\n\n');

  return (
    <div class="backdrop" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div class="dialog" role="alertdialog" aria-label="EasyMerge can't send">
        <h2><span class="mark">_</span>Easy<span class="merge">Merge</span></h2>
        <p class="summary">{summary}</p>

        <div class="dev">
          <span class="name">Developer message</span>
          <pre><code>{headline}</code></pre>
          {details && (
            <details>
              <summary>How to fix it</summary>
              <pre><code>{details}</code></pre>
            </details>
          )}
        </div>

        <footer>
          <button type="button" class="primary" ref={ok} onClick={onClose}>OK</button>
        </footer>
      </div>
    </div>
  );
}

export const setupErrorDialogCss = `
  .dialog { width: 640px; }
  .summary { margin: 0; font-size: 14px; line-height: 1.4; color: #3c4043; }
  .dev { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  summary { cursor: pointer; user-select: none; font-size: 12px; color: #1967d2; }
  summary:hover { text-decoration: underline; }
  details pre { margin-top: 6px; }
  pre { margin: 0; padding: 10px 12px; border-radius: 6px; background: #f8f9fa; border: 1px solid #e8eaed;
    overflow: auto; max-height: 50vh; font: 12px/1.5 ui-monospace, monospace; color: #202124;
    white-space: pre; user-select: text; }
`;
