import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { CcdIkSolver, type CcdIkBone, type CcdIkChain, type MutableQuatTuple, type Vec3Tuple } from "@yohawing/three-mmd-loader/runtime";

// Golden outputs match both published 0.8.6 and 0.9.0 full-skeleton solvers. Exercise the
// public API: all rotations, iteration counts and goal distances on every tick.
function motionDigest(permuted: boolean) {
  const solver = new CcdIkSolver();
  const parents = [-1,0,1,2,0,1,5,0,0,8,9];
  const offsets: Vec3Tuple[] = [[0,0,0],[0,.9,0],[0,-.45,.02],[0,-.45,-.02],[-.12,.12,.18],
    [.18,.32,0],[.26,.03,.02],[.27,1.08,.25],[-1,.1,0],[0,1,0],[0,1,0]];
  const order = permuted ? [4,9,3,0,10,1,8,6,5,2,7] : parents.map((_,i)=>i);
  const id = (i: number) => order.indexOf(i);
  const bones: CcdIkBone[] = order.map(i => ({parentIndex: id(parents[i]), translation: offsets[i]}));
  const chains: CcdIkChain[] = [
    { goalBoneIndex:id(4), effectorBoneIndex:id(3), iterationCount:15, maxAnglePerIteration:.25,
      links:[{boneIndex:id(2), angleLimit:{ minimumAngle:[-1.5,0,0], maximumAngle:[0,0,0] }}, {boneIndex:id(1)}] },
    { goalBoneIndex:id(7), effectorBoneIndex:id(6), iterationCount:12, maxAnglePerIteration:.19,
      links:[{boneIndex:id(5), fixedAxis:[0,1,0]}, {boneIndex:id(1), angleLimit:{ minimumAngle:[-.5,-.8,-.4], maximumAngle:[.5,.8,.4] }}] },
  ];
  const all = solver.prepareChains(chains, bones);
  const active = [...all]; // same array, different contents (VMD IK state changes)
  const hash = createHash("sha256");
  for (const f of [0,1,5,12,12,29,30,48,1,0,25,7]) {
    active.splice(0, active.length, ...(f === 12 ? [] : f === 29 ? [all[1]] : f === 30 ? [all[0]] : all));
    bones[id(4)] = {parentIndex:id(f === 48 ? 8 : 0), translation:[-.12 + f*.003,.12,.18]};
    const rotations: MutableQuatTuple[] = order.map(i => [0,0,Math.sin((f+i)*.007),Math.cos((f+i)*.007)]);
    const result = solver.solvePrepared({ bones, pose:{rotations}, chains:active });
    const row = [...parents.flatMap((_,i)=>rotations[id(i)]), result.iterationCount, ...result.finalDistances];
    hash.update(JSON.stringify(row.map(v => Math.round(v*1e8))));
  }
  return hash.digest("hex");
}

it.each([false,true])("matches upstream poses with overlapping IK, animated targets and chain toggles (permuted=%s)", permuted => {
  expect(motionDigest(permuted)).toBe("86055fa20daf4fe7d4c5842ccbb8bbd4de916f52bb826d102ccf3d09cc7dd650");
});
