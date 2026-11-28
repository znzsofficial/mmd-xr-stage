import { createContext } from 'react';
import {
  createMmdVrHapticDriver, createMmdVrHapticGate, getMmdVrHapticFeedback,
  MMD_VR_HAPTIC_POLL_INTERVAL, supportsMmdVrHaptics, type MmdVrHapticLevel,
} from './mmdVrHaptics';

type Side = 0 | 1;
type Grip = { source: XRInputSource; tracked(frame: XRFrame, delta: number): boolean; speed(): number };
type ReadContact = (index: Side) => number;

function controllerSide(index: Side) {
  const driver = createMmdVrHapticDriver();
  let grip: Grip | null = null;
  let pad: Gamepad | null = null;
  let gate = createMmdVrHapticGate();
  let contact = false;

  function reset() {
    if (!pad) return;
    pad = null;
    contact = false;
    gate = createMmdVrHapticGate(); // A new grip starts with neither a latch nor the old cooldown.
    driver.reset();
  }

  return {
    bind(next: Grip) {
      reset();
      grip = next;
      return () => { if (grip === next) { reset(); grip = null; } };
    },
    reset,
    removed(sources: readonly XRInputSource[]) { if (grip && sources.includes(grip.source)) reset(); },
    sample(frame: XRFrame, delta: number, nowMs: number, level: Exclude<MmdVrHapticLevel, 'off'>, poll: boolean, read: ReadContact) {
      const source = grip?.source, gamepad = source?.gamepad;
      if (!grip || !source?.gripSpace || source.hand || !gamepad || !supportsMmdVrHaptics(gamepad)
        || !grip.tracked(frame, delta) || !Array.prototype.includes.call(frame.session.inputSources, source)) {
        reset();
        return;
      }
      if (pad !== gamepad) { reset(); pad = gamepad; }
      if (poll) contact = read(index) > 0;
      if (gate.update(contact, nowMs)) void driver.pulse(pad, getMmdVrHapticFeedback(grip.speed(), level), nowMs);
    },
  };
}

/** One game room's mounted grip consumers. Both sides sample the same post-Bullet step. */
export function createControllerContactHaptics() {
  const sides = [controllerSide(0), controllerSide(1)] as const;
  let session: XRSession | undefined;
  let elapsed = 0;
  function clear() { sides[0].reset(); sides[1].reset(); elapsed = 0; }
  function visibility() { if (session?.visibilityState !== 'visible') clear(); }
  function sourcesChanged(event: XRInputSourcesChangeEvent) { for (const side of sides) side.removed(event.removed); }
  function reset() {
    clear();
    session?.removeEventListener('visibilitychange', visibility);
    session?.removeEventListener('inputsourceschange', sourcesChanged);
    session?.removeEventListener('end', reset);
    session = undefined;
  }
  return {
    bind(index: Side, grip: Grip) { return sides[index].bind(grip); },
    reset,
    advance(frame: XRFrame | undefined, delta: number, nowMs: number, level: MmdVrHapticLevel, read: ReadContact) {
      if (!frame || level === 'off' || frame.session.visibilityState !== 'visible') { reset(); return; }
      if (session !== frame.session) {
        reset();
        session = frame.session;
        session.addEventListener('visibilitychange', visibility);
        session.addEventListener('inputsourceschange', sourcesChanged);
        session.addEventListener('end', reset);
      }
      elapsed += delta;
      const poll = elapsed >= MMD_VR_HAPTIC_POLL_INTERVAL;
      if (poll) elapsed %= MMD_VR_HAPTIC_POLL_INTERVAL;
      for (const side of sides) side.sample(frame, delta, nowMs, level, poll, read);
    },
  };
}

export const ControllerContactHaptics = createContext<ReturnType<typeof createControllerContactHaptics> | null>(null);
