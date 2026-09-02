import { nodeAt, type DomPoint } from "./dom";
import { lineAt, type TextRange } from "./text";

export type OffsetOf = (node: Node, offset: number) => number | null;

/** Current DOM selection as character offsets, or null if outside root. */
export function readSelection(root: HTMLElement, offsetOf: OffsetOf): TextRange | null {
  const sel = root.ownerDocument.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !sel.focusNode) {
    return null;
  }
  if (!root.contains(sel.anchorNode) || !root.contains(sel.focusNode)) {
    return null;
  }

  const anchor = offsetOf(sel.anchorNode, sel.anchorOffset);
  const focus = offsetOf(sel.focusNode, sel.focusOffset);
  if (anchor === null || focus === null) {
    return null;
  }

  return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

/** Place the DOM selection at character offsets. Assumes rendered DOM. */
export function writeSelection(root: HTMLElement, starts: number[], range: TextRange): void {
  const sel = root.ownerDocument.getSelection();
  if (!sel) {
    return;
  }

  const [startNode, startOffset] = nodeAt(root, toPoint(starts, range.start));
  const [endNode, endOffset] = nodeAt(root, toPoint(starts, range.end));
  sel.setBaseAndExtent(startNode, startOffset, endNode, endOffset);
}

export function toPoint(starts: number[], offset: number): DomPoint {
  const line = lineAt(starts, offset);
  return { line, inner: offset - starts[line] };
}
