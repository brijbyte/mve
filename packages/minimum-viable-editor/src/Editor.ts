import {
  createElement,
  useLayoutEffect,
  useRef,
  type HTMLAttributes,
  type ReactElement
} from "react";
import { EditorCore } from "./core/editor";
import type { Language } from "./language";

const DEFAULT_INDENT = "  ";

export interface EditorProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "children" | "contentEditable"> {
  value: string;
  onChange?: (value: string) => void;
  language?: Language | null;
  /** Inserted on Tab. Defaults to two spaces. */
  indent?: string;
}

/**
 * Controlled plaintext code editor. React owns the `<div>`; the core owns
 * everything inside it, so this component never renders children.
 */
export function Editor({
  value,
  onChange,
  language = null,
  indent = DEFAULT_INDENT,
  ...rest
}: EditorProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<EditorCore | null>(null);
  const onChangeRef = useRef(onChange);

  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

  useLayoutEffect(() => {
    const core = new EditorCore(rootRef.current!, {
      value,
      language,
      indent,
      onChange: (next) => onChangeRef.current?.(next)
    });
    coreRef.current = core;

    return () => {
      core.destroy();
      coreRef.current = null;
    };
    // Mount only; later prop changes go through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    coreRef.current?.setValue(value);
  }, [value]);

  useLayoutEffect(() => {
    coreRef.current?.setLanguage(language);
  }, [language]);

  useLayoutEffect(() => {
    coreRef.current?.setIndent(indent);
  }, [indent]);

  return createElement("div", { ...rest, ref: rootRef });
}
