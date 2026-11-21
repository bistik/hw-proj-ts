import { runWithStartContext } from "@tanstack/start-storage-context";

/**
 * A compiled server function stub. The TanStack Start compiler exports
 * one stub per server function in the "?tss-serverfn-split" module.
 * The stub name is "<functionName>_createServerFn_handler".
 */
export type ServerFnStub = (opts: {
  method: "POST";
  data: unknown;
}) => Promise<{ result?: unknown; error?: unknown }>;

/**
 * Runs a compiled server function stub the same way the server runtime
 * does: auth middleware, validator, and the raw handler body. The stub
 * needs a Start context, so this function wraps the call with one.
 *
 * The response holds the handler return value under "result", or the
 * thrown error under "error".
 */
export async function executeServerFn(
  fn: ServerFnStub,
  data: unknown,
): Promise<{ result?: unknown; error?: unknown }> {
  return (await runWithStartContext(
    { contextAfterGlobalMiddlewares: {} },
    () => fn({ method: "POST", data }),
  )) as { result?: unknown; error?: unknown };
}

/**
 * Imports a "?tss-serverfn-split" module and returns the stub for one
 * server function. Example:
 *
 *   const createQuestions = await loadServerFnStub(
 *     "@/server/questions/mutate-question.ts",
 *     "createQuestions",
 *   );
 */
export async function loadServerFnStub(
  modulePath: string,
  functionName: string,
): Promise<ServerFnStub> {
  const stubs = (await import(
    `${modulePath}?tss-serverfn-split`
  )) as unknown as Record<string, ServerFnStub>;
  return stubs[`${functionName}_createServerFn_handler`];
}
