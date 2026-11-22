import OpenAI from "openai";
import z from "zod";
import type { ChatMessage } from "@/lib/ai/prompt";

// Issue #79: the question generation runs through the OpenAI-compatible
// chat completions API of the OpenCode gateway. The key comes from
// OPENCODE_API_KEY; OPENCODE_BASE_URL overrides the endpoint, so a test
// or a local setup can point the fn at a stand-in service.

const LLM_MODEL = "mimo-v2.6-flash";
const LLM_DEFAULT_BASE_URL = "https://opencode.ai/inference/go/openai/v1";

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
 */
export async function generateQuestionsWithLlm(
  messages: ChatMessage[],
): Promise<LlmQuestion[]> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENCODE_API_KEY is not set, so the LLM service cannot be reached.",
    );
  }
  const baseURL = process.env.OPENCODE_BASE_URL ?? LLM_DEFAULT_BASE_URL;
  const client = new OpenAI({ apiKey, baseURL });

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
  return parsed.data.questions;
}
