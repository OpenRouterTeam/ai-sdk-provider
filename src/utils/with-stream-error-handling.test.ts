import { describe, expect, it, vi } from 'vitest';
import { withStreamErrorHandling } from './with-stream-error-handling';

function createChunkedStream<T>(chunks: T[]): ReadableStream<T> {
  let index = 0;
  return new ReadableStream<T>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });
}

function createFailingStream<T>(chunks: T[], error: Error): ReadableStream<T> {
  let index = 0;
  return new ReadableStream<T>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.error(error);
      }
    },
  });
}

async function collectStream<T>(stream: ReadableStream<T>): Promise<T[]> {
  const reader = stream.getReader();
  const results: T[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    results.push(value);
  }
  return results;
}

describe('withStreamErrorHandling', () => {
  it('should forward all chunks from a healthy stream', async () => {
    const source = createChunkedStream(['a', 'b', 'c']);
    const onError = vi.fn();

    const wrapped = withStreamErrorHandling(source, onError);
    const result = await collectStream(wrapped);

    expect(result).toEqual(['a', 'b', 'c']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('should call onError and close cleanly when source errors mid-stream', async () => {
    const error = new TypeError('terminated');
    const source = createFailingStream(['a', 'b'], error);
    const onError = vi.fn();

    const wrapped = withStreamErrorHandling(source, onError);
    const result = await collectStream(wrapped);

    expect(result).toEqual(['a', 'b']);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should call onError when source errors before any chunks', async () => {
    const error = new Error('connection reset');
    const source = createFailingStream([], error);
    const onError = vi.fn();

    const wrapped = withStreamErrorHandling(source, onError);
    const result = await collectStream(wrapped);

    expect(result).toEqual([]);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should handle an empty stream without errors', async () => {
    const source = createChunkedStream<string>([]);
    const onError = vi.fn();

    const wrapped = withStreamErrorHandling(source, onError);
    const result = await collectStream(wrapped);

    expect(result).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('should propagate cancellation to the source reader', async () => {
    const cancelFn = vi.fn();
    const source = new ReadableStream({
      pull(controller) {
        controller.enqueue('data');
      },
      cancel: cancelFn,
    });

    const wrapped = withStreamErrorHandling(source, vi.fn());
    const reader = wrapped.getReader();
    await reader.read();
    await reader.cancel('user abort');

    expect(cancelFn).toHaveBeenCalledWith('user abort');
  });

  it('should not leak an unhandled rejection when cancelled after the source errored', async () => {
    // An aborted fetch errors the response body while the consumer cancels
    // the wrapper. Cancelling an errored reader rejects, and that rejection
    // must not escape as unhandled.
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      let sourceController!: ReadableStreamDefaultController<string>;
      const source = new ReadableStream<string>({
        start(controller) {
          sourceController = controller;
        },
      });
      const onError = vi.fn();
      const wrapped = withStreamErrorHandling(source, onError);

      // Fill the wrapper's queue so it has no pull in flight.
      sourceController.enqueue('a');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const abortError = new DOMException(
        'This operation was aborted',
        'AbortError',
      );
      sourceController.error(abortError);
      await expect(wrapped.cancel(abortError)).resolves.toBeUndefined();

      // Give Node a chance to report any unhandled rejection.
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(unhandled).toEqual([]);
      expect(onError).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('should not call onError when cancelled while a read is in flight', async () => {
    // A source that never produces, so the wrapper's pull stays parked on
    // reader.read() until the consumer cancels.
    const source = new ReadableStream<string>();
    const onError = vi.fn();
    const wrapped = withStreamErrorHandling(source, onError);

    const reader = wrapped.getReader();
    const pending = reader.read();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await reader.cancel('user abort');
    await expect(pending).resolves.toEqual({ done: true, value: undefined });
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(onError).not.toHaveBeenCalled();
  });

  it('should release the source reader lock on error', async () => {
    const error = new TypeError('terminated');
    const source = createFailingStream(['a'], error);
    const onError = vi.fn();

    const wrapped = withStreamErrorHandling(source, onError);
    await collectStream(wrapped);

    expect(onError).toHaveBeenCalledOnce();
  });
});
