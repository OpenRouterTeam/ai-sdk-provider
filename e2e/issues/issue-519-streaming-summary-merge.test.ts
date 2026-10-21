/**
 * Regression test for GitHub issue #519
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/519
 *
 * Issue: During streaming, consecutive `reasoning.summary` deltas were pushed
 * to the accumulated reasoning_details as-is (one entry per delta) instead of
 * being merged the way consecutive `reasoning.text` deltas are. Providers such
 * as OpenAI `openai-responses-v1` stream a single logical summary as many small
 * deltas that all carry `index: 0`, so the array fragmented into one entry per
 * delta. Re-submitting that fragmented array on the next turn breaks multi-turn
 * reasoning round-tripping (cf. langchain-ai/langchain#36400).
 *
 * Fix: consecutive `reasoning.summary` deltas are concatenated by their
 * `summary` field, mirroring the existing `reasoning.text` merge. Encrypted
 * details remain discrete (each is an opaque blob with its own id).
 */
import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createOpenRouter } from '@/src';
import { ReasoningDetailType } from '@/src/schemas/reasoning-details';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Think step by step.' }] },
];

const provider = createOpenRouter({
  apiKey: 'test-api-key',
  compatibility: 'strict',
});

type AccumulatedDetail = {
  type: string;
  summary?: string;
  data?: string;
  id?: string;
  index?: number;
  format?: string;
};

describe('Issue #519: streaming reasoning.summary deltas must be merged', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  /**
   * Reproduces the customer scenario: a summary streamed as N deltas (all
   * index:0), followed by a single encrypted delta (also index:0), then text.
   */
  function buildSummaryThenEncryptedChunks(summaryParts: string[]): string[] {
    const id = 'chatcmpl-519-summary';
    const base = `"object":"chat.completion.chunk","created":1711357598,"model":"openai/gpt-5.4-nano","system_fingerprint":"fp_test"`;
    const chunks: string[] = [];

    summaryParts.forEach((part, i) => {
      const isFirst = i === 0;
      const rolePart = isFirst ? `"role":"assistant","content":"",` : '';
      // The first summary delta intentionally omits `format`; a later delta
      // carries it. This exercises the merge's format-preservation fallback
      // (lastDetail.format = lastDetail.format || detail.format) so the merged
      // entry ends up with the format even when the leading delta lacked it.
      const formatPart = isFirst ? '' : `,"format":"openai-responses-v1"`;
      chunks.push(
        `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{${rolePart}"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":${JSON.stringify(part)}${formatPart},"index":0}]},"logprobs":null,"finish_reason":null}]}\n\n`,
      );
    });

    // Encrypted block — different type, but also index:0 in streaming.
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"gAAAAA...Fgw=","id":"rs_0fcb21ad7ba2c5f7","format":"openai-responses-v1","index":0}]},"logprobs":null,"finish_reason":null}]}\n\n`,
    );

    // Text content delta
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"content":"The answer is 42."},"logprobs":null,"finish_reason":null}]}\n\n`,
    );

    // Finish + usage + DONE
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{},"logprobs":null,"finish_reason":"stop"}]}\n\n`,
    );
    chunks.push(
      `data: {"id":"${id}",${base},"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}\n\n`,
    );
    chunks.push('data: [DONE]\n\n');

    return chunks;
  }

  function getAccumulatedDetails(
    elements: Array<{ type: string; providerMetadata?: unknown }>,
  ): AccumulatedDetail[] | undefined {
    const finishEvent = elements.find((el) => el.type === 'finish');
    return (
      finishEvent?.providerMetadata as
        | { openrouter?: { reasoning_details?: AccumulatedDetail[] } }
        | undefined
    )?.openrouter?.reasoning_details;
  }

  it('merges consecutive summary deltas into a single entry', async () => {
    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks: buildSummaryThenEncryptedChunks([' reading', ' it', '.']),
    };

    const model = provider.chat('openai/gpt-5.4-nano');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const details = getAccumulatedDetails(elements);
    expect(details).toBeDefined();

    const summaries = details!.filter(
      (d) => d.type === ReasoningDetailType.Summary,
    );
    const encrypted = details!.filter(
      (d) => d.type === ReasoningDetailType.Encrypted,
    );

    // Three summary deltas collapse into ONE merged summary entry...
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.summary).toBe(' reading it.');
    // ...with format preserved from the deltas on the merged entry.
    expect(summaries[0]?.format).toBe('openai-responses-v1');
    // ...and the encrypted block stays a discrete entry.
    expect(encrypted).toHaveLength(1);
    expect(encrypted[0]?.data).toBe('gAAAAA...Fgw=');

    // Total accumulated shape matches non-streaming: [summary, encrypted]
    expect(details).toHaveLength(2);
  });

  it('keeps distinct encrypted blocks separate (no cross-type merge)', async () => {
    const id = 'chatcmpl-519-multi';
    const base = `"object":"chat.completion.chunk","created":1711357598,"model":"openai/gpt-5.4-nano"`;
    const chunks: string[] = [
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"role":"assistant","content":"","reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"a","format":"openai-responses-v1","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"b","format":"openai-responses-v1","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"BLOB1","id":"rs_1","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Summary}","summary":"c","format":"openai-responses-v1","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"reasoning_details":[{"type":"${ReasoningDetailType.Encrypted}","data":"BLOB2","id":"rs_2","index":0}]},"finish_reason":null}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{"content":"done"},"finish_reason":null}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n`,
      `data: {"id":"${id}",${base},"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n`,
      'data: [DONE]\n\n',
    ];

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks,
    };

    const model = provider.chat('openai/gpt-5.4-nano');
    const { stream } = await model.doStream({ prompt: TEST_PROMPT });
    const elements = await convertReadableStreamToArray(stream);

    const details = getAccumulatedDetails(elements);
    expect(details).toBeDefined();

    // summary(a+b) | encrypted(BLOB1) | summary(c) | encrypted(BLOB2)
    expect(details).toHaveLength(4);
    expect(details![0]).toMatchObject({
      type: ReasoningDetailType.Summary,
      summary: 'ab',
    });
    expect(details![1]).toMatchObject({
      type: ReasoningDetailType.Encrypted,
      data: 'BLOB1',
    });
    expect(details![2]).toMatchObject({
      type: ReasoningDetailType.Summary,
      summary: 'c',
    });
    expect(details![3]).toMatchObject({
      type: ReasoningDetailType.Encrypted,
      data: 'BLOB2',
    });
  });
});
