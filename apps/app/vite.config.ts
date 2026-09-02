import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (["/node_modules/react/", "/node_modules/react-dom/"].some((pkg) => id.includes(pkg))) {
            return "react-vendor";
          }

          // Grammar entries stay out so they become lazy chunks.
          if (id.includes("/dist/languages/")) {
            return undefined;
          }

          // Editor core plus the Lezer runtime every grammar needs.
          const core = [
            "/node_modules/@brijbyte/mve/",
            "/packages/minimum-viable-editor/",
            "/node_modules/@lezer/lr/",
            "/node_modules/@lezer/common/",
            "/node_modules/@lezer/highlight/"
          ];
          if (core.some((pkg) => id.includes(pkg))) {
            return "mve-vendor";
          }
        }
      }
    }
  }
});
