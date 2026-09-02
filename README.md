# Minimum Viable Editor

A small React code editor: plaintext `contenteditable`, Lezer syntax
highlighting, incremental parsing and rendering.

## Install

```sh
pnpm add minimum-viable-editor react
```

## Usage

```tsx
import { useState } from "react";
import { Editor } from "minimum-viable-editor";
import { javascript } from "minimum-viable-editor/languages";
import "minimum-viable-editor/theme.css";

// Build once: a new Language object means a full reparse.
const JS = javascript();

export function App() {
  const [value, setValue] = useState("const answer = 42;");
  return <Editor value={value} onChange={setValue} language={JS} />;
}
```

`Editor` is controlled. Remaining props spread onto the root `div`.

| Prop       | Type                      | Notes                                |
| ---------- | ------------------------- | ------------------------------------ |
| `value`    | `string`                  | Text to show                         |
| `onChange` | `(value: string) => void` | Fires on every edit, undo and redo   |
| `language` | `Language \| null`        | `null` renders plain text            |
| `indent`   | `string`                  | Inserted on Tab, default two spaces  |

## Languages

```ts
import { css, javascript, json } from "minimum-viable-editor/languages";

javascript(); // "jsx" | "ts" | "tsx" as dialect
json();
css();
```

Each grammar is also its own entry for lazy loading:
`minimum-viable-editor/languages/javascript`, `/json`, `/css`.

Any Lezer parser works as a custom language:

```ts
import type { Language } from "minimum-viable-editor";
import { parser } from "@lezer/python";

const python: Language = { parser };
```

`Language` also accepts a `highlighter` (Lezer `Highlighter`) and
`refine(classes, text)` to adjust classes from token text.

## Theming

Tokens get short `mve-*` classes; the root element gets `mve`. The
shipped theme colours them through `--mve-*` variables, light by
default. Dark applies under `prefers-color-scheme: dark` or inside a
`.mve-dark` ancestor; `.mve-light` forces light.

```css
:root {
  --mve-k: #8250df; /* keywords */
  --mve-s: #0a3069; /* strings */
}
```

Font, size and padding are yours to set on `.mve`.

## Behaviour

- Enter keeps the current line's indentation. Tab inserts `indent`.
- Paste inserts plain text. Undo and redo are handled by the editor.
- Work per keystroke is proportional to the edit: only touched lines are
  read back, reparsed and re-rendered.

## Size

Minified and gzipped, React excluded.

| Part                                        | Gzipped |
| ------------------------------------------- | ------- |
| Editor core + React wrapper + Lezer runtime | 21.3 kB |
| javascript() incl. TypeScript and JSX       | 30.3 kB |
| json()                                      | 1.1 kB  |
| css()                                       | 7.8 kB  |

## Development

```sh
mise exec -- pnpm install
mise exec -- pnpm build   # library and demo
mise exec -- pnpm dev     # demo and docs site
```
