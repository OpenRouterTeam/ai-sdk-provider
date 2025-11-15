import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ModelMessage } from 'ai';
import { streamText } from 'ai';

import { BASIC_TOOLS } from '../../../lib/tools';
import { DEFAULT_SYSTEM_PROMPT } from '../../../lib/models';

interface ChatRequestBody {
  modelId: string;
  toolMode?: 'auto' | 'disabled';
  messages: ModelMessage[];
}

const openrouter = createOpenRouter({
  compatibility: 'strict',
  baseURL: process.env.OPENROUTER_BASE_URL ?? process.env.OPENROUTER_API_BASE,
});

function normalizeToolMode(toolMode: ChatRequestBody['toolMode']) {
  return toolMode === 'disabled' ? 'disabled' : 'auto';
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'Missing OPENROUTER_API_KEY environment variable.' },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch (_error) {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!body || typeof body.modelId !== 'string') {
    return Response.json({ error: 'Request must include a modelId string.' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.some((message) => typeof message !== 'object')) {
    return Response.json({ error: 'Messages must be an array of chat messages.' }, { status: 400 });
  }

  const toolMode = normalizeToolMode(body.toolMode);
  const shouldExposeTools = toolMode !== 'disabled';

  try {
    const result = streamText({
      model: openrouter(body.modelId),
      system: DEFAULT_SYSTEM_PROMPT,
      messages: body.messages,
      tools: shouldExposeTools ? BASIC_TOOLS : undefined,
      toolChoice: shouldExposeTools ? 'auto' : 'none',
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error while contacting OpenRouter.';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
