import { Buffer } from "node:buffer";
import { parseVmd } from "@yohawing/three-mmd-loader/parser";
import { describe, expect, it } from "vitest";
import { getMmdAnimationDurationSeconds, mergeMotionAnimations } from "./mmdUtils";

// Minimal VMD 0002 with independent light, self-shadow and model/IK records.
function motion(lights: number[], shadows: number[], properties: number[]) {
  function count(n: number) {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n);
    return b;
  }
  const header = Buffer.alloc(50);
  header.write("Vocaloid Motion Data 0002");
  const ik = Buffer.alloc(21);
  ik.write("LegIK"); // 20-byte name, disabled flag
  return parseVmd(Buffer.concat([
    header, count(0), count(0), count(0), // no bones, morphs or cameras
    count(lights.length), ...lights.flatMap(frame => [count(frame), Buffer.alloc(24)]),
    count(shadows.length), ...shadows.flatMap(frame => [count(frame), Buffer.from([2]), Buffer.alloc(4)]),
    count(properties.length), ...properties.flatMap(frame => [count(frame), Buffer.from([1]), count(1), ik]),
  ]));
}

describe("VMD playback duration", () => {
  it("reaches the last parsed model/IK key after the lighting tracks end", () => {
    const clip = motion([30], [42], [95, 0]);
    expect(clip.propertyFrames.at(-1)).toMatchObject({ frame: 95, ikStates: [{ boneName: "LegIK", enabled: false }] });
    expect(getMmdAnimationDurationSeconds(clip)).toBe(95 / 30);
  });

  it("reaches a self-shadow key even when the model track ends earlier", () => {
    const clip = motion([30], [96, 12], [45]);
    expect(clip.selfShadowFrames.at(-1)).toMatchObject({ frame: 96, mode: 2 });
    expect(getMmdAnimationDurationSeconds(clip)).toBe(96 / 30);
  });

  it("times only the selected tracks after merging body, face and camera files", () => {
    const body = motion([], [], [45]);
    const face = motion([], [75], [301]);
    const camera = motion([], [401], []);
    // The body supplies the property track; its empty shadow track falls back to the face.
    expect(getMmdAnimationDurationSeconds(mergeMotionAnimations(body, face, camera)!)).toBe(75 / 30);
    expect(getMmdAnimationDurationSeconds(mergeMotionAnimations(null, face, camera)!)).toBe(301 / 30);
  });

  it("retains a one-frame duration for empty and frame-zero-only clips", () => {
    expect(getMmdAnimationDurationSeconds(motion([], [], []))).toBe(1 / 30);
    expect(getMmdAnimationDurationSeconds(motion([], [0], [0]))).toBe(1 / 30);
  });
});
