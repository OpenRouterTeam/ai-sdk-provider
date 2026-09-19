import { InvalidArgumentError } from '@ai-sdk/provider';
import { experimental_evaluate as evaluate } from 'ai';
import { describe, expect, it } from 'vitest';
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

  describe('doEvaluate', () => {
    it('should post to /api/alpha/decisions with mapped questions', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });
      const model = provider.evaluationModel('typesafe/jev-1.13', {
        user: 'user-1',
        provider: { order: ['typesafe'] },
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

    it('should merge call-level providerOptions.openrouter into the body', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        fetch: mockFetch,
      });

      await provider
        .evaluationModel('typesafe/jev-1.13', {
          provider: { order: ['openai'] },
        })
        .doEvaluate({
          state: 'x',
          questions: QUESTIONS,
          providerOptions: {
            openrouter: { provider: { order: ['typesafe'] }, custom: 1 },
          },
        });

      const body = parseBody(calls[0]?.init);
      expect(body.provider).toEqual({ order: ['typesafe'] });
      expect(body.custom).toBe(1);
    });

    it('should omit usage and provider when the response lacks them', async () => {
      const { mockFetch } = createMockFetch({
        model: 'typesafe/jev-1.13-20260917',
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
    });

    it('should respect a custom baseURL', async () => {
      const { mockFetch, calls } = createMockFetch();
      const provider = createOpenRouter({
        apiKey: 'test-key',
        baseURL: 'https://proxy.example.com/api/v1/',
        fetch: mockFetch,
      });

      await provider
        .evaluationModel('typesafe/jev-1.13')
        .doEvaluate({ state: 'x', questions: QUESTIONS });

      expect(calls[0]?.url).toBe(
        'https://proxy.example.com/api/alpha/decisions',
      );
    });

    it('should map answers, probabilities, usage and metadata', async () => {
      const { mockFetch } = createMockFetch();
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

    it('should drop partial boolean criteria with a warning', async () => {
      const { mockFetch, calls } = createMockFetch({
        model: 'typesafe/jev-1.13',
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
              criteria: { true: 'yes' },
            },
          },
        });

      const body = parseBody(calls[0]?.init);
      expect(body.questions).toEqual({
        q: { type: 'noul', instructions: 'Is it?' },
      });
      expect(result.warnings).toHaveLength(1);
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
  });
});
