import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";
import { OpenRouterChatLanguageModel } from "./openrouter-chat-language-model";
import type {
  OpenRouterChatModelId,
  OpenRouterChatSettings,
} from "./openrouter-chat-settings";
import { OpenRouterCompletionLanguageModel } from "./openrouter-completion-language-model";
import type {
  OpenRouterCompletionModelId,
  OpenRouterCompletionSettings,
} from "./openrouter-completion-settings";
import type { OpenRouterProviderSettings } from "./openrouter-provider";

/**
@deprecated Use `createOpenRouter` instead.
 */
export class OpenRouter {
  /**
Use a different URL prefix for API calls, e.g. to use proxy servers.
The default prefix is `https://api.openrouter.com/v1`.
   */
  readonly baseURL: string;

  /**
API key that is being send using the `Authorization` header.
It defaults to the `OPENAI_API_KEY` environment variable.
 */
  readonly apiKey?: string;

  /**
OpenRouter Organization.
   */
  readonly organization?: string;

  /**
OpenRouter project.
   */
  readonly project?: string;

  /**
Custom headers to include in the requests.
   */
  readonly headers?: Record<string, string>;

  /**
   * Creates a new OpenRouter provider instance.
   */
  constructor(options: OpenRouterProviderSettings = {}) {
    this.baseURL =
      withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
      "https://api.openrouter.com/v1";
    this.apiKey = options.apiKey;
    this.organization = options.organization;
    this.project = options.project;
    this.headers = options.headers;
  }

  private get baseConfig() {
    return {
      organization: this.organization,
      baseURL: this.baseURL,
      headers: () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: "OPENAI_API_KEY",
          description: "OpenRouter",
        })}`,
        "OpenRouter-Organization": this.organization,
        "OpenRouter-Project": this.project,
        ...this.headers,
      }),
    };
  }

  chat(modelId: OpenRouterChatModelId, settings: OpenRouterChatSettings = {}) {
    return new OpenRouterChatLanguageModel(modelId, settings, {
      provider: "openrouter.chat",
      ...this.baseConfig,
      compatibility: "strict",
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  completion(
    modelId: OpenRouterCompletionModelId,
    settings: OpenRouterCompletionSettings = {}
  ) {
    return new OpenRouterCompletionLanguageModel(modelId, settings, {
      provider: "openrouter.completion",
      ...this.baseConfig,
      compatibility: "strict",
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }
}
