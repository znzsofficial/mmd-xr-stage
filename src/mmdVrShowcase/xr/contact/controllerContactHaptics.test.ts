import { expect, it, vi } from 'vitest';
import { createControllerContactHaptics } from './controllerContactHaptics';

const pad = () => ({ hapticActuators: [{ pulse: vi.fn(() => true) }] });
function grip(gamepad: unknown) {
  const source = { gripSpace: {}, gamepad } as XRInputSource;
  return { source, tracked: vi.fn(() => true), speed: () => 0 };
}

it('handles both sides independently on the same 30 Hz clock, even on a tracking drop shorter than one poll', () => {
  const haptics = createControllerContactHaptics(), left = pad(), right = pad();
  const l = grip(left), r = grip({ vibrationActuator: {} });
  const session = Object.assign(new EventTarget(), { visibilityState: 'visible', inputSources: [l.source, r.source] });
  const read = vi.fn(() => 0);
  let ms = 0;
  const step = () => haptics.advance({ session } as unknown as XRFrame, 1 / 60, ms += 1000 / 60, 'normal', read);
  const poll = () => { step(); step(); };
  haptics.bind(1, r);
  try {
    poll(); expect(read).not.toHaveBeenCalled(); // A gamepad and a placeholder actuator cannot consume feedback.
    haptics.bind(0, l);
    poll();
    expect(read.mock.calls).toEqual([[0]]); // Tracked and clear still needs a sample.
    Object.assign(r.source, { gamepad: right });
    read.mockReturnValue(1); poll();
    expect(read.mock.calls).toEqual([[0], [0], [1]]);
    expect(left.hapticActuators[0].pulse).toHaveBeenCalledOnce();
    expect(right.hapticActuators[0].pulse).toHaveBeenCalledOnce();
    l.tracked.mockReturnValue(false); step();
    l.tracked.mockReturnValue(true); step();
    // A fresh hit inside the *old* cooldown is admitted. The other grip stays latched.
    expect(left.hapticActuators[0].pulse).toHaveBeenCalledTimes(2);
    expect(right.hapticActuators[0].pulse).toHaveBeenCalledOnce();
    Object.assign(l.source.gamepad!, { connected: false });
    read.mockClear(); poll();
    expect(read.mock.calls).toEqual([[1]]);
  } finally { haptics.reset(); }
});

it('requires fresh contact after a hidden interval or session change; a removed source cannot finish a late fallback', async () => {
  const haptics = createControllerContactHaptics();
  let reject!: () => void;
  const pulse = vi.fn<() => boolean | Promise<boolean>>().mockImplementationOnce(() => new Promise(resolve => { reject = () => resolve(false); })).mockReturnValue(true);
  const playEffect = vi.fn(), left = grip({ hapticActuators: [{ pulse }], vibrationActuator: { playEffect } });
  const createSession = (...inputSources: XRInputSource[]) => Object.assign(new EventTarget(), { visibilityState: 'visible', inputSources });
  let session = createSession(left.source), ms = 0;
  const read = vi.fn(() => 1);
  const tick = (dt = 1 / 30) => haptics.advance({ session } as unknown as XRFrame, dt, ms += dt * 1000, 'normal', read);
  const unbind = haptics.bind(0, left);
  try {
    tick(); expect(pulse).toHaveBeenCalledOnce();
    session.inputSources.pop();
    session.dispatchEvent(Object.assign(new Event('inputsourceschange'), { removed: [left.source] }));
    reject(); await Promise.resolve(); await Promise.resolve();
    expect(playEffect).not.toHaveBeenCalled();
    read.mockClear(); tick(); expect(read).not.toHaveBeenCalled();
    session.inputSources.push(left.source); tick(1 / 60); expect(pulse).toHaveBeenCalledOnce();
    tick(1 / 60); expect(pulse).toHaveBeenCalledTimes(2);
    session.visibilityState = 'hidden'; session.dispatchEvent(new Event('visibilitychange'));
    session.visibilityState = 'visible'; // No intermediary invisible frame.
    read.mockReturnValue(0); tick(1 / 60); tick(1 / 60); expect(pulse).toHaveBeenCalledTimes(2);
    read.mockReturnValue(1); tick(); expect(pulse).toHaveBeenCalledTimes(3);
    const other = pad(), replacement = grip(other);
    session = createSession(replacement.source); read.mockClear();
    tick(); expect(read).not.toHaveBeenCalled(); // The hook may still hold the previous session's source.
    haptics.bind(0, replacement); unbind(); // Late old cleanup cannot clear the replacement.
    tick(1 / 60); expect(other.hapticActuators[0].pulse).not.toHaveBeenCalled();
    tick(1 / 60); tick(); expect(other.hapticActuators[0].pulse).toHaveBeenCalledOnce();
  } finally { haptics.reset(); }
});
