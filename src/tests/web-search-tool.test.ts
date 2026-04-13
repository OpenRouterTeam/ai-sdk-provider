import type { ModelMessage } from 'ai';

import { createTestServer } from '@ai-sdk/test-server';
import { streamText, tool } from 'ai';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '../provider';

const TEST_MESSAGES: ModelMessage[] = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

describe('web search provider tool', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: {
        type: 'stream-chunks',
        chunks: [],
      },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('provider.tools.webSearch exists', () => {
    it('should expose a webSearch tool factory on the provider', () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      expect(openrouter.tools).toBeDefined();
      expect(openrouter.tools.webSearch).toBeDefined();
      expect(typeof openrouter.tools.webSearch).toBe('function');
    });
  });

  describe('provider tool in API request body', () => {
    it('should map webSearch provider tool to openrouter:web_search in the tools array', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({}),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
          }),
        ]),
      );
    });

    it('should pass maxResults as max_results in the tool args', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({
            maxResults: 5,
          }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
            max_results: 5,
          }),
        ]),
      );
    });

    it('should pass searchPrompt as search_prompt in the tool args', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({
            searchPrompt: 'latest news',
          }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
            search_prompt: 'latest news',
          }),
        ]),
      );
    });

    it('should pass engine in the tool args', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({
            engine: 'exa',
          }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
            engine: 'exa',
          }),
        ]),
      );
    });

    it('should pass all args together in the tool', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({
            maxResults: 3,
            searchPrompt: 'test query',
            engine: 'native',
          }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
            max_results: 3,
            search_prompt: 'test query',
            engine: 'native',
          }),
        ]),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle webSearch with no args (empty object)', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({}),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
          }),
        ]),
      );
      // Should not have extra properties when no args are provided
      const webSearchTool = body.tools.find(
        (t: Record<string, unknown>) => t.type === 'openrouter:web_search',
      );
      expect(webSearchTool).toBeDefined();
    });

    it('should mix function tools and provider tools in the same request', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({}),
          get_weather: tool({
            description: 'Get weather for a location',
            inputSchema: z.object({
              location: z.string(),
            }),
          }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      // Should contain both the provider tool and the function tool
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
          }),
          expect.objectContaining({
            type: 'function',
            function: expect.objectContaining({
              name: 'get_weather',
            }),
          }),
        ]),
      );
    });

    it('should default to tool_choice auto when only provider tools are present', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({}),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      // The AI SDK defaults toolChoice to 'auto' when tools are present
      expect(body.tool_choice).toBe('auto');
    });

    it('should preserve existing plugins and web_search_options alongside provider tool', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o', {
        plugins: [{ id: 'web' }],
        web_search_options: { max_results: 10 },
      });

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          web_search: openrouter.tools.webSearch({ maxResults: 5 }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      // Both the old settings and new provider tool should be present
      expect(body.plugins).toEqual([{ id: 'web' }]);
      expect(body.web_search_options).toEqual({ max_results: 10 });
      expect(body.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'openrouter:web_search',
          }),
        ]),
      );
    });

    it('should send request with only function tools when no provider tools are present', async () => {
      const openrouter = createOpenRouter({ apiKey: 'test' });
      const model = openrouter('openai/gpt-4o');

      await streamText({
        model,
        messages: TEST_MESSAGES,
        tools: {
          get_weather: tool({
            description: 'Get weather',
            inputSchema: z.object({
              location: z.string(),
            }),
          }),
        },
      }).consumeStream();

      const body = await server.calls[0]?.requestBodyJson;
      expect(body.tools).toEqual([
        expect.objectContaining({
          type: 'function',
          function: expect.objectContaining({
            name: 'get_weather',
            description: 'Get weather',
          }),
        }),
      ]);
      // Verify no provider tools leaked in
      const providerTools = body.tools.filter(
        (t: Record<string, unknown>) => t.type !== 'function',
      );
      expect(providerTools).toHaveLength(0);
    });
  });
});
