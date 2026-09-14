import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMmdVrHapticContacts,
  createMmdVrHapticDriver,
  createMmdVrHapticGate,
  getMmdVrHapticFeedback,
  getMmdVrHapticContact,
  setMmdVrHapticContacts,
  type MmdVrHapticGamepad,
} from "./mmdVrHaptics";

describe("MMD VR haptics", () => {
  beforeEach(clearMmdVrHapticContacts);

  it("stores per-controller contacts without publishing React state", () => {
    setMmdVrHapticContacts(true, false);
    expect(getMmdVrHapticContact(0)).toBe(true);
    expect(getMmdVrHapticContact(1)).toBe(false);
  });

  it("maps controller speed to conservative Low and Normal feedback", () => {
    expect(getMmdVrHapticFeedback(0, "normal")).toEqual({
      intensity: 0.12,
      weakMagnitude: 0.0768,
      durationMs: 24,
    });
    expect(getMmdVrHapticFeedback(1.5, "normal")).toEqual({
      intensity: 0.45,
      weakMagnitude: 0.28800000000000003,
      durationMs: 42,
    });
    expect(getMmdVrHapticFeedback(1.5, "low").intensity).toBeCloseTo(0.27);
    expect(getMmdVrHapticFeedback(Number.NaN, "normal").intensity).toBe(0.12);
  });

  it("pulses once on contact onset and rearms after a stable release", () => {
    const gate = createMmdVrHapticGate(140, 60);
    expect(gate.update(true, 0)).toBe(true);
    expect(gate.update(true, 20)).toBe(false);
    expect(gate.update(false, 40)).toBe(false);
    expect(gate.update(true, 80)).toBe(false);
    expect(gate.update(false, 100)).toBe(false);
    expect(gate.update(false, 160)).toBe(false);
    expect(gate.update(true, 180)).toBe(true);
  });

  it("enforces the cooldown independently of release debounce", () => {
    const gate = createMmdVrHapticGate(140, 20);
    expect(gate.update(true, 0)).toBe(true);
    gate.update(false, 10);
    gate.update(false, 30);
    expect(gate.update(true, 40)).toBe(false);
    gate.update(false, 50);
    gate.update(false, 70);
    expect(gate.update(true, 150)).toBe(true);
  });

  it("falls back to dual rumble when the legacy actuator rejects", async () => {
    const pulse = vi.fn().mockRejectedValue(new Error("unsupported"));
    const playEffect = vi.fn().mockResolvedValue("complete");
    const gamepad = {
      hapticActuators: [{ pulse }],
      vibrationActuator: { playEffect },
    } as unknown as MmdVrHapticGamepad;

    const driver = createMmdVrHapticDriver();
    await expect(driver.pulse(gamepad, undefined, 100)).resolves.toBe(true);
    expect(pulse).toHaveBeenCalledWith(0.28, 36);
    expect(playEffect).toHaveBeenCalledWith("dual-rumble", {
      duration: 36,
      strongMagnitude: 0.28,
      weakMagnitude: 0.18,
    });
  });

  it("accepts preempted dual-rumble effects as supported output", async () => {
    const playEffect = vi.fn().mockResolvedValue("preempted");
    const gamepad = { vibrationActuator: { playEffect } } as unknown as MmdVrHapticGamepad;

    await expect(createMmdVrHapticDriver().pulse(gamepad)).resolves.toBe(true);
  });

  it("handles false results, synchronous failures, and missing actuators", async () => {
    const playEffect = vi.fn(() => { throw new Error("disconnected"); });
    const gamepad = {
      hapticActuators: [{ pulse: vi.fn().mockResolvedValue(false) }],
      vibrationActuator: { playEffect },
    } as unknown as MmdVrHapticGamepad;

    const driver = createMmdVrHapticDriver();
    await expect(driver.pulse(gamepad, undefined, 100)).resolves.toBe(false);
    await expect(driver.pulse(gamepad, undefined, 200)).resolves.toBe(false);
    await expect(driver.pulse(undefined)).resolves.toBe(false);
    expect(gamepad.hapticActuators[0].pulse).toHaveBeenCalledTimes(1);
    expect(playEffect).toHaveBeenCalledTimes(1);
  });

  it("retries transient actuator failures after the backoff", async () => {
    const pulse = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const gamepad = { hapticActuators: [{ pulse }] } as unknown as MmdVrHapticGamepad;
    const driver = createMmdVrHapticDriver();

    await expect(driver.pulse(gamepad, undefined, 100)).resolves.toBe(false);
    await expect(driver.pulse(gamepad, undefined, 1_000)).resolves.toBe(false);
    await expect(driver.pulse(gamepad, undefined, 2_100)).resolves.toBe(true);
    expect(pulse).toHaveBeenCalledTimes(2);
  });
});
