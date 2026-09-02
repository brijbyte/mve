import { useEffect, useState } from "react";
import type { Language } from "@brijbyte/mve";

export type LanguageLoader = () => Promise<Language>;

// One Language per loader, so the editor never reparses for an identical
// grammar and the chunk is fetched once.
const loaded = new Map<LanguageLoader, Promise<Language>>();

/** Grammar for `load`, null until its chunk has arrived. */
export function useLanguage(load: LanguageLoader | null): Language | null {
  const [language, setLanguage] = useState<Language | null>(null);

  useEffect(() => {
    if (!load) {
      setLanguage(null);
      return;
    }

    let live = true;
    let pending = loaded.get(load);
    if (!pending) {
      pending = load();
      loaded.set(load, pending);
    }
    pending.then((next) => {
      if (live) {
        setLanguage(next);
      }
    });

    return () => {
      live = false;
    };
  }, [load]);

  return language;
}

// Grammars are separate chunks, fetched the first time they are needed.
export const LOADERS = {
  jsx: () => import("@brijbyte/mve/languages/javascript").then((m) => m.javascript("jsx")),
  ts: () => import("@brijbyte/mve/languages/javascript").then((m) => m.javascript("ts")),
  tsx: () => import("@brijbyte/mve/languages/javascript").then((m) => m.javascript("tsx")),
  json: () => import("@brijbyte/mve/languages/json").then((m) => m.json()),
  css: () => import("@brijbyte/mve/languages/css").then((m) => m.css())
} satisfies Record<string, LanguageLoader>;
