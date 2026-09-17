export type AssetLoadPhase = "model" | "body" | "face" | "object";

export type AssetLoadFailure = {
  id: string;
  fileName: string;
  phase: AssetLoadPhase;
  message: string;
};

export type AssetLoadProgress = {
  running: boolean;
  completed: number;
  total: number;
  fileName: string;
  phase: AssetLoadPhase | null;
  failures: AssetLoadFailure[];
};

export type AssetLoadTask = {
  id: string;
  fileName: string;
  phase: AssetLoadPhase;
  requires?: string;
  run: () => Promise<void | readonly string[]>;
};

export function emptyAssetLoadProgress(): AssetLoadProgress {
  return { running: false, completed: 0, total: 0, fileName: "", phase: null, failures: [] };
}

/** Successful tasks stay committed; retries execute only failed or blocked tasks. */
export function createAssetLoadQueue(tasks: readonly AssetLoadTask[]) {
  const succeeded = new Set<string>();
  const retryable = new Set<string>();
  let active: Promise<void> | null = null;

  async function execute(publish: (progress: AssetLoadProgress) => void, isCancelled: () => boolean) {
    const invalidated = new Set(retryable);
    // Reloading a model changes its runtime id; its motions must be rebound too.
    for (let changed = true; changed;) {
      changed = false;
      for (const task of tasks) {
        if (task.requires && invalidated.has(task.requires) && !invalidated.has(task.id)) {
          invalidated.add(task.id);
          changed = true;
        }
      }
    }
    invalidated.forEach((id) => succeeded.delete(id));
    retryable.clear();
    const pending = tasks.filter((task) => !succeeded.has(task.id));
    const failures: AssetLoadFailure[] = [];
    let completed = 0;
    for (const task of pending) {
      if (isCancelled()) return;
      // A model failure already explains why its motions could not be applied.
      if (task.requires && !succeeded.has(task.requires)) {
        completed += 1;
        continue;
      }
      publish({ running: true, completed, total: pending.length, fileName: task.fileName, phase: task.phase, failures: [...failures] });
      try {
        const warnings = await task.run();
        succeeded.add(task.id);
        if (warnings?.length) {
          retryable.add(task.id);
          failures.push({ id: task.id, fileName: task.fileName, phase: task.phase, message: warnings.join("\n") });
        }
      } catch (error) {
        if (isCancelled()) return;
        failures.push({ id: task.id, fileName: task.fileName, phase: task.phase, message: error instanceof Error ? error.message : String(error) });
      }
      if (isCancelled()) return;
      completed += 1;
    }
    if (!isCancelled()) {
      publish({ running: false, completed, total: pending.length, fileName: "", phase: null, failures });
    }
  }

  return {
    run(publish: (progress: AssetLoadProgress) => void, isCancelled: () => boolean = () => false) {
      if (active) return active;
      active = execute(publish, isCancelled).finally(() => { active = null; });
      return active;
    },
  };
}
