// @vitest-environment jsdom
import {act,type PropsWithChildren} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import Rapier from '@dimforge/rapier3d-compat';
import {BoxGeometry,BufferGeometry,Group,InstancedMesh,InterleavedBuffer,InterleavedBufferAttribute,Matrix4,Mesh,MeshBasicMaterial,Scene,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {afterEach,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import {useBackpack} from '../backpack/store';
import PlanetPhysics from './PlanetPhysics';
import {createPlanetPad} from './planetPad';
import {createTraveller,transport,type PlanetDriver} from './planetTravel';

let world:Rapier.World,scene:Scene,root:Root;
const driver:{current:PlanetDriver|null}={current:null};
const initialBag=useBackpack.getState();
vi.mock('@react-three/fiber',()=>({useThree:(select:(s:{scene:Scene})=>Scene)=>select({scene})}));
vi.mock('@react-three/rapier',()=>({Physics:({children}:PropsWithChildren)=>children,useRapier:()=>({rapier:Rapier,world})}));
beforeAll(async()=>{await Rapier.init()});
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  world=new Rapier.World({x:0,y:0,z:0});scene=new Scene();root=createRoot(document.createElement('div'));
});
afterEach(async()=>{
  await act(()=>root.unmount());world.free();useBackpack.setState(initialBag,true);vi.restoreAllMocks();vi.unstubAllGlobals();
});
const mount=()=>act(()=>root.render(<PlanetPhysics driver={driver}/>));
const publish=()=>act(()=>initialBag.publishLive({...useBackpack.getState().live}));
function prop(){const group=new Group();group.userData.stagePropSolid=true;scene.add(group);return group;}
// Keep these probes above the home terrain and its instruments.
function ray(x:number,z=0){
  world.step();return world.castRay(new Rapier.Ray({x,y:13,z},{x:0,y:-1,z:0}),6,true);
}

it('builds 3 → 3 → 3 → 3 prop trimeshes on mount, actor move, identical roster and hiding the two instances',async()=>{
  const box=new BoxGeometry(),one=prop(),two=prop();one.position.set(5,9,0);two.position.set(8,9,0);
  one.add(new Mesh(box));const copies=new InstancedMesh(box,new MeshBasicMaterial(),2);
  copies.setMatrixAt(1,new Matrix4().makeTranslation(2,0,0));two.add(copies);
  useBackpack.setState({entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}]});
  const actor=(x:number)=>initialBag.publishLive({a:{runtimeId:'actor:1',position:[x,9,0],visible:true,bounds:{center:[x,10,0],size:[.5,2,.4]}}});
  actor(-5);
  const build=vi.spyOn(Rapier.ColliderDesc,'trimesh');
  const boxesBuilt=()=>build.mock.calls.filter(([,idx])=>idx.length===box.index!.count).length;
  await mount();const counts=[boxesBuilt()],unchanged=ray(5)!.collider;
  expect(ray(-5)?.timeOfImpact).toBeCloseTo(2);expect(ray(8)).toBeTruthy();expect(ray(10)).toBeTruthy();
  await act(()=>actor(-4));counts.push(boxesBuilt());expect(ray(-5)).toBeNull();expect(ray(-4)?.timeOfImpact).toBeCloseTo(2);
  await act(()=>actor(-4));counts.push(boxesBuilt());
  two.visible=false;await publish();counts.push(boxesBuilt());expect(ray(8)).toBeNull();expect(ray(10)).toBeNull();
  expect(counts).toEqual([3,3,3,3]);expect(ray(5)?.collider).toBe(unchanged);

  two.visible=true;await publish();expect(boxesBuilt()).toBe(5);
  copies.setMatrixAt(1,new Matrix4().makeTranslation(3,0,0));await publish();
  expect(ray(10)).toBeNull();expect(ray(11)).toBeTruthy();
  copies.count=1;await publish();expect(ray(11)).toBeNull();expect(ray(8)).toBeTruthy();
  expect(ray(5)?.collider).toBe(unchanged);
});

it('uses the visible descendants, composed pose and scale, and the actual drawn position/index data on each publication',async()=>{
  const group=prop(),child=new Group(),g=new BufferGeometry();group.add(child);group.position.y=9;
  const positions=new InterleavedBufferAttribute(new InterleavedBuffer(new Float32Array([
    0,-2.5,0,-.5, 0,-2,0,.5, 0,-1.5,0,-.5,
    0,1.5,0,-.5, 0,2,0,.5, 0,2.5,0,-.5,
  ]),4),3,1);
  g.setAttribute('position',positions);g.setIndex([3,4,5,0,1,2]);g.setDrawRange(3,3);
  const mesh=new Mesh(g);child.add(mesh);await mount();
  expect(ray(-2)).toBeTruthy();expect(ray(2)).toBeNull();
  g.setDrawRange(0,5);await publish();expect(ray(-2)).toBeNull();expect(ray(2)).toBeTruthy(); // ignore partial final triangle
  g.index!.array.set([0,1,2]);await publish();expect(ray(-2)).toBeTruthy();expect(ray(2)).toBeNull();
  for(let i=0;i<3;i++)positions.setX(i,positions.getX(i)-1);
  await publish();expect(ray(-2)).toBeNull();expect(ray(-3)).toBeTruthy();
  g.setIndex(null);g.setDrawRange(3,Infinity);await publish();expect(ray(-3)).toBeNull();expect(ray(2)).toBeTruthy();
  group.position.x=1;group.rotation.y=Math.PI/2;child.scale.x=2;await publish();
  expect(ray(2)).toBeNull();expect(ray(1,-4)).toBeTruthy();
  child.visible=false;await publish();expect(ray(1,-4)).toBeNull();
  child.visible=true;mesh.geometry=new BoxGeometry(.5,.5,.5);await publish();
  expect(ray(1,-4)).toBeNull();expect(ray(1)).toBeTruthy();
  const old=ray(1)!.collider;scene.remove(group);const replacement=prop();replacement.add(new Mesh(mesh.geometry));
  replacement.position.set(3,9,0);await publish();expect(old.isValid()).toBe(false);expect(ray(1)).toBeNull();expect(ray(3)).toBeTruthy();
});

it('walks through a hollow GLB arch, stops at its lowered beam, and transfers platform support on move, removal and re-entry',async()=>{
  const arch=prop(),platform=prop();
  arch.add(new Mesh(mergeGeometries([
    new BoxGeometry(.15,2.3,.15).translate(0,1.15,-.8),
    new BoxGeometry(.15,2.3,.15).translate(0,1.15,.8),
    new BoxGeometry(.15,.16,1.75).translate(0,2.22,0),
  ])));
  platform.add(new Mesh(new BoxGeometry(.8,.14,.7)));platform.position.set(-.8,.07,1.4);
  await mount();
  const eye=new Vector3(0,1.65,0);
  let pad=createPlanetPad();
  function start(x:number,z:number){
    const s=createTraveller();s.foot.set(x,0,z);transport(s);driver.current!.seed(s);return s;
  }
  function step(s:ReturnType<typeof start>,stick:number,frames:number){
    pad.update(scene);
    for(let i=0;i<frames;i++){
      s.dir.set(0,0,-1).applyQuaternion(s.basis);driver.current!.step(s,1/90,stick,0,eye,pad.read);
    }
  }
  function platformHeight(x:number){
    world.step();
    const hit=world.castRay(new Rapier.Ray({x,y:.5,z:1.4},{x:0,y:-1,z:0}),1,true,Rapier.QueryFilterFlags.ONLY_FIXED);
    return .5-hit!.timeOfImpact;
  }
  try{
    const open=start(-1.1,0);step(open,1,90);expect(open.foot.x).toBeGreaterThan(.8);
    arch.scale.y=.72;await publish();const sweep=vi.spyOn(world,'castShape');
    const low=start(-1.1,0);step(low,1,90);expect(low.foot.x).toBeGreaterThan(-.6);expect(low.foot.x).toBeLessThan(-.1);
    expect(sweep.mock.results.some(r=>r.value!=null)).toBe(true);
    const stopped=low.foot.clone();step(low,1,45);expect(low.foot.distanceTo(stopped)).toBeLessThan(.02);
    arch.visible=false;await publish();step(low,1,90);expect(low.foot.x).toBeGreaterThan(1);

    const onDeck=start(-.8,1.4);step(onDeck,0,10);expect(onDeck.foot.y).toBeCloseTo(.14,3);expect(platformHeight(-.8)).toBeCloseTo(.14,3);
    platform.position.x=.8;await publish();step(onDeck,0,10);expect(onDeck.foot.y).toBeCloseTo(0,3);expect(platformHeight(-.8)).toBeCloseTo(0,3);
    const moved=start(.8,1.4);step(moved,0,10);expect(moved.foot.y).toBeCloseTo(.14,3);expect(platformHeight(.8)).toBeCloseTo(.14,3);
    scene.remove(platform);await publish();step(moved,0,10);expect(moved.foot.y).toBeCloseTo(0,3);expect(platformHeight(.8)).toBeCloseTo(0,3);

    await act(()=>root.render(null));expect(driver.current).toBeNull();expect(world.colliders.len()).toBe(0);expect(world.bodies.len()).toBe(0);
    world.free();world=new Rapier.World({x:0,y:0,z:0});pad.dispose();pad=createPlanetPad();
    scene.add(platform);await mount();
    const oldSite=start(-.8,1.4);step(oldSite,0,10);expect(oldSite.foot.y).toBeCloseTo(0,3);expect(platformHeight(-.8)).toBeCloseTo(0,3);
    const restored=start(.8,1.4);step(restored,0,10);expect(restored.foot.y).toBeCloseTo(.14,3);expect(platformHeight(.8)).toBeCloseTo(.14,3);
  }finally{pad.dispose();}
});
