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

const BLOCK_TAGS = new Set([
  'ADDRESS', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4',
  'H5', 'H6', 'HEADER', 'HR', 'LI', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TD', 'TH', 'TR', 'UL',
]);

interface TextIndex {
  full: string;
  nodes: { node: Text; start: number }[];
}

/**
 * Concatenate the text nodes under `root`, with a newline wherever a `<br>` or block boundary falls.
 * Gmail puts each line in its own `<div>`, so plain `textContent` runs `_FIRSTNAME` straight into
 * the next line's text and the wildcard no longer matches.
 */
function indexText(root: HTMLElement): TextIndex {
  const doc = root.ownerDocument;
  const blockOf = (node: Node): Node => {
    let el = node.parentNode;
    while (el && el !== root && !BLOCK_TAGS.has((el as Element).tagName)) el = el.parentNode;
    return el ?? root;
  };

  const nodes: TextIndex['nodes'] = [];
  let full = '';
  let prevBlock: Node | undefined;
  let pendingBreak = false;
  const walker = doc.createTreeWalker(root, 1 | 4 /* NodeFilter.SHOW_ELEMENT | SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      if ((n as Element).tagName === 'BR') pendingBreak = true;
      continue;
    }
    const block = blockOf(n);
    if (prevBlock && (pendingBreak || block !== prevBlock)) full += '\n';
    pendingBreak = false;
    prevBlock = block;
    nodes.push({ node: n as Text, start: full.length });
    full += (n as Text).data;
  }
  return { full, nodes };
}

/** The element's text with line breaks preserved, for wildcard detection. */
export function textOfElement(root: HTMLElement): string {
  return indexText(root).full;
}

/**
 * Replace wildcards in a DOM tree. Pasted rich text (Capacities) often splits one wildcard across
 * several text nodes/spans, so we match against the concatenated text and write each replacement
 * into the first node the match touches, trimming the rest of the match out of later nodes.
 */
export function replaceWildcardsInElement(root: HTMLElement, values: Record<string, string>): void {
  const { full, nodes } = indexText(root);
  const matches = [...full.matchAll(newRegex())].filter((m) => m[0] in values);

  // Back to front so earlier offsets stay valid.
  for (const match of matches.reverse()) {
    const start = match.index!;
    const end = start + match[0].length;
    let placed = false;
    for (const { node, start: nodeStart } of nodes) {
      const nodeEnd = nodeStart + node.data.length;
      if (nodeEnd <= start || nodeStart >= end) continue;
      const from = Math.max(start, nodeStart) - nodeStart;
      const to = Math.min(end, nodeEnd) - nodeStart;
      const insert = placed ? '' : values[match[0]];
      node.data = node.data.slice(0, from) + insert + node.data.slice(to);
      placed = true;
    }
  }
}
