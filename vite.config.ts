import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
    tailwindcss(),
    // E2E runs must use plain Node SSR: the cloudflare plugin's workerd
    // runtime ignores process env (breaking BETTER_AUTH_URL trust) and its
    // web-standard libsql client rejects "file:" URLs, so the isolated
    // local e2e database cannot work under it. Set by playwright's webServer.
    ...(!process.env.E2E
      ? [
          cloudflare({
            viteEnvironment: {
              name: "ssr"
            }
          })
        ]
      : [])
  ],
});