/**
 * Type-only consumer used by `check.sh` to verify that the built package
 * typechecks against the latest published `ai` release. Never executed.
 */
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { embed, experimental_decide, generateText, rerank } from 'ai';

const openrouter = createOpenRouter({ apiKey: 'unused' });

export async function consumer() {
  await generateText({
    model: openrouter('openai/gpt-4o-mini'),
    prompt: 'Hello',
  });

  await generateText({
    model: openrouter.chat('openai/gpt-4o-mini'),
    prompt: 'Hello',
  });

  await generateText({
    model: openrouter.completion('openai/gpt-3.5-turbo-instruct'),
    prompt: 'Hello',
  });

  await embed({
    model: openrouter.embeddingModel('openai/text-embedding-3-small'),
    value: 'Hello',
  });

  await rerank({
    model: openrouter.rerankingModel('cohere/rerank-v3.5'),
    query: 'Hello',
    documents: ['a', 'b'],
  });

  await experimental_decide({
    model: openrouter.decisionModel('typesafe/jev-1.13'),
    state: 'The checkout page crashes when I click pay.',
    questions: {
      is_bug: {
        type: 'boolean',
        instructions: 'Is the customer reporting a software defect?',
      },
      team: {
        type: 'choice',
        instructions: 'Which team should own this ticket?',
        criteria: { payments: null, frontend: null },
      },
      urgency: {
        type: 'score',
        instructions: 'How urgent is this ticket?',
        criteria: ['low', 'medium', 'high'],
      },
    },
  });
}
