import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { DirectionalLight, Group, Matrix4, PerspectiveCamera, Scene, Triangle, Vector3 } from 'three';
import { createCustomBulletMmdPhysicsBackend } from '@yohawing/three-mmd-loader/physics';
import { getBulletModule } from './bulletModule';
import { createMmdRuntimeHandle } from './mmdRuntime';
// @ts-expect-error internal Vite-only JS module, never imported by the stage entry
import { createStageActorBackend } from '../../../scripts/webgpu-actor/stageActorBackend.js';
// @ts-expect-error original in-memory PMX encoder
import { encodeSwatch } from '../../../experiments/gpu-cloth/swatch.js';
// @ts-expect-error shared lab JS solver component
import { skirtPhysicsFilter } from '../../../experiments/gpu-cloth/rig.js';

vi.mock('./bulletModule', () => ({getBulletModule:vi.fn()}));
const gpu = vi.hoisted(() => ({surface:vi.fn(),driver:vi.fn()}));
vi.mock('../../../scripts/webgpu-actor/clothSurface.js', () => ({createClothSurface:gpu.surface}));
vi.mock('../../../scripts/webgpu-actor/clothDriver.js', () => ({createClothDriver:gpu.driver}));

beforeAll(async () => {
  const {createNodeBulletModule} = await import(new URL('../../../scripts/node-bullet-stage.mjs',import.meta.url).href);
  vi.mocked(getBulletModule).mockResolvedValue({module:await createNodeBulletModule(),createCustomBulletMmdPhysicsBackend});
});
beforeEach(() => { gpu.driver.mockReset(); gpu.surface.mockReset(); });

// Interleave an independent, unconstrained hair body midway down the skirt
// chain. Its visible bone must still fall while the VMD time is held fixed.
function actorFile(hasSkirt: boolean) {
  const bone = ['waist','skirt 0','skirt 1','hair','skirt 2','skirt 3'].map((name,i) =>
    ({name:hasSkirt?name:name.replace('skirt','ribbon'),parent:[-1,0,1,0,2,4][i],p:[i===3?3:0,12-i,0]}));
  const body = bone.map(({name,p},i) => ({name,p,b:i,dyn:i>0,r:.03,h:0}));
  const joint = [1,2,4,5].map(i => [bone[i].parent,i,bone[i].p]);
  const vertices = [-1,0,1].map((x,i) => ({b:5,p:[x,i===1?8:7,0],normal:[0,0,1]}));
  return encodeSwatch({bone,body,joint,vertices,groups:[[],[0,1,2],[]]},'room.pmx') as File;
}

async function mount(hasSkirt=true) {
  const scene=new Scene(), light=new DirectionalLight(), camera=new PerspectiveCamera();
  const renderer={init:async()=>{},isWebGPURenderer:true,backend:{isWebGPUBackend:true},xr:{enabled:true},compute:vi.fn()};
  const origin={current:new Group()}; // This fixture's player stands at the world origin.
  const backend=await createStageActorBackend(renderer,scene,light,origin);
  const parked=new Matrix4().makeTranslation(0,-1000,0), shape=()=>({type:'sphere' as const,size:[.01,.01,.01] as const});
  const runtime=createMmdRuntimeHandle(scene,{actorBackend:backend,controllerColliders:()=>[parked,parked],
    handColliders:()=>Array(12).fill(parked),propColliders:()=>Array(8).fill(parked),propShape:shape});
  const id=(await runtime.addModel(actorFile(hasSkirt),[],{physics:true,transform:{scale:.1}})).modelId;
  const frame={session:{visibilityState:'visible',inputSources:[]},getViewerPose:()=>({views:[{}]})};
  const tick=(tracked=true,seconds=0,reseed=false,physics=true)=>{
    backend.beginFrame(tracked?frame:null,tracked?{}:null,reseed);
    runtime.update(seconds,physics,camera,1,false,1/72,reseed);
    backend.prepareRender(true);
    return backend.status;
  };
  return {backend,runtime,id,tick,close:()=>{runtime.dispose();backend.dispose();}};
}

it('hands the matched chain to a ready driver only, retains native body motion and all 22 slots, and restores the same actor',async()=>{
  const release:string[]=[];
  gpu.surface.mockReturnValue({dispose:()=>release.push('surface'),setEnabled:vi.fn()});
  let ready!:()=>void;
  const driver={dispose:()=>release.push('driver'),step:vi.fn(()=>1),reset:vi.fn()};
  gpu.driver.mockImplementation(()=>new Promise(resolve=>{ready=()=>resolve(driver);}));
  const {runtime,backend,id,tick,close}=await mount();
  try {
    expect(tick()).toMatchObject({mode:'bullet',fullBodies:6,keptBodies:6,nodes:4,clothSteps:0});
    expect(runtime.getRigidBodyCount()).toBe(28);
    const mesh=runtime.getModelSurface(id)!.mesh, hair=mesh.skeleton.bones.find(b=>b.name==='hair')!;
    mesh.geometry.addEventListener('dispose',()=>release.push('model'));
    ready(); await Promise.resolve();
    expect(tick()).toMatchObject({mode:'gpu',fullBodies:6,keptBodies:2,updatedBones:1});
    expect(runtime.getRigidBodyCount()).toBe(24);
    const y=hair.position.y;
    for(let i=0;i<20;i++)tick();
    expect(hair.position.y).toBeLessThan(y-.01);
    expect(backend.status).toMatchObject({poseSeconds:0,clothSteps:20,bulletSimulatedSteps:20});
    runtime.resetPhysics(1);
    expect(runtime.getRigidBodyCount()).toBe(24); // No transient full world on the explicit seed.
    expect(tick(true,1)).toMatchObject({mode:'gpu',clothSteps:20});
    expect(tick(false)).toMatchObject({mode:'bullet',keptBodies:6,clothSteps:20});
    expect(tick(true,2,true)).toMatchObject({mode:'gpu',poseSeconds:2,clothSteps:20});
    expect(tick(true,2)).toMatchObject({mode:'gpu',poseSeconds:2,clothSteps:21});
    backend.setClothEnabled(false); expect(tick()).toMatchObject({mode:'bullet',keptBodies:6,clothSteps:21});
    await runtime.setPhysicsEnabled(false); expect(tick(true,2,false,false)).toMatchObject({mode:'none',keptBodies:0});
    await runtime.setPhysicsEnabled(true); backend.setClothEnabled(true);
    expect(tick()).toMatchObject({mode:'gpu',fullBodies:6,keptBodies:2});
    expect(runtime.getModelSurface(id)!.mesh).toBe(mesh); expect(gpu.driver).toHaveBeenCalledOnce();
    runtime.removeModel(id);
    expect(release).toEqual(['driver','surface','model']);
    expect(backend.status).toMatchObject({mode:'none',fullBodies:0,keptBodies:0,nodes:0,clothSteps:0});
  } finally {close();}
});

it('remaps joints and impulses but never skeleton indices; an incomplete rebind keeps the original context',()=>{
  const filter=skirtPhysicsFilter({byBone:new Map([[4,0],[5,1]])});
  const rigidBodies=[4,4,8,5,9].map((boneIndex,index)=>({boneIndex,index,motionType:index===1?'static':'dynamic'}));
  const c={rigidBodies,joints:[{rigidBodyIndexA:0,rigidBodyIndexB:4},{rigidBodyIndexA:1,rigidBodyIndexB:4}],
    morphImpulses:[{rigidBodyIndex:3,weight:.3},{rigidBodyIndex:2,weight:.6}]};
  const cut=filter(c);
  expect(cut.rigidBodies).toEqual([1,2,4].map((i,index)=>({...rigidBodies[i],index})));
  expect(cut.joints).toEqual([{index:0,rigidBodyIndexA:0,rigidBodyIndexB:2}]);
  expect(cut.morphImpulses).toEqual([{rigidBodyIndex:1,weight:.6}]); expect(filter(c).rigidBodies).toBe(cut.rigidBodies);
  const missing={...c,rigidBodies:rigidBodies.filter(b=>b.boneIndex!==4)};
  expect(filter(missing)).toBe(missing);
  const ambiguous={...c,rigidBodies:[...rigidBodies,{...rigidBodies[0],index:5}]}; expect(filter(ambiguous)).toBe(ambiguous);
});

it('keeps the native topology on failed initialization and retires an unresolved driver without a late frame',async()=>{
  const disposeSurface=vi.fn(),lateStep=vi.fn(),lateDispose=vi.fn();
  gpu.surface.mockReturnValue({setEnabled:vi.fn(),dispose:disposeSurface});
  gpu.driver.mockRejectedValueOnce(Error('compile failed'));
  const old=await mount();
  try {
    old.tick(); await Promise.resolve(); await Promise.resolve();
    expect(old.tick()).toMatchObject({mode:'bullet',cloth:'failed',keptBodies:6,clothSteps:0});
    expect(old.runtime.getDynamicRigidBodyCount()).toBe(5);
  } finally {old.close();}
  let finish!:()=>void;
  gpu.driver.mockImplementationOnce(()=>new Promise(resolve=>{finish=()=>resolve({dispose:lateDispose,step:lateStep});}));
  const replacement=await mount();
  replacement.tick(); const signal=gpu.driver.mock.lastCall![4] as AbortSignal;
  replacement.close(); expect(signal.aborted).toBe(true);
  finish(); await Promise.resolve();
  expect(lateDispose).toHaveBeenCalledOnce(); expect(lateStep).not.toHaveBeenCalled();
  expect(disposeSurface).toHaveBeenCalledTimes(2);
  expect(replacement.backend.status).toMatchObject({mode:'none',nodes:0,clothSteps:0});
});

it('draws the original cloth group with its complete Bullet world when no authored skirt chain matches',async()=>{
  const {runtime,backend,id,tick,close}=await mount(false);
  try {
    const {root,mesh}=runtime.getModelSurface(id)!;
    const hair=mesh.skeleton.bones.find(b=>b.name==='hair')!, y=hair.position.y;
    for(let i=0;i<21;i++)tick();
    expect(backend.status).toMatchObject({mode:'bullet',cloth:'unsupported',fullBodies:6,keptBodies:6,
      nodes:0,clothSteps:0,bulletSimulatedSteps:20,updatedBones:5});
    expect(runtime.getRigidBodyCount()).toBe(28); expect(hair.position.y).toBeLessThan(y-.01);
    expect(root.parent).toBeInstanceOf(Scene); expect(root.visible && mesh.visible).toBe(true);
    const draw=mesh.geometry.groups.find(g=>g.materialIndex===1)!;
    expect(draw.count).toBe(3);
    expect([mesh.material].flat()[1]).toMatchObject({visible:true,colorWrite:true,isNodeMaterial:true});
    const vertex=(k:number)=>mesh.getVertexPosition(mesh.geometry.index!.getX(draw.start+k),new Vector3());
    expect(new Triangle(vertex(0),vertex(1),vertex(2)).getArea()).toBeGreaterThan(.5);
    expect(gpu.surface).not.toHaveBeenCalled(); expect(gpu.driver).not.toHaveBeenCalled();
  }finally{close();}
});

it('keeps each actor’s material, surface and Bullet binding through removal of a neighbour',async()=>{
  const {runtime,backend,id,tick,close}=await mount(false);
  try {
    const otherFile=actorFile(false),thirdFile=actorFile(false); // All three PMX have the same filename.
    const other=(await runtime.addModel(otherFile,[],{physics:true})).modelId;
    const third=(await runtime.addModel(thirdFile,[],{physics:true})).modelId;
    const surface=backend.getGarmentPose(other), mesh=runtime.getModelSurface(other)!.mesh;
    expect(surface.position).not.toBe(backend.getGarmentPose(id).position);
    expect(backend.styles.read(other,otherFile)).toBeTruthy();
    expect(backend.styles.read(other,thirdFile)).toBeNull();
    runtime.setModelVisible(third,false);
    expect(tick().actors).toEqual([expect.objectContaining({id,visible:true}),expect.objectContaining({id:other,visible:true}),expect.objectContaining({id:third,visible:false})]);
    runtime.removeModel(id);tick();
    expect(backend.getGarmentPose(id)).toBeNull();expect(backend.getGarmentPose(other)).toBe(surface);
    expect(runtime.getModelSurface(other)!.mesh).toBe(mesh);
    expect(runtime.getRigidBodyCount()).toBeGreaterThan(0);
    expect(backend.status.actors).toHaveLength(2);
  }finally{close();}
});
