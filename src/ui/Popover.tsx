import { render } from 'preact';

/** Contents of the compose button's dropdown: a message, plus Replace/Cancel when `onConfirm` is given. */
function Popover({ message, onConfirm, onClose }: { message: string; onConfirm?(): void; onClose(): void }) {
  return (
    <div class="popover">
      <p>{message}</p>
      {onConfirm && (
        <footer>
          <button class="ghost" onClick={onClose}>Cancel</button>
          <button class="primary" onClick={onConfirm}>Replace</button>
        </footer>
      )}
    </div>
  );
}

const popoverCss = `
  :host { all: initial; font-family: system-ui, sans-serif; }
  .popover { padding: 12px 14px; max-width: 260px; color: #202124; display: flex; flex-direction: column; gap: 10px; }
  p { margin: 0; font-size: 13px; line-height: 1.4; }
  footer { display: flex; justify-content: flex-end; gap: 8px; }
  button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 6px; cursor: pointer;
    border: 1px solid transparent; }
  .ghost { background: none; border-color: #dadce0; color: #3c4043; }
  .primary { background: #1a73e8; color: #fff; }
`;

/** Render into an InboxSDK dropdown's element, in a shadow root so Gmail's CSS can't touch it. */
export function showPopover(
  container: HTMLElement,
  props: { message: string; onConfirm?(): void; onClose(): void },
): void {
  const shadow = container.appendChild(document.createElement('div')).attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = popoverCss;
  const mountPoint = document.createElement('div');
  shadow.append(style, mountPoint);
  render(<Popover {...props} />, mountPoint);
}
