import {BufferAttribute,BufferGeometry,Matrix4,SkinnedMesh,Vector3} from 'three';
import {authoredSurface,type AuthoredSurface} from '../play/authoredSurface';
import {createWandPose,type PositionDeltas} from '../play/wandPose';
import {fitPoseSkirt} from './poseSkirtClearance';

/** CPU work surface for the ordinary pose fit. No scene object, new skeleton,
 * evaluator or draw; only position is writable. Bone edits unwind on the
 * real rig through the same restore/clear calls as the WebGL display layer. */
export function fitSparsePoseSkirt(mesh:SkinnedMesh,source:AuthoredSurface){
  const g=mesh.geometry,base=source.position;
  if(!(base instanceof BufferAttribute)||base.itemSize!==3||!(base.array instanceof Float32Array)||
    base.count!==g.attributes.position.count||base.count>650000||!g.index||!g.morphTargetsRelative||
    mesh.userData.mmdMorphSplitBodyMeshes?.length)return null;
  const position=base.clone(),geometry=new BufferGeometry();
  geometry.setIndex(g.index);geometry.attributes={...g.attributes,position};geometry.morphTargetsRelative=true;
  const materials=[mesh.material].flat();
  for(const group of g.groups){const mat=materials[group.materialIndex??0];
    if(mat&&!mat.userData.mmdTslOutlineMaterial&&!mat.userData.mmdShadowOnlyRenderProxy)
      geometry.addGroup(group.start,group.count,group.materialIndex);
  }
  const view=new SkinnedMesh(geometry,mesh.material);
  view.skeleton=mesh.skeleton;view.matrixWorld=mesh.matrixWorld;
  view.bindMatrix=mesh.bindMatrix;view.bindMatrixInverse=mesh.bindMatrixInverse;
  view.userData.mmdPhysics=mesh.userData.mmdPhysics;
  // Keep detached morph metadata out of the render geometry. The fit guards
  // the actual subset of garment/leg indices, so a face channel can stay on.
  const morphs=source.morphs;
  authoredSurface.set(view,{position,uv:source.uv,morphs,sampleable:source.sampleable});
  const channels:{attr:PositionDeltas;weight:number}[]=[],delta=new Vector3(),inverse=new Matrix4();
  let special:ReturnType<typeof createWandPose>|undefined;
  const {matricesSdefEnabled:sdef,matricesQdefEnabled:qdef}=geometry.attributes;
  view.getVertexPosition=(i,out)=>{
    if(sdef?.getX(i)||qdef?.getX(i)){
      // Raised panels can change bones in the middle of a fit pass.
      special??=createWandPose(view,mesh,morphs,position);
      special.begin();return special.vertex(i,out).applyMatrix4(inverse);
    }
    out.fromBufferAttribute(position,i);
    for(const {attr,weight} of channels)out.addScaledVector(delta.set(attr.getX(i),attr.getY(i),attr.getZ(i)),weight);
    return view.applyBoneTransform(i,out);
  };
  function sync(){
    inverse.copy(mesh.matrixWorld).invert();view.morphTargetInfluences=mesh.morphTargetInfluences;
    channels.length=0;
    for(let i=0;i<morphs.length;i++){const weight=mesh.morphTargetInfluences?.[i],attr=morphs[i];
      if(weight&&attr)channels.push({attr,weight});}
  }
  sync();const fit=fitPoseSkirt(view);if(!fit)return null;
  return {...fit,seed(){sync();fit.seed();},present(){sync();fit.present();},
    get hasField(){return fit.hasField;},get version(){return position.version;}};
}
