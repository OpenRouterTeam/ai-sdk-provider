import { describe, expect, it } from 'vitest';
import { webSearch } from './web-search';

describe('webSearch', () => {
  it('creates an OpenRouter web search provider tool', () => {
    expect(
      webSearch({ maxResults: 5, searchPrompt: 'latest news', engine: 'exa' }),
    ).toEqual(
      expect.objectContaining({
        type: 'provider',
        id: 'openrouter.web_search',
        args: {
          maxResults: 5,
          searchPrompt: 'latest news',
          engine: 'exa',
        },
      }),
    );
  });
});
