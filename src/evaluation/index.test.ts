import type { Experimental_EvaluationModelV4 } from '@ai-sdk/provider';
import type { EvaluationModelV4 } from './types';

import { InvalidArgumentError, LoadSettingError } from '@ai-sdk/provider';
import { experimental_evaluate as evaluate } from 'ai';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { createOpenRouter } from '../provider';
import { OpenRouterEvaluationModel } from './index';

const DECISIONS_RESPONSE = {
  id: 'gen-dec-123',
  model: 'typesafe/jev-1.13-20260917',
  provider: 'TypeSafe',
  answers: {
    is_bug: { type: 'noul', noul: 0.96 },
    team: {
      type: 'choice',
      choice: 'payments',
      probabilities: { payments: 0.84, frontend: 0.16, account: 0 },
      confidence: 0.75,
    },
    urgency: {
      type: 'score',
      score: 1.99,
      legend: {
        '0': 'Can wait for the next release',
        '1': 'Should be fixed this week',
        '2': 'Blocking revenue right now',
      },
      probabilities: { '0': 0, '1': 0.01, '2': 0.99 },
      confidence: 0.99,
    },
  },
  usage: { input_tokens: 476, output_tokens: 70, cost: 0.000019992 },
};

// Two-decimal API output whose weighted mean (1.89) differs from the score.
const ROUNDED_DECISIONS_RESPONSE = {
  ...DECISIONS_RESPONSE,
  answers: {
    ...DECISIONS_RESPONSE.answers,
    urgency: {
      type: 'score',
      score: 1.9,
      probabilities: { '0': 0.01, '1': 0.09, '2': 0.9 },
    },
  },
};

const QUESTIONS = {
  is_bug: {
    type: 'boolean',
    instructions: 'Is the customer reporting a software defect?',
    criteria: {
      true: 'The customer describes broken behavior.',
      false: 'The customer is asking a question.',
    },
  },
  team: {
    type: 'choice',
    instructions: 'Which team should own this ticket?',
    criteria: {
      payments: 'Checkout or billing issues.',
      frontend: 'Rendering issues.',
      account: null,
    },
  },
  urgency: {
    type: 'score',
    instructions: 'How urgent is this ticket?',
    criteria: [
      'Can wait for the next release',
      'Should be fixed this week',
      'Blocking revenue right now',
    ],
  },
} as const;

function createMockFetch(body: unknown = DECISIONS_RESPONSE) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const mockFetch = async (
    url: URL | RequestInfo,
    init?: RequestInit,
  ): Promise<Response> => {
    calls.push({ url: url.toString(), init });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { mockFetch, calls };
}

function parseBody(init: RequestInit | undefined): Record<string, unknown> {
  expect(typeof init?.body).toBe('string');
  return JSON.parse(String(init?.body));
}

describe('OpenRouterEvaluationModel', () => {
  it('should satisfy the AI SDK evaluation model contract', () => {
    expectTypeOf<OpenRouterEvaluationModel>().toExtend<Experimental_EvaluationModelV4>();
    expectTypeOf<EvaluationModelV4>().toEqualTypeOf<Experimental_EvaluationModelV4>();
  });

  describe('provider methods', () => {
    it('should create an evaluation model instance', () => {
      const provider = createOpenRouter({ apiKey: 'test-key' });
      const model = provider.evaluationModel('typesafe/jev-1.13');
      expect(model).toBeInstanceOf(OpenRouterEvaluationModel);
      expect(model.modelId).toBe('typesafe/jev-1.13');
      expect(model.provider).toBe('openrouter');
      expect(model.specificationVersion).toBe('v4');
      expect(model.supportedQuestionTypes).toEqual([
        'choice',
        'score',
        'boolean',
      ]);
    });
  });

  describe('endpoint resolution', () => {
    it.each([
      [undefined, 'https://openrouter.ai/api/alpha/decisions'],
      [
        'https://openrouter.ai/api/v1',
        'https://openrouter.ai/api/alpha/decisions',
      ],
      [
        'https://proxy.example.com/api/v1/',
        'https://proxy.example.com/api/alpha/decisions',
      ],
      [
        'https://proxy.example.com/openrouter/v1',
        'https://proxy.example.com/openrouter/alpha/decisions',
      ],
    ])('should derive the Decisions URL from baseURL %s', async (baseURL, expected) => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        baseURL,
        fetch: mockFetch,
      });

      await provider
        .evaluationModel('typesafe/jev-1.13')
        .doEvaluate({ state: 'x', questions: QUESTIONS });

      expect(calls[0]?.url).toBe(expected);
    });

    it('should prefer an explicit decisionsBaseURL', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        baseURL: 'https://proxy.example.com/openrouter',
        decisionsBaseURL: 'https://proxy.example.com/decisions-gateway/',
        fetch: mockFetch,
      });

      await provider
        .evaluationModel('typesafe/jev-1.13')
        .doEvaluate({ state: 'x', questions: QUESTIONS });

      expect(calls[0]?.url).toBe(
        'https://proxy.example.com/decisions-gateway/decisions',
      );
    });

    it('should require decisionsBaseURL when baseURL does not end in /v1', () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        baseURL: 'https://proxy.example.com/openrouter',
      });

      expect(() => provider.evaluationModel('typesafe/jev-1.13')).toThrow(
        LoadSettingError,
      );
      expect(() => provider.chat('openai/gpt-4o')).not.toThrow();
    });
  });

  describe('doEvaluate', () => {
    it('should post to /decisions with mapped questions', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.evaluationModel('typesafe/jev-1.13', {
        user: 'user-1',
        provider: { order: ['typesafe'] },
        session_id: 'session-1',
        trace: { trace_id: 'trace-1' },
      });

      await model.doEvaluate({
        state: { ticket: 'Checkout is blank after Pay.' },
        questions: QUESTIONS,
        headers: { 'X-Custom': 'yes' },
      });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.url).toBe('https://openrouter.ai/api/alpha/decisions');
      const requestHeaders = new Headers(calls[0]?.init?.headers);
      expect(requestHeaders.get('authorization')).toBe('Bearer test-key');
      expect(requestHeaders.get('x-custom')).toBe('yes');

      expect(parseBody(calls[0]?.init)).toEqual({
        model: 'typesafe/jev-1.13',
        state: { ticket: 'Checkout is blank after Pay.' },
        user: 'user-1',
        provider: { order: ['typesafe'] },
        session_id: 'session-1',
        trace: { trace_id: 'trace-1' },
        questions: {
          is_bug: {
            type: 'noul',
            instructions: 'Is the customer reporting a software defect?',
            criteria: {
              true: 'The customer describes broken behavior.',
              false: 'The customer is asking a question.',
            },
          },
          team: {
            type: 'choice',
            instructions: 'Which team should own this ticket?',
            criteria: {
              payments: 'Checkout or billing issues.',
              frontend: 'Rendering issues.',
              account: null,
            },
          },
          urgency: {
            type: 'score',
            instructions: 'How urgent is this ticket?',
            criteria: [
              'Can wait for the next release',
              'Should be fixed this week',
              'Blocking revenue right now',
            ],
          },
        },
      });
    });

    it('should merge factory extraBody, settings, and providerOptions in that precedence', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
        extraBody: { user: 'factory-user', factory: true, shared: 'factory' },
      });

      await provider
        .evaluationModel('typesafe/jev-1.13', {
          provider: { order: ['openai'] },
          extraBody: { shared: 'settings', session_id: 'from-extra-body' },
        })
        .doEvaluate({
          state: 'x',
          questions: QUESTIONS,
          providerOptions: {
            openrouter: { provider: { order: ['typesafe'] }, custom: 1 },
          },
        });

      const body = parseBody(calls[0]?.init);
      expect(body.user).toBe('factory-user');
      expect(body.factory).toBe(true);
      expect(body.shared).toBe('settings');
      expect(body.session_id).toBe('from-extra-body');
      expect(body.provider).toEqual({ order: ['typesafe'] });
      expect(body.custom).toBe(1);
    });

    it('should not let extraBody or providerOptions override model, state, or questions', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
        extraBody: { questions: {}, model: 'factory/model' },
      });

      await provider
        .evaluationModel('typesafe/jev-1.13', {
          extraBody: { state: 'settings-state' },
        })
        .doEvaluate({
          state: 'call-state',
          questions: QUESTIONS,
          providerOptions: {
            openrouter: { model: 'other/model', state: 'REPLACED' },
          },
        });

      const body = parseBody(calls[0]?.init);
      expect(body.model).toBe('typesafe/jev-1.13');
      expect(body.state).toBe('call-state');
      expect(Object.keys(body.questions as object)).toEqual([
        'is_bug',
        'team',
        'urgency',
      ]);
    });

    it('should reject malformed providerOptions.openrouter before calling the API', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await expect(
        provider.evaluationModel('typesafe/jev-1.13').doEvaluate({
          state: 'x',
          questions: QUESTIONS,
          providerOptions: { openrouter: { user: 42 } },
        }),
      ).rejects.toBeInstanceOf(InvalidArgumentError);
      expect(calls).toHaveLength(0);
    });

    it('should map answers, probabilities, usage, rounding and metadata', async () => {
      const { mockFetch } = createMockFetch({
        ...DECISIONS_RESPONSE,
        future_field: 'kept',
      });
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await provider
        .evaluationModel('typesafe/jev-1.13')
        .doEvaluate({ state: 'x', questions: QUESTIONS });

      expect(result.answers).toEqual({
        is_bug: { type: 'boolean', probability: 0.96 },
        team: {
          type: 'choice',
          choice: 'payments',
          probabilities: { payments: 0.84, frontend: 0.16, account: 0 },
        },
        urgency: {
          type: 'score',
          score: 1.99,
          probabilities: { '0': 0, '1': 0.01, '2': 0.99 },
        },
      });
      expect(result.rounding).toEqual({
        probabilityDecimals: 2,
        scoreDecimals: 2,
      });
      expect(result.usage).toEqual({ inputTokens: 476, outputTokens: 70 });
      expect(result.warnings).toEqual([]);
      expect(result.providerMetadata).toEqual({
        openrouter: {
          provider: 'TypeSafe',
          usage: { cost: 0.000019992 },
          answers: {
            is_bug: {},
            team: { confidence: 0.75 },
            urgency: {
              confidence: 0.99,
              legend: {
                '0': 'Can wait for the next release',
                '1': 'Should be fixed this week',
                '2': 'Blocking revenue right now',
              },
            },
          },
        },
      });
      expect(result.response?.id).toBe('gen-dec-123');
      expect(result.response?.modelId).toBe('typesafe/jev-1.13-20260917');
      expect(result.response?.headers?.['content-type']).toBe(
        'application/json',
      );
      expect(result.response?.body).toEqual({
        ...DECISIONS_RESPONSE,
        future_field: 'kept',
      });
    });

    it('should accept a response with only answers', async () => {
      const { mockFetch } = createMockFetch({
        answers: { q: { type: 'noul', noul: 0.5 } },
      });
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await provider
        .evaluationModel('typesafe/jev-1.13')
        .doEvaluate({
          state: 'x',
          questions: { q: { type: 'boolean', instructions: 'Is it?' } },
        });

      expect(result.answers).toEqual({
        q: { type: 'boolean', probability: 0.5 },
      });
      expect(result.usage).toBeUndefined();
      expect(result.providerMetadata).toEqual({
        openrouter: { answers: { q: {} } },
      });
      expect(result.response?.modelId).toBeUndefined();
    });

    it('should reject null score criteria without calling the API', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await expect(
        provider.evaluationModel('typesafe/jev-1.13').doEvaluate({
          state: 'x',
          questions: {
            q: {
              type: 'score',
              instructions: 'Rate it',
              criteria: [null, 'b'],
            },
          },
        }),
      ).rejects.toBeInstanceOf(InvalidArgumentError);
      expect(calls).toHaveLength(0);
    });

    it('should reject one-sided boolean criteria without calling the API', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await expect(
        provider.evaluationModel('typesafe/jev-1.13').doEvaluate({
          state: 'x',
          questions: {
            q: {
              type: 'boolean',
              instructions: 'Is it?',
              criteria: { true: 'yes', false: null },
            },
          },
        }),
      ).rejects.toBeInstanceOf(InvalidArgumentError);
      expect(calls).toHaveLength(0);
    });

    it('should omit boolean criteria when no description is given', async () => {
      const { mockFetch, calls } = createMockFetch({
        answers: { q: { type: 'noul', noul: 0.5 } },
      });
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await provider
        .evaluationModel('typesafe/jev-1.13')
        .doEvaluate({
          state: 'x',
          questions: {
            q: {
              type: 'boolean',
              instructions: 'Is it?',
              criteria: { true: null, false: undefined },
            },
          },
        });

      expect(parseBody(calls[0]?.init).questions).toEqual({
        q: { type: 'noul', instructions: 'Is it?' },
      });
      expect(result.warnings).toEqual([]);
    });

    it('should throw an API error on failed responses', async () => {
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: async () =>
          new Response(
            JSON.stringify({ error: { message: 'Bad model', code: 400 } }),
            {
              status: 400,
              headers: { 'content-type': 'application/json' },
            },
          ),
      });

      await expect(
        provider
          .evaluationModel('nope/nope')
          .doEvaluate({ state: 'x', questions: QUESTIONS }),
      ).rejects.toThrow('Bad model');
    });
  });

  describe('experimental_evaluate integration', () => {
    it('should pass AI SDK answer validation and expose typed results', async () => {
      const { mockFetch } = createMockFetch();
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await evaluate({
        model: openrouter.evaluationModel('typesafe/jev-1.13'),
        state: { ticket: 'Checkout is blank after Pay.' },
        questions: QUESTIONS,
      });

      expect(result.answers.is_bug.probability).toBe(0.96);
      expect(result.answers.team.choice).toBe('payments');
      expect(result.answers.team.probabilities?.payments).toBe(0.84);
      expect(result.answers.urgency.score).toBe(1.99);
      expect(result.providerMetadata?.openrouter).toMatchObject({
        answers: { team: { confidence: 0.75 } },
      });
    });

    it('should accept two-decimal scores that differ from the exact weighted mean', async () => {
      const { mockFetch } = createMockFetch(ROUNDED_DECISIONS_RESPONSE);
      const openrouter = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      const result = await evaluate({
        model: openrouter.evaluationModel('typesafe/jev-1.13'),
        state: 'x',
        questions: QUESTIONS,
      });

      expect(result.answers.urgency.score).toBe(1.9);
      expect(result.answers.urgency.probabilities).toEqual({
        '0': 0.01,
        '1': 0.09,
        '2': 0.9,
      });
    });
  });
});
