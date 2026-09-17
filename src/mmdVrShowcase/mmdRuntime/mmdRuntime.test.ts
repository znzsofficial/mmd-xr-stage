import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { applyModelTransform, DEFAULT_MODEL_TRANSFORM, disposeLoadedModelObject, type RuntimeEntry } from "./mmdRuntimeEntry";
import { bindStaticMmdPhysicsRuntime, isMmdRuntimeRebuildError, MmdRuntimeRebuildError } from "./mmdRuntime";

describe("standalone model runtime", () => {
  it("keeps native physics unit-scale, then restores visual scale", () => {
    const root = new THREE.Group();
    const entry = { model: { root }, transform: { ...DEFAULT_MODEL_TRANSFORM, scale: 0.2, positionX: 2 } } as RuntimeEntry;
    applyModelTransform(entry, { physicsStep: true });
    expect(root.scale.toArray()).toEqual([1, 1, 1]);
    expect(root.position.x).toBe(2);
    expect(entry.transform.scale).toBe(0.2);
    applyModelTransform(entry);
    expect(root.scale.toArray()).toEqual([0.2, 0.2, 0.2]);
  });

  it("binds static cloth without requiring an external motion file", () => {
    const setAnimation = vi.fn();
    bindStaticMmdPhysicsRuntime({ setAnimation } as unknown as Pick<ThreeMmdModel, "setAnimation">);
    expect(setAnimation).toHaveBeenCalledWith(expect.objectContaining({ kind: "vmd", boneTracks: {}, morphTracks: {} }));
  });

  it("distinguishes fatal rebuild failure from a recoverable error", () => {
    expect(isMmdRuntimeRebuildError(new MmdRuntimeRebuildError(new Error("rebuild"), new Error("restore")))).toBe(true);
    expect(isMmdRuntimeRebuildError(new Error("rebuild"))).toBe(false);
  });

  it("releases owned GPU resources and runtime when leaving a model", () => {
    const texture = new THREE.Texture();
    texture.userData.mmdTextureOwnership = "loader";
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const mesh = new THREE.SkinnedMesh(geometry, material);
    const bone = new THREE.Bone();
    const skeleton = new THREE.Skeleton([bone]);
    mesh.add(bone);
    mesh.bind(skeleton);
    const root = new THREE.Group();
    root.add(mesh);
    new THREE.Scene().add(root);
    const runtime = { dispose: vi.fn() };
    const disposals = [geometry, material, texture, skeleton].map((value) => vi.spyOn(value, "dispose"));
    disposeLoadedModelObject({ root, mesh, runtime, outlineMeshes: [], renderOrderMeshes: [] } as unknown as ThreeMmdModel);
    expect(root.parent).toBeNull();
    expect(runtime.dispose).toHaveBeenCalledOnce();
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});
