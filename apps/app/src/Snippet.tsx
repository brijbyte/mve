import { useState } from "react";
import { Editor } from "@brijbyte/mve";
import { useLanguage, type LanguageLoader } from "./useLanguage";

interface SnippetProps {
  code: string;
  load: LanguageLoader | null;
}

/** A code block in the docs, rendered by the editor itself. Editable. */
export function Snippet({ code, load }: SnippetProps) {
  const [value, setValue] = useState(code);
  const language = useLanguage(load);

  return <Editor className="editor snippet" value={value} onChange={setValue} language={language} />;
}
