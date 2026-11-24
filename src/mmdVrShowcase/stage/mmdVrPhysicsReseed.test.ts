import { describe, expect, it } from "vitest";
import { transformRequiresPhysicsReseed } from "./mmdVrPhysicsReseed";

describe("MMD VR physics reseeding", () => {
  it("does not reseed for scale-only changes", () => {
    expect(transformRequiresPhysicsReseed({ scale: 0.5 })).toBe(false);
  });

  it("reseeds after rotation and reset requests", () => {
    expect(transformRequiresPhysicsReseed({ rotationY: 90 })).toBe(true);
    expect(transformRequiresPhysicsReseed({ reset: true, scale: 1 })).toBe(true);
  });
});
