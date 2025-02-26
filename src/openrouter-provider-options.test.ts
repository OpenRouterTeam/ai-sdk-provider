import { OpenRouterChatLanguageModel } from "./openrouter-chat-language-model";
import { createOpenRouter } from "./openrouter-provider";
import { describe, it, expect, vi, type Mock } from "vitest";

// Add type assertions for the mocked classes
const OpenRouterChatLanguageModelMock =
  OpenRouterChatLanguageModel as unknown as Mock;

vi.mock("@ai-sdk/provider-utils", () => ({
  loadSetting: vi.fn().mockImplementation(() => "us-east-1"),
  withoutTrailingSlash: vi.fn((url) => url),
  generateId: vi.fn().mockReturnValue("mock-id"),
}));

describe("providerOptions", () => {
  it("should set providerOptions openrouter to extra body", async () => {
    const provider = createOpenRouter();
    provider("anthropic/claude-3.7-sonnet");

    const constructorCall = OpenRouterChatLanguageModelMock.mock.calls[0];
    expect(constructorCall?.[0]).toBe("anthropic.claude-v2");
    expect(constructorCall?.[1]).toEqual({});
    expect(constructorCall?.[2].headers).toEqual({});
    expect(constructorCall?.[2].baseUrl()).toBe(
      "https://bedrock-runtime.us-east-1.amazonaws.com"
    );
  });
});
