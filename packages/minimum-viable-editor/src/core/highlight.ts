import { Tree } from "@lezer/common";
import { highlightTree, type Highlighter } from "@lezer/highlight";
import { defaultHighlighter } from "../highlighter";
import type { Language } from "../language";
import { lineEnd } from "./text";

const BREAK_TAG = "br";
const LINE_TAG = "div";

/**
 * Render lines [lineFrom, lineTo) as block elements with one tree walk.
 * Tokens spanning a newline are split across line elements.
 */
export function renderLines(
  doc: Document,
  value: string,
  starts: number[],
  lineFrom: number,
  lineTo: number,
  language: Language | null,
  tree: Tree | null
): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (lineFrom >= lineTo) {
    return out;
  }

  const from = starts[lineFrom];
  const to = lineEnd(starts, lineTo - 1, value.length);
  let line = lineFrom;
  let el = doc.createElement(LINE_TAG);
  let pos = from;

  const finish = () => {
    if (!el.firstChild) {
      el.append(doc.createElement(BREAK_TAG));
    }
    out.push(el);
  };

  // Emit [pos, upTo) with `classes`, starting new line elements at "\n".
  const emit = (upTo: number, classes: string | null) => {
    while (pos < upTo) {
      const end = lineEnd(starts, line, value.length);
      const chunkEnd = Math.min(upTo, end);

      if (chunkEnd > pos) {
        const text = value.slice(pos, chunkEnd);
        if (classes) {
          const span = doc.createElement("span");
          span.className = language?.refine ? language.refine(classes, text) : classes;
          span.textContent = text;
          el.append(span);
        } else {
          el.append(text);
        }
      }
      pos = chunkEnd;

      if (pos === end && pos < upTo) {
        finish();
        el = doc.createElement(LINE_TAG);
        pos = end + 1;
        line++;
      }
    }
  };

  if (language && tree) {
    const highlighter: Highlighter = language.highlighter ?? defaultHighlighter;
    highlightTree(
      tree,
      highlighter,
      (start, end, classes) => {
        start = Math.max(start, from);
        end = Math.min(end, to);
        if (start >= end) {
          return;
        }
        emit(start, null);
        emit(end, classes);
      },
      from,
      to
    );
  }

  emit(to, null);
  finish();

  return out;
}

/**
 * Regions whose highlighting may differ from the previous tree.
 *
 * Incremental parsing reuses subtrees by identity. Walking only the nodes
 * not in `known` (and adding them) yields the rebuilt parts of the tree in
 * document order, minus any reused children. Cost is proportional to the
 * rebuilt portion, not the document.
 */
export function changedRanges(tree: Tree, known: WeakSet<Tree>): [number, number][] {
  const out: [number, number][] = [];
  collect(tree, 0, known, out);
  return out;
}

function collect(tree: Tree, offset: number, known: WeakSet<Tree>, out: [number, number][]): void {
  known.add(tree);
  let pos = offset;

  for (let i = 0; i < tree.children.length; i++) {
    const child = tree.children[i];
    if (!(child instanceof Tree)) {
      // TreeBuffer: freshly built tokens, part of this node's own region.
      continue;
    }

    const childPos = offset + tree.positions[i];
    if (pos < childPos) {
      out.push([pos, childPos]);
    }

    if (!known.has(child)) {
      collect(child, childPos, known, out);
    }
    pos = childPos + child.length;
  }

  if (pos < offset + tree.length) {
    out.push([pos, offset + tree.length]);
  }
}
