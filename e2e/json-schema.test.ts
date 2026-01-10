import { generateObject, streamObject } from 'ai';
import { it, expect, vi } from 'vitest';
import { createLLMGateway } from '@/src';
import { z } from 'zod/v3';

vi.setConfig({
  testTimeout: 42_000,
});

const schema = z.object({
  recipe: z.object({
    name: z.string().describe('Name of the recipe'),
    ingredients: z.array(z.object({
      name: z.string().describe('Name of the ingredient'),
      amount: z.string().describe('Amount of the ingredient'),
    })).describe('List of ingredients'),
    steps: z.array(z.string()).describe('Cooking steps'),
  }).describe('Recipe details'),
});

it('should generate structured output with json_schema using generateObject', async () => {
  const llmgateway = createLLMGateway({
    apiKey: process.env.LLM_GATEWAY_API_KEY,
    baseUrl: process.env.LLM_GATEWAY_API_BASE,
  });
  const model = llmgateway('gpt-4o-mini');

  const result = await generateObject({
    model,
    schema,
    output: 'object',
    prompt: 'Generate a simple recipe for chocolate chip cookies.',
  });

  expect(result.object).toBeDefined();
  expect(result.object.recipe).toBeDefined();
  expect(result.object.recipe.name).toBeDefined();
  expect(typeof result.object.recipe.name).toBe('string');
  expect(Array.isArray(result.object.recipe.ingredients)).toBe(true);
  expect(Array.isArray(result.object.recipe.steps)).toBe(true);
  expect(result.object.recipe.ingredients.length).toBeGreaterThan(0);
  expect(result.object.recipe.steps.length).toBeGreaterThan(0);
});

it('should generate structured output with json_schema using streamObject', async () => {
  const llmgateway = createLLMGateway({
    apiKey: process.env.LLM_GATEWAY_API_KEY,
    baseUrl: process.env.LLM_GATEWAY_API_BASE,
  });
  const model = llmgateway('gpt-4o-mini');

  const result = streamObject({
    model,
    schema,
    output: 'object',
    prompt: 'Generate a simple recipe for pancakes.',
  });

  // Consume the stream
  for await (const _partialObject of result.partialObjectStream) {
    // Just consume it
  }

  const finalObject = await result.object;

  expect(finalObject).toBeDefined();
  expect(finalObject.recipe).toBeDefined();
  expect(finalObject.recipe.name).toBeDefined();
  expect(typeof finalObject.recipe.name).toBe('string');
  expect(Array.isArray(finalObject.recipe.ingredients)).toBe(true);
  expect(Array.isArray(finalObject.recipe.steps)).toBe(true);
  expect(finalObject.recipe.ingredients.length).toBeGreaterThan(0);
  expect(finalObject.recipe.steps.length).toBeGreaterThan(0);
});
