import * as THREE from 'three';
import {ThreeMmdLoader} from '@yohawing/three-mmd-loader';
import {createMmdRuntimeHandle} from '../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts';
import {prepareMmdVrModel} from '../src/mmdVrShowcase/stage/loading/prepareMmdVrModel.ts';
import {clothSmokeFixture} from './cloth-smoke-fixture.js';

async function run(files){
  const model=files.find(f=>/\.pmx$/i.test(f.name));if(!model)throw Error('Select a PMX.');
  const bytes=new Uint8Array(await clothSmokeFixture().vmd.arrayBuffer());
  for(const off of [54,165]){bytes.fill(0,off,off+15);bytes.set([0x83,0x5a,0x83,0x93,0x83,0x5e,0x81,0x5b],off);}new DataView(bytes.buffer).setFloat32(184,1.5,true);
  // Keep the centre moving throughout every sample without adding loop/seek spikes.
  new DataView(bytes.buffer).setUint32(180,420,true);
  const motion=new File([bytes],'centre.vmd'),cms=ThreeMmdLoader.prototype.loadModel,stats=[],dt=1/72,warm=240,n=720;
  for(const mode of ['full','off','no-skirt-contacts','no-skirt-joints','no-skirt-joints','no-skirt-contacts','off','full']){
    const camera=new THREE.PerspectiveCamera(),on=mode!=='off',steps=[],elapsed=[],track=[];let sample=false,affected=0,skirtBones=[];
    ThreeMmdLoader.prototype.loadModel=async function(...args){const m=await cms.apply(this,args),raw=m.mesh.userData.mmdPhysics;
      const skirt=raw.rigidBodies.map(b=>b.mode!=='static'&&/スカート|skirt|裙/i.test([b.name,b.englishName,m.mesh.skeleton.bones[b.boneIndex]?.name].join(' ')));
      skirtBones=raw.rigidBodies.flatMap((b,i)=>skirt[i]?[m.mesh.skeleton.bones[b.boneIndex]]:[]).filter(Boolean);
      if(!skirtBones.length)throw Error('No named dynamic skirt bodies');
      if(mode==='no-skirt-contacts'){affected=skirt.filter(Boolean).length;m.mesh.userData.mmdPhysics={...raw,rigidBodies:raw.rigidBodies.map((b,i)=>skirt[i]?{...b,mask:0}:b)};}
      if(mode==='no-skirt-joints'){const joints=raw.joints.filter(j=>!skirt[j.rigidBodyIndexA]&&!skirt[j.rigidBodyIndexB]);affected=raw.joints.length-joints.length;if(!affected)throw Error('No matching skirt joints: '+Object.keys(raw.joints[0]??{}));m.mesh.userData.mmdPhysics={...raw,joints};}
      return m;};
    const rt=createMmdRuntimeHandle(new THREE.Scene(),{prepareModel:prepareMmdVrModel,onBulletStepWork(_f,s,_o,seed){if(sample&&!seed)steps.push(s);}});
    try{const {modelId}=await rt.addModel(model,files,{physics:on,transform:{scale:.1}});await rt.loadMotion(motion,'body',modelId);
      for(let i=0;i<warm+n;i++){sample=i>=warm;const start=performance.now();rt.update(i*dt,on,camera,1,false,dt);if(sample)elapsed.push(performance.now()-start);
        if(sample&&i%24===0){rt.getModelRoot(modelId).updateMatrixWorld(true);for(const b of skirtBones)track.push(...b.matrixWorld.elements.slice(12,15));}}
      if(on&&!steps.length||track.some(v=>!Number.isFinite(v)))throw Error('Incomplete run');
      stats.push({mode,affected,skirtBones:skirtBones.length,meanMs:elapsed.reduce((a,b)=>a+b)/n,p95Ms:elapsed.sort((a,b)=>a-b)[Math.ceil(n*.95)-1],worldMs:on?steps.reduce((a,b)=>a+b)/steps.length:null,track});
    }finally{ThreeMmdLoader.prototype.loadModel=cms;rt.dispose();}
  }
  return stats.map(({track,...r})=>({...r,trajectoryRms:Math.sqrt(track.reduce((s,v,i)=>s+(v-stats[0].track[i])**2,0)/track.length)}));
}
window.measure=()=>run([...document.querySelector('input').files]);document.querySelector('button').onclick=async e=>{e.target.disabled=true;try{document.querySelector('pre').textContent=JSON.stringify(await window.measure(),null,2);}finally{document.querySelector('button').disabled=false;}};
