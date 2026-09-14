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
  playEffect: (
    type: "dual-rumble",
    params: { duration: number; strongMagnitude: number; weakMagnitude: number },
  ) => GamepadHapticsResult | Promise<GamepadHapticsResult>;
};

export type MmdVrHapticGamepad = Gamepad & {
  hapticActuators?: readonly LegacyHapticActuator[];
  vibrationActuator?: DualRumbleActuator | null;
};

const controllerContacts: [boolean, boolean] = [false, false];

export function setMmdVrHapticContacts(left: boolean, right: boolean) {
  controllerContacts[0] = left;
  controllerContacts[1] = right;
}

export function clearMmdVrHapticContacts() {
  setMmdVrHapticContacts(false, false);
}

export function getMmdVrHapticContact(index: 0 | 1): boolean {
  return controllerContacts[index];
}

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

async function tryHaptic(
  action: (() => boolean | GamepadHapticsResult | Promise<boolean | GamepadHapticsResult>) | undefined,
): Promise<boolean> {
  if (!action) return false;
  try {
    const result = await action();
    return result === true || result === "complete" || result === "preempted";
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
  reset: () => void;
};

export function supportsMmdVrHaptics(gamepad: MmdVrHapticGamepad | null | undefined): boolean {
  return Boolean(gamepad?.hapticActuators?.[0] || gamepad?.vibrationActuator);
}

export function createMmdVrHapticDriver(): MmdVrHapticDriver {
  let currentGamepad: MmdVrHapticGamepad | null = null;
  let generation = 0;
  let legacyRetryAt = 0;
  let rumbleRetryAt = 0;

  return {
    async pulse(gamepad, feedback = { intensity: HAPTIC_INTENSITY, weakMagnitude: 0.18, durationMs: 36 }, nowMs = performance.now()) {
      if (!gamepad) return false;
      if (currentGamepad !== gamepad) {
        currentGamepad = gamepad;
        generation += 1;
        legacyRetryAt = 0;
        rumbleRetryAt = 0;
      }
      const callGeneration = generation;
      const now = Number.isFinite(nowMs) ? nowMs : 0;

      const legacy = gamepad.hapticActuators?.[0];
      if (legacy && now >= legacyRetryAt) {
        if (await tryHaptic(() => legacy.pulse(feedback.intensity, feedback.durationMs))) return true;
        if (callGeneration !== generation || currentGamepad !== gamepad) return false;
        legacyRetryAt = now + ACTUATOR_RETRY_MS;
      }

      const rumble = gamepad.vibrationActuator;
      if (rumble && now >= rumbleRetryAt) {
        if (await tryHaptic(() => rumble.playEffect("dual-rumble", {
          duration: feedback.durationMs,
          strongMagnitude: feedback.intensity,
          weakMagnitude: feedback.weakMagnitude,
        }))) return true;
        if (callGeneration !== generation || currentGamepad !== gamepad) return false;
        rumbleRetryAt = now + ACTUATOR_RETRY_MS;
      }
      return false;
    },
    reset() {
      currentGamepad = null;
      generation += 1;
      legacyRetryAt = 0;
      rumbleRetryAt = 0;
    },
  };
}
