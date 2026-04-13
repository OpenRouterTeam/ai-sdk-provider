import type { Engine } from '../types/openrouter-api-types';

import { createProviderToolFactory } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

/**
 * Input schema for the OpenRouter web search server tool.
 *
 * @see https://openrouter.ai/docs/guides/features/server-tools/web-search
 */
const webSearchInputSchema = z.object({
  /** Search results returned by the server tool */
  results: z.array(z.unknown()).optional(),
});

type WebSearchInput = z.infer<typeof webSearchInputSchema>;

/**
 * Configuration args for the web search provider tool.
 * These are mapped to snake_case in the API request.
 */
type WebSearchArgs = {
  /** Maximum number of search results to include */
  maxResults?: number;
  /** Custom search prompt to guide the search query */
  searchPrompt?: string;
  /** Search engine to use: 'auto', 'native', or 'exa' */
  engine?: 'auto' | Engine;
};

/**
 * Creates the `openrouter.tools.webSearch` provider tool factory.
 *
 * Usage:
 * ```ts
 * const openrouter = createOpenRouter();
 * const result = await generateText({
 *   model: openrouter('openai/gpt-4o'),
 *   tools: {
 *     web_search: openrouter.tools.webSearch({ maxResults: 5 }),
 *   },
 *   prompt: 'What are the latest news?',
 * });
 * ```
 */
export const webSearch = createProviderToolFactory<
  WebSearchInput,
  WebSearchArgs
>({
  id: 'openrouter.web_search',
  inputSchema: webSearchInputSchema,
});
