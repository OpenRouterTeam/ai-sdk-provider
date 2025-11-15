export interface ModelOption {
  id: string;
  label: string;
  description: string;
  supportsTools: boolean;
}

export type ToolMode = 'auto' | 'disabled';

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'openai/gpt-4.1-mini',
    label: 'OpenAI GPT-4.1 Mini',
    description:
      'Fast and capable general-purpose model with strong support for streaming tool calls.',
    supportsTools: true,
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Anthropic Claude 3.7 Sonnet',
    description:
      'Reasoning-focused assistant that can plan multi-step solutions and execute structured tools.',
    supportsTools: true,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B Instruct',
    description:
      'Great open-weight model for narrative tasks. Tools are disabled by default for this model.',
    supportsTools: false,
  },
];

export const DEFAULT_MODEL_ID = MODEL_OPTIONS[0]?.id ?? 'openai/gpt-4.1-mini';

export const DEFAULT_TOOL_MODE: ToolMode = 'auto';

export const DEFAULT_SYSTEM_PROMPT =
  'You are an expert assistant running on OpenRouter. Provide concise, actionable answers, '
  + 'call the available tools when they make the response more helpful, and always explain how '
  + 'you used any tool results.';
