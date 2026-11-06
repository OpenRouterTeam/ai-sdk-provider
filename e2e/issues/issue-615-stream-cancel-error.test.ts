/**
 * Regression test for GitHub issue #615
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/615
 *
 * Reported error: Unhandled AbortError when a cancelled stream has already errored
 *
 * This test verifies that source cancellation errors do not become unhandled
 * rejections when a consumer cancels the wrapped stream.
 */
import { describe, expect, it, vi } from 'vitest';
import { withStreamErrorHandling } from '@/src/utils/with-stream-error-handling';

describe('Issue #615: stream cancellation after source error', () => {
  it('handles a rejection from source cancellation', async () => {
    const cancelError = new DOMException(
      'The operation was aborted',
      'AbortError',
    );
    const source = new ReadableStream({
      cancel() {
        return Promise.reject(cancelError);
      },
    });

    const wrapped = withStreamErrorHandling(source, vi.fn());

    await expect(wrapped.cancel('user abort')).resolves.toBeUndefined();
  });
});
