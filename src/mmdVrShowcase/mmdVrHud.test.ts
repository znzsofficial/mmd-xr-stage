import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { clampMmdVrHudPosition } from "./components/MmdVrHud";

describe("clampMmdVrHudPosition", () => {
  it("keeps the panel in a reachable local-space volume", () => {
    expect(clampMmdVrHudPosition(new THREE.Vector3(9, -2, 1))).toEqual([1.8, 0.65, -0.5]);
    expect(clampMmdVrHudPosition(new THREE.Vector3(-9, 8, -9))).toEqual([-1.8, 2.25, -5]);
    expect(clampMmdVrHudPosition(new THREE.Vector3(0.4, 1.4, -1.9))).toEqual([0.4, 1.4, -1.9]);
  });
});
