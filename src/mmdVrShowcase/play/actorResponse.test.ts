import {DefaultMmdRuntime, ThreeMmdLoader} from '@yohawing/three-mmd-loader';
import {Matrix4} from 'three';
import {expect,it} from 'vitest';
import {createPelvicSolver,pelvicRailMatrix} from '../pelvic/geometry';
import {poseFixture} from '../pose/poseFixture.testSupport';
import {createActorResponse,type ActorContactFrame} from './actorResponse';
import {faceFixture} from './faceFixture.testSupport';
import {faceMorphNames} from './faceMorphs';

it('reads contact at the real rail: two taps, movement, jittering dwell, renewed movement and withdrawal draw different split-face vertices above the evaluated VMD',async()=>{
  const a=faceFixture(), single=faceFixture(undefined,['Blink']),display=createActorResponse(),mono=createActorResponse(),solver=createPelvicSolver();
  const rt=new DefaultMmdRuntime({physics:'none'}),clip=(await new ThreeMmdLoader().loadAnimation(poseFixture().vmd)).animation;
  rt.setAnimation({...clip,morphTracks:{Blink:clip.morphTracks.Gesture}},a.mesh);
  const dt=1/90, f={world:new Matrix4(),inverse:new Matrix4(),scale:1,radiusM:.024,lengthM:.092};
  let t=.5;rt.evaluate(t,{physics:false});let raw=a.mesh.morphTargetInfluences![0];
  function step(distance:number){
    display.restore();expect(a.mesh.morphTargetInfluences![0]).toBe(raw);expect(a.z(0)).toBeCloseTo(raw*.1,7);
    rt.evaluate(t,{physics:false});raw=a.mesh.morphTargetInfluences![0];expect(raw).toBeCloseTo(.12+(.83-.12)*t/2);
    const c=solver.step(f,pelvicRailMatrix(f,distance),{dt});
    const frame=c.motion?{root:a.root,assetId:'a',runtimeId:'m',token:1,motion:c.motion,depthM:c.depthM,dt}:null;
    display.present(frame,a,undefined);mono.present(frame&&{...frame,root:single.root,assetId:'b'},single,undefined);
  }
  try{
    step(-.015);
    for(let tap=0;tap<2;tap++){
      step(.001);expect(a.z(0)).toBeGreaterThan(.094);expect(a.z(1)).toBe(0);expect(single.z(0)).toBeCloseTo(.095);
      step(-.011);expect(a.z(0)).toBeGreaterThan(.1*raw);expect(a.z(3)).toBeGreaterThan(.015);
      for(let i=0;i<9;i++)step(-.011);expect(a.z(0)).toBeCloseTo(.1*raw);expect(a.z(3)).toBeGreaterThan(.042);
      for(let i=0;i<36;i++)step(-.011);expect(a.z(3)).toBe(0);
    }
    step(.001);
    for(let i=1;i<=40;i++)step(.001+.001*i);
    expect(a.z(0)).toBeCloseTo(.1*raw);expect(a.z(1)).toBeGreaterThan(.073);expect(a.z(2)).toBeLessThan(.001);expect(single.z(0)).toBeGreaterThan(.073);
    // Same valid admission, same VMD time: sub-millimetre hand tremor isn't a stroke.
    for(let i=0;i<82;i++)step(.041+(i%2?1:-1)*.0003);
    expect(a.z(1)).toBeLessThan(.0001);expect(a.z(2)).toBeCloseTo(.034,4);expect(single.z(0)).toBeCloseTo(.034,4);
    for(let i=1;i<=35;i++){t+=dt;step(.041+.001*i);}
    expect(a.z(1)).toBeGreaterThan(.07);expect(a.z(2)).toBeLessThan(.002);
    for(let i=1;i<=17;i++)step(.076-i*.005);
    expect(a.z(3)).toBeGreaterThan(.015);
    for(let i=0;i<40;i++)step(-.009);
    expect(a.mesh.morphTargetInfluences).toEqual([raw,0,0,0]);expect(a.z(0)).toBeCloseTo(.1*raw);
    expect(single.z(0)).toBe(0);
  }finally{display.reset();mono.reset();a.dispose();single.dispose();}
});

it('never guesses a garment, group, bone, missing attribute, mixed alias or nameless PMX morph; explicit single-face choice stays local and is exactly reversible',()=>{
  const a=faceFixture(undefined,['Blink','Smile','smile skirt','MouthOpen','wink','困る','びっくり','なごみ']),b=faceFixture(undefined,['Blink']),display=createActorResponse();
  a.mesh.userData.mmdMorphs[3].type='group';a.mesh.userData.mmdMorphs[4].type='bone';a.mesh.userData.mmdMorphs[5].englishName='skirt up';
  delete a.mesh.userData.mmdMorphs[6];
  const map=Array.from(a.body.userData.mmdMorphSplitBody.morphTargetIndices as Uint16Array),missing=map.indexOf(7);
  map.splice(missing,1);a.body.geometry.morphAttributes.position!.splice(missing,1);a.body.morphTargetInfluences!.splice(missing,1);
  a.body.userData.mmdMorphSplitBody.morphTargetIndices=Uint16Array.from(map);
  const frame:ActorContactFrame={root:a.root,assetId:'a',runtimeId:'m',token:4,motion:'enter',depthM:.002,dt:1/72};
  try{
    expect(faceMorphNames(a.mesh)).toEqual(['Blink','Smile']);
    a.mesh.morphTargetInfluences![1]=.4;a.body.morphTargetInfluences![map.indexOf(1)]=.26;
    const before=a.z(1);display.present(frame,a,'Smile');expect(a.z(1)).toBeCloseTo(.097,6);expect(a.z(0)).toBe(0);
    display.present({...frame,motion:'inside'},a,null);expect(a.z(1)).toBe(before);expect(a.mesh.morphTargetInfluences![1]).toBe(.4);
    const later={...frame,root:b.root,assetId:'b',token:5};
    display.present({...later,motion:'inside'},b,undefined);expect(b.z(0)).toBe(0); // same runtime ID is not a crossing
    display.present(later,b,'Smile');expect(b.z(0)).toBe(0); // saved shape disappeared
    display.present(later,b,undefined);expect(b.z(0)).toBeCloseTo(.095,6);
    display.present(null,null,undefined);expect(b.z(0)).toBe(0);
    for(const motion of ['inside','withdraw','outside'] as const){display.present({...later,motion},b,undefined);expect(b.z(0)).toBe(0);}
  }finally{display.reset();a.dispose();b.dispose();}
});
