// Last value used per wildcard. Deliberately in-memory: it lives as long as the Gmail tab does.
const lastValues = new Map<string, string>();

export const getLastValues = (): Record<string, string> => Object.fromEntries(lastValues);

export function rememberValues(values: Record<string, string>): void {
  for (const [wildcard, value] of Object.entries(values)) {
    if (value.trim()) lastValues.set(wildcard, value);
  }
}
