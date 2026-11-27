import {Ray,Triangle,Vector3} from 'three';
import {createWandPose} from '../../src/mmdVrShowcase/play/wandPose';
import {visibleTexel} from '../../src/mmdVrShowcase/play/wandOpacity';

// A horizontal ray through the frozen outfit is independent of the wand's
// ellipsoid and its rolling cluster search. Only the controller moves to it.
export function wandTakeSite(mesh,source){
  const skin=createWandPose(mesh,mesh,source.morphs,source.position);
  function bone(re){
    const b=mesh.skeleton.bones.find(b=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n=>typeof n==='string'&&re.test(n)));
    if(!b)throw Error('Expected MMD reference bone '+re);return b.getWorldPosition(new Vector3());
  }
  const waist=bone(/^(下半身|hips?|pelvis|lower body)$/i).lerp(bone(/^(首|neck)$/i),.35);
  const eye=bone(/^(左目|left[ _]?eye|eye[ _.]?l)$/i).lerp(bone(/^(右目|right[ _]?eye|eye[ _.]?r)$/i),.5);
  const ray=new Ray(waist.add(new Vector3(0,0,2)),new Vector3(0,0,-1)),tri=new Triangle(),point=new Vector3(),ids=[0,0,0];
  const g=mesh.geometry,site=new Vector3(0,0,-Infinity);
  skin.begin();
  for(const group of g.groups){
    const mat=[mesh.material].flat()[group.materialIndex??0];
    if(!mat?.visible||!mat.colorWrite||mat.opacity<=0||mat.userData.mmdTslOutlineMaterial)continue;
    for(let j=group.start;j<group.start+group.count;j+=3){
      for(let k=0;k<3;k++)ids[k]=g.index?.getX(j+k)??j+k;
      skin.vertex(ids[0],tri.a);skin.vertex(ids[1],tri.b);skin.vertex(ids[2],tri.c);
      if(ray.intersectTriangle(tri.a,tri.b,tri.c,false,point)&&point.z>site.z&&source.sampleable(ids,mat)&&visibleTexel(mat,g,j,tri,point,source.uv))site.copy(point);
    }
  }
  if(!Number.isFinite(site.z))throw Error('No visible outfit triangle at the waist ray');
  return {site,eye};
}
