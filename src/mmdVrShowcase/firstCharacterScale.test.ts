import { Bone, BoxGeometry, Group, Mesh, Skeleton, SkinnedMesh } from "three";
import { expect, it } from "vitest";
import { firstCharacterScale } from "./firstCharacterScale";

function rig(bones: [string,number,string?][]) {
  const root = new Group(), mesh = new SkinnedMesh(); root.add(mesh);
  mesh.bind(new Skeleton(bones.map(([name,y,jp]) => {
    const b = new Bone(); b.name = name; b.position.y = y; b.userData.mmdBoneName = jp; mesh.add(b); return b;
  })));
  return root;
}

it("fits a conventional 15–20 MMD-unit character using eye-to-ankle height despite huge hair and head accessories", () => {
  const root = rig([["Eye_L",18],["右目",18],["head",16],["Ankle_L",2],["ignored",2,"右足首"],["HeadRibbon",60]]);
  const hair = new Mesh(new BoxGeometry(1,190,1)); root.add(hair);
  root.position.y = -3;
  expect(firstCharacterScale(root)).toBe(.1);
});
it("keeps authored metre-sized humanoids and tall FX without a matching anatomical pair at their original scale", () => {
  expect(firstCharacterScale(rig([["Head",1.65],["leftFoot",.05]]))).toBeUndefined();
  expect(firstCharacterScale(rig([["HeadLight",25],["FootIK",1]]))).toBeUndefined();
  expect(firstCharacterScale(rig([["head",20]]))).toBeUndefined();
});
it("can use the original Japanese head and ankle names when mesh geometry and English labels are unhelpful", () => {
  expect(firstCharacterScale(rig([["bone1",18,"頭"],["bone2",2,"左足首"]]))).toBe(.1);
});
