import { describe, expect, it } from 'vitest';
import { convertToOpenRouterChatMessages } from '../chat/convert-to-openrouter-chat-messages';
import { OpenRouterProviderOptionsSchema } from './provider-metadata';
import {
  OutputUnionToReasoningDetailsSchema,
  ReasoningDetailArraySchema,
  ReasoningDetailType,
} from './reasoning-details';

// Formats listed in OpenRouter's reasoning_details docs that were missing
// from the SDK enum, plus a format the SDK has never heard of.
const FORMATS = [
  'bedrock-openai-responses-v1',
  'bedrock-xai-responses-v1',
  'meta-responses-v1',
  'some-future-provider-v1',
];

const detailsFor = (format: string) => [
  {
    type: ReasoningDetailType.Summary,
    summary: `Summary for ${format}.`,
    format,
    index: 0,
  },
  {
    type: ReasoningDetailType.Encrypted,
    data: `encrypted-${format}`,
    id: `rs_${format}`,
    format,
    index: 1,
  },
  {
    type: ReasoningDetailType.Text,
    text: `Text for ${format}.`,
    format,
    index: 2,
  },
];

describe.each(FORMATS)('reasoning_details with format %s', (format) => {
  it('is preserved by ReasoningDetailArraySchema', () => {
    const details = detailsFor(format);
    expect(ReasoningDetailArraySchema.parse(details)).toEqual(details);
  });

  it('is preserved when parsing response messages and deltas', () => {
    const details = detailsFor(format);
    expect(
      OutputUnionToReasoningDetailsSchema.parse({
        message: { reasoning_details: details },
      }),
    ).toEqual(details);
    expect(
      OutputUnionToReasoningDetailsSchema.parse({
        delta: { reasoning_details: details },
      }),
    ).toEqual(details);
  });

  it('is preserved in providerOptions', () => {
    const details = detailsFor(format);
    expect(
      OpenRouterProviderOptionsSchema.parse({
        openrouter: { reasoning_details: details },
      })?.openrouter?.reasoning_details,
    ).toEqual(details);
  });

  it('round-trips back to the API on the next turn', () => {
    const details = detailsFor(format);
    const result = convertToOpenRouterChatMessages([
      { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Thinking.' },
          { type: 'text', text: 'Hi.' },
        ],
        providerOptions: {
          openrouter: { reasoning_details: details },
        },
      },
      { role: 'user', content: [{ type: 'text', text: 'Again' }] },
    ]);

    const assistant = result.find((m) => m.role === 'assistant');
    expect(assistant?.reasoning_details).toEqual(details);
    expect(assistant?.reasoning).toBe('Thinking.');
  });
});
