import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateQuestionsWithLlm } from "@/lib/ai/llm";

// Issue #79, test-driven development red phase: these tests fail until
// generateQuestionsWithLlm exists. The contract:
// - The fn wraps the OpenAI SDK chat completions API.
// - The fn reads OPENCODE_API_KEY from the environment and sends it as
//   the bearer token.
// - The fn uses the model "mimo-v2.6-flash" by default; OPENCODE_MODEL
//   overrides it (PR #80 review).
// - The fn posts the given messages to the chat completions endpoint.
// - The fn identifies itself with its own user agent and sends a
//   session id in x-opencode-session (OpenCode Go requires both).
// - The model's answer must be JSON in the shape
//   { "questions": [{ "questionText": ..., "answer": ... }] }; the fn
//   returns the parsed items.
// - The fn never returns more items than the requested count (PR #80
//   review): an overshooting model is trimmed to the count.
// - The fn never retries a failed request (PR #80 review): the client
//   sets maxRetries 0 and a short timeout.
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

const defaultOptions = { session: "unit-test-session", count: 10 };

const parsedQuestions = [
  { questionText: "What is 2 + 2?", answer: "4" },
  { questionText: "What is 3 + 3?", answer: "6" },
];

const validContent = JSON.stringify({ questions: parsedQuestions });

/** The content that the fake chat-completion endpoint answers with. */
let respondContent = validContent;

/** The HTTP status the fake endpoint answers with. */
let respondStatus = 200;

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
  if (respondStatus !== 200) {
    return new Response("upstream error", { status: respondStatus });
  }
  return chatCompletionResponse(respondContent);
}

beforeEach(() => {
  capturedRequests.length = 0;
  respondContent = validContent;
  respondStatus = 200;
  process.env.OPENCODE_API_KEY = "unit-test-key";
  vi.stubGlobal("fetch", vi.fn(fetchMock));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENCODE_API_KEY;
  delete process.env.OPENCODE_MODEL;
});

describe("generateQuestionsWithLlm (issue #79)", () => {
  it("posts the messages to the chat completions endpoint with the configured model and key", async () => {
    const questions = await generateQuestionsWithLlm(
      messages,
      defaultOptions,
    );

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
    expect(request.session).toBe("unit-test-session");
  });

  it("uses OPENCODE_MODEL instead of the default model when it is set", async () => {
    // PR #80 review: the model is a default, so the environment can
    // point the fn at another model.
    process.env.OPENCODE_MODEL = "unit-test-model";

    await generateQuestionsWithLlm(messages, defaultOptions);

    expect(capturedRequests[0]!.body.model).toBe("unit-test-model");
  });

  it("sends the caller's session id in the x-opencode-session header", async () => {
    await generateQuestionsWithLlm(messages, {
      session: "hw-proj-ts-assignment-7",
      count: 10,
    });

    expect(capturedRequests).toHaveLength(1);
    expect(capturedRequests[0]!.session).toBe("hw-proj-ts-assignment-7");
  });

  it("throws a clear error when OPENCODE_API_KEY is not set", async () => {
    delete process.env.OPENCODE_API_KEY;

    await expect(
      generateQuestionsWithLlm(messages, defaultOptions),
    ).rejects.toThrow(/OPENCODE_API_KEY/);
    expect(capturedRequests).toHaveLength(0);
  });

  it("rejects a response whose content is not JSON", async () => {
    respondContent = "The model wrote plain prose instead.";

    await expect(
      generateQuestionsWithLlm(messages, defaultOptions),
    ).rejects.toThrow("Could not parse the generated questions.");
  });

  it("rejects a response whose JSON does not match the expected shape", async () => {
    // An item with an empty answer is not a usable question.
    respondContent = JSON.stringify({
      questions: [{ questionText: "What is 2 + 2?", answer: "" }],
    });
    await expect(
      generateQuestionsWithLlm(messages, defaultOptions),
    ).rejects.toThrow("Could not parse the generated questions.");

    // A different outer shape is not usable either.
    respondContent = JSON.stringify({ items: parsedQuestions });
    await expect(
      generateQuestionsWithLlm(messages, defaultOptions),
    ).rejects.toThrow("Could not parse the generated questions.");
  });

  it("returns at most the requested count when the model overshoots", async () => {
    respondContent = JSON.stringify({
      questions: [
        ...parsedQuestions,
        { questionText: "What is 4 + 4?", answer: "8" },
      ],
    });

    const questions = await generateQuestionsWithLlm(messages, {
      session: "unit-test-session",
      count: 2,
    });

    // PR #80 review: a silent overshoot must not reach the database;
    // the fn keeps only the requested number of items.
    expect(questions).toEqual(parsedQuestions);
  });

  it("does not retry a failed request", async () => {
    respondStatus = 500;

    // PR #80 review: the SDK defaults retry twice with a 10-minute
    // timeout each. The client sets maxRetries 0, so one failed
    // generate means exactly one request.
    await expect(
      generateQuestionsWithLlm(messages, defaultOptions),
    ).rejects.toThrow();
    expect(capturedRequests).toHaveLength(1);
  });
});
