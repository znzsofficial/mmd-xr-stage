import {Box3,Matrix4,Vector3} from 'three';
import {fitHipSkinDepth} from '../../src/mmdVrShowcase/mmdRuntime/hipSkinDepth';

// A narrow field for the lab's ONE reproducible held posture. Select a material
// that wraps BOTH upper legs in bind space; only the six-ray interior of its
// actual posed skin, nearest a thigh-weighted face, can generate a correction.
export async function bakeHeldThigh(mesh,rig,alive){
  const bones=mesh.skeleton.bones,g=mesh.geometry,mat=[].concat(mesh.material),s=g.attributes.skinIndex,w=g.attributes.skinWeight,p=new Vector3();
  if(g.index.count>650000||g.attributes.position.count>160000||g.groups.length>160)return null;
  const side=bones.map(b=>{const n=[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].join('|').normalize('NFKC');return /(?:^|\|)(左足|left[ _]?(?:thigh|upleg|upperleg))d?(?:$|\|)/i.test(n)?0:/(?:^|\|)(右足|right[ _]?(?:thigh|upleg|upperleg))d?(?:$|\|)/i.test(n)?1:-1;});
  const hips=[side.indexOf(0),side.indexOf(1)];if(hips.includes(-1)||![0,1].every(s=>rig.capsules.some(c=>side[bones.indexOf(c.bone)]===s)))return null;
  const bind=hips.map(i=>new Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert()));
  const spread=bind[0].distanceTo(bind[1]);if(!(spread>0))return null;
  let best=0,winner;
  for(const gr of g.groups){if(!mat[gr.materialIndex]?.visible||mat[gr.materialIndex].opacity<.5||gr.count>8400*3)continue;
    const cover=[new Set(),new Set()],bounds=new Box3(),used=new Set(),hasCloth=new Set();for(const i of new Set(g.index.array.subarray(gr.start,gr.start+gr.count))){
      p.fromBufferAttribute(g.attributes.position,i);const weights=[0,0];for(let k=0;k<4;k++){const bi=s.getComponent(i,k),val=w.getComponent(i,k);if(!val)continue;if(rig.byBone.has(bi))hasCloth.add(bi);if(side[bi]>=0)weights[side[bi]]+=val;used.add(bi);}
      for(const [j,wt] of weights.entries()){if(wt<.5)continue;const o=bind[j],h=(o.y-p.y)/spread;if(h>.05&&h<1.55)cover[j].add(Math.min(2,Math.floor(h/.52))*8+(Math.floor((Math.atan2(p.z-o.z,p.x-o.x)+Math.PI)*4/Math.PI)%8));
        bounds.expandByPoint(mesh.getVertexPosition(i,new Vector3()).multiplyScalar(rig.scale));}}
    const score=Math.min(...cover.map(c=>c.size));if(!hasCloth.size&&score>=16&&score>best){best=score;winner={bounds,used,material:mat[gr.materialIndex]};}}
  if(!winner)return null;
  const used=[...winner.used],saved=used.map(i=>bones[i].matrixWorld.clone());
  // Freeze the skin and palette together. The grid below can be built over
  // multiple tasks even if the player returns to standing or changes actors.
  const field=fitHipSkinDepth(mesh,winner.material,hips,new Matrix4().makeScale(rig.scale,rig.scale,rig.scale));if(!field)return null;
  const box=winner.bounds.expandByScalar(.025),ext=box.getSize(new Vector3()),cell=Math.max(.013,Math.max(...ext.toArray())/44),dims=ext.toArray().map(x=>Math.ceil(x/cell)+3),[nx,ny,nz]=dims;
  const base=box.min.clone().addScalar(-cell),data=new Float32Array(nx*ny*nz*4),val=(x,y,z)=>data[4*(x+nx*(y+ny*z))+3];let interior=0;
  let until=performance.now()+2;for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++){
    if(performance.now()>until){await new Promise(resolve=>setTimeout(resolve,0));if(!alive())return null;until=performance.now()+2;}
    for(let x=1;x<nx-1;x++){p.set(x,y,z).multiplyScalar(cell).add(base);const d=Math.max(field(p,0),field(p,1));if(d>0){data[4*(x+nx*(y+ny*z))+3]=d;interior++;}}}
  if(!interior)return null;
  for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++)for(let x=1;x<nx-1;x++){
    const d=val(x,y,z);if(!d)continue;p.set(val(x-1,y,z)-val(x+1,y,z),val(x,y-1,z)-val(x,y+1,z),val(x,y,z-1)-val(x,y,z+1));if(p.lengthSq()<1e-10)continue;
    p.normalize().multiplyScalar(d).toArray(data,4*(x+nx*(y+ny*z)));}
  return {data,base:base.toArray(),cell,dims,valid(){return used.every((i,j)=>bones[i].matrixWorld.elements.every((x,k)=>Math.abs(x-saved[j].elements[k])<1e-4));}};
}
