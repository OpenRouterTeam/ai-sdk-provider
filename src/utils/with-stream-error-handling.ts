export function withStreamErrorHandling<T>(
  source: ReadableStream<T>,
  onError: (error: unknown) => void,
): ReadableStream<T> {
  const reader = source.getReader();
  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      } catch (err) {
        onError(err);
        controller.close();
      }
    },
    cancel(reason) {
      reader.cancel(reason);
    },
  });
}
