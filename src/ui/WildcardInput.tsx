import type { Ref } from 'preact';

/**
 * A wildcard's value field. A remembered value shows as `⇥ value` ghost text until accepted: Tab (or →
 * in an empty field) accepts it, and Tab still moves on to the next field.
 */
export function WildcardInput({ value, ghost, onChange, inputRef, label }: {
  value: string;
  ghost?: string;
  onChange(value: string): void;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
}) {
  const hasGhost = !value.trim() && !!ghost;
  const acceptGhost = (e: KeyboardEvent) => {
    if (!hasGhost) return;
    if (e.key === 'Tab' && !e.shiftKey) onChange(ghost!);
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(ghost!);
    }
  };

  return (
    // autocomplete=off plus the password managers' own opt-outs, so no dropdowns cover the fields.
    <input
      ref={inputRef}
      value={value}
      placeholder={ghost ? `⇥ ${ghost}` : ''}
      title={hasGhost ? `${ghost} (press Tab to reuse)` : undefined}
      aria-label={label}
      autocomplete="off"
      data-1p-ignore
      data-lpignore="true"
      data-bwignore
      data-form-type="other"
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onKeyDown={acceptGhost}
    />
  );
}
