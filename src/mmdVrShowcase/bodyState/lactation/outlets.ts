import { Triangle, Vector3, type SkinnedMesh } from 'three';
import { visibleTexel } from '../../play/wandOpacity';
import { createWandPose } from '../../play/wandPose';
import type { WandModel } from '../../play/wandSurface';
import { fitOutlets, materialDraws, type Binding, type Draw, type Side } from './outletFit';
import { makeCover, shown, type ClearOutlet } from './outletCover';
import type {OutletState} from './interaction';

export type OutletDetail={state?:OutletState;span?:number};
export type SampleMilkOutlet=(side:Side,position:Vector3,normal:Vector3,trustedBareSkin?:boolean,detail?:OutletDetail)=>boolean;
const unsupported:SampleMilkOutlet=(_s,_p,_n,_bare,detail)=>{if(detail){detail.state='missing';detail.span=undefined;}return false;};

function* build(model:WandModel):Generator<void,SampleMilkOutlet>{
  const source=model.mesh,split:SkinnedMesh[]|undefined=source.userData.mmdMorphSplitBodyMeshes;
  if(!source.morphTargetDictionary||split&&(!Array.isArray(split)||source.geometry.drawRange.count!==0||model.renderOrderMeshes.length!==0))return unsupported;
  const parts:{mesh:SkinnedMesh;draws:Draw[]}[]=[],sides=['left','right'] as const;
  const anchors:Partial<Record<Side,{mesh:SkinnedMesh;b:Binding}|null>>={};let vertices=0,indices=0,morphValues=0;
  // For split PMX the source mesh owns weights but draws no triangles. The
  // skin AND every possible cover have independent indices and morph maps.
  for(const mesh of split??[source]){
    const g=mesh.geometry,p=g?.attributes.position;
    if(!p||(vertices+=p.count)>200_000||(indices+=g.index?.count??p.count)>1_200_000||
      (morphValues+=(g.morphAttributes.position?.length??0)*p.count)>32_000_000)return unsupported;
    const draws=materialDraws(mesh===source?model:{root:model.root,mesh,renderOrderMeshes:[]});if(!draws?.length)return unsupported;
    const binds=yield* fitOutlets(mesh,draws,source);
    for(const side of sides){const b=binds?.[side];if(b)anchors[side]=side in anchors?null:{mesh,b};}
    parts.push({mesh,draws});
  }
  if(!anchors.left&&!anchors.right)return unsupported;
  const covers=new Map<SkinnedMesh,{clear:ClearOutlet;draws:Draw[];pose:ReturnType<typeof createWandPose>}>();
  for(const {mesh,draws} of parts){const pose=createWandPose(mesh,source),clear=yield* makeCover(mesh,draws,pose);if(!clear)return unsupported;covers.set(mesh,{clear,draws,pose});}
  const tri=new Triangle(),point=new Vector3(),axis=new Vector3(),a=new Vector3(),c=new Vector3(),work={faces:0};
  return (side,position,normal,trustedBareSkin=false,detail)=>{
    const anchor=anchors[side];if(!anchor)return unsupported(side,position,normal,trustedBareSkin,detail);
    if(detail){detail.state='blocked';detail.span=undefined;}
    const {mesh,b}=anchor,g=mesh.geometry,{pose}=covers.get(mesh)!;
    if(!shown(b.draw)||b.draw.material.opacity<b.draw.material.alphaTest)return false;
    pose.begin();pose.vertex(b.ids[0],tri.a);pose.vertex(b.ids[1],tri.b);pose.vertex(b.ids[2],tri.c);
    const scale=mesh.matrixWorld.getMaxScaleOnAxis();if(!(scale>0&&tri.getArea()>(b.span*scale)**2*1e-12))return false;
    point.copy(tri.a).multiplyScalar(b.bary.x).addScaledVector(tri.b,b.bary.y).addScaledVector(tri.c,b.bary.z);
    axis.set(0,0,0);
    for(let i=0;i<b.boundary.length;i+=2){pose.vertex(b.boundary[i],a).sub(point);pose.vertex(b.boundary[i+1],c).sub(point);axis.add(a.cross(c));}
    if(!(axis.lengthSq()>1e-20*(b.span*scale)**4))return false;
    axis.normalize().multiplyScalar(b.sign);
    if(!Number.isFinite(point.lengthSq()+axis.lengthSq())||!visibleTexel(b.draw.material,g,b.face,tri,point))return false;
    work.faces=0;
    for(const cover of covers.values()){if(!cover.draws.some(shown))continue;if(cover.pose!==pose)cover.pose.begin();if(!cover.clear(b,point,axis,scale,work))return false;}
    if(!trustedBareSkin&&b.bareOnly){if(detail)detail.state='confirm';return false;}
    if(detail){detail.state='ready';detail.span=b.span*scale;}
    position.copy(point);normal.copy(axis);return true;
  };
}

// A failed optional calibration must not retire an otherwise playable PMX.
// Retire the faulty sampler for this instance instead of throwing every frame.
function* prepare(model:WandModel):Generator<void,SampleMilkOutlet>{
  try{const sample=yield* build(model);if(sample===unsupported)return sample;
    let failed=false;return (side,position,normal,trusted,detail)=>{
      if(!failed)try{return sample(side,position,normal,trusted,detail);}catch{failed=true;}
      return unsupported(side,position,normal,trusted,detail);
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
