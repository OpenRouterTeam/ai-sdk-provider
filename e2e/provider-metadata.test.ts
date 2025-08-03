import { streamText, generateText } from 'ai';
import { expect, it, describe } from 'vitest';
import { createOpenRouter } from '../src';

describe('Provider Metadata - Real API Tests', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should extract provider field from generateText API response', async () => {
    const model = openrouter('anthropic/claude-3.5-haiku');
    const response = await generateText({
      model,
      prompt: 'What is 2+2?',
      maxOutputTokens: 50,
    });

    expect(response.providerMetadata).toBeDefined();
    expect(response.providerMetadata?.provider).toBeDefined();
    expect(typeof response.providerMetadata?.provider).toBe('string');
    expect(response.providerMetadata?.openrouter).toBeDefined();
  });

  it('should extract provider field from streamText API response', async () => {
    const model = openrouter('anthropic/claude-3.5-haiku');
    const response = streamText({
      model,
      prompt: 'What is 2+2?',
      maxOutputTokens: 50,
    });

    await response.consumeStream();
    const providerMetadata = await response.providerMetadata;
    
    expect(providerMetadata).toBeDefined();
    expect(providerMetadata?.provider).toBeDefined();
    expect(typeof providerMetadata?.provider).toBe('string');
    expect(providerMetadata?.openrouter).toBeDefined();
  });

  it('should extract provider field from completion API response', async () => {
    const model = openrouter.completion('openai/gpt-3.5-turbo-instruct');
    const response = await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'What is 2+2?' }] }],
      maxOutputTokens: 50,
    });

    expect(response.providerMetadata).toBeDefined();
    expect((response.providerMetadata as any)?.provider).toBeDefined();
    expect(typeof (response.providerMetadata as any)?.provider).toBe('string');
    expect(response.providerMetadata?.openrouter).toBeDefined();
  });
});
