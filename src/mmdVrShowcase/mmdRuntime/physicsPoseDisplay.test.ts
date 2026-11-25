import { Bone, Group, Vector3 } from "three";
import { expect, it } from "vitest";
import { PhysicsPoseDisplay } from "./physicsPoseDisplay";
import type { MmdPhysicsRigidBody } from "@yohawing/three-mmd-loader/physics";

const body = (boneIndex: number, motionType: MmdPhysicsRigidBody["motionType"] = "dynamic"): MmdPhysicsRigidBody => ({
  index: boneIndex, boneIndex, motionType, shape: { type: "sphere", size: [1, 0, 0] },
});

it("reduces visible fine motion without feeding the shown pose back into the next evaluation", () => {
  const scene = new Group(), bone = new Bone(); scene.add(bone); bone.position.y = 1;
  const display = new PhysicsPoseDisplay(), bodies = [body(0)];
  const step = (x: number, seek = false) => {
    display.restore(seek); bone.position.x = x; bone.rotation.z = x;
    scene.updateMatrixWorld(true); const rawRotation = bone.quaternion.clone();
    display.record([0], 1, bodies); display.present([bone], 1/72);
    const shown = bone.position.x, rotation = bone.rotation.z;
    display.restore(); expect(bone.position.x).toBe(x); expect(bone.quaternion.equals(rawRotation)).toBe(true);
    return { shown, rotation };
  };
  step(0);
  for (let i = 0; i < 60; ++i) {
    const { shown, rotation } = step(i%2 ? -.01 : .01);
    expect(Math.abs(shown)).toBeLessThan(.004); expect(Math.abs(rotation)).toBeLessThan(.004);
  }
  expect(step(.5).shown).toBeCloseTo(.5, 10);
  expect(step(.51, true).shown).toBeCloseTo(.51, 10);
});

it("preserves coherent targets across a non-physics ancestor, and never translates rotation-only bones", () => {
  const root = new Group(), a = new Bone(), helper = new Bone(), b = new Bone(), tip = new Bone();
  root.add(a); a.add(helper); helper.add(b); b.add(tip);
  for (const bone of [a, helper, b, tip]) bone.position.y = 1;
  const bones = [a, helper, b, tip], display = new PhysicsPoseDisplay();
  const bodies = [body(0), body(2, "dynamicWithBone"), body(3)];
  const frame = () => { root.updateMatrixWorld(true); display.record([3,2,0], 3, bodies); display.present(bones, 1/72); root.updateMatrixWorld(true); };
  frame(); display.restore(); a.rotation.z = .04; b.position.x = .2; tip.position.x = -.2;
  root.updateMatrixWorld(true); const original = tip.getWorldPosition(new Vector3());
  frame(); expect(b.position.x).toBe(.2); expect(helper.position.y).toBe(1);
  const shown = tip.getWorldPosition(new Vector3());
  expect(Math.abs(shown.x)).toBeLessThan(Math.abs(original.x));
  // A disabled/toggled bone must not reuse stale history when it next appears.
  display.restore(); root.updateMatrixWorld(true); display.record([],0,bodies); display.present(bones,1/72);
  display.restore(); frame(); expect(tip.getWorldPosition(new Vector3()).distanceTo(original)).toBeLessThan(1e-8);
});

it('lets the standing skirt settle, follows a gradual pull, and retires its held position on a seek or pose edit',()=>{
  const root=new Group(),skirt=new Bone(),ribbon=new Bone();skirt.name='スカート';root.add(skirt,ribbon);
  const bones=[skirt,ribbon],bodies=[body(0),body(1)],display=new PhysicsPoseDisplay();
  const step=(x:number,standing=true,seek=false)=>{
    display.restore(seek);for(const b of bones){b.position.set(x,1,0);b.rotation.z=x;}
    root.updateMatrixWorld(true);display.record([0,1],2,bodies);display.present(bones,1/72,standing);
    return bones.map(b=>b.position.x);
  };
  step(0);for(let i=0;i<100;i++){
    const [hem,other]=step(i%2?.012:-.012);expect(hem).toBe(0);expect(Math.abs(other)).toBeGreaterThan(0);
  }
  for(let i=1;i<=60;i++)step(i*.003);
  expect(skirt.position.x).toBeGreaterThan(.11); // slow cumulative movement must also wake it
  step(.5);expect(Math.abs(skirt.position.x-ribbon.position.x)).toBeLessThan(.051);
  step(.006,true,true);expect(skirt.position.x).toBeCloseTo(.006,10);
  const [hem,reference]=step(.01,false);expect(hem).toBeCloseTo(reference,10);
  display.restore();expect(skirt.position.x).toBe(.01);expect(skirt.rotation.z).toBeCloseTo(.01,10);
});
