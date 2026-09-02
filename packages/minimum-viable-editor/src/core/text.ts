export interface TextRange {
  start: number;
  end: number;
}

export interface TextChange {
  from: number;
  toA: number;
  toB: number;
}

const NEWLINE = "\n";

/**
 * Single replaced span between two strings, found by trimming the common
 * prefix and suffix. "abc" -> "aXc" gives { from: 1, toA: 2, toB: 2 }.
 */
export function diffText(a: string, b: string): TextChange {
  const max = Math.min(a.length, b.length);
  let from = 0;
  while (from < max && a.charCodeAt(from) === b.charCodeAt(from)) {
    from++;
  }

  let tail = 0;
  const maxTail = max - from;
  while (
    tail < maxTail &&
    a.charCodeAt(a.length - 1 - tail) === b.charCodeAt(b.length - 1 - tail)
  ) {
    tail++;
  }

  return { from, toA: a.length - tail, toB: b.length - tail };
}

/** Offset at which each line starts. "a\nbc" -> [0, 2]. */
export function lineStartsOf(value: string): number[] {
  const starts = [0];
  let pos = value.indexOf(NEWLINE);

  while (pos !== -1) {
    starts.push(pos + 1);
    pos = value.indexOf(NEWLINE, pos + 1);
  }

  return starts;
}

/**
 * Line containing `offset`. An offset sitting on a line's trailing newline
 * still belongs to that line, so the caret at the end of a line maps there.
 */
export function lineAt(starts: number[], offset: number): number {
  let lo = 0;
  let hi = starts.length - 1;

  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return lo;
}

/** End offset of a line, excluding its newline. */
export function lineEnd(starts: number[], line: number, length: number): number {
  return line + 1 < starts.length ? starts[line + 1] - 1 : length;
}
