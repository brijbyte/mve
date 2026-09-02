import { styleTags, tags as t } from "@lezer/highlight";
import { parser as cssParser } from "@lezer/css";
import type { Language } from "../language";

// Declaration names are definitions (coloured like keys); attribute
// selectors get the attribute tag.
const CSS_STYLE = styleTags({
  PropertyName: t.definition(t.propertyName),
  AttributeName: t.attributeName
});

export function css(): Language {
  return { parser: cssParser.configure({ props: [CSS_STYLE] }) };
}
