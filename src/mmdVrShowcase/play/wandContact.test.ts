import {Bone,BufferGeometry,DataTexture,Float32BufferAttribute,Group,MeshBasicMaterial,Scene,Skeleton,SkinnedMesh,Texture,Uint16BufferAttribute,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {makeWandHead} from './boutiqueModels';
import {createRoomWand,createWandBlend} from './wandContact';
import {capR,capY,createWandHead,mountWandHead} from './wandHead';
import {setWandResponse,wandMorphNames} from './wandResponse';
import {createWandSurface} from './wandSurface';

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
  const pass=createWandSurface(model),query=(x:number,y:number,z:number)=>{pass.query(at(x,y,z),h,Infinity);return h.depth;};
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
    pass.query(pivot,h,Infinity);expect(h.depth).toBeCloseTo(1,4);
    mesh.morphTargetInfluences[1]=0;pass.query(pivot,h,Infinity);expect(h.depth).toBe(0);mesh.morphTargetInfluences[1]=1;
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
  const pass=createWandSurface(model),h=hit();pass.query(at(1,0,.01),h,Infinity);expect(h.depth).toBeGreaterThan(.5);
  pass.query(at(.5,0,.01),h,Infinity);expect(h.depth).toBe(0);
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

it('held XR requires the same XRFrame; pulses once on entry, follows a stationary paused pose and restores on tracking/session loss',()=>{
  const {model,mesh}=rig(),scene=new Scene(),hand=new Group(),pivot=at(-.1,-.1,.012),geo=makeWandHead();scene.add(model.root,hand);hand.add(pivot);
  const unmount=mountWandHead(createWandHead(pivot,geo)),room=createRoomWand(),raw=geo.attributes.position.array.slice();
  mesh.morphTargetDictionary={Smile:0};mesh.morphTargetInfluences=[.25];setWandResponse('actor','Smile',.6);
  const session=Object.assign(new EventTarget(),{visibilityState:'visible'}) as unknown as XRSession;
  const pulse=vi.fn(()=>true);Object.assign(hand.userData,{heldToy:'wand',propUsable:true,gamepad:{hapticActuators:[{pulse}]}});
  const step=(fresh=true)=>{const frame={session} as XRFrame;if(fresh)hand.userData.propFrame=frame;
    room.restore();expect(mesh.morphTargetInfluences).toEqual([.25]);room.advance(scene,null,true,frame,true,'normal',[{id:'actor',visible:true}],()=>model);};
  try{
    // Cold preparation may take more than one small XR slice.
    for(let i=0;i<4;i++)step();expect(mesh.morphTargetInfluences[0]).toBeGreaterThan(.25);expect(pulse).toHaveBeenCalledTimes(1);
    expect(geo.attributes.position.array).not.toEqual(raw);
    step(false);expect(mesh.morphTargetInfluences).toEqual([.25]);expect(geo.attributes.position.array).toEqual(raw);
    step();session.dispatchEvent(new Event('end'));expect(mesh.morphTargetInfluences).toEqual([.25]);expect(geo.attributes.position.array).toEqual(raw);
    // Screen wrist uses the same actual geometry, independent of XR input.
    room.advance(scene,hand,false,undefined,true,'normal',[{id:'actor',visible:true}],()=>model);expect(mesh.morphTargetInfluences[0]).toBeGreaterThan(.25);
    expect(pulse).toHaveBeenCalledTimes(1);room.restore();pivot.position.z=.12;
    room.advance(scene,hand,false,undefined,true,'normal',[{id:'actor',visible:true}],()=>model);expect(mesh.morphTargetInfluences).toEqual([.25]);expect(geo.attributes.position.array).toEqual(raw);
  }finally{room.reset();unmount();geo.dispose();}
});

it('slices the cold topology build rather than scanning a dense input in its first callback',()=>{
  const {model,g}=rig();g.setIndex(Array.from({length:6000},(_,i)=>i%3));const pass=createWandSurface(model);
  expect(pass.warm(-Infinity)).toBe(false);expect(pass.warm(Infinity)).toBe(true);
});
