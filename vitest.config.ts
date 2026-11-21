import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vitest/config";

// The TanStack Start plugin compiles server functions: it moves each
// .handler() body into a "?tss-serverfn-split" module. Unit tests import
// those modules and run a server function without a web server. The
// helpers in tests/unit/helpers/server-fn.ts show how. Without this
// plugin, the handler bodies are missing and no server fn test can run.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/unit/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tanstackStart()],
});
