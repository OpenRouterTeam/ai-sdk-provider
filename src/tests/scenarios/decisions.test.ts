// Scenarios: #577 (unwrap AI SDK state parts for the Decisions API) through
// `experimental_evaluate`, plus direct doEvaluate calls in the part-array
// shape newer `ai` releases (>= 7.0.133) produce.
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import { experimental_evaluate as evaluate } from 'ai';
import { describe, expect, it } from 'vitest';
import { jsonResponse, mockProvider, PNG_BASE64 } from './helpers';

const RESPONSE = {
  id: 'gen-dec-1',
  model: 'typesafe/jev-1.13',
  provider: 'TypeSafe',
  answers: {
    is_bug: { type: 'noul', noul: 0.9 },
    team: {
      type: 'choice',
      choice: 'payments',
      probabilities: { payments: 0.8, frontend: 0.2 },
      confidence: 0.7,
    },
  },
  usage: { input_tokens: 100, output_tokens: 10, cost: 0.00001 },
};

const QUESTIONS = {
  is_bug: {
    type: 'boolean' as const,
    instructions: 'Is this a defect?',
  },
  team: {
    type: 'choice' as const,
    instructions: 'Which team?',
    criteria: { payments: 'Billing', frontend: null },
  },
};

function setup() {
  const { provider, calls } = mockProvider(() => jsonResponse(RESPONSE));
  return {
    model: provider.decisionModel('typesafe/jev-1.13'),
    calls,
    provider,
  };
}

describe('Decisions state through experimental_evaluate (#577)', () => {
  it('string state is sent as-is and answers are mapped', async () => {
    const { model, calls } = setup();
    const result = await evaluate({
      model,
      state: 'Checkout fails with a 500',
      questions: QUESTIONS,
    });
    expect(calls[0]?.url).toBe('https://openrouter.ai/api/alpha/decisions');
    expect(calls[0]?.body.state).toBe('Checkout fails with a 500');
    expect(calls[0]?.body.questions.is_bug.type).toBe('noul');
    expect(result.answers.is_bug).toEqual({
      type: 'boolean',
      probability: 0.9,
    });
    expect(result.answers.team).toMatchObject({
      type: 'choice',
      choice: 'payments',
    });
    expect(result.usage).toEqual({
      inputTokens: 100,
      outputTokens: 10,
      totalTokens: 110,
    });
  });

  it('object state is sent as-is', async () => {
    const { model, calls } = setup();
    const state = {
      ticket: { id: 42, body: 'Card declined', tags: ['billing'] },
    };
    await evaluate({ model, state, questions: QUESTIONS });
    expect(calls[0]?.body.state).toEqual(state);
  });

  it('plain array state (not part-shaped) is sent as-is', async () => {
    const { model, calls } = setup();
    const state = ['first message', { role: 'agent', text: 'second' }, 3];
    await evaluate({ model, state, questions: QUESTIONS });
    expect(calls[0]?.body.state).toEqual(state);
  });

  it('chat-style image_url array state is sent as-is', async () => {
    const { model, calls } = setup();
    const state = [
      { type: 'text', text: 'Is the screenshot showing an error?' },
      { type: 'image_url', image_url: { url: 'https://example.com/s.png' } },
    ];
    await evaluate({ model, state, questions: QUESTIONS });
    expect(calls[0]?.body.state).toEqual(state);
  });

  it('text + image file parts become [text, image_url] entries', async () => {
    const { model, calls } = setup();
    await evaluate({
      model,
      state: [
        { type: 'text', text: 'Rate this screenshot' },
        {
          type: 'file',
          mediaType: 'image/png',
          data: { type: 'data', data: PNG_BASE64 },
        },
      ],
      questions: QUESTIONS,
    });
    expect(calls[0]?.body.state).toEqual([
      'Rate this screenshot',
      {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${PNG_BASE64}` },
      },
    ]);
  });

  it('image URL file part becomes an image_url entry with the URL', async () => {
    const { model, calls } = setup();
    await evaluate({
      model,
      state: [
        {
          type: 'file',
          mediaType: 'image/jpeg',
          data: { type: 'url', url: 'https://example.com/photo.jpg' },
        },
      ],
      questions: QUESTIONS,
    });
    expect(calls[0]?.body.state).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/photo.jpg' },
      },
    ]);
  });
});

describe('Decisions state parts as newer ai releases pass them (#577)', () => {
  const callOptions = (state: unknown) => ({
    state: state as any,
    questions: QUESTIONS,
  });

  it('single text part unwraps to the string', async () => {
    const { model, calls } = setup();
    await model.doEvaluate(callOptions([{ type: 'text', text: 'hello' }]));
    expect(calls[0]?.body.state).toBe('hello');
  });

  it('single json part with an object unwraps to the object', async () => {
    const { model, calls } = setup();
    await model.doEvaluate(callOptions([{ type: 'json', value: { a: 1 } }]));
    expect(calls[0]?.body.state).toEqual({ a: 1 });
  });

  it('single json part with an array unwraps to the array', async () => {
    const { model, calls } = setup();
    await model.doEvaluate(callOptions([{ type: 'json', value: ['x', 'y'] }]));
    expect(calls[0]?.body.state).toEqual(['x', 'y']);
  });

  it('mixed text/json/file parts keep order', async () => {
    const { model, calls } = setup();
    await model.doEvaluate(
      callOptions([
        { type: 'text', text: 'ctx' },
        { type: 'json', value: { n: 1 } },
        {
          type: 'file',
          mediaType: 'image/webp',
          data: { type: 'data', data: PNG_BASE64 },
        },
      ]),
    );
    expect(calls[0]?.body.state).toEqual([
      'ctx',
      { n: 1 },
      {
        type: 'image_url',
        image_url: { url: `data:image/webp;base64,${PNG_BASE64}` },
      },
    ]);
  });

  it('non-image file parts are rejected', async () => {
    const { model, calls } = setup();
    await expect(
      model.doEvaluate(
        callOptions([
          {
            type: 'file',
            mediaType: 'application/pdf',
            data: { type: 'data', data: 'JVBERi0=' },
          },
        ]),
      ),
    ).rejects.toSatisfy((e: unknown) =>
      UnsupportedFunctionalityError.isInstance(e),
    );
    expect(calls).toHaveLength(0);
  });

  it('providerOptions and settings merge into the request; state is not overridable', async () => {
    const { provider, calls } = mockProvider(() => jsonResponse(RESPONSE));
    const model = provider.decisionModel('typesafe/jev-1.13', {
      provider: { order: ['typesafe'] },
      user: 'u-1',
    });
    const result = await evaluate({
      model,
      state: 'x',
      questions: QUESTIONS,
      providerOptions: { openrouter: { session_id: 's-9', state: 'hijack' } },
    });
    expect(calls[0]?.body).toMatchObject({
      model: 'typesafe/jev-1.13',
      state: 'x',
      provider: { order: ['typesafe'] },
      user: 'u-1',
      session_id: 's-9',
    });
    expect(result.providerMetadata?.openrouter).toMatchObject({
      provider: 'TypeSafe',
      usage: { cost: 0.00001 },
    });
  });
});
