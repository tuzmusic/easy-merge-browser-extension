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

// An optional section is `[[...]]` on one line: `about the _ROLE[[ on the _TEAM]].` It's kept (without
// the brackets) when every wildcard in it has a value, and dropped whole when any of them is blank.
const SECTION_SOURCE = String.raw`\[\[([^\n]*?)\]\]`;

const newSectionRegex = () => new RegExp(SECTION_SOURCE, 'g');

/** Wildcards that only ever appear inside `[[...]]` sections, so leaving them blank is fine. */
export function findOptionalWildcards(text: string): string[] {
  const outside = text.replace(newSectionRegex(), '');
  return findWildcards(text).filter((w) => !findWildcards(outside).includes(w));
}

interface Edit {
  start: number;
  end: number;
  insert: string;
}

/**
 * The replacements that fill `text`: each wildcard with a value, and each section either unwrapped or
 * removed. In order, never overlapping. Wildcards without a value are left as they are.
 */
function fillEdits(text: string, values: Record<string, string>): Edit[] {
  const has = (w: string) => !!values[w];
  const wildcardEdits = (from: number, to: number): Edit[] =>
    [...text.slice(from, to).matchAll(newRegex())]
      .filter((m) => has(m[0]))
      .map((m) => ({ start: from + m.index!, end: from + m.index! + m[0].length, insert: values[m[0]] }));

  const edits: Edit[] = [];
  let pos = 0;
  for (const section of text.matchAll(newSectionRegex())) {
    const start = section.index!;
    const end = start + section[0].length;
    edits.push(...wildcardEdits(pos, start));
    if (findWildcards(section[1]).every(has)) {
      edits.push({ start, end: start + 2, insert: '' }, ...wildcardEdits(start + 2, end - 2), { start: end - 2, end, insert: '' });
    } else {
      edits.push({ start, end, insert: '' });
    }
    pos = end;
  }
  edits.push(...wildcardEdits(pos, text.length));
  return edits;
}

export function replaceWildcardsInText(text: string, values: Record<string, string>): string {
  return fillEdits(text, values).reduceRight((out, { start, end, insert }) => out.slice(0, start) + insert + out.slice(end), text);
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
 * Replace wildcards (and resolve `[[...]]` sections) in a DOM tree. Pasted rich text (Capacities) often
 * splits one wildcard across several text nodes/spans, so we match against the concatenated text and
 * write each replacement into the first node the match touches, trimming the rest of the match out of
 * later nodes.
 */
export function replaceWildcardsInElement(root: HTMLElement, values: Record<string, string>): void {
  const { full, nodes } = indexText(root);

  // Back to front so earlier offsets stay valid.
  for (const { start, end, insert: replacement } of fillEdits(full, values).reverse()) {
    let placed = false;
    for (const { node, start: nodeStart } of nodes) {
      const nodeEnd = nodeStart + node.data.length;
      if (nodeEnd <= start || nodeStart >= end) continue;
      const from = Math.max(start, nodeStart) - nodeStart;
      const to = Math.min(end, nodeEnd) - nodeStart;
      const insert = placed ? '' : replacement;
      node.data = node.data.slice(0, from) + insert + node.data.slice(to);
      placed = true;
    }
  }
}

/** `replaceWildcardsInElement` for an HTML string, done on a detached copy. */
export function fillHTML(html: string, values: Record<string, string>): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  replaceWildcardsInElement(div, values);
  return div.innerHTML;
}

// Gmail's auto-inserted signature, and the "-- " line before it.
const SIGNATURE_SELECTOR = '.gmail_signature, .gmail_signature_prefix, [data-smartmail="gmail_signature"]';

/** True for a fresh compose: no subject and nothing in the body besides the signature. */
export function isBlankDraft(subject: string, body: HTMLElement): boolean {
  if (subject.trim()) return false;
  const copy = body.cloneNode(true) as HTMLElement;
  copy.querySelectorAll(SIGNATURE_SELECTOR).forEach((el) => el.remove());
  return !textOfElement(copy).trim();
}
