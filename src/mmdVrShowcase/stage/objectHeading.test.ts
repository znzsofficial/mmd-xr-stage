import { Group, MathUtils, Quaternion, Vector3 } from "three";
import { expect, it } from "vitest";
import { objectHeadingDegrees, setObjectHeadingDegrees } from "./objectHeading";

it("rotates 15 degrees per tap through a quaternion restore, preserving the GLB's tilt", () => {
  let g = new Group();
  g.rotation.x = 0.12;
  const original = g.quaternion.clone();
  const axis = new Vector3(0, 1, 0);
  for (let i = 1; i <= 24; i++) {
    setObjectHeadingDegrees(g, objectHeadingDegrees(g) + 15);
    const expected = new Quaternion().setFromAxisAngle(axis, MathUtils.degToRad(i * 15)).multiply(original);
    expect(Math.abs(g.quaternion.dot(expected))).toBeCloseTo(1, 8);
    if (i === 12) { const saved = g.quaternion.clone(); g = new Group(); g.quaternion.copy(saved); }
  }
});
