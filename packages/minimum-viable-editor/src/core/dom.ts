/**
 * Editable DOM shape: one block per line, inline spans for tokens, and a
 * `<br>` placeholder that keeps an empty line visible.
 *
 *   <div>                         <- root
 *     <div><span class="mve-k">let</span> x</div>
 *     <div><br></div>             <- empty line
 *   </div>
 */

const LINE_TAG = "DIV";
const BREAK_TAG = "BR";
const NEWLINE = "\n";

export interface DomPoint {
  /** Index among root's child nodes. */
  line: number;
  /** Characters from the start of that node. */
  inner: number;
}

export function isLine(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === LINE_TAG;
}

/** Text of a run of root-level nodes, one line per block. */
export function readLines(nodes: Node[]): string {
  const lines: string[] = [];
  let loose: string | null = null;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (isLine(node)) {
      if (loose !== null) {
        lines.push(loose);
        loose = null;
      }
      lines.push(readInline(node));
      continue;
    }

    // Stray nodes outside a block (browsers do this when emptying the
    // editor) form an implicit line.
    const isLast = i === nodes.length - 1;
    loose = (loose ?? "") + (isBreak(node) && isLast ? "" : readInline(node));
  }

  if (loose !== null) {
    lines.push(loose);
  }

  return lines.join(NEWLINE);
}

/**
 * Text inside one line node. A `<br>` breaks the line unless it is the
 * last thing in it: browsers leave one there as a placeholder, sometimes
 * nested inside a span.
 */
export function readInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).data;
  }
  if (isBreak(node)) {
    return NEWLINE;
  }

  const el = node as Element | DocumentFragment;
  if (!el.querySelector(BREAK_TAG)) {
    return el.textContent ?? "";
  }

  const walker = el.ownerDocument!.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let text = "";
  let trailingBreak = false;

  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      text += (n as Text).data;
      trailingBreak = false;
    } else if (isBreak(n)) {
      text += NEWLINE;
      trailingBreak = true;
    }
  }

  return trailingBreak ? text.slice(0, -1) : text;
}

/**
 * Untouched line nodes at each end of root after a browser edit, given the
 * nodes we last rendered. A node counts as untouched when it is still the
 * same object at the same position and nothing inside it mutated.
 */
export function dirtyRegion(
  root: HTMLElement,
  rendered: Node[],
  records: MutationRecord[]
): { prefix: number; suffix: number } | null {
  if (records.length === 0) {
    return null;
  }

  const dirty = new Set<Node>();
  for (const rec of records) {
    if (rec.target === root) {
      continue;
    }
    const top = topLevelAncestor(root, rec.target);
    if (top) {
      dirty.add(top);
    }
  }

  const nodes = root.childNodes;
  const max = Math.min(rendered.length, nodes.length);
  const clean = (i: number, j: number) => rendered[i] === nodes[j] && !dirty.has(nodes[j]);

  let prefix = 0;
  while (prefix < max && clean(prefix, prefix)) {
    prefix++;
  }

  let suffix = 0;
  while (
    prefix + suffix < max &&
    clean(rendered.length - 1 - suffix, nodes.length - 1 - suffix)
  ) {
    suffix++;
  }

  return { prefix, suffix };
}

function topLevelAncestor(root: HTMLElement, node: Node): Node | null {
  let top: Node | null = node;
  while (top && top.parentNode !== root) {
    top = top.parentNode;
  }
  return top;
}

function isBreak(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === BREAK_TAG;
}

/** Map a DOM position to (line index, offset within line). */
export function pointOf(root: HTMLElement, node: Node, offset: number): DomPoint | null {
  const nodes = root.childNodes;

  if (node === root) {
    if (offset >= nodes.length) {
      const lastIndex = nodes.length - 1;
      return lastIndex < 0 ? { line: 0, inner: 0 } : { line: lastIndex, inner: readInline(nodes[lastIndex]).length };
    }
    return { line: offset, inner: 0 };
  }

  const top = topLevelAncestor(root, node);
  if (!top) {
    return null;
  }

  const line = Array.prototype.indexOf.call(nodes, top);
  const range = root.ownerDocument.createRange();
  range.setStart(top, 0);
  range.setEnd(node, offset);

  return { line, inner: readInline(range.cloneContents()).length };
}

/** Inverse of pointOf, for our own rendered lines. */
export function nodeAt(root: HTMLElement, point: DomPoint): [Node, number] {
  const lineNode = root.childNodes[point.line];
  if (!lineNode) {
    return [root, 0];
  }

  const walker = root.ownerDocument.createTreeWalker(lineNode, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let last: Text | null = null;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (point.inner <= consumed + text.length) {
      return [text, point.inner - consumed];
    }
    consumed += text.length;
    last = text;
  }

  return last ? [last, last.length] : [lineNode, 0];
}

/** Text between root child `fromIndex` and a DOM position, by our line rules. */
export function readUpTo(root: HTMLElement, fromIndex: number, node: Node, offset: number): string {
  const range = root.ownerDocument.createRange();
  range.setStart(root, fromIndex);
  range.setEnd(node, offset);

  return readLines(Array.from(range.cloneContents().childNodes));
}
