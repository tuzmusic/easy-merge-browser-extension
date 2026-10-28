import { render } from 'preact';
import { useState } from 'preact/hooks';

export interface PopoverProps {
  message: string;
  /** Shows Replace/Cancel and the "Include subject" checkbox. */
  onConfirm?(includeSubject: boolean): void;
  /** Initial state of the checkbox. */
  includeSubject?: boolean;
  /** Shows an Undo button, for when the last replace can still be undone. */
  onUndo?(): void;
  onClose(): void;
}

/** Contents of the compose button's dropdown: a message, plus the controls its callbacks ask for. */
function Popover({ message, onConfirm, includeSubject = true, onUndo, onClose }: PopoverProps) {
  const [subject, setSubject] = useState(includeSubject);
  return (
    <div class="popover">
      <p>{message}</p>
      {onConfirm && (
        <label>
          <input type="checkbox" checked={subject} onChange={(e) => setSubject(e.currentTarget.checked)} />
          Include subject
        </label>
      )}
      {(onConfirm || onUndo) && (
        <footer>
          {onUndo && <button class="ghost undo" title="⌘Z / Ctrl+Z" onClick={onUndo}>Undo replace</button>}
          <button class="ghost" onClick={onClose}>Cancel</button>
          {onConfirm && <button class="primary" onClick={() => onConfirm(subject)}>Replace</button>}
        </footer>
      )}
    </div>
  );
}

const popoverCss = `
  :host { all: initial; font-family: system-ui, sans-serif; }
  .popover { padding: 12px 14px; max-width: 300px; color: #202124; display: flex; flex-direction: column; gap: 10px; }
  p { margin: 0; font-size: 13px; line-height: 1.4; }
  label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
  input { margin: 0; }
  footer { display: flex; justify-content: flex-end; gap: 8px; }
  button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
    border: 1px solid transparent; white-space: nowrap; }
  .ghost { background: none; border-color: #dadce0; color: #3c4043; }
  .undo { margin-right: auto; }
  .primary { background: #1a73e8; color: #fff; }
`;

/** Render into an InboxSDK dropdown's element, in a shadow root so Gmail's CSS can't touch it. */
export function showPopover(container: HTMLElement, props: PopoverProps): void {
  const shadow = container.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = popoverCss;
  const mountPoint = document.createElement('div');
  shadow.append(style, mountPoint);
  render(<Popover {...props} />, mountPoint);
}
