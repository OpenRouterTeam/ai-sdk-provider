import type { LanguageModelV1Prompt } from "@ai-sdk/provider";
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils";
import type {
  OpenRouterChatPrompt,
  ChatCompletionContentPart,
} from "./openrouter-chat-prompt";

export function convertToOpenRouterChatMessages(
  prompt: LanguageModelV1Prompt
): OpenRouterChatPrompt {
  const messages: OpenRouterChatPrompt = [];

  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        messages.push({ role: "system", content });
        break;
      }

      case "user": {
        if (content.length === 1 && content[0]?.type === "text") {
          messages.push({ role: "user", content: content[0].text });
          break;
        }

        const contentParts: ChatCompletionContentPart[] = content.map(
          (part) => {
            switch (part.type) {
              case "text":
                return {
                  type: "text" as const,
                  text: part.text,
                };
              case "image":
                return {
                  type: "image_url" as const,
                  image_url: {
                    url:
                      part.image instanceof URL
                        ? part.image.toString()
                        : `data:${
                            part.mimeType ?? "image/jpeg"
                          };base64,${convertUint8ArrayToBase64(part.image)}`,
                  },
                };
              case "file":
                return {
                  type: "text" as const,
                  text:
                    part.data instanceof URL ? part.data.toString() : part.data,
                };
              default: {
                const _exhaustiveCheck: never = part;
                throw new Error(
                  `Unsupported content part type: ${_exhaustiveCheck}`
                );
              }
            }
          }
        );

        messages.push({
          role: "user",
          content: contentParts,
        });

        break;
      }

      case "assistant": {
        let text = "";
        const toolCalls: Array<{
          id: string;
          type: "function";
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case "text": {
              text += part.text;
              break;
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args),
                },
              });
              break;
            }
            // TODO: Handle reasoning and redacted-reasoning
            case "reasoning":
            case "redacted-reasoning":
              break;
            default: {
              const _exhaustiveCheck: never = part;
              throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
            }
          }
        }

        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        });

        break;
      }

      case "tool": {
        for (const toolResponse of content) {
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.result),
          });
        }
        break;
      }

      default: {
        const _exhaustiveCheck: never = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }

  return messages;
}
