import { tagHighlighter, tags as t } from "@lezer/highlight";

/**
 * Default tag -> class mapping. Broader than Lezer's `classHighlighter`:
 * it separates literals, operators, function names, definitions, markup
 * and CSS values so a theme can colour them apart. Classes are `mve-*`,
 * kept short; a second class narrows the kind (e.g. `mve-o mve-oc` is a
 * compare operator).
 */
export const defaultHighlighter = tagHighlighter([
  { tag: t.comment, class: "mve-c" },
  { tag: t.string, class: "mve-s" },
  { tag: t.special(t.string), class: "mve-s" },
  { tag: t.regexp, class: "mve-re" },
  { tag: t.escape, class: "mve-esc" },
  { tag: t.number, class: "mve-n" },
  { tag: t.bool, class: "mve-b" },
  { tag: t.null, class: "mve-nil" },
  { tag: t.atom, class: "mve-atom" },
  { tag: t.literal, class: "mve-lit" },

  { tag: t.keyword, class: "mve-k" },
  { tag: t.definitionKeyword, class: "mve-k mve-kd" },
  { tag: t.controlKeyword, class: "mve-k mve-kc" },
  { tag: t.modifier, class: "mve-k mve-km" },
  { tag: t.self, class: "mve-self" },

  { tag: t.typeName, class: "mve-t" },
  { tag: t.className, class: "mve-cls" },
  { tag: t.constant(t.className), class: "mve-cls" },
  { tag: t.namespace, class: "mve-ns" },
  { tag: t.labelName, class: "mve-lbl" },
  { tag: t.macroName, class: "mve-mac" },

  { tag: t.propertyName, class: "mve-p" },
  { tag: t.definition(t.propertyName), class: "mve-p mve-def" },
  { tag: t.variableName, class: "mve-v" },
  { tag: t.special(t.variableName), class: "mve-v mve-sp" },
  { tag: t.local(t.variableName), class: "mve-v mve-loc" },
  { tag: t.definition(t.variableName), class: "mve-v mve-def" },
  { tag: t.special(t.definition(t.variableName)), class: "mve-v mve-param" },
  { tag: t.function(t.variableName), class: "mve-f" },
  { tag: t.function(t.definition(t.variableName)), class: "mve-f mve-def" },
  { tag: t.function(t.propertyName), class: "mve-f mve-p" },
  { tag: t.function(t.definition(t.propertyName)), class: "mve-f mve-p mve-def" },

  { tag: t.operator, class: "mve-o" },
  { tag: t.arithmeticOperator, class: "mve-o mve-oa" },
  { tag: t.logicOperator, class: "mve-o mve-ol" },
  { tag: t.bitwiseOperator, class: "mve-o mve-ob" },
  { tag: t.compareOperator, class: "mve-o mve-oc" },
  { tag: t.updateOperator, class: "mve-o mve-ou" },
  { tag: t.definitionOperator, class: "mve-o mve-od" },
  { tag: t.typeOperator, class: "mve-o mve-ot" },
  { tag: t.controlOperator, class: "mve-o mve-octl" },
  { tag: t.punctuation, class: "mve-pu" },
  { tag: t.function(t.punctuation), class: "mve-pu mve-f" },
  { tag: t.angleBracket, class: "mve-pu mve-ab" },

  { tag: t.tagName, class: "mve-tag" },
  { tag: t.attributeName, class: "mve-attr" },
  { tag: t.attributeValue, class: "mve-av" },

  { tag: t.unit, class: "mve-u" },
  { tag: t.color, class: "mve-col" },
  { tag: t.url, class: "mve-url" },
  { tag: t.link, class: "mve-link" },
  { tag: t.heading, class: "mve-h" },
  { tag: t.emphasis, class: "mve-em" },
  { tag: t.strong, class: "mve-st" },
  { tag: t.inserted, class: "mve-ins" },
  { tag: t.deleted, class: "mve-del" },
  { tag: t.meta, class: "mve-meta" },
  { tag: t.invalid, class: "mve-inv" }
]);
