import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuestionsWithLlm } from "@/lib/ai/llm";

// Issue #79, test-driven development red phase: these tests fail until
// generateQuestionsWithLlm exists. The contract:
// - The fn wraps the OpenAI SDK chat completions API.
// - The fn reads OPENCODE_API_KEY from the environment and sends it as
//   the bearer token.
// - The fn uses the model "mimo-v2.6-flash".
// - The fn posts the given messages to the chat completions endpoint.
// - The fn identifies itself with its own user agent and sends a
//   session id in x-opencode-session (OpenCode Go requires both).
// - The model's answer must be JSON in the shape
//   { "questions": [{ "questionText": ..., "answer": ... }] }; the fn
//   returns the parsed items.
// - Content that is not that JSON becomes "Could not parse the
//   generated questions."
//
// The tests stub global fetch, because the OpenAI SDK calls it. If the
// SDK ever caches fetch differently, switch to vi.mock("openai")
// without changing these assertions.

const messages = [
  { role: "system", content: "system prompt" },
  { role: "user", content: "user prompt" },
];

const parsedQuestions = [
  { questionText: "What is 2 + 2?", answer: "4" },
  { questionText: "What is 3 + 3?", answer: "6" },
];

const validContent = JSON.stringify({ questions: parsedQuestions });

/** The content that the fake chat-completion endpoint answers with. */
let respondContent = validContent;

type CapturedRequest = {
  url: string;
  method: string;
  authorization: string | null;
  userAgent: string | null;
  session: string | null;
  body: {
    model: string;
    messages: Array<{ role: string; content: string }>;
  };
};

const capturedRequests: CapturedRequest[] = [];

function chatCompletionResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-unit-test",
      object: "chat.completion",
      created: 1730000000,
      model: "mimo-v2.6-flash",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** Records the request the SDK sends, then answers with a chat
 * completion whose message content is respondContent. */
async function fetchMock(input: unknown, init?: RequestInit): Promise<Response> {
  const request =
    input instanceof Request ? input : new Request(String(input), init);
  capturedRequests.push({
    url: request.url,
    method: request.method,
    authorization: request.headers.get("authorization"),
    userAgent: request.headers.get("user-agent"),
    session: request.headers.get("x-opencode-session"),
    body: await request.json(),
  });
  return chatCompletionResponse(respondContent);
}

beforeEach(() => {
  capturedRequests.length = 0;
  respondContent = validContent;
  process.env.OPENCODE_API_KEY = "unit-test-key";
  vi.stubGlobal("fetch", vi.fn(fetchMock));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENCODE_API_KEY;
});

describe("generateQuestionsWithLlm (issue #79)", () => {
  it("posts the messages to the chat completions endpoint with the configured model and key", async () => {
    const questions = await generateQuestionsWithLlm(messages);

    expect(questions).toEqual(parsedQuestions);
    expect(capturedRequests).toHaveLength(1);
    const request = capturedRequests[0]!;
    expect(request.url).toContain("/chat/completions");
    expect(request.method).toBe("POST");
    expect(request.authorization).toBe("Bearer unit-test-key");
    expect(request.body.model).toBe("mimo-v2.6-flash");
    expect(request.body.messages).toEqual(messages);
    // The OpenAI SDK's default user agent must not leak: the fn
    // identifies itself, and a session id is always present.
    expect(request.userAgent).toBe("hw-proj-ts/1.0");
    expect(request.session).toBeTruthy();
  });

  it("sends the caller's session id in the x-opencode-session header", async () => {
    await generateQuestionsWithLlm(messages, {
      session: "hw-proj-ts-assignment-7",
    });

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]!.session).toBe("hw-proj-ts-assignment-7");
  });

  it("throws a clear error when OPENCODE_API_KEY is not set", async () => {
    delete process.env.OPENCODE_API_KEY;

    await expect(generateQuestionsWithLlm(messages)).rejects.toThrow(
      /OPENCODE_API_KEY/,
    );
    expect(capturedRequests).toHaveLength(0);
  });

  it("rejects a response whose content is not JSON", async () => {
    respondContent = "The model wrote plain prose instead.";

    await expect(generateQuestionsWithLlm(messages)).rejects.toThrow(
      "Could not parse the generated questions.",
    );
  });

  it("rejects a response whose JSON does not match the expected shape", async () => {
    // An item with an empty answer is not a usable question.
    respondContent = JSON.stringify({
      questions: [{ questionText: "What is 2 + 2?", answer: "" }],
    });
    await expect(generateQuestionsWithLlm(messages)).rejects.toThrow(
      "Could not parse the generated questions.",
    );

    // A different outer shape is not usable either.
    respondContent = JSON.stringify({ items: parsedQuestions });
    await expect(generateQuestionsWithLlm(messages)).rejects.toThrow(
      "Could not parse the generated questions.",
    );
  });
});
