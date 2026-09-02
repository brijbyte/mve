import type { TextRange } from "./text";

export interface Snapshot {
  value: string;
  selection: TextRange;
}

/**
 * Undo/redo stack. Re-rendering the DOM on every edit discards the
 * browser's native history, so the editor keeps its own.
 *
 *   past: [s0, s1, s2]   current: s3   future: []
 *   undo -> past: [s0, s1]  current: s2  future: [s3]
 */
export class History {
  private past: Snapshot[] = [];
  private future: Snapshot[] = [];
  private lastRecord = 0;

  private static readonly LIMIT = 200;
  private static readonly MERGE_WINDOW_MS = 1000;

  /**
   * Store `previous` as an undo point. Mergeable edits (a burst of word
   * characters) extend the last point instead of creating a new one.
   */
  record(previous: Snapshot, merge: "merge" | "separate"): void {
    const now = Date.now();
    const withinWindow = now - this.lastRecord < History.MERGE_WINDOW_MS;
    this.lastRecord = now;
    this.future = [];

    if (merge === "merge" && withinWindow && this.past.length > 0) {
      return;
    }

    this.past.push(previous);
    if (this.past.length > History.LIMIT) {
      this.past.shift();
    }
  }

  undo(current: Snapshot): Snapshot | null {
    const target = this.past.pop();
    if (!target) {
      return null;
    }

    this.future.push(current);
    this.lastRecord = 0;
    return target;
  }

  redo(current: Snapshot): Snapshot | null {
    const target = this.future.pop();
    if (!target) {
      return null;
    }

    this.past.push(current);
    this.lastRecord = 0;
    return target;
  }
}
