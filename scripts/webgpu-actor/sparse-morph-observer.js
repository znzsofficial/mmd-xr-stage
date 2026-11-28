// Imported by the browser fixture through Vite, so these functions see the
// exact loader instance that owns the stage mesh (not a second module copy).
import { computeMmdTslSparsePositionMorphs, invalidateMmdTslSparseMorphOutputs } from '@yohawing/three-mmd-loader/webgpu';
import { invalidateDraws } from '../../src/mmdVrShowcase/wardrobe/draws';
export { invalidateMmdTslSparseMorphOutputs };

export function fullReference(gl, mesh) {
  invalidateMmdTslSparseMorphOutputs(mesh);
  if (!computeMmdTslSparsePositionMorphs(gl,mesh,true)) throw Error('Missing unconditional sparse reference');
}

// Read the actual post-TSL, color-converted layers, then redraw the *same*
// frozen pose/camera with both actors' bases unconditionally recomputed. Omit
// each actor in turn to locate its visible pixels independently in each eye.
export function installPortrait(primaryId) {
  const {gl,scene,camera}=gameTargets.floorState(), pictures=new Map(), counts=new Map();
  const native=gl.compute, meshes=[];
  scene.traverse(o=>{if(o.isSkinnedMesh&&o.userData.mmdTslSparsePositionMorphs)meshes.push(o);});
  const primary=meshes.find(m=>m.userData.mmdModelId===primaryId);
  const other=meshes.find(m=>m!==primary);
  if(meshes.length!==2||!primary||!other)throw Error('Expected two mounted sparse actors');
  const at=mesh=>{const b=mesh.skeleton.bones.find(b=>(b.userData.mmdBoneName??b.name)==='頭');
    return gl.xr.getCamera().parent.worldToLocal(b.getWorldPosition(mesh.position.clone()));};
  const p=at(primary), q=at(other), distance=Math.max(.75, Math.abs(p.x-q.x)*1.05);
  const view={x:(p.x+q.x)/2,y:(p.y+q.y)/2-.035,z:Math.max(p.z,q.z)+distance};
  const owners=new Map();let reference=null;
  gl.compute=function(group,...rest){
    const first=Array.isArray(group)?group[0]:group;
    if(reference)owners.set(first,reference);
    else if(first.name?.startsWith('MMD sparse morph: ')){
      const mesh=owners.get(first);counts.set(mesh,(counts.get(mesh)??0)+1);
    }
    return native.call(this,group,...rest);
  };
  const delta=(a,b,i)=>Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
  async function capture(label){
    const cfg=labFixture,old=cfg.headX;cfg.headX=view.x;let timer;
    try {
      const [candidate,baseline,hiddenA,hiddenB]=await new Promise((ok,no)=>{
        timer=setTimeout(()=>no(Error('No tracked portrait: '+label)),20000);
        let n=0;
        cfg.take={eyeY:view.y,eyeZ:view.z,inputs(){this.time=performance.now();invalidateDraws(primary);},afterDraw(session){
          if(++n!==3)return;cfg.take=null;
          try{
            const draws=[session.copyEyes()];
            for(const mesh of meshes){reference=mesh;fullReference(gl,mesh);}reference=null;
            gl.render(scene,camera);draws.push(session.copyEyes());
            for(const mesh of [primary,other]){
              mesh.visible=false;
              try {gl.render(scene,camera);draws.push(session.copyEyes());}finally{mesh.visible=true;}
            }
            gl.render(scene,camera);
            ok(Promise.all(draws));
          }catch(e){no(e);}
        }};
      });
      const start=pictures.get('zero')??candidate;
      const eyes=candidate.map((im,e)=>{
        const a=im.data,b=baseline[e].data,others=[hiddenA[e].data,hiddenB[e].data];
        const visible=[0,0],changed=[0,0],residual=[0,0];
        for(let i=0;i<a.length;i+=4)for(let actor=0;actor<2;actor++){
          if(delta(b,others[actor],i)<=12)continue;
          visible[actor]++;if(delta(a,start[e].data,i)>5)changed[actor]++;
          if(delta(a,b,i))residual[actor]++;
        }
        return {visible,changed,residual};
      });
      if(label==='zero')pictures.set(label,candidate);
      const calls=[counts.get(primary)??0,counts.get(other)??0];counts.clear();
      const w=primary.morphTargetInfluences,dict=primary.morphTargetDictionary;
      return {eyes,calls,weights:[w[dict['まばたき']],w[dict.SparseUv]]};
    } finally {reference=null;cfg.take=null;cfg.headX=old;clearTimeout(timer);}
  }
  window.sparsePortrait={capture,dispose(){gl.compute=native;delete window.sparsePortrait;}};
}
