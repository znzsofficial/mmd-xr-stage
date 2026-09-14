/**
 * Timeline clock shared between stage (writer) and HUD progress (reader).
 * Avoids React/zustand setState on the XR hot path.
 */
export type MmdVrClockSnapshot = {
  time: number;
  duration: number;
  /** Bumped when time/duration should repaint UI (~10 Hz). */
  paintVersion: number;
};

const clock: MmdVrClockSnapshot = {
  time: 0,
  duration: 0,
  paintVersion: 0,
};

let lastPaintBucket = -1;

export function clampMmdVrSimulationDelta(delta: number): number {
  return Math.min(1 / 20, Math.max(0, Number.isFinite(delta) ? delta : 0));
}

export function getMmdVrClock(): Readonly<MmdVrClockSnapshot> {
  return clock;
}

export function resetMmdVrClock() {
  clock.time = 0;
  clock.duration = 0;
  clock.paintVersion = 0;
  lastPaintBucket = -1;
}

export function setMmdVrClockDuration(duration: number) {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (clock.duration === d) return;
  clock.duration = d;
  clock.paintVersion += 1;
}

export function setMmdVrClockTime(time: number, forcePaint = false) {
  const t = Number.isFinite(time) && time >= 0 ? time : 0;
  clock.time = t;
  // ~8–10 UI updates per second
  const bucket = Math.floor(t * 8);
  if (forcePaint || bucket !== lastPaintBucket) {
    lastPaintBucket = bucket;
    clock.paintVersion += 1;
  }
}
