import type { Parser } from "@lezer/common";
import type { Highlighter } from "@lezer/highlight";

/**
 * A syntax definition. `parser` is any Lezer parser, so users can plug in
 * their own grammar. `highlighter` maps Lezer tags to CSS classes and
 * defaults to the built-in `mve-*` mapping. `refine` may adjust a token's
 * classes from its text, for distinctions the grammar does not make
 * (e.g. `string` as a built-in type vs. `Foo` as a user type).
 */
export interface Language {
  parser: Parser;
  highlighter?: Highlighter;
  refine?: (classes: string, text: string) => string;
}
