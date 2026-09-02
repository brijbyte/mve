import { TreeFragment, type Tree } from "@lezer/common";
import type { Language } from "../language";
import { dirtyRegion, pointOf, readLines, readUpTo } from "./dom";
import { changedRanges, renderLines } from "./highlight";
import { History } from "./history";
import { readSelection, writeSelection, type OffsetOf } from "./selection";
import {
  diffText,
  lineAt,
  lineEnd,
  lineStartsOf,
  type TextChange,
  type TextRange
} from "./text";

export interface EditorOptions {
  value: string;
  language: Language | null;
  indent: string;
  onChange: (value: string) => void;
}

/** Lines left untouched at either end of an edit. */
interface Region {
  prefix: number;
  suffix: number;
}

const ROOT_CLASS = "mve";
const WORD_CHARS = /^\S+$/;
const LEADING_WHITESPACE = /^[ \t]*/;
const WHOLE: Region = { prefix: 0, suffix: 0 };

/**
 * Framework-agnostic editor over a contenteditable element. Work per edit
 * is proportional to the edit, not the document:
 *
 *   browser mutates DOM
 *     -> MutationObserver says which line nodes it touched
 *     -> read only those, splice into `value`, diff inside the region
 *     -> incremental Lezer parse; reused subtrees mark unchanged lines
 *     -> re-render touched lines + lines whose tokens changed
 *     -> restore caret
 *
 * Enter, Tab, paste and undo/redo skip the browser and edit `value`
 * directly, then render the same way.
 */
export class EditorCore {
  private value: string;
  private starts: number[];
  private selection: TextRange = { start: 0, end: 0 };
  private language: Language | null;
  private indent: string;
  private tree: Tree | null = null;
  private known = new WeakSet<Tree>();
  /** Line nodes as we last rendered them, in order. */
  private rendered: Node[] = [];
  private readonly history = new History();
  private readonly abort = new AbortController();
  private readonly observer: MutationObserver;
  /** Records delivered before `input` fired (Chromium) wait here. */
  private pending: MutationRecord[] = [];
  /** Selection restore deferred to the next frame; see draw(). */
  private restoreFrame = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly options: EditorOptions
  ) {
    this.value = options.value;
    this.starts = lineStartsOf(this.value);
    this.language = options.language;
    this.indent = options.indent;

    setupRoot(root);
    this.parse(null);
    this.draw(WHOLE, []);

    this.observer = new MutationObserver((records) => this.pending.push(...records));
    this.observer.observe(root, { childList: true, characterData: true, subtree: true });
    this.listen();
  }

  getValue(): string {
    return this.value;
  }

  /** Programmatic update; does not fire onChange. */
  setValue(value: string): void {
    if (value === this.value) {
      return;
    }

    const caret = Math.min(this.selection.start, value.length);
    this.commit(value, diffText(this.value, value), { start: caret, end: caret }, null, "silent");
  }

  setLanguage(language: Language | null): void {
    if (language === this.language) {
      return;
    }

    this.language = language;
    this.tree = null;
    this.parse(null);
    this.draw(WHOLE, []);
  }

  setIndent(indent: string): void {
    this.indent = indent;
  }

  destroy(): void {
    this.cancelRestore();
    this.abort.abort();
    this.observer.disconnect();
    this.root.replaceChildren();
  }

  private listen(): void {
    const signal = this.abort.signal;
    const root = this.root;

    // Anything that reads or edits at the caret needs it back first.
    root.addEventListener("keydown", () => this.flushRestore(), { signal, capture: true });
    root.addEventListener("beforeinput", () => this.flushRestore(), { signal, capture: true });
    root.addEventListener("compositionstart", () => this.flushRestore(), { signal });

    root.addEventListener("beforeinput", (e) => this.onBeforeInput(e), { signal });
    root.addEventListener("keydown", (e) => this.onKeyDown(e), { signal });
    root.addEventListener("compositionend", () => this.syncFromDom(), { signal });
    root.addEventListener(
      "input",
      (e) => {
        if (!(e as InputEvent).isComposing) {
          this.syncFromDom();
        }
      },
      { signal }
    );

    // Track the caret so undo snapshots restore where the user was.
    root.ownerDocument.addEventListener(
      "selectionchange",
      () => {
        if (root.childNodes.length !== this.starts.length) {
          return;
        }
        const selection = readSelection(root, this.cleanOffset);
        if (!selection) {
          return;
        }

        // The user moved the caret before a deferred restore ran; theirs wins.
        this.cancelRestore();
        this.selection = selection;
      },
      { signal }
    );
  }

  private onBeforeInput(e: InputEvent): void {
    switch (e.inputType) {
      case "insertParagraph":
      case "insertLineBreak":
        e.preventDefault();
        this.insertNewline();
        return;

      case "insertFromPaste": {
        // No dataTransfer: let the browser paste and `input` will sync.
        const text = e.dataTransfer?.getData("text/plain");
        if (text === undefined) {
          return;
        }

        e.preventDefault();
        this.replace(this.currentSelection(), text);
        return;
      }

      case "historyUndo":
        e.preventDefault();
        this.undo();
        return;

      case "historyRedo":
        e.preventDefault();
        this.redo();
        return;
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    const mod = e.metaKey || e.ctrlKey;

    if (e.key === "Tab" && !mod && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      this.replace(this.currentSelection(), this.indent);
      return;
    }

    if (!mod || e.altKey) {
      return;
    }

    const key = e.key.toLowerCase();
    if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) {
        this.redo();
      } else {
        this.undo();
      }
      return;
    }

    if (key === "y" && e.ctrlKey) {
      e.preventDefault();
      this.redo();
    }
  }

  // Keep the indentation of the current line on the new one.
  private insertNewline(): void {
    const sel = this.currentSelection();
    const lineStart = this.starts[lineAt(this.starts, sel.start)];
    const line = this.value.slice(lineStart, sel.start);
    const indent = LEADING_WHITESPACE.exec(line)?.[0] ?? "";

    this.replace(sel, "\n" + indent);
  }

  private replace(range: TextRange, text: string): void {
    const value = this.value.slice(0, range.start) + text + this.value.slice(range.end);
    const caret = range.start + text.length;
    const change = { from: range.start, toA: range.end, toB: caret };

    this.commit(value, change, { start: caret, end: caret }, null, "notify");
  }

  /** Pull a browser edit out of the DOM, touching only the lines it changed. */
  private syncFromDom(): void {
    const root = this.root;
    const region = dirtyRegion(root, this.rendered, this.takeRecords());
    if (!region) {
      return;
    }

    const oldCount = this.starts.length;
    const domCount = root.childNodes.length;
    const { prefix, suffix } = region;
    if (prefix + suffix >= oldCount) {
      this.resync();
      return;
    }

    const first = prefix;
    const last = domCount - 1 - suffix;
    const nodes = Array.prototype.slice.call(root.childNodes, first, last + 1);
    const regionText = readLines(nodes);
    let from = this.starts[prefix];
    let toA = lineEnd(this.starts, oldCount - 1 - suffix, this.value.length);

    // Whole lines vanished (e.g. Backspace on an empty line): one of the
    // newlines around them goes as well, or the line count never drops.
    if (nodes.length === 0) {
      if (prefix > 0) {
        from -= 1;
      } else if (suffix > 0) {
        toA += 1;
      }
    }

    const value = this.value.slice(0, from) + regionText + this.value.slice(toA);

    const inner = diffText(this.value.slice(from, toA), regionText);
    const change = { from: from + inner.from, toA: from + inner.toA, toB: from + inner.toB };

    // Caret offsets in the new text, resolved against the still-dirty DOM.
    const delta = value.length - this.value.length;
    const dirtyOffset: OffsetOf = (node, offset) => {
      const point = pointOf(root, node, offset);
      if (!point) {
        return null;
      }
      if (point.line < first) {
        return this.starts[point.line] + point.inner;
      }
      if (point.line > last) {
        const oldLine = oldCount - (domCount - point.line);
        return this.starts[oldLine] + point.inner + delta;
      }
      return from + readUpTo(root, first, node, offset).length;
    };
    const fallback = { start: change.toB, end: change.toB };
    const selection = readSelection(root, dirtyOffset) ?? fallback;

    this.commit(value, change, selection, { prefix, suffix }, "notify");
  }

  // Unexpected DOM shape: read everything and redraw everything.
  private resync(): void {
    const value = readLines(Array.from(this.root.childNodes));
    const change = diffText(this.value, value);
    const caret = { start: change.toB, end: change.toB };

    this.commit(value, change, caret, WHOLE, "notify");
  }

  private undo(): void {
    const target = this.history.undo(this.snapshot());
    if (target) {
      this.restore(target.value, target.selection);
    }
  }

  private redo(): void {
    const target = this.history.redo(this.snapshot());
    if (target) {
      this.restore(target.value, target.selection);
    }
  }

  private restore(value: string, selection: TextRange): void {
    this.apply(value, diffText(this.value, value), selection, null);
    this.options.onChange(value);
  }

  private commit(
    value: string,
    change: TextChange,
    selection: TextRange,
    region: Region | null,
    notify: "notify" | "silent"
  ): void {
    const changed = value !== this.value;
    if (changed) {
      const inserted = value.slice(change.from, change.toB);
      const isTyping = change.toA === change.from && WORD_CHARS.test(inserted);
      this.history.record(this.snapshot(), isTyping ? "merge" : "separate");
    }

    this.apply(value, change, selection, region);

    if (changed && notify === "notify") {
      this.options.onChange(value);
    }
  }

  /**
   * Install new text and redraw. `region` is the DOM area the browser
   * disturbed; when null the DOM is pristine and the region follows from
   * the change itself.
   */
  private apply(value: string, change: TextChange, selection: TextRange, region: Region | null): void {
    const oldStarts = this.starts;
    this.value = value;
    this.starts = lineStartsOf(value);
    this.selection = {
      start: Math.min(selection.start, value.length),
      end: Math.min(selection.end, value.length)
    };

    region ??= {
      prefix: lineAt(oldStarts, change.from),
      suffix: oldStarts.length - 1 - lineAt(oldStarts, change.toA)
    };

    this.draw(region, this.parse(change));
  }

  /** Reparse reusing the previous tree; returns regions that were rebuilt. */
  private parse(change: TextChange | null): [number, number][] {
    if (!this.language) {
      this.tree = null;
      return [];
    }

    const noop = change && change.from === change.toA && change.from === change.toB;
    if (this.tree && noop) {
      return [];
    }

    let fragments: readonly TreeFragment[] | undefined;
    if (this.tree && change) {
      fragments = TreeFragment.applyChanges(TreeFragment.addTree(this.tree), [
        { fromA: change.from, toA: change.toA, fromB: change.from, toB: change.toB }
      ]);
    } else {
      this.known = new WeakSet();
    }
    this.tree = this.language.parser.parse(this.value, fragments);
    return changedRanges(this.tree, this.known);
  }

  /**
   * Replace DOM nodes in `region` with fresh lines, then swap any line
   * outside it whose tokens changed. Untouched lines keep their nodes.
   *
   * The selection is dropped while mutating: browsers do per-mutation
   * bookkeeping for a selection inside an editable root that costs more
   * than the mutation itself.
   */
  private draw(region: Region, rebuilt: [number, number][]): void {
    const root = this.root;
    const doc = root.ownerDocument;
    const focused = doc.activeElement === root;
    if (focused) {
      doc.getSelection()?.removeAllRanges();
    }

    const lineCount = this.starts.length;
    const regionEnd = lineCount - region.suffix;
    const domEnd = root.childNodes.length - region.suffix;
    const stale = Array.prototype.slice.call(root.childNodes, region.prefix, domEnd);
    const anchor = region.suffix > 0 ? this.rendered[this.rendered.length - region.suffix] : null;
    const fresh = this.renderLines(region.prefix, regionEnd);

    this.swap(stale, fresh, anchor);
    this.rendered.splice(region.prefix, this.rendered.length - region.prefix - region.suffix, ...fresh);

    for (const [runFrom, runTo] of this.lineRuns(rebuilt)) {
      this.swapLines(runFrom, Math.min(runTo, region.prefix));
      this.swapLines(Math.max(runFrom, regionEnd), runTo);
    }

    // Our own mutations are not user edits.
    this.takeRecords();

    // Restoring inside the browser's own editing command is an order of
    // magnitude slower (Chromium). The frame callback runs before paint,
    // so the caret never visibly disappears.
    if (focused) {
      this.cancelRestore();
      this.restoreFrame = root.ownerDocument.defaultView!.requestAnimationFrame(() =>
        this.flushRestore()
      );
    }
  }

  private flushRestore(): void {
    if (!this.restoreFrame) {
      return;
    }

    this.cancelRestore();
    if (this.root.ownerDocument.activeElement === this.root) {
      writeSelection(this.root, this.starts, this.selection);
    }
  }

  private cancelRestore(): void {
    if (this.restoreFrame) {
      this.root.ownerDocument.defaultView!.cancelAnimationFrame(this.restoreFrame);
      this.restoreFrame = 0;
    }
  }

  /**
   * Re-render lines [from, to) in place, skipping lines that come out
   * identical. A rebuilt subtree usually spans many lines whose tokens did
   * not actually change.
   */
  private swapLines(from: number, to: number): void {
    if (from >= to) {
      return;
    }

    const fresh = this.renderLines(from, to);
    const rendered = this.rendered;
    let runStart = -1;

    const flush = (runEnd: number) => {
      if (runStart === -1) {
        return;
      }
      const next = fresh.slice(runStart - from, runEnd - from);
      this.swap(rendered.slice(runStart, runEnd), next, rendered[runEnd] ?? null);
      rendered.splice(runStart, runEnd - runStart, ...next);
      runStart = -1;
    };

    for (let i = from; i < to; i++) {
      const same = (rendered[i] as Element).innerHTML === fresh[i - from].innerHTML;
      if (same) {
        flush(i);
      } else if (runStart === -1) {
        runStart = i;
      }
    }
    flush(to);
  }

  // Individual removes plus one fragment insert is the combination that
  // stays fast in Chromium, Firefox and WebKit alike.
  private swap(stale: Node[], fresh: Node[], anchor: Node | null): void {
    for (const node of stale) {
      (node as ChildNode).remove();
    }

    const fragment = this.root.ownerDocument.createDocumentFragment();
    fragment.append(...fresh);
    this.root.insertBefore(fragment, anchor);
  }

  private takeRecords(): MutationRecord[] {
    const records = this.pending.concat(this.observer?.takeRecords() ?? []);
    this.pending = [];
    return records;
  }

  private renderLines(lineFrom: number, lineTo: number): HTMLElement[] {
    const doc = this.root.ownerDocument;
    return renderLines(doc, this.value, this.starts, lineFrom, lineTo, this.language, this.tree);
  }

  // Runs of non-empty lines overlapping the (sorted) ranges, as [from, to).
  private lineRuns(ranges: [number, number][]): [number, number][] {
    const starts = this.starts;
    const runs: [number, number][] = [];
    let line = 0;

    for (const [a, b] of ranges) {
      line = Math.max(line, lineAt(starts, a));

      for (; line < starts.length && starts[line] < b; line++) {
        const end = lineEnd(starts, line, this.value.length);
        if (end === starts[line] || end <= a) {
          continue;
        }

        const last = runs[runs.length - 1];
        if (last && last[1] === line) {
          last[1] = line + 1;
        } else {
          runs.push([line, line + 1]);
        }
      }
    }

    return runs;
  }

  private readonly cleanOffset: OffsetOf = (node, offset) => {
    const point = pointOf(this.root, node, offset);
    if (!point) {
      return null;
    }
    const line = Math.min(point.line, this.starts.length - 1);
    return Math.min(this.starts[line] + point.inner, this.value.length);
  };

  private currentSelection(): TextRange {
    const sel = readSelection(this.root, this.cleanOffset) ?? this.selection;
    const max = this.value.length;

    return { start: Math.min(sel.start, max), end: Math.min(sel.end, max) };
  }

  private snapshot() {
    return { value: this.value, selection: this.selection };
  }
}

function setupRoot(root: HTMLElement): void {
  // Older Firefox rejects "plaintext-only"; fall back to rich mode there.
  try {
    root.contentEditable = "plaintext-only";
  } catch {
    root.contentEditable = "true";
  }

  root.classList.add(ROOT_CLASS);
  root.spellcheck = false;
  root.setAttribute("autocorrect", "off");
  root.setAttribute("autocapitalize", "off");
  root.setAttribute("role", "textbox");
  root.setAttribute("aria-multiline", "true");

  root.style.whiteSpace ||= "pre-wrap";
}
