export type ToolInvocationState =
  | 'collecting-input'
  | 'awaiting-execution'
  | 'completed'
  | 'error';

export interface ToolInvocationDisplay {
  id: string;
  name: string;
  inputPreview?: string;
  input?: unknown;
  output?: unknown;
  error?: string;
  providerExecuted?: boolean;
  state: ToolInvocationState;
}

export interface ConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  reasoning: string[];
  toolInvocations: ToolInvocationDisplay[];
  metadata?: unknown;
  pending: boolean;
}
