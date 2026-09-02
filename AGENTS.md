# Minimum Viable Editor

## Project

- pnpm monorepo managed with mise.
- `packages/minimum-viable-editor` is the library package (React).
- `apps/app` is the Vite demo and documentation site. Docs are static HTML in `index.html` for indexability; React mounts only the demo (`Demo.tsx`) and upgrades each `pre.snippet` into an editor (`main.tsx`). Grammars are lazy chunks via `useLanguage.ts`. Static placeholders (`#demo-static`, `pre.snippet`) mirror the mounted markup so the page does not shift; keep their styles and content in sync. It consumes the built library (`dist/`); rebuild the library to see changes.

## Library

- Entries: `.` exports `Editor` (controlled `value`/`onChange`), `Language`, `defaultHighlighter`; `./languages` exports `javascript(dialect?)`, `json()`, `css()`, each also available as `./languages/<name>` for lazy loading; `./theme.css` is the default theme.
- `Language` = `{ parser, highlighter?, refine? }`. `parser` is any Lezer parser. `refine(classes, text)` adjusts a token's classes from its text.
- Highlight classes are short `mve-*` names from `src/highlighter.ts`, broader than Lezer's `classHighlighter` (operator kinds, function names, parameters, JSX tags, CSS units). The root element gets class `mve`.
- `theme.css` follows GitHub's light/dark palettes via `--mve-*` variables (including `--mve-bg`/`--mve-fg` on `.mve`). Dark applies under `prefers-color-scheme: dark` or a `.mve-dark` ancestor; `.mve-light` forces light.
- `src/core/editor.ts` drives a plaintext `contenteditable`, one `<div>` per line. Enter, Tab, paste and undo/redo are handled by the core, not the browser.
- Work per edit is proportional to the edit: a MutationObserver marks touched line nodes, only those are read back, Lezer reparses incrementally, reused subtrees (node identity) mark unchanged lines, and only lines whose HTML differs are swapped.
- `draw()` drops the selection while mutating (mutations with a selection inside an editable root are ~100x slower) and restores it on the next animation frame (restoring inside Chromium's editing command is slow), flushed synchronously before the next key event.

## Tooling and commands

- Tool versions are pinned in `mise.toml`.
- Run commands through mise, for example: `mise exec -- pnpm install`.
- Build everything: `mise exec -- pnpm build`.
- Run the app: `mise exec -- pnpm dev`.
- Typecheck the library: `mise exec -- pnpm --filter @brijbyte/mve typecheck`.
- The library uses tsdown and emits ESM, CJS, declarations and `theme.css` into `dist/`.
- Behaviour and perf were verified with headless Playwright against the demo on a 20k-line file (scripts not committed).
- Bundle sizes in `apps/app/index.html` (own and react-simple-code-editor + Prism comparison) are rolldown min+gzip measurements; re-measure when dependencies change.

## Conventions

- Keep the library API deliberate and minimal.
- Update package exports when changing library build outputs or entry points.
- Keep generated `dist/` and dependency directories uncommitted.
