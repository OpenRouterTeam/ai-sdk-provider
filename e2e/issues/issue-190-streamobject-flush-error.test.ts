/**
 * Regression test for GitHub issue #190
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/190
 *
 * Issue: streamObject with ai@4 + @openrouter/ai-sdk-provider@0.7.x threw
 * TypeError in flush: "Cannot read properties of undefined (reading 'sent')"
 *
 * Reported: September 24, 2025
 * Affected versions: ai@4.3.18 + @openrouter/ai-sdk-provider@0.7.5
 * Working versions: ai@5.x + @openrouter/ai-sdk-provider@1.0.0
 *
 * This test verifies that streamObject with JSON Schema completes without error.
 */
import type { JSONSchema7 } from 'json-schema';

import { jsonSchema, streamObject } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #190: streamObject flush TypeError', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Use a model that supports structured output
  const model = openrouter('openai/gpt-4o-mini');

  it('should stream structured output without TypeError', async () => {
    // This is the exact schema from the issue report
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 3, maxLength: 60 },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      required: ['title', 'priority'],
      additionalProperties: false,
    };

    const result = streamObject({
      model,
      temperature: 0,
      system: 'You are a helpful assistant that outputs strictly valid JSON.',
      messages: [
        {
          role: 'user',
          content:
            'Generate a concise title (<= 6 words) for a test task and pick priority medium.',
        },
      ],
      schema: jsonSchema(schema),
    });

    const object = (await result.object) as { title: string; priority: string };

    // Verify the output matches the schema
    expect(object).toBeDefined();
    expect(typeof object.title).toBe('string');
    expect(object.title.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(object.priority);
  });

  it('should handle streamObject with nested schema', async () => {
    // Test with a more complex nested schema
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        task: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'done'] },
          },
          required: ['name', 'status'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['task', 'tags'],
      additionalProperties: false,
    };

    const result = streamObject({
      model,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content:
            'Create a task named "Review PR" with status pending and tags ["code", "review"].',
        },
      ],
      schema: jsonSchema(schema),
    });

    const object = (await result.object) as {
      task: { name: string; status: string };
      tags: string[];
    };

    expect(object).toBeDefined();
    expect(object.task).toBeDefined();
    expect(typeof object.task.name).toBe('string');
    expect(['pending', 'done']).toContain(object.task.status);
    expect(Array.isArray(object.tags)).toBe(true);
  });
});
