let scenePromise: Promise<typeof import("./MmdVrScene")> | null = null;

/** Share preload with the overlay; failed requests must be retryable. */
export function preloadMmdVrScene() {
  return scenePromise ??= import("./MmdVrScene").catch((error) => {
    scenePromise = null;
    throw error;
  });
}
