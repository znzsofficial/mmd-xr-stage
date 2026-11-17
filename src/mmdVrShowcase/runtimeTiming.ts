export function createRuntimeTiming() {
  let samples = 0;
  let sum = 0;
  let max = 0;
  return {
    record(ms: number) {
      if (!Number.isFinite(ms) || ms < 0) return;
      samples += 1; sum += ms; max = Math.max(max, ms);
    },
    readAndReset() {
      const value = samples ? { mean: sum / samples, max } : null;
      samples = 0; sum = 0; max = 0;
      return value;
    },
  };
}

export const runtimeTiming = createRuntimeTiming();
