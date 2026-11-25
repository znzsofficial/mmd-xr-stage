import {MeshDepthMaterial,RGBADepthPacking,type Object3D,type SkinnedMesh} from 'three';
import {useRigSpaceSkinning} from './rigSpaceSkinning';
import {shareMorphGeometry} from './shareMorphGeometry';

/** Animated MMD bounds can be stale after morphs, causing incorrect per-eye culling in VR. */
export function prepareMmdVrModel(root: Object3D,options?:{shareMorphGeometry?:boolean}) {
  if(options?.shareMorphGeometry!==false)shareMorphGeometry(root);
  root.traverse((object) => {
    object.frustumCulled = false;
    const mesh=object as SkinnedMesh,g=mesh.geometry;
    if(mesh.isSkinnedMesh&&(g.attributes.matricesSdefEnabled||g.attributes.matricesQdefEnabled)){
      // Stage enables cast-only directional shadows even for source materials
      // without an authored depth material. The renderer default uses LBS.
      if(!mesh.userData.mmdOutlineProxy&&!mesh.customDepthMaterial)mesh.customDepthMaterial=new MeshDepthMaterial({depthPacking:RGBADepthPacking});
      for(const m of [...[mesh.material].flat(),mesh.customDepthMaterial,mesh.customDistanceMaterial])if(m)useRigSpaceSkinning(m);
    }
  });
}
