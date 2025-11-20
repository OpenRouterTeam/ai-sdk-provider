import type { ToolInvocationDisplay } from '../../lib/conversation-types';
import { formatStructuredData } from '../../lib/format';

const STATUS_LABELS: Record<ToolInvocationDisplay['state'], string> = {
  'collecting-input': 'Collecting input',
  'awaiting-execution': 'Running tool',
  completed: 'Completed',
  error: 'Error',
};

export function ToolInvocationCard({ invocation }: { invocation: ToolInvocationDisplay }) {
  const statusClass = invocation.state === 'error' ? 'status error' : 'status';
  const inputToShow =
    invocation.input !== undefined
      ? formatStructuredData(invocation.input)
      : invocation.inputPreview;
  const outputToShow =
    invocation.output !== undefined ? formatStructuredData(invocation.output) : undefined;

  return (
    <div className="tool-card">
      <div>
        <h4>{invocation.name}</h4>
        <div className={statusClass}>{STATUS_LABELS[invocation.state]}</div>
      </div>
      {invocation.providerExecuted ? (
        <div className="status-pill">Executed by provider</div>
      ) : null}
      {inputToShow ? (
        <div>
          <strong>Input</strong>
          <pre>{inputToShow}</pre>
        </div>
      ) : null}
      {outputToShow ? (
        <div>
          <strong>Result</strong>
          <pre>{outputToShow}</pre>
        </div>
      ) : null}
      {invocation.error ? (
        <div>
          <strong>Error</strong>
          <pre>{formatStructuredData(invocation.error)}</pre>
        </div>
      ) : null}
    </div>
  );
}
