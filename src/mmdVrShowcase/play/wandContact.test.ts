import {Bone,BufferGeometry,DataTexture,Float32BufferAttribute,Group,MeshBasicMaterial,Scene,Skeleton,SkinnedMesh,Texture,Uint16BufferAttribute,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {makeWandHead} from './boutiqueModels';
import {createRoomWand,createWandBlend} from './wandContact';
import {capR,capY,createSiliconeHead,createWandHead,mountWandHead,siliconeCap,wandCap} from './wandHead';
import {setWandResponse,setWandResponseEnabled,useWandResponse,wandMorphNames} from './wandResponse';
import {createWandSurface} from './wandSurface';
import {centerZ,siliconeCrown,siliconeMount,siliconeTilt} from './siliconeProfile';
import {makeSilicone} from './workshopModels';
import {useWandMotor,stopWand} from './wandMotor';

function rig(){
  const root=new Group(),g=new BufferGeometry(),m=new MeshBasicMaterial();
  g.setAttribute('position',new Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0],3));
  g.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(12),4));
  g.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));g.setIndex([0,1,2]);g.computeBoundingSphere();
  const mesh=new SkinnedMesh(g,m),bone=new Bone();mesh.add(bone);root.add(mesh);mesh.bind(new Skeleton([bone]));root.updateMatrixWorld(true);
  const model={root,mesh,renderOrderMeshes:[] as SkinnedMesh[]};return {model,root,bone,mesh,g,m};
}
const hit=()=>({depth:0,axis:new Vector3()});
function at(x:number,y:number,z:number){const pivot=new Group();pivot.position.set(x,y-capY,z);return pivot;}

it('requires actual posed triangles (including triangle interiors); excludes empty AABB corners, handle-only overlap, hidden material, hidden actor and proxy ranges',()=>{
  const {model,mesh,m,root,g}=rig(),h=hit(),proxy=new SkinnedMesh(g.clone(),m);proxy.bind(mesh.skeleton,mesh.bindMatrix);root.add(proxy);
  g.setDrawRange(0,0);model.renderOrderMeshes.push(proxy);
  const pass=createWandSurface(model),query=(x:number,y:number,z:number)=>{pass.query(at(x,y,z),wandCap,h,Infinity);return h.depth;};
  expect(query(.3,.3,.001)).toBe(0);expect(query(-.1,-.1,capR+.0001)).toBe(0);
  expect(query(-.1,-.1,capR-.003)).toBeCloseTo(.003/capR);expect(h.axis.z).toBeCloseTo(-1);
  expect(query(-.1,-.1,.08)).toBe(0);
  proxy.visible=false;expect(query(-.1,-.1,0)).toBe(0);proxy.visible=true;
  m.visible=false;expect(query(-.1,-.1,0)).toBe(0);m.visible=true;
  m.opacity=0;expect(query(-.1,-.1,0)).toBe(0);m.opacity=1;
  g.setAttribute('uv',new Float32BufferAttribute([0,0,1,0,0,1],2));m.alphaTest=.5;
  m.map=new DataTexture(new Uint8ClampedArray([255,255,255,0,255,255,255,255]),2,1);
  expect(query(-.2,-.3,.001)).toBe(0);expect(query(.12,-.3,.001)).toBeGreaterThan(.9);
  m.map=new Texture();expect(query(.12,-.3,.001)).toBe(0);m.map=null;
  root.visible=false;expect(query(-.1,-.1,0)).toBe(0);
});

it('queries only the visible half of an indexed square shared by two material proxies',()=>{
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0],3));
  g.setIndex([0,1,2, 2,3,0]);g.setDrawRange(0,0);Object.freeze(g.drawRange);
  const root=new Group(),mats=[new MeshBasicMaterial(),new MeshBasicMaterial()],mesh=new SkinnedMesh(g,mats);
  const proxies=mats.map((m,i)=>{const p=new SkinnedMesh(g,m);p.userData.mmdMaterialRenderProxy={materialIndex:i,start:3*i,count:3};return p;});
  root.add(mesh,...proxies);const pass=createWandSurface({root,mesh,renderOrderMeshes:proxies}),h=hit();
  const depth=(x:number,y:number)=>{pass.query(at(x,y,0),wandCap,h,Infinity);return h.depth;};
  proxies[0].visible=false;expect(depth(-.5,.5)).toBeCloseTo(1);expect(depth(.5,-.5)).toBe(0);
  proxies[0].visible=true;proxies[1].visible=false;expect(depth(-.5,.5)).toBe(0);expect(depth(.5,-.5)).toBeCloseTo(1);
});

it('uses the current scaled/rotated wrist pose, animated bone and a reordered split-body morph, not the rest mesh',()=>{
  const {model,root,mesh,bone,g,m}=rig();const body=new SkinnedMesh(g.clone(),m);root.add(body);body.bind(mesh.skeleton,mesh.bindMatrix);
  body.userData.mmdMorphSplitBody={morphTargetIndices:new Uint16Array([1])};mesh.userData.mmdMorphSplitBodyMeshes=[body];
  body.geometry.morphTargetsRelative=true;body.geometry.morphAttributes.position=[new Float32BufferAttribute([0,0,.85,0,0,.85,0,0,.85],3)];
  mesh.morphTargetInfluences=[0,1];body.morphTargetInfluences=[1];const pass=createWandSurface(model),h=hit();
  const wrist=new Group(),pivot=new Group();wrist.add(pivot);pivot.position.set(0,-capY,0);
  for(const scale of [.1,1.7]){
    root.position.set(3,.77,-2);root.rotation.y=.76;root.scale.setScalar(scale);bone.rotation.x=.54;bone.position.set(.3,.15,-.07);root.updateMatrixWorld(true);
    const center=new Vector3(-.15,-.15,.85).applyMatrix4(bone.matrixWorld);
    wrist.position.copy(center);wrist.quaternion.setFromEuler(bone.rotation);wrist.updateMatrixWorld(true);
    // Make the cap center coincide with the triangle independent of hand rotation.
    pass.query(pivot,wandCap,h,Infinity);expect(h.depth).toBeCloseTo(1,4);
    mesh.morphTargetInfluences[1]=0;pass.query(pivot,wandCap,h,Infinity);expect(h.depth).toBe(0);mesh.morphTargetInfluences[1]=1;
  }
});

it('blends and restores exact per-channel display values on a split model across changes to VMD, configuration and actor',()=>{
  const {mesh,g,m}=rig(),body=new SkinnedMesh(g.clone(),m);
  mesh.userData.mmdMorphs=[{type:'bone'},{type:'vertex'},{type:'vertex'}];mesh.morphTargetDictionary={Blink:0,Smile:1,Alias:1,Other:2};
  mesh.morphTargetInfluences=[.42,.35,.24];body.morphTargetInfluences=[.24,.31];body.userData.mmdMorphSplitBody={morphTargetIndices:[2,1]};
  body.geometry.morphAttributes.position=[g.attributes.position,g.attributes.position];mesh.userData.mmdMorphSplitBodyMeshes=[body];
  expect(wandMorphNames(mesh)).toEqual(['Smile','Other']);expect(wandMorphNames(body)).toEqual([]);
  const layer=createWandBlend(),cfg={morph:'Smile',strength:.5};layer.apply(mesh,cfg,1);
  expect(mesh.morphTargetInfluences).toEqual([.42,.675,.24]);expect(body.morphTargetInfluences).toEqual([.24,.675]);
  layer.restore();expect(mesh.morphTargetInfluences).toEqual([.42,.35,.24]);expect(body.morphTargetInfluences).toEqual([.24,.31]);
  mesh.morphTargetInfluences[1]=.6;layer.apply(mesh,cfg,1);expect(mesh.morphTargetInfluences[1]).toBe(.8);
  layer.apply(mesh,{morph:null,strength:1},1);expect(mesh.morphTargetInfluences[1]).toBe(.6);
});

it.each(['Sdef','Qdef'])('samples the rendered %s rotation, not a linearly collapsed two-bone joint',type=>{
  const {model,bone,mesh,g,root}=rig(),second=new Bone();mesh.add(second);mesh.bind(new Skeleton([bone,second]));
  g.setAttribute('position',new Float32BufferAttribute([.95,-.04,0,1.05,-.04,0,1,.04,0],3));
  g.setAttribute('skinIndex',new Uint16BufferAttribute([0,1,0,0,0,1,0,0,0,1,0,0],4));
  g.setAttribute('skinWeight',new Float32BufferAttribute([.5,.5,0,0,.5,.5,0,0,.5,.5,0,0],4));
  g.setAttribute(`matrices${type}Enabled`,new Float32BufferAttribute([1,1,1],1));
  for(const n of ['C','RW0','RW1'])g.setAttribute(`matricesSdef${n}`,new Float32BufferAttribute(new Float32Array(9),3));
  bone.rotation.y=-Math.PI/3;second.rotation.y=Math.PI/3;root.updateMatrixWorld(true);
  // Equal antipodal rotations average to identity in both nonlinear modes.
  // Linear blend would instead put this tiny triangle at x=.5.
  const pass=createWandSurface(model),h=hit();pass.query(at(1,0,.01),wandCap,h,Infinity);expect(h.depth).toBeGreaterThan(.5);
  pass.query(at(.5,0,.01),wandCap,h,Infinity);expect(h.depth).toBe(0);
  // The actual contact follows the actor, without shrinking the authored
  // swing twice or letting the world translation contaminate the DQ blend.
  root.scale.setScalar(.1);root.position.set(.8,.3,-.6);root.rotation.y=.7;root.updateMatrixWorld(true);
  const target=root.localToWorld(new Vector3(1,0,0));pass.query(at(target.x,target.y,target.z),wandCap,h,Infinity);expect(h.depth).toBeCloseTo(1,4);
});

it('deforms only the touching side of the silicone head, and releases exactly',()=>{
  const geom=makeWandHead(),head=createWandHead(new Group(),geom),p=geom.attributes.position,n=geom.attributes.normal;
  const raw=p.array.slice(),norm=n.array.slice();head.press(new Vector3(0,0,1),.8);
  let moved=0;for(let i=0;i<p.count;i++){
    const d=raw[3*i+2]-p.getZ(i);if(d>0)moved++;
    if(raw[3*i+2]<.009||raw[3*i+1]<=.022)expect(d).toBe(0);
    expect(d).toBeLessThan(.00501);
  }expect(moved).toBeGreaterThan(0);head.release();expect(p.array).toEqual(raw);expect(n.array).toEqual(norm);geom.dispose();
});

it('mixes an off-beat touch into one motor beat on a paused skin, and drops feedback with stale tracking or wrist ownership',()=>{
  const {model,mesh}=rig(),scene=new Scene(),hand=new Group(),pivot=at(-.1,-.1,.012),geo=makeWandHead();scene.add(model.root,hand);hand.add(pivot);
  const unmount=mountWandHead(createWandHead(pivot,geo)),room=createRoomWand(),raw=geo.attributes.position.array.slice();
  mesh.morphTargetDictionary={Smile:0};mesh.morphTargetInfluences=[.25];setWandResponse('actor','Smile',.6);
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as unknown as XRSession;
  const pulse=vi.fn((_force:number,_duration:number)=>true),positive=()=>pulse.mock.calls.map(([force])=>force).filter(force=>force>0);
  Object.assign(hand.userData,{heldToy:'wand',propUsable:true,propSource:{handedness:'left'},gamepad:{hapticActuators:[{pulse}]}});
  const step=(ms:number,fresh=true)=>{const frame={session} as XRFrame;if(fresh)hand.userData.propFrame=frame;
    room.restore();expect(mesh.morphTargetInfluences).toEqual([.25]);room.advance(scene,null,'wand','left',frame,ms,'normal',[{id:'actor',visible:true}],()=>model);};
  try{
    useWandMotor.setState({speed:1,startedMs:0});pivot.position.z=.12;step(0);
    const base=positive()[0];expect(base).toBeGreaterThan(0);
    pivot.position.z=.012;for(let i=1;i<=4;i++)step(i*10);
    expect(mesh.morphTargetInfluences[0]).toBeGreaterThan(.25);expect(geo.attributes.position.array).not.toEqual(raw);
    step(249);expect(positive()).toEqual([base]);step(250);step(260);
    expect(positive()).toHaveLength(2);expect(positive()[1]).toBeGreaterThan(base);
    step(500);expect(positive()[2]).toBe(base); // sustained contact has no more accents
    step(550,false);expect(positive()).toHaveLength(3);expect(mesh.morphTargetInfluences).toEqual([.25]);expect(geo.attributes.position.array).toEqual(raw);
    step(600);session.dispatchEvent(new Event('end'));expect(mesh.morphTargetInfluences).toEqual([.25]);expect(geo.attributes.position.array).toEqual(raw);
    // Screen wrist uses the same actual geometry, independent of XR input.
    const count=positive().length;
    room.advance(scene,hand,'wand',null,undefined,750,'normal',[{id:'actor',visible:true}],()=>model);expect(mesh.morphTargetInfluences[0]).toBeGreaterThan(.25);
    room.restore();pivot.position.z=.12;
    room.advance(scene,hand,'wand',null,undefined,1000,'normal',[{id:'actor',visible:true}],()=>model);expect(mesh.morphTargetInfluences).toEqual([.25]);expect(geo.attributes.position.array).toEqual(raw);
    expect(positive()).toHaveLength(count);
  }finally{room.reset();stopWand();unmount();geo.dispose();}
});

it('runs in empty air with surface response disabled; high beats follow flex cycles and missed frames never burst',()=>{
  const scene=new Scene(),pivot=new Group(),holder=new Group(),geo=makeWandHead(),room=createRoomWand();
  scene.add(holder);holder.add(pivot);
  const unmount=mountWandHead(createWandHead(pivot,geo)),before=useWandResponse.getState();
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as unknown as XRSession;
  const calls:number[]=[],data=holder.userData;
  Object.assign(data,{heldToy:'wand',propSource:{handedness:'right'},propUsable:true,gamepad:{hapticActuators:[{pulse:(x:number)=>{if(x)calls.push(x);return true;}}]}});
  const step=(ms:number,level:'low'|'normal'|'off'='low',hand:'left'|'right'='right')=>{
    const frame=data.propFrame={session} as XRFrame;room.advance(scene,null,'wand',hand,frame,ms,level,[],()=>null);};
  try{
    setWandResponseEnabled(false);useWandMotor.setState({speed:2,startedMs:1000});
    for(const ms of [1000,1100,1142,1143,1285,1286])step(ms);
    expect(calls).toHaveLength(3);expect(calls[0]).toBeGreaterThan(0);
    step(2500,'normal');expect(calls).toHaveLength(4);expect(calls[3]).toBeGreaterThan(calls[0]);
    step(3000,'off');step(3200,'normal','left');data.propUsable=false;step(3400);
    data.propUsable=true;stopWand();step(3700);expect(calls).toHaveLength(4);
  }finally{room.reset();stopWand();unmount();geo.dispose();useWandResponse.setState(before);}
});

it('uses the silicone crown dimensions on the posed visible skin at either owner, independent of wand motor and expression',()=>{
  const {model,mesh,bone,root,m}=rig(),scene=new Scene(),holder=new Group(),part=new Group(),geom=makeSilicone();
  const room=createRoomWand(),unmount=mountWandHead(createSiliconeHead(part,geom)),before=useWandResponse.getState();
  const p=geom.attributes.position,n=geom.attributes.normal,raw=p.array.slice(),norm=n.array.slice();
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as unknown as XRSession;
  const pulse=vi.fn(()=>true);Object.assign(holder.userData,{heldToy:'dildo',propSource:{handedness:'left'},propUsable:true,gamepad:{hapticActuators:[{pulse}]}});
  holder.add(part);part.position.set(...siliconeMount);part.rotation.x=siliconeTilt;holder.scale.setScalar(1.45);holder.rotation.x=.25;
  scene.add(root,holder);root.rotation.y=Math.PI/2;root.position.set(-.53,.12,.46);root.scale.setScalar(.68);bone.position.z=.09;root.updateMatrixWorld(true);
  const target=bone.localToWorld(new Vector3(-.1,-.1,0));
  function place(center:Vector3,offset:number){holder.position.set(0,0,0);const origin=part.localToWorld(center.clone());
    holder.position.copy(target).sub(origin);holder.position.x+=offset*holder.scale.x;}
  function step(held:boolean,tracked=true){const frame=held?{session} as XRFrame:undefined;if(tracked)holder.userData.propFrame=frame;
    room.restore();room.advance(scene,held?null:holder,'dildo',held?'left':null,frame,performance.now(),'normal',[{id:'s',visible:true}],()=>model);}
  try{
    mesh.morphTargetDictionary={Smile:0};mesh.morphTargetInfluences=[.21];setWandResponse('s','Smile',1);setWandResponseEnabled(false);
    place(siliconeCap.center,.021);step(true);expect(p.array).toEqual(raw);expect(pulse).not.toHaveBeenCalled();
    place(siliconeCap.center,.009);for(let i=0;i<4;i++)step(true);
    expect(p.array).not.toEqual(raw);expect(pulse).toHaveBeenCalledTimes(1);expect(mesh.morphTargetInfluences).toEqual([.21]);
    let moved=0,forbidden=0,maxDelta=0;
    for(let i=0;i<p.count;i++){const x=raw[3*i],y=raw[3*i+1],d=p.getX(i)-x;
      if(d){moved++;if(x>=0||y<=.085||d<0)forbidden++;maxDelta=Math.max(maxDelta,d);}}
    expect(moved).toBeGreaterThan(10);expect(forbidden).toBe(0);expect(maxDelta).toBeCloseTo(.0035,4);
    setWandResponseEnabled(true);room.resetWand();expect(p.array).not.toEqual(raw);
    step(true);expect(mesh.morphTargetInfluences).toEqual([.21]);expect(pulse).toHaveBeenCalledTimes(1);
    step(true,false);expect(p.array).toEqual(raw);expect(n.array).toEqual(norm);
    holder.userData.propUsable=false;step(true);expect(p.array).toEqual(raw);
    step(false);expect(p.array).not.toEqual(raw);expect(pulse).toHaveBeenCalledTimes(1);
    m.visible=false;step(false);expect(p.array).toEqual(raw);m.visible=true;
    step(false);bone.position.z+=.3;root.updateMatrixWorld(true);step(false);expect(p.array).toEqual(raw);expect(n.array).toEqual(norm);
  }finally{room.reset();unmount();geom.dispose();useWandResponse.setState(before);}
});

it('compresses the crown around the fixed nozzle on end-on contact and restores its manufactured normals',()=>{
  const g=makeSilicone(),p=g.attributes.position,n=g.attributes.normal,raw=p.array.slice(),norm=n.array.slice(),head=createSiliconeHead(new Group(),g);
  const pitch=siliconeCrown.pitch;head.press(new Vector3(0,Math.cos(pitch),Math.sin(pitch)),.9);
  let moved=0,nozzleMoved=0,fixedLip=0;
  for(let i=0;i<p.count;i++){
    const [x,y,z]=[raw[3*i],raw[3*i+1],raw[3*i+2]],delta=Math.hypot(x-p.getX(i),y-p.getY(i),z-p.getZ(i));
    if(y>.111&&Math.hypot(x,z-centerZ(y))<=.005){fixedLip++;if(delta)nozzleMoved++;}
    if(y>.11&&delta>.001)moved++;
  }
  expect(moved).toBeGreaterThan(10);expect(fixedLip).toBeGreaterThan(10);expect(nozzleMoved).toBe(0);
  head.release();expect(p.array).toEqual(raw);expect(n.array).toEqual(norm);g.dispose();
});

it('slices the cold topology build rather than scanning a dense input in its first callback',()=>{
  const {model,g}=rig();g.setIndex(Array.from({length:6000},(_,i)=>i%3));const pass=createWandSurface(model);
  expect(pass.warm(-Infinity)).toBe(false);expect(pass.warm(Infinity)).toBe(true);
});
