import { Triangle, Vector3 } from 'three';
import { visibleTexel } from '../../play/wandOpacity';
import { createWandPose } from '../../play/wandPose';
import type { WandModel } from '../../play/wandSurface';
import { fitOutlets, materialDraws, type Side } from './outletFit';
import { makeCover, shown } from './outletCover';

export type SampleMilkOutlet=(side:Side,position:Vector3,normal:Vector3,trustedBareSkin?:boolean)=>boolean;
const unsupported:SampleMilkOutlet=()=>false;

function* build(model:WandModel):Generator<void,SampleMilkOutlet>{
  const mesh=model.mesh,g=mesh.geometry,dict=mesh.morphTargetDictionary;
  if(!dict||!Object.keys(dict).length||!g?.attributes.position||mesh.userData.mmdMorphSplitBodyMeshes||g.attributes.position.count>200_000||
    (g.index?.count??g.attributes.position.count)>1_200_000)return unsupported;
  const draws=materialDraws(model);if(!draws)return unsupported;
  const binds=yield* fitOutlets(mesh,draws);if(!binds||(!binds.left&&!binds.right))return unsupported;
  const pose=createWandPose(mesh,mesh),clear=yield* makeCover(mesh,draws,pose);if(!clear)return unsupported;
  const tri=new Triangle(),point=new Vector3(),axis=new Vector3(),a=new Vector3(),c=new Vector3();
  return (side,position,normal,trustedBareSkin=false)=>{
    const b=binds[side];if(!b||(!trustedBareSkin&&b.bareOnly)||!shown(b.draw)||b.draw.material.opacity<b.draw.material.alphaTest)return false;
    pose.begin();pose.vertex(b.ids[0],tri.a);pose.vertex(b.ids[1],tri.b);pose.vertex(b.ids[2],tri.c);
    const scale=mesh.matrixWorld.getMaxScaleOnAxis();if(!(scale>0&&tri.getArea()>(b.span*scale)**2*1e-12))return false;
    point.copy(tri.a).multiplyScalar(b.bary.x).addScaledVector(tri.b,b.bary.y).addScaledVector(tri.c,b.bary.z);
    axis.set(0,0,0);
    for(let i=0;i<b.boundary.length;i+=2){pose.vertex(b.boundary[i],a).sub(point);pose.vertex(b.boundary[i+1],c).sub(point);axis.add(a.cross(c));}
    if(!(axis.lengthSq()>1e-20*(b.span*scale)**4))return false;
    axis.normalize().multiplyScalar(b.sign);
    if(!Number.isFinite(point.lengthSq()+axis.lengthSq())||!visibleTexel(b.draw.material,g,b.face,tri,point)||!clear(b,point,axis,scale))return false;
    position.copy(point);normal.copy(axis);return true;
  };
}

// A failed optional calibration must not retire an otherwise playable PMX.
// Retire the faulty sampler for this instance instead of throwing every frame.
function* prepare(model:WandModel):Generator<void,SampleMilkOutlet>{
  try{const sample=yield* build(model);if(sample===unsupported)return sample;
    let failed=false;return (side,position,normal,trusted)=>{
      if(failed)return false;
      try{return sample(side,position,normal,trusted);}catch{failed=true;return false;}
    };
  }catch{return unsupported;}
}

/** For deterministic probes/fixtures. The runtime prepares in bounded slices
 * before publishing the entry so the FIRST button need not wait for fitting. */
export function createMilkOutlets(model:WandModel):SampleMilkOutlet{
  const build=prepare(model);for(;;){const step=build.next();if(step.done)return step.value;}
}
export async function prepareMilkOutlets(model:WandModel,stale:()=>boolean):Promise<SampleMilkOutlet>{
  const build=prepare(model);
  for(;;){const deadline=performance.now()+4;
    do{const step=build.next();if(step.done)return step.value;}while(performance.now()<deadline);
    await new Promise<void>(resolve=>setTimeout(resolve,0));if(stale())return unsupported;
  }
}
