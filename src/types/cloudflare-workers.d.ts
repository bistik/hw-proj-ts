// Minimal types for the workerd-only "cloudflare:workers" module (the runtime
// provided by @cloudflare/vite-plugin and deployed Workers runtime). The local
// module shape is intentionally permissive here; `wrangler types` (script
// `npm run cf-typegen`) can generate the exact types later.
// https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/cloudflare-workers/
declare module "cloudflare:workers" {
  // Full worker env: bindings plus plain-text vars from wrangler.jsonc.
  export const env: unknown;
}
