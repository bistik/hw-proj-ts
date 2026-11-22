import OpenAI from "openai";
import z from "zod";
import type { ChatMessage } from "@/lib/ai/prompt";

// Issue #79: the question generation runs through the OpenAI-compatible
// chat completions API of the OpenCode gateway. The key comes from
// OPENCODE_API_KEY; OPENCODE_BASE_URL overrides the endpoint, so a test
// or a local setup can point the fn at a stand-in service.

const LLM_MODEL = "mimo-v2.6-flash";
const LLM_DEFAULT_BASE_URL = "https://opencode.ai/inference/go/openai/v1";
// OpenCode Go asks every client to identify itself with its own user
// agent instead of a generic SDK name.
const LLM_USER_AGENT = "hw-proj-ts/1.0";
// The SDK defaults hold one request for up to 10 minutes and retry it
// twice, so one failed generate could block the author's request for
// half an hour (PR #80 review). The call gives up after 30 seconds and
// never retries: the author can press Generate again.
const LLM_TIMEOUT_MS = 30_000;

// The model answers with JSON in this shape (see buildQuestionPrompt).
// An empty questionText or answer makes the item unusable, so both must
// be non-empty strings.
const llmQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        questionText: z.string().min(1),
        answer: z.string().min(1),
      }),
    )
    .min(1),
});

export type LlmQuestion = z.infer<typeof llmQuestionsSchema>["questions"][number];

/**
 * Removes a markdown code fence that a model may wrap its JSON in.
 * Prose without a fence passes through unchanged.
 */
function stripCodeFence(content: string): string {
  return content
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");
}

/**
 * Parses the model's answer as the expected questions JSON. The fn tries
 * the raw content first, then a fence-stripped copy. Anything else
 * becomes undefined, so the caller reports the parse failure.
 */
function extractQuestionsJson(content: string): unknown {
  for (const candidate of [content, stripCodeFence(content)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}

/**
 * Sends the given messages to the chat completions endpoint and returns
 * the parsed questions. A missing OPENCODE_API_KEY throws before any
 * request. Content that is not JSON in the expected shape becomes
 * "Could not parse the generated questions."
 *
 * The count caps the parsed list (PR #80 review): the model may
 * overshoot, so the fn returns at most options.count questions. Fewer
 * questions pass through unchanged; the count is best-effort, because a
 * model may stop early.
 *
 * The OpenCode Go endpoint also requires a stable x-opencode-session
 * header per conversation, so it can route the requests and cache the
 * prompt. The caller names the conversation (one assignment in this
 * app).
 */
export async function generateQuestionsWithLlm(
  messages: ChatMessage[],
  options: { session: string; count: number },
): Promise<LlmQuestion[]> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENCODE_API_KEY is not set, so the LLM service cannot be reached.",
    );
  }
  const baseURL = process.env.OPENCODE_BASE_URL ?? LLM_DEFAULT_BASE_URL;
  const client = new OpenAI({
    apiKey,
    baseURL,
    // PR #80 review: a failed generate must fail fast, not hold the
    // request through the SDK's 10-minute default and two retries.
    timeout: LLM_TIMEOUT_MS,
    maxRetries: 0,
    defaultHeaders: {
      "User-Agent": LLM_USER_AGENT,
      "x-opencode-session": options.session,
    },
  });

  const completion = await client.chat.completions.create({
    model: LLM_MODEL,
    // The builder emits only "system" and "user" messages; the SDK's
    // param type narrows the role union, so the wide ChatMessage type
    // needs this cast.
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  });
  const content = completion.choices[0]?.message?.content ?? "";

  const parsed = llmQuestionsSchema.safeParse(extractQuestionsJson(content));
  if (!parsed.success) {
    throw new Error("Could not parse the generated questions.");
  }
  // PR #80 review: never return more questions than requested. Fewer
  // pass through, so a silent overshoot cannot reach the database.
  const questions = parsed.data.questions;
  return questions.length > options.count
    ? questions.slice(0, options.count)
    : questions;
}
