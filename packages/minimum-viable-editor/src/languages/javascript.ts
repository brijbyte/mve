import { styleTags, tags as t } from "@lezer/highlight";
import { parser as jsParser } from "@lezer/javascript";
import type { Language } from "../language";

export type JavaScriptDialect = "js" | "jsx" | "ts" | "tsx";

// Lezer dialect flags, space separated.
const JS_DIALECTS: Record<JavaScriptDialect, string> = {
  js: "",
  jsx: "jsx",
  ts: "ts",
  tsx: "jsx ts"
};

// Distinctions the stock grammar does not tag: parameters, imported
// names, spread, constructors after `new`, method names, `void` type.
const JS_STYLE = styleTags({
  "ParamList/VariableDefinition ArrowFunction/VariableDefinition": t.special(
    t.definition(t.variableName)
  ),
  "ImportGroup/VariableDefinition ImportDeclaration/VariableDefinition": t.special(
    t.variableName
  ),
  Spread: t.controlOperator,
  "NewExpression/VariableName InstantiationExpression/VariableName NewExpression/MemberExpression/PropertyName":
    t.className,
  "MethodDeclaration/PropertyDefinition": t.function(t.definition(t.propertyName)),
  "VoidType!": t.typeName
});

const BUILT_IN_TYPES = new Set([
  "string",
  "number",
  "boolean",
  "void",
  "never",
  "symbol",
  "object",
  "any",
  "unknown",
  "bigint",
  "undefined"
]);

const TYPE_NAME = "mve-t";
const TAG_NAME = "mve-tag";

// `string` vs `Foo`; `<div>` vs `<Button>`.
function refineJs(classes: string, text: string): string {
  if (classes === TYPE_NAME) {
    return BUILT_IN_TYPES.has(text) ? "mve-t mve-bi" : classes;
  }
  if (classes === TAG_NAME) {
    return /^[a-z]/.test(text) ? classes : "mve-tag mve-comp";
  }
  return classes;
}

const jsBase = jsParser.configure({ props: [JS_STYLE] });

export function javascript(dialect: JavaScriptDialect = "js"): Language {
  return { parser: jsBase.configure({ dialect: JS_DIALECTS[dialect] }), refine: refineJs };
}
