import { useEffect, useLayoutEffect, useState } from "react";
import { Editor } from "@brijbyte/mve";
import { LOADERS, useLanguage, type LanguageLoader } from "./useLanguage";

// The JavaScript sample lives in index.html as the static placeholder.
const STATIC_ID = "demo-static";
const staticDemo = document.getElementById(STATIC_ID);

const SAMPLES = {
  javascript: staticDemo?.querySelector("pre")?.textContent ?? "",
  typescript: `interface Point<T = number> {
  x: T;
  y: T;
}

type Named = Point & { name: string };

export async function load(id: string): Promise<Named | undefined> {
  const res = await fetch(\`/points/\${id}\`);
  if (!res.ok) {
    return undefined;
  }
  return (await res.json()) as Named;
}

const enum Axis {
  X = "x",
  Y = "y"
}
`,
  json: `{
  "name": "@brijbyte/mve",
  "tags": ["lezer", "react"],
  "stable": false
}
`,
  css: `.editor {
  font-family: monospace;
  color: #383a42;
}
`
} as const;

type SampleName = keyof typeof SAMPLES;
type Theme = "system" | "light" | "dark";

const THEMES: Theme[] = ["system", "light", "dark"];

const LANGUAGES: Record<SampleName, LanguageLoader> = {
  javascript: LOADERS.jsx,
  typescript: LOADERS.ts,
  json: LOADERS.json,
  css: LOADERS.css
};

const THEME_KEY = "mve-theme";

// `.mve-light` / `.mve-dark` on <html> force a palette; none follows the OS.
// The choice is saved so the inline head script can apply it before paint.
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("mve-light", "mve-dark");
  if (theme !== "system") {
    root.classList.add(`mve-${theme}`);
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage may be unavailable; the theme still applies for this visit.
  }
}

function savedTheme(): Theme {
  const root = document.documentElement.classList;
  if (root.contains("mve-dark")) {
    return "dark";
  }
  return root.contains("mve-light") ? "light" : "system";
}

export function Demo() {
  const [name, setName] = useState<SampleName>("javascript");
  const [value, setValue] = useState<string>(SAMPLES.javascript);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const language = useLanguage(LANGUAGES[name]);

  useEffect(() => applyTheme(theme), [theme]);

  // Swap the static placeholder for the live demo in the same frame.
  useLayoutEffect(() => {
    staticDemo?.remove();
  }, []);

  const select = (next: SampleName) => {
    setName(next);
    setValue(SAMPLES[next]);
  };

  return (
    <>

      <nav>
        {(Object.keys(SAMPLES) as SampleName[]).map((key) => (
          <button key={key} onClick={() => select(key)} disabled={key === name}>
            {key}
          </button>
        ))}
        <span className="spacer" />
        {THEMES.map((key) => (
          <button key={key} onClick={() => setTheme(key)} disabled={key === theme}>
            {key}
          </button>
        ))}
      </nav>

      <Editor className="editor" value={value} onChange={setValue} language={language} />

      <p className="output" data-value={value}>
        {value.split("\n").length} lines, {value.length} chars
      </p>
    </>
  );
}
