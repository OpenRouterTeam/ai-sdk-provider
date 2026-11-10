export function withStreamErrorHandling<T>(
  source: ReadableStream<T>,
  onError: (error: unknown) => void,
): ReadableStream<T> {
  const reader = source.getReader();
  // Set once the consumer cancels. A read that was in flight at that point
  // settles afterwards, and the controller is already closed, so pull must
  // not touch it (or report the resulting TypeError via onError).
  let cancelled = false;
  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (cancelled) {
          return;
        }
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        onError(err);
        reader.cancel().catch(() => {});
        controller.close();
      }
    },
    cancel(reason) {
      cancelled = true;
      // The source may already have errored (e.g. the fetch was aborted), in
      // which case reader.cancel() rejects. Swallow it so it doesn't surface
      // as an unhandled rejection.
      return reader.cancel(reason).catch(() => {});
    },
  });
}
