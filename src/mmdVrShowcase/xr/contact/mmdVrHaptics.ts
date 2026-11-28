export const MMD_VR_HAPTIC_POLL_INTERVAL = 1 / 30;
export const MMD_VR_HAPTIC_COOLDOWN_MS = 140;
export const MMD_VR_HAPTIC_RELEASE_DEBOUNCE_MS = 60;

const HAPTIC_INTENSITY = 0.28;
const ACTUATOR_RETRY_MS = 2_000;

export type MmdVrHapticLevel = "off" | "low" | "normal";

export type MmdVrHapticFeedback = {
  intensity: number;
  weakMagnitude: number;
  durationMs: number;
};

export function getMmdVrHapticFeedback(speed: number, level: Exclude<MmdVrHapticLevel, "off">): MmdVrHapticFeedback {
  const normalizedSpeed = Math.min(1, Math.max(0, (Number.isFinite(speed) ? speed : 0) / 1.5));
  const levelScale = level === "low" ? 0.6 : 1;
  const intensity = (0.12 + normalizedSpeed * 0.33) * levelScale;
  return {
    intensity,
    weakMagnitude: intensity * 0.64,
    durationMs: Math.round(24 + normalizedSpeed * 18),
  };
}

type LegacyHapticActuator = {
  pulse: (intensity: number, duration: number) => boolean | Promise<boolean>;
};

type DualRumbleActuator = {
  reset?: () => GamepadHapticsResult | Promise<GamepadHapticsResult>;
  playEffect: (
    type: "dual-rumble",
    params: { duration: number; strongMagnitude: number; weakMagnitude: number },
  ) => GamepadHapticsResult | Promise<GamepadHapticsResult>;
};

export type MmdVrHapticGamepad = Gamepad & {
  hapticActuators?: readonly LegacyHapticActuator[];
  vibrationActuator?: DualRumbleActuator | null;
};

export type MmdVrHapticGate = {
  update: (contactActive: boolean, nowMs: number) => boolean;
  reset: () => void;
};

export function createMmdVrHapticGate(
  cooldownMs = MMD_VR_HAPTIC_COOLDOWN_MS,
  releaseDebounceMs = MMD_VR_HAPTIC_RELEASE_DEBOUNCE_MS,
): MmdVrHapticGate {
  let contactLatched = false;
  let releaseStartedAt: number | null = null;
  let lastPulseAt = Number.NEGATIVE_INFINITY;

  return {
    update(contactActive, nowMs) {
      const now = Number.isFinite(nowMs) ? nowMs : 0;
      if (contactActive) {
        releaseStartedAt = null;
        if (contactLatched) return false;
        contactLatched = true;
        if (now - lastPulseAt < cooldownMs) return false;
        lastPulseAt = now;
        return true;
      }

      if (!contactLatched) return false;
      if (releaseStartedAt == null) releaseStartedAt = now;
      else if (now - releaseStartedAt >= releaseDebounceMs) {
        contactLatched = false;
        releaseStartedAt = null;
      }
      return false;
    },
    reset() {
      contactLatched = false;
      releaseStartedAt = null;
    },
  };
}

type HapticResult = boolean | GamepadHapticsResult;
type HapticAction = () => HapticResult | Promise<HapticResult>;

function tryHaptic(action: HapticAction): HapticResult | Promise<HapticResult> {
  try {
    const result = action();
    return typeof result === "object" ? result.catch(() => false) : result;
  } catch {
    return false;
  }
}

export type MmdVrHapticDriver = {
  pulse: (
    gamepad: MmdVrHapticGamepad | null | undefined,
    feedback?: MmdVrHapticFeedback,
    nowMs?: number,
  ) => Promise<boolean>;
  /** Forget the current gamepad without writing to its actuators. */
  reset: () => void;
  /** Also interrupt this driver's unexpired hardware pulse, if it still owns it. */
  stop: () => void;
};

export function supportsMmdVrHaptics(gamepad: MmdVrHapticGamepad | null | undefined): boolean {
  return !!gamepad && gamepad.connected !== false && (typeof gamepad.hapticActuators?.[0]?.pulse === 'function'
    || typeof gamepad.vibrationActuator?.playEffect === 'function');
}

// A wand, contact feedback and a remote can all write to the same gamepad.
const lastPadWriter = new WeakMap<Gamepad, symbol>();

export function createMmdVrHapticDriver(): MmdVrHapticDriver {
  let currentGamepad: MmdVrHapticGamepad | null = null;
  let latestRequest: symbol | null = null;
  let playing: { request: symbol; until: number; cancel: HapticAction } | null = null;
  let legacyRetryAt = 0;
  let rumbleRetryAt = 0;

  function reset() {
    currentGamepad = null;
    latestRequest = null;
    playing = null;
    legacyRetryAt = 0;
    rumbleRetryAt = 0;
  }

  return {
    async pulse(gamepad, feedback = { intensity: HAPTIC_INTENSITY, weakMagnitude: 0.18, durationMs: 36 }, nowMs = performance.now()) {
      if (!gamepad) return false;
      if (currentGamepad !== gamepad) {
        reset();
        currentGamepad = gamepad;
      }
      const request = latestRequest = Symbol();
      const isCurrent = () => request === latestRequest && lastPadWriter.get(gamepad) === request;
      const now = Number.isFinite(nowMs) ? nowMs : 0;

      const attempt = async (start: HapticAction, cancel: HapticAction) => {
        // Arm before invoking hardware: the promise may still be pending at tracking loss.
        // Playback uses wall time even when the caller's scene clock is paused.
        const output = { request, until: performance.now() + feedback.durationMs, cancel };
        playing = output;
        lastPadWriter.set(gamepad, request);
        const started = tryHaptic(start);
        const result = typeof started === "object" ? await started : started;
        if (result === true || result === "complete") return true;
        if (playing === output) playing = null;
        return result === "preempted";
      };

      const legacy = gamepad.hapticActuators?.[0];
      if (legacy && now >= legacyRetryAt) {
        if (await attempt(() => legacy.pulse(feedback.intensity, feedback.durationMs), () => legacy.pulse(0, 0))) return true;
        if (!isCurrent()) return false;
        legacyRetryAt = now + ACTUATOR_RETRY_MS;
      }

      const rumble = gamepad.vibrationActuator;
      if (rumble && now >= rumbleRetryAt) {
        if (await attempt(() => rumble.playEffect("dual-rumble", {
          duration: feedback.durationMs,
          strongMagnitude: feedback.intensity,
          weakMagnitude: feedback.weakMagnitude,
        }), () => rumble.reset ? rumble.reset() : rumble.playEffect("dual-rumble", {
          duration: 0, strongMagnitude: 0, weakMagnitude: 0,
        }))) return true;
        if (!isCurrent()) return false;
        rumbleRetryAt = now + ACTUATOR_RETRY_MS;
      }
      return false;
    },
    reset,
    stop() {
      const output = playing, pad = currentGamepad;
      reset();
      if (output && pad && lastPadWriter.get(pad) === output.request && performance.now() < output.until) {
        void tryHaptic(output.cancel);
      }
    },
  };
}
