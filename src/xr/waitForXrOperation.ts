export function waitForXrOperation<T>(
  operation: Promise<T>,
  options: { signal?: AbortSignal; timeoutMs?: number; timeoutMessage?: string } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("XR entry cancelled", "AbortError"));
    };
    operation.then((value) => {
      cleanup();
      resolve(value);
    }, (error) => {
      cleanup();
      reject(error);
    });
    if (options.signal?.aborted) {
      onAbort();
      return;
    }
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(options.timeoutMessage ?? "XR startup timed out"));
      }, options.timeoutMs);
    }
  });
}
