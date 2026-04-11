---
"@openrouter/ai-sdk-provider": minor
---

Add `openrouter.tools.webSearch()` provider-defined tool for server-side web search

- New `src/tool/web-search.ts` — web search tool factory using `createProviderToolFactory`
- Updated `OpenRouterProvider` interface with `tools.webSearch` property
- Updated `getArgs()` to map `LanguageModelV3ProviderTool` to OpenRouter API server tool format (`openrouter:web_search`)
- Supports optional args: `maxResults`, `searchPrompt`, `engine` ('auto' | 'native' | 'exa')

Usage:
```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter();
const result = await generateText({
  model: openrouter('openai/gpt-4o'),
  tools: {
    web_search: openrouter.tools.webSearch({ maxResults: 5 }),
  },
  prompt: 'What are the latest news?',
});
```
