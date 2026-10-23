/**
 * #605  provider routing merge: configured `order` + `allow_fallbacks: false`
 *       on the model, runtime `provider.only` via providerOptions. The merged
 *       object must be sent and the configured order must win.
 * #603  User-Agent suffix: not observable server-side, skipped.
 */
import { generateText } from 'ai';
import { describe, expect } from 'vitest';
import {
  assert2xx,
  HAS_KEY,
  lastBody,
  probe,
  providerFor,
  skippedProbe,
} from './lib/harness';
import { MODELS, ROUTING } from './lib/models';

const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

describe.skipIf(!HAS_KEY)('provider routing', () => {
  probe(
    {
      id: '605-provider-routing-merge',
      pr: '#605',
      title:
        'runtime provider.only is merged with configured order (configured order wins)',
      model: MODELS.openaiCheap,
    },
    async ({ capture, observe }) => {
      const openrouter = providerFor(capture);
      const only = [ROUTING.configuredOrder, ROUTING.other];
      const runs: Array<Record<string, unknown>> = [];
      // Two runs with opposite configured orders rule out coincidence.
      for (const first of [ROUTING.configuredOrder, ROUTING.other]) {
        const result = await generateText({
          model: openrouter.chat(MODELS.openaiCheap, {
            provider: { order: [first], allow_fallbacks: false },
          }),
          prompt: 'Reply with the single word OK.',
          maxOutputTokens: 16,
          maxRetries: 0,
          providerOptions: { openrouter: { provider: { only } } },
        });
        runs.push({
          configuredOrder: [first],
          sentProvider: lastBody(capture).provider,
          servedBy: result.providerMetadata?.openrouter?.provider,
        });
      }
      assert2xx(capture);
      observe({ runs });
      for (const run of runs) {
        const order = run.configuredOrder as string[];
        expect(run.sentProvider).toEqual({
          order,
          allow_fallbacks: false,
          only,
        });
        expect(norm(run.servedBy)).toContain(norm(order[0]));
      }
    },
  );

  skippedProbe(
    {
      id: '603-user-agent',
      pr: '#603',
      title: 'User-Agent keeps the provider suffix through the AI SDK',
    },
    'Not observable server-side; covered by unit tests (src/tests/user-agent.test.ts).',
  );
});
