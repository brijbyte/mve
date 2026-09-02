import { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Demo } from "./Demo";
import { Snippet } from "./Snippet";
import { LOADERS, type LanguageLoader } from "./useLanguage";

// The page is static HTML so search engines index it. React mounts only
// the live demo, then upgrades each static <pre class="snippet"> into an
// editor in place.
createRoot(document.getElementById("demo")!).render(
  <StrictMode>
    <Demo />
  </StrictMode>
);

const SNIPPET_LOADERS: Record<string, LanguageLoader | null> = {
  tsx: LOADERS.tsx,
  css: LOADERS.css,
  text: null
};

// Rendered synchronously so the <pre> and its editor swap within one
// frame; otherwise the empty host briefly collapses and the page jumps.
for (const pre of document.querySelectorAll<HTMLPreElement>("pre.snippet")) {
  const host = document.createElement("div");
  const load = SNIPPET_LOADERS[pre.dataset.language ?? "text"] ?? null;
  pre.replaceWith(host);
  flushSync(() => {
    createRoot(host).render(<Snippet code={pre.textContent ?? ""} load={load} />);
  });
}
