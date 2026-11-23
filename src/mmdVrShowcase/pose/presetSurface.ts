import { Matrix4, type Bone, type SkinnedMesh } from 'three';

export type Region = 'trunk' | `${'left'|'right'}${'Leg'|'Foot'|'Arm'|'Hand'}`;
const regionsOfBody:Region[]=['trunk','leftLeg','rightLeg','leftFoot','rightFoot','leftArm','rightArm','leftHand','rightHand'];
/** Work only on a deliberate preset press. Measure the skin on the isolated
 * posing rig, including split draw geometry and append-driven deform bones.
 * A dangling skirt/hair IK helper is not a load-bearing limb. */
export function createPresetSurface(source: SkinnedMesh, rig: SkinnedMesh, regions: Map<Bone, Region>) {
  const { bones, boneInverses } = rig.skeleton;
  function region(b: Bone) {
    const grant = b.userData.mmdAppendTransform?.parentIndex;
    if (regions.has(b)) return regions.get(b);
    if (regions.has(bones[grant])) return regions.get(bones[grant]);
    for (let p = b.parent as Bone; p?.isBone; p = p.parent as Bone) {
      const part = regions.get(p) ?? regions.get(bones[p.userData.mmdAppendTransform?.parentIndex]);
      if (part?.endsWith('Hand') || part?.endsWith('Foot')) return part; // digits
      if (part) break;
    }
  }
  const groups = bones.map(region);
  const bodies: SkinnedMesh[] = source.userData.mmdMorphSplitBodyMeshes?.length ? source.userData.mmdMorphSplitBodyMeshes : [source];
  const matrix = new Matrix4();
  const surfaces = bodies.flatMap(body => {
    const { position:p, skinIndex:ix, skinWeight:w } = body.geometry.attributes;
    if (body.skeleton !== source.skeleton || !p || ix?.itemSize !== 4 || w?.itemSize !== 4 || ix.count !== p.count || w.count !== p.count) return [];
    const bins=Object.fromEntries(regionsOfBody.map(r=>[r,[] as number[]])) as Record<Region,number[]>;
    for (let i=0;i<p.count;i++) {
      let max=0, main=-1;
      for(let j=0;j<4;j++) { const weight=w.getComponent(i,j); if (weight>max) { max=weight; main=ix.getComponent(i,j); } }
      const part=groups[main]; if(part)bins[part].push(i);
    }
    const bins32=regionsOfBody.map(part=>({part,vertices:Uint32Array.from(bins[part])}));
    return [{body,p,ix,w,bins32,rows:new Float64Array(bones.length*4)}];
  });
  return () => {
    rig.updateWorldMatrix(true,true);
    const minimum=Object.fromEntries(regionsOfBody.map(r=>[r,Infinity])) as Record<Region,number>;
    for(const {body,p,ix,w,bins32,rows} of surfaces) {
      for(let k=0;k<bones.length;k++) {
        const e=matrix.multiplyMatrices(bones[k].matrixWorld,boneInverses[k]).multiply(body.bindMatrix).elements;
        rows[4*k]=e[1]; rows[4*k+1]=e[5]; rows[4*k+2]=e[9]; rows[4*k+3]=e[13];
      }
      for(const {part,vertices} of bins32) {
        let low=minimum[part];
        for(const i of vertices) {
          const x=p.getX(i),y=p.getY(i),z=p.getZ(i); let height=0;
          for(let j=0;j<4;j++) { const weight=w.getComponent(i,j); if(!weight)continue; const k=4*ix.getComponent(i,j);
            height+=weight*(rows[k]*x+rows[k+1]*y+rows[k+2]*z+rows[k+3]); }
          low=Math.min(low,height);
        }
        minimum[part]=low;
      }
    }
    return minimum;
  };
}
