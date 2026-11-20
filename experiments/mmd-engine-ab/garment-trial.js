import {Vector3,Matrix} from '@babylonjs/core/Maths/math.vector';
import {loadContactRig} from './contact-rig';

// Optional local authoring probe for real PMX skirts. An identical no-hand
// replay controls for the solver's own movement after pausing the dance.
export async function garmentTrial(scene,pmx,files,vmd){
  const dt=1/60,logs=[],m=new Matrix(),p=new Vector3();let path=null,probes=null;
  for(const touch of [false,true]){
    const rig=await loadContactRig(scene,pmx,files,vmd);
    try{await rig.play();for(let i=0;i<90;i++)rig.step(dt);rig.pause();for(let i=0;i<120;i++)rig.step(dt);
      const {scale,meta,model,pos}=rig,wi=model.runtimeBones.findIndex(b=>/^(右手首|rightwrist|righthand)$/i.test(b.name));if(wi<0||!vmd)throw Error('本项需要有腕骨的角色和身体动作');
      const mats=()=>model.worldTransformMatrices,wrist=()=>Array.from(mats().slice(wi*16,wi*16+16));
      const inds=new Set(),bodies=[];for(const b of meta.rigidBodies){if(!b.physicsMode||b.boneIndex<0||!/スカート|裙|skirt/i.test(b.name+' '+meta.bones[b.boneIndex]?.name))continue;
        inds.add(b.boneIndex);const off=Vector3.FromArray(b.shapePosition);Vector3.TransformCoordinatesToRef(off,meta.skeleton.bones[b.boneIndex].getAbsoluteInverseBindMatrix(),off);
        Matrix.FromArrayToRef(mats(),b.boneIndex*16,m);const center=Vector3.TransformCoordinates(off,m).scaleInPlace(scale).addInPlace(pos);bodies.push(center);}
      if(!bodies.length)throw Error('本项需要可识别的裙摆动态刚体');
      if(!path){const min=Math.min(...bodies.map(b=>b.y));const front=bodies.filter(b=>b.y<min+.16).sort((a,b)=>a.z-b.z)[0];path=front.clone();probes=[];
        for(const [meshIndex,mesh] of meta.meshes.entries()){const a=mesh.getPositionData(true,true),bones=mesh.getVerticesData('matricesIndices'),w=mesh.getVerticesData('matricesWeights');if(!bones||!w||!a)continue;
          for(let i=0;i<a.length/3;i++){if(![0,1,2,3].some(j=>w[i*4+j]>.05&&inds.has(bones[i*4+j])))continue;
            Vector3.FromArrayToRef(a,i*3,p);p.scaleInPlace(scale).addInPlace(pos);const d=Vector3.DistanceSquared(p,path);if(d<.16**2)probes.push({meshIndex,i,d});}}
        probes.sort((a,b)=>a.d-b.d);probes=probes.slice(0,24);if(probes.length<3)throw Error('附近缺少裙摆蒙皮顶点');}
      const vertices=()=>{const cache=new Map();return probes.map(({meshIndex,i})=>{let a=cache.get(meshIndex);if(!a){a=meta.meshes[meshIndex].getPositionData(true,true);cache.set(meshIndex,a)}return Vector3.FromArray(a,3*i).scaleInPlace(scale)})};
      const frame=rig.frame,arm=wrist(),base=vertices(),samples=[];let armed=0;
      const stroke=(n,a,b)=>{for(let i=1;i<=n;i++){Vector3.LerpToRef(a,b,i/n,p);armed+=Number(rig.contact('right',touch?p:null,dt));rig.step(dt)}samples.push(vertices())};
      const far=path.add(new Vector3(0,-.15,-.55)),under=path.add(new Vector3(0,-.13,-.025)),up=path.add(new Vector3(0,.06,-.025)),side=up.add(new Vector3(.11,0,0));
      stroke(6,far,far);stroke(50,far,under);stroke(30,under,up);stroke(22,up,side);stroke(50,side,far);
      rig.contact('right',null,dt);for(let i=0;i<180;i++)rig.step(dt);samples.push(vertices());
      const drift=Math.max(...wrist().map((v,i)=>Math.abs(v-arm[i])));if(frame!==rig.frame||drift>1e-5||touch&&!armed)throw Error('动作未保持暂停或输入未生效');logs.push({base,samples,drift});
    }finally{rig.dispose()}
  }
  const [a,b]=logs;const stages=b.samples.map((row,k)=>Math.max(...row.map((v,i)=>v.subtract(b.base[i]).subtractInPlace(a.samples[k][i].subtract(a.base[i])).length()*100)));
  if(stages.some(n=>!Number.isFinite(n)))throw Error('非有限姿态');return {sampledVertices:probes.length,unit:'cm; maximum touch-minus-control displacement',raiseCm:stages[2],sideCm:stages[3],after3sCm:stages[5],armMatrixDrift:Math.max(a.drift,b.drift)};
}
