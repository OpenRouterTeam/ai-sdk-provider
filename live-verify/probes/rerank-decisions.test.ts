/**
 * #553      rerank() against a rerank model
 * #577/#602 experimental_evaluate against the Decisions API (/api/alpha),
 *           with instructions (live) and without (clean client-side error,
 *           no request sent)
 */
import { experimental_evaluate as evaluate, rerank } from 'ai';
import { describe, expect } from 'vitest';
import {
  assert2xx,
  HAS_KEY,
  lastBody,
  probe,
  providerFor,
} from './lib/harness';
import { MODELS } from './lib/models';

describe.skipIf(!HAS_KEY)('rerank and decisions', () => {
  probe(
    {
      id: '553-rerank',
      pr: '#553',
      title: 'rerank ranks the relevant document first',
      model: MODELS.rerank,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const result = await rerank({
        model: openrouter.rerankingModel(MODELS.rerank),
        query: 'What is the capital of France?',
        documents: [
          'Berlin is the capital of Germany.',
          'Paris is the capital of France.',
          'Bananas are rich in potassium.',
        ],
        topN: 2,
        maxRetries: 0,
      });
      assert2xx(capture);
      observe({
        url: capture.exchanges[0]?.url,
        ranking: result.ranking.map((r) => ({
          originalIndex: r.originalIndex,
          score: r.score,
        })),
        providerMetadata: result.providerMetadata,
      });
      expect(result.ranking[0]?.originalIndex).toBe(1);
    },
  );

  probe(
    {
      id: '577-decisions-with-instructions',
      pr: '#577',
      title:
        'experimental_evaluate hits /api/alpha/decisions and returns answers',
      model: MODELS.decision,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const result = await evaluate({
        model: openrouter.decisionModel(MODELS.decision),
        state: {
          ticket: 'My checkout page shows a blank screen after I click Pay.',
          customer_tier: 'enterprise',
        },
        questions: {
          is_bug: {
            type: 'boolean',
            instructions: 'Is the customer reporting a software defect?',
          },
          team: {
            type: 'choice',
            instructions: 'Which team should own this ticket?',
            criteria: {
              payments: 'Checkout, billing, or payment processing issues.',
              frontend: 'Rendering, layout, or browser compatibility issues.',
            },
          },
          urgency: {
            type: 'score',
            instructions: 'How urgent is this ticket?',
            criteria: ['low', 'medium', 'high'],
          },
        },
        maxRetries: 0,
      });
      assert2xx(capture);
      const url = capture.exchanges[0]?.url ?? '';
      observe({
        url,
        sentState: lastBody(capture, '/decisions').state,
        answers: result.answers,
        usage: result.usage,
        providerMetadata: result.providerMetadata,
      });
      expect(url).toMatch(/\/api\/alpha\/decisions$/);
      expect(result.answers.is_bug.type).toBe('boolean');
      expect(['payments', 'frontend']).toContain(result.answers.team.choice);
      expect(result.answers.urgency.score).toBeGreaterThanOrEqual(0);
    },
  );

  probe(
    {
      id: '602-decisions-without-instructions',
      pr: '#602',
      title:
        'question without instructions fails client-side with a clear error (no request)',
      model: MODELS.decision,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const model = openrouter.decisionModel(MODELS.decision);
      const catchError = async (fn: () => PromiseLike<unknown>) => {
        try {
          await fn();
          return undefined;
        } catch (e) {
          return e as Error;
        }
      };
      // `instructions` is optional in newer `ai` types; the pinned
      // ai@7.0.103 types still require it, hence the casts.
      const questions = { is_true: { type: 'boolean' } as any };

      // (a) Through ai@7.0.103 core, which validates questions itself.
      const viaCore = await catchError(() =>
        evaluate({
          model,
          state: 'The sky is green.',
          questions,
          maxRetries: 0,
        }),
      );
      // (b) Straight into the provider, as newer `ai` releases (which accept
      // omitted instructions) would call it.
      const viaProvider = await catchError(() =>
        model.doEvaluate({ state: 'The sky is green.', questions }),
      );
      observe({
        viaCore: viaCore && `${viaCore.name}: ${viaCore.message}`,
        viaProvider:
          viaProvider && `${viaProvider.name}: ${viaProvider.message}`,
        requestsSent: capture.exchanges.length,
      });
      expect(viaCore?.message ?? '').toMatch(/instructions/);
      expect(viaProvider?.message ?? '').toMatch(
        /Decisions API requires `instructions`/,
      );
      expect(capture.exchanges.length).toBe(0);
    },
  );
});
