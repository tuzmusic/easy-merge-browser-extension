// A wildcard is `_ALLCAPS`: leading underscore, then 2+ chars of A-Z/0-9, inner underscores allowed
// (`_FIRST_NAME`). Double-clicking selects the whole token, which is the point of the syntax.
// The lookarounds keep us from matching inside snake_case identifiers, URLs, or `__DUNDER__`.
const WILDCARD_SOURCE = String.raw`(?<![A-Za-z0-9_])_[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*(?![A-Za-z0-9_])`;

const newRegex = () => new RegExp(WILDCARD_SOURCE, 'g');

/** Distinct wildcards in order of first appearance. */
export function findWildcards(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(newRegex())) seen.add(match[0]);
  return [...seen];
}

export function replaceWildcardsInText(text: string, values: Record<string, string>): string {
  return text.replace(newRegex(), (wildcard) => values[wildcard] ?? wildcard);
}

/**
 * Replace wildcards in a DOM tree. Pasted rich text (Capacities) often splits one wildcard across
 * several text nodes/spans, so we match against the concatenated text and write each replacement
 * into the first node the match touches, trimming the rest of the match out of later nodes.
 */
export function replaceWildcardsInElement(root: HTMLElement, values: Record<string, string>): void {
  const doc = root.ownerDocument;
  const nodes: Text[] = [];
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);

  const full = nodes.map((n) => n.data).join('');
  const matches = [...full.matchAll(newRegex())].filter((m) => m[0] in values);

  // Back to front so earlier offsets stay valid.
  for (const match of matches.reverse()) {
    const start = match.index!;
    const end = start + match[0].length;
    let offset = 0;
    let placed = false;
    for (const node of nodes) {
      const nodeStart = offset;
      const nodeEnd = offset + node.data.length;
      offset = nodeEnd;
      if (nodeEnd <= start || nodeStart >= end) continue;
      const from = Math.max(start, nodeStart) - nodeStart;
      const to = Math.min(end, nodeEnd) - nodeStart;
      const insert = placed ? '' : values[match[0]];
      node.data = node.data.slice(0, from) + insert + node.data.slice(to);
      placed = true;
    }
  }
}
