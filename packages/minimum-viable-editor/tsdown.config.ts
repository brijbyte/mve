import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    languages: "src/languages.ts",
    "languages/javascript": "src/languages/javascript.ts",
    "languages/json": "src/languages/json.ts",
    "languages/css": "src/languages/css.ts"
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  copy: ["src/theme.css"]
});
