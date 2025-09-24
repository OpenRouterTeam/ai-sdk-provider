'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { ModelMessage } from 'ai';

import type { ToolMode } from '../lib/models';
import { DEFAULT_MODEL_ID, DEFAULT_TOOL_MODE, MODEL_OPTIONS } from '../lib/models';

type ToolStatus = 'collecting' | 'running' | 'complete' | 'error';

interface ToolCall {
  id: string;
  name: string;
  status: ToolStatus;
  inputText?: string;
  resultText?: string;
  errorText?: string;
  providerExecuted?: boolean;
}

interface ConversationEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  tools: ToolCall[];
  pending: boolean;
}

const TOOL_STATUS_LABEL: Record<ToolStatus, string> = {
  collecting: 'Collecting input',
  running: 'Running',
  complete: 'Completed',
  error: 'Error',
};

const TOOL_MODE_OPTIONS: Array<{ value: ToolMode; label: string }> = [
  { value: 'auto', label: 'Automatic tool calling' },
  { value: 'disabled', label: 'Disable tools' },
];

function createMessageId(counterRef: { current: number }, prefix: string) {
  counterRef.current += 1;
  return `${prefix}-${Date.now()}-${counterRef.current}`;
}

function mapConversationToModelMessages(history: ConversationEntry[]): ModelMessage[] {
  return history.map((entry) =>
    entry.role === 'user'
      ? ({ role: 'user', content: entry.text } as ModelMessage)
      : ({ role: 'assistant', content: entry.text } as ModelMessage),
  );
}

function formatData(value: unknown): string {
  if (value === undefined || value === null) {
    return '—';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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
  }, [toolMode, toolsSupported]);

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
    setInput('');
    setError(null);
    setIsStreaming(false);
  }, []);

  const streamResponse = useCallback(
    async (history: ConversationEntry[]) => {
      setIsStreaming(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const payload = JSON.stringify({
        messages: mapConversationToModelMessages(history),
        modelId,
        toolMode,
      });

      const toolBuffers = new Map<string, string>();

      const ensureAssistantMessage = (messageId?: string) => {
        if (currentAssistantIdRef.current) {
          return currentAssistantIdRef.current;
        }

        const newId = messageId ?? createMessageId(messageCounterRef, 'assistant');
        currentAssistantIdRef.current = newId;
        appendEntry({
          id: newId,
          role: 'assistant',
          text: '',
          tools: [],
          pending: true,
        });
        return newId;
      };

      const updateToolCall = (
        assistantId: string,
        toolId: string,
        updater: (tool: ToolCall) => ToolCall,
      ) => {
        updateEntryById(assistantId, (entry) => ({
          ...entry,
          tools: entry.tools.map((tool) => (tool.id === toolId ? updater(tool) : tool)),
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
        } catch {
          return null;
        }
      };

      const finalizeAssistant = (fallback?: string) => {
        const assistantId = currentAssistantIdRef.current;
        if (!assistantId) {
          return;
        }

        updateEntryById(assistantId, (entry) => ({
          ...entry,
          text: entry.text || fallback || entry.text,
          pending: false,
        }));
      };

      const processChunk = (chunk: Record<string, unknown>) => {
        const type = typeof chunk.type === 'string' ? chunk.type : null;
        if (!type) {
          return;
        }

        if (type === 'start') {
          const messageId = typeof chunk.messageId === 'string' ? chunk.messageId : undefined;
          ensureAssistantMessage(messageId);
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
          case 'tool-input-start': {
            if (typeof chunk.toolCallId === 'string' && typeof chunk.toolName === 'string') {
              toolBuffers.set(chunk.toolCallId, '');
              const status: ToolStatus = chunk.providerExecuted === true ? 'running' : 'collecting';
              updateEntryById(assistantId, (entry) => ({
                ...entry,
                tools: [
                  ...entry.tools,
                  {
                    id: chunk.toolCallId as string,
                    name: chunk.toolName as string,
                    status,
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
              updateToolCall(assistantId, chunk.toolCallId, (tool) => ({
                ...tool,
                inputText: nextValue,
                status: tool.status === 'collecting' ? 'collecting' : tool.status,
              }));
            }
            break;
          }
          case 'tool-input-available': {
            if (typeof chunk.toolCallId === 'string') {
              const formatted =
                'input' in chunk ? formatData((chunk as { input?: unknown }).input) : undefined;
              const preview = toolBuffers.get(chunk.toolCallId);
              toolBuffers.delete(chunk.toolCallId);
              updateToolCall(assistantId, chunk.toolCallId, (tool) => ({
                ...tool,
                inputText: formatted ?? preview ?? tool.inputText,
                providerExecuted: tool.providerExecuted || chunk.providerExecuted === true,
                status: 'running',
              }));
            }
            break;
          }
          case 'tool-output-available': {
            if (typeof chunk.toolCallId === 'string') {
              const formatted =
                'output' in chunk ? formatData((chunk as { output?: unknown }).output) : undefined;
              updateToolCall(assistantId, chunk.toolCallId, (tool) => ({
                ...tool,
                resultText: formatted ?? tool.resultText,
                status: 'complete',
              }));
            }
            break;
          }
          case 'tool-output-error': {
            if (typeof chunk.toolCallId === 'string') {
              const errorText =
                typeof chunk.errorText === 'string' ? chunk.errorText : 'Tool error';
              updateToolCall(assistantId, chunk.toolCallId, (tool) => ({
                ...tool,
                errorText,
                status: 'error',
              }));
            }
            break;
          }
          case 'finish': {
            updateEntryById(assistantId, (entry) => ({
              ...entry,
              pending: false,
            }));
            break;
          }
          case 'abort': {
            finalizeAssistant('Response aborted.');
            break;
          }
          case 'error': {
            if (typeof chunk.errorText === 'string') {
              setError(chunk.errorText);
            }
            finalizeAssistant('The model returned an error.');
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
          finalizeAssistant('Generation cancelled.');
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Unexpected error while streaming response.';
        setError(message);
        finalizeAssistant('The response ended unexpectedly.');
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
        tools: [],
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
      <div className="container">
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
            {selectedModel ? <p className="hint">{selectedModel.description}</p> : null}
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
            {!toolsSupported ? <p className="hint">Tools are disabled for this model.</p> : null}
          </div>

          <div className="control">
            <span className="label">Status</span>
            <span className={`badge ${isStreaming ? 'active' : 'idle'}`}>
              {isStreaming ? 'Streaming response…' : 'Ready'}
            </span>
          </div>

          <div className="control">
            <span className="label">Conversation</span>
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
          {error ? <div className="alert">{error}</div> : null}
          <div className="chat-log">
            {conversation.length === 0 ? (
              <p className="empty">
                Start by asking a question. The assistant streams its reply and displays each tool call.
              </p>
            ) : (
              conversation.map((entry) => (
                <article key={entry.id} className={`message ${entry.role}`}>
                  <header className="message-header">
                    <span className="role-label">{entry.role === 'user' ? 'You' : 'Assistant'}</span>
                    {entry.pending ? <span className="badge active">Streaming…</span> : null}
                  </header>
                  {entry.text ? <p className="message-text">{entry.text}</p> : null}
                  {entry.tools.length > 0 ? (
                    <div className="tool-list">
                      {entry.tools.map((tool) => (
                        <div key={tool.id} className="tool-card">
                          <div className="tool-card-header">
                            <span className="tool-name">{tool.name}</span>
                            <span className={`badge status ${tool.status}`}>
                              {TOOL_STATUS_LABEL[tool.status]}
                            </span>
                          </div>
                          {tool.providerExecuted ? <p className="hint">Executed by provider</p> : null}
                          {tool.inputText ? (
                            <div className="tool-block">
                              <p className="label">Input</p>
                              <pre>{tool.inputText}</pre>
                            </div>
                          ) : null}
                          {tool.resultText ? (
                            <div className="tool-block">
                              <p className="label">Result</p>
                              <pre>{tool.resultText}</pre>
                            </div>
                          ) : null}
                          {tool.errorText ? (
                            <div className="tool-block">
                              <p className="label">Error</p>
                              <pre>{tool.errorText}</pre>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>

          <form className="chat-form" onSubmit={handleSubmit}>
            <label htmlFor="user-input" className="label">
              Your message
            </label>
            <textarea
              id="user-input"
              placeholder="Ask anything — try planning a trip or requesting structured data."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isStreaming}
              rows={3}
            />
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
