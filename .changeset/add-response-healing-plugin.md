---
"@openrouter/ai-sdk-provider": minor
---

Add support for the Response Healing plugin

The Response Healing plugin automatically validates and repairs malformed JSON responses from AI models. Enable it by adding `{ id: 'response-healing' }` to the plugins array when using structured outputs with `generateObject`.

```typescript
const model = openrouter('openai/gpt-4o', {
  plugins: [{ id: 'response-healing' }],
});

const { object } = await generateObject({
  model,
  schema: z.object({ name: z.string(), age: z.number() }),
  prompt: 'Generate a person.',
});
```

Note: Response Healing only works with non-streaming requests.
