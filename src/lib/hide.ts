// Hides Gmail compose windows while a merge runs. They stay on the page (moved off-screen and
// transparent, not display:none) because Gmail's editor has to keep working to send them.
const ATTR = 'data-easymerge-hidden';
const CSS = `[${ATTR}] {
  position: fixed !important; left: -10000px !important; top: 0 !important;
  opacity: 0 !important; pointer-events: none !important;
}`;

function ensureStyle(doc: Document) {
  if (doc.getElementById('easymerge-hide-style')) return;
  const style = doc.createElement('style');
  style.id = 'easymerge-hide-style';
  style.textContent = CSS;
  doc.head.append(style);
}

/** The whole floating window, title bar included; InboxSDK's compose element is only its inside. */
const windowOf = (composeElement: HTMLElement) => composeElement.closest<HTMLElement>('.AD') ?? composeElement;

/** Hide a compose window. Returns a function that shows it again. */
export function hideCompose(composeElement: HTMLElement): () => void {
  const el = windowOf(composeElement);
  ensureStyle(el.ownerDocument);
  el.setAttribute(ATTR, '');
  return () => el.removeAttribute(ATTR);
}
