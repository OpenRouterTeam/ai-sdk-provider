import type { ConversationEntry } from '../../lib/conversation-types';
import { formatStructuredData } from '../../lib/format';
import { ToolInvocationCard } from './tool-invocation-card';

function getAvatarLabel(role: ConversationEntry['role']) {
  return role === 'user' ? 'You' : 'AI';
}

export function ChatMessage({ entry }: { entry: ConversationEntry }) {
  return (
    <div className={`message ${entry.role}`}>
      <div className="avatar" aria-hidden>
        {getAvatarLabel(entry.role)}
      </div>
      <div className="bubble">
        {entry.text ? <p>{entry.text}</p> : null}
        {entry.reasoning.length > 0 ? (
          <details>
            <summary>Reasoning</summary>
            <pre>{entry.reasoning.join('\n')}</pre>
          </details>
        ) : null}
        {entry.metadata ? (
          <details>
            <summary>Metadata</summary>
            <pre>{formatStructuredData(entry.metadata)}</pre>
          </details>
        ) : null}
        {entry.toolInvocations.map((tool) => (
          <ToolInvocationCard key={tool.id} invocation={tool} />
        ))}
        {entry.pending ? (
          <div className="status-pill">Streaming response…</div>
        ) : null}
      </div>
    </div>
  );
}
