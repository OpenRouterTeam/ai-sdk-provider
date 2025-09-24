'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ModelMessage } from 'ai';

import { ChatMessage } from './components/chat-message';
import type {
  ConversationEntry,
  ToolInvocationDisplay,
  ToolInvocationState,
} from '../lib/conversation-types';
import type { ToolMode } from '../lib/models';
import { DEFAULT_MODEL_ID, DEFAULT_TOOL_MODE, MODEL_OPTIONS } from '../lib/models';

const TOOL_MODE_OPTIONS: Array<{ value: ToolMode; label: string }> = [
  { value: 'auto', label: 'Automatic tool calling' },
  { value: 'disabled', label: 'Disable tools' },
];

function createMessageId(counterRef: { current: number }, prefix: string) {
  counterRef.current += 1;
  return `${prefix}-${Date.now()}-${counterRef.current}`;
}

function mapConversationToModelMessages(history: ConversationEntry[]): ModelMessage[] {
  return history.map((entry) => {
    if (entry.role === 'user') {
      return { role: 'user', content: entry.text } as ModelMessage;
    }

    return { role: 'assistant', content: entry.text } as ModelMessage;
  });
}

export default function ChatPage() {
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [input, setInput] = useState('');
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [toolMode, setToolMode] = useState<ToolMode>(DEFAULT_TOOL_MODE);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messageCounterRef = useRef(0);
  const currentAssistantIdRef = useRef<string | null>(null);

  const selectedModel = useMemo(
    () => MODEL_OPTIONS.find((option) => option.id === modelId) ?? MODEL_OPTIONS[0],
    [modelId],
  );
  const toolsSupported = selectedModel?.supportsTools ?? false;

  useEffect(() => {
    if (!toolsSupported && toolMode !== 'disabled') {
      setToolMode('disabled');
    }
  }, [toolsSupported, toolMode]);

  const appendEntry = useCallback((entry: ConversationEntry) => {
    setConversation((prev) => [...prev, entry]);
  }, []);

  const updateEntryById = useCallback(
    (id: string, updater: (entry: ConversationEntry) => ConversationEntry) => {
      setConversation((prev) => {
        const index = prev.findIndex((item) => item.id === id);
        if (index === -1) {
          return prev;
        }

        const updated = updater(prev[index]);
        if (updated === prev[index]) {
          return prev;
        }

        const next = [...prev];
        next[index] = updated;
        return next;
      });
    },
    [],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleClear = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    currentAssistantIdRef.current = null;
    setConversation([]);
    setError(null);
    setIsStreaming(false);
  }, []);

  const streamResponse = useCallback(
    async (history: ConversationEntry[]) => {
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestMessages = mapConversationToModelMessages(history);
      const payload = JSON.stringify({
        messages: requestMessages,
        modelId,
        toolMode,
      });

      const toolBuffers = new Map<string, string>();
      const reasoningBuffers = new Map<string, string>();

      const ensureAssistantMessage = (metadata?: unknown, messageId?: unknown) => {
        if (currentAssistantIdRef.current) {
          if (metadata !== undefined) {
            updateEntryById(currentAssistantIdRef.current, (entry) => ({
              ...entry,
              metadata: metadata ?? entry.metadata,
            }));
          }
          return currentAssistantIdRef.current;
        }

        const newId =
          typeof messageId === 'string'
            ? messageId
            : createMessageId(messageCounterRef, 'assistant');
        currentAssistantIdRef.current = newId;
        appendEntry({
          id: newId,
          role: 'assistant',
          text: '',
          reasoning: [],
          toolInvocations: [],
          metadata,
          pending: true,
        });
        return newId;
      };

      const updateToolInvocation = (
        assistantId: string,
        callId: string,
        updater: (invocation: ToolInvocationDisplay) => ToolInvocationDisplay,
      ) => {
        updateEntryById(assistantId, (entry) => ({
          ...entry,
          toolInvocations: entry.toolInvocations.map((invocation) =>
            invocation.id === callId ? updater(invocation) : invocation,
          ),
        }));
      };

      const parseEvent = (eventText: string) => {
        const dataLines = eventText
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim());

        if (dataLines.length === 0) {
          return null;
        }

        const payloadText = dataLines.join('');
        if (!payloadText) {
          return null;
        }

        try {
          return JSON.parse(payloadText) as Record<string, unknown>;
        } catch (_error) {
          return null;
        }
      };

      const finalizeAssistant = (options?: { fallback?: string }) => {
        const assistantId = currentAssistantIdRef.current;
        if (!assistantId) {
          return;
        }

        updateEntryById(assistantId, (entry) => {
          if (!entry.pending) {
            return entry;
          }

          const nextText = entry.text || options?.fallback || entry.text;
          return {
            ...entry,
            text: nextText,
            pending: false,
          };
        });
      };

      const processChunk = (chunk: Record<string, unknown>) => {
        const type = typeof chunk.type === 'string' ? chunk.type : null;
        if (!type) {
          return;
        }

        if (type === 'start') {
          ensureAssistantMessage(chunk.messageMetadata, chunk.messageId);
          return;
        }

        const assistantId = ensureAssistantMessage();

        switch (type) {
          case 'text-delta': {
            if (typeof chunk.delta === 'string') {
              updateEntryById(assistantId, (entry) => ({
                ...entry,
                text: entry.text + chunk.delta,
              }));
            }
            break;
          }
          case 'message-metadata': {
            updateEntryById(assistantId, (entry) => ({
              ...entry,
              metadata: chunk.messageMetadata ?? entry.metadata,
            }));
            break;
          }
          case 'reasoning': {
            if (typeof chunk.text === 'string') {
              updateEntryById(assistantId, (entry) => ({
                ...entry,
                reasoning: [...entry.reasoning, chunk.text as string],
              }));
            }
            break;
          }
          case 'reasoning-start': {
            if (typeof chunk.id === 'string') {
              reasoningBuffers.set(chunk.id, '');
            }
            break;
          }
          case 'reasoning-delta': {
            if (typeof chunk.id === 'string' && typeof chunk.delta === 'string') {
              const existing = reasoningBuffers.get(chunk.id) ?? '';
              reasoningBuffers.set(chunk.id, existing + chunk.delta);
            }
            break;
          }
          case 'reasoning-end': {
            if (typeof chunk.id === 'string') {
              const content = reasoningBuffers.get(chunk.id);
              reasoningBuffers.delete(chunk.id);
              if (content && content.trim().length > 0) {
                updateEntryById(assistantId, (entry) => ({
                  ...entry,
                  reasoning: [...entry.reasoning, content],
                }));
              }
            }
            break;
          }
          case 'tool-input-start': {
            if (typeof chunk.toolCallId === 'string' && typeof chunk.toolName === 'string') {
              toolBuffers.set(chunk.toolCallId, '');
              const initialState: ToolInvocationState =
                chunk.providerExecuted === true ? 'awaiting-execution' : 'collecting-input';
              updateEntryById(assistantId, (entry) => ({
                ...entry,
                toolInvocations: [
                  ...entry.toolInvocations,
                  {
                    id: chunk.toolCallId as string,
                    name: chunk.toolName as string,
                    inputPreview: '',
                    state: initialState,
                    providerExecuted: chunk.providerExecuted === true,
                  },
                ],
              }));
            }
            break;
          }
          case 'tool-input-delta': {
            if (typeof chunk.toolCallId === 'string' && typeof chunk.inputTextDelta === 'string') {
              const nextValue = (toolBuffers.get(chunk.toolCallId) ?? '') + chunk.inputTextDelta;
              toolBuffers.set(chunk.toolCallId, nextValue);
              updateToolInvocation(assistantId, chunk.toolCallId, (invocation) => ({
                ...invocation,
                inputPreview: nextValue,
              }));
            }
            break;
          }
          case 'tool-input-available': {
            if (typeof chunk.toolCallId === 'string') {
              toolBuffers.delete(chunk.toolCallId);
              updateToolInvocation(assistantId, chunk.toolCallId, (invocation) => ({
                ...invocation,
                input: chunk.input ?? invocation.input,
                inputPreview: undefined,
                providerExecuted:
                  invocation.providerExecuted || chunk.providerExecuted === true,
                state: 'awaiting-execution',
              }));
            }
            break;
          }
          case 'tool-output-available': {
            if (typeof chunk.toolCallId === 'string') {
              updateToolInvocation(assistantId, chunk.toolCallId, (invocation) => ({
                ...invocation,
                output: chunk.output ?? invocation.output,
                state: 'completed',
              }));
            }
            break;
          }
          case 'tool-output-error': {
            if (typeof chunk.toolCallId === 'string') {
              updateToolInvocation(assistantId, chunk.toolCallId, (invocation) => ({
                ...invocation,
                error: typeof chunk.errorText === 'string' ? chunk.errorText : 'Tool error',
                state: 'error',
              }));
            }
            break;
          }
          case 'finish': {
            updateEntryById(assistantId, (entry) => ({
              ...entry,
              metadata: chunk.messageMetadata ?? entry.metadata,
              pending: false,
            }));
            break;
          }
          case 'abort': {
            finalizeAssistant({ fallback: 'Response aborted.' });
            break;
          }
          case 'error': {
            if (typeof chunk.errorText === 'string') {
              setError(chunk.errorText);
            }
            finalizeAssistant({ fallback: 'The model returned an error.' });
            break;
          }
          default:
            break;
        }
      };

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const message = await response.text();
          throw new Error(message || 'Unable to reach the chat endpoint.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

          let boundary = buffer.indexOf('\n\n');
          while (boundary !== -1) {
            const eventText = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const chunk = parseEvent(eventText);
            if (chunk) {
              processChunk(chunk);
            }
            boundary = buffer.indexOf('\n\n');
          }

          if (done) {
            break;
          }
        }

        finalizeAssistant();
      } catch (error) {
        if (controller.signal.aborted) {
          finalizeAssistant({ fallback: 'Generation cancelled.' });
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unexpected error while streaming response.';
        setError(message);
        finalizeAssistant({ fallback: 'The response ended unexpectedly.' });
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        currentAssistantIdRef.current = null;
      }
    },
    [appendEntry, modelId, toolMode, updateEntryById],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isStreaming) {
        return;
      }

      const trimmed = input.trim();
      if (!trimmed) {
        return;
      }

      const userEntry: ConversationEntry = {
        id: createMessageId(messageCounterRef, 'user'),
        role: 'user',
        text: trimmed,
        reasoning: [],
        toolInvocations: [],
        metadata: undefined,
        pending: false,
      };

      const nextConversation = [...conversation, userEntry];
      setConversation(nextConversation);
      setInput('');
      setError(null);
      void streamResponse(nextConversation);
    },
    [conversation, input, isStreaming, streamResponse],
  );

  return (
    <main>
      <div className="app-shell">
        <header>
          <h1>OpenRouter Chat Playground</h1>
          <p className="subtitle">
            Pick a model, decide whether tool calling is enabled, and chat with a streaming assistant.
          </p>
        </header>

        <section className="controls">
          <div className="control">
            <label htmlFor="model-select">Model</label>
            <select
              id="model-select"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              disabled={isStreaming}
            >
              {MODEL_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {selectedModel ? <p className="subtitle">{selectedModel.description}</p> : null}
          </div>

          <div className="control">
            <label htmlFor="tool-mode">Tool usage</label>
            <select
              id="tool-mode"
              value={toolMode}
              onChange={(event) => setToolMode(event.target.value as ToolMode)}
              disabled={!toolsSupported || isStreaming}
            >
              {TOOL_MODE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === 'auto' && !toolsSupported}
                >
                  {option.label}
                </option>
              ))}
            </select>
            {!toolsSupported ? (
              <p className="subtitle">Tools are disabled for this model.</p>
            ) : null}
          </div>

          <div className="control">
            <p className="control-title">Status</p>
            <div className={`status-pill ${isStreaming ? '' : 'idle'}`}>
              {isStreaming ? 'Streaming response…' : 'Ready'}
            </div>
          </div>

          <div className="control">
            <p className="control-title">Conversation</p>
            <button
              type="button"
              className="secondary"
              onClick={handleClear}
              disabled={conversation.length === 0 && !isStreaming}
            >
              Clear conversation
            </button>
          </div>
        </section>

        <section className="chat-panel">
          {error ? <div className="error-banner">{error}</div> : null}
          <div className="chat-messages">
            {conversation.length === 0 ? (
              <p className="subtitle">
                Start by asking a question. The assistant streams its reply and displays every tool call.
              </p>
            ) : (
              conversation.map((entry) => <ChatMessage key={entry.id} entry={entry} />)
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <div className="control">
              <label htmlFor="user-input">Your message</label>
              <textarea
                id="user-input"
                placeholder="Ask anything — try planning a trip or requesting structured data."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={isStreaming}
              />
            </div>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={handleStop}
                disabled={!isStreaming}
              >
                Stop streaming
              </button>
              <button type="submit" className="primary" disabled={isStreaming}>
                Send message
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
