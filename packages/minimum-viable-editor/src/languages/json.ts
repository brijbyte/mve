import { styleTags, tags as t } from "@lezer/highlight";
import { parser as jsonParser } from "@lezer/json";
import type { Language } from "../language";

// Keys are definitions, not property access, so themes colour them.
const KEY_STYLE = styleTags({ PropertyName: t.definition(t.propertyName) });

export function json(): Language {
  return { parser: jsonParser.configure({ props: [KEY_STYLE] }) };
}
