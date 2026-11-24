// @vitest-environment jsdom
import {act,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {Group,PerspectiveCamera,Scene} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {enablePelvic,usePelvic} from '../pelvic/store';
import {tourShots} from '../scenery/roomViews';
import {ScreenStage} from './ScreenStage';

// Exercise the actual two actor sheets, camera actions, OrbitControls and keyboard.
// Only the renderer/frame source and the unrelated mounted stage are stand-ins.
let host:HTMLDivElement,root:ReturnType<typeof createRoot>,camera:PerspectiveCamera,scene:Scene,orbit:OrbitControls;
let tick:(state:unknown,dt:number)=>void;
const gl={get domElement(){return host.querySelector<HTMLCanvasElement>('.screen-picture canvas')!;}};
vi.mock('@react-three/fiber',async original=>{
  const {useEffect,useState}=await import('react');
  return {...await original(),useThree:()=>({camera,scene,gl}),useFrame:(fn:typeof tick)=>{tick=fn;},Canvas:({children}:{children:ReactNode})=>{
    const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return <><canvas/>{ready&&children}</>;
  }};
});
vi.mock('../components/MmdVrStage',()=>({MmdVrStageContent:()=>null}));
vi.mock('../components/BackpackPlacement',()=>({BackpackPlacement:({onScreenPick}:{onScreenPick:()=>void})=><button onClick={()=>{useBackpack.getState().select('a');onScreenPick();}}>pick actor</button>}));
vi.mock('../music/ScreenMusic',()=>({ScreenMusic:()=>null}));
vi.mock('../play/StoryStations',()=>({StoryStations:()=>null}));
vi.mock('../observation/ObservationDiagram',()=>({ObservationDiagram:()=>null}));

const initial=useMmdVrStore.getState(),bag=useBackpack.getState(),pelvic=usePelvic.getState();
const button=(name:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===name);
const click=(name:string)=>act(()=>button(name)!.click());
async function openMilk(){await click('pick actor');await click('泌乳');}
const snapshot=()=>({eye:camera.position.clone(),aim:orbit.target.clone(),up:camera.up.clone(),rotation:camera.quaternion.clone(),fov:camera.fov,zoom:camera.zoom});
function expectView(saved:ReturnType<typeof snapshot>){
  expect(camera.position.distanceTo(saved.eye)).toBeLessThan(1e-8);expect(orbit.target.distanceTo(saved.aim)).toBeLessThan(1e-8);
  expect(camera.up.distanceTo(saved.up)).toBeLessThan(1e-8);expect(Math.abs(camera.quaternion.dot(saved.rotation))).toBeCloseTo(1,10);
  expect(camera.fov).toBe(saved.fov);expect(camera.zoom).toBe(saved.zoom);
}
function key(code:string,type='keydown'){gl.domElement.parentElement!.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true,cancelable:true}));}
function move(){key('KeyE');key('KeyW');tick(null,.09);key('KeyW','keyup');key('KeyE','keyup');}
function wheel(deltaY:number){gl.domElement.dispatchEvent(new WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true}));}
function drag(){for(const [type,x] of [['pointerdown',120],['pointermove',165],['pointerup',165]] as const){
  gl.domElement.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'mouse',button:0,clientX:x,clientY:100}));
}}
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
  const update=OrbitControls.prototype.update;vi.spyOn(OrbitControls.prototype,'update').mockImplementation(function(this:OrbitControls,dt){orbit=this;return update.call(this,dt);});
  scene=new Scene();camera=new PerspectiveCamera(50,1.4,.03,100);camera.position.set(0,1.65,4);
  const actor=new Group();actor.userData.mmdModelId='r';scene.add(actor);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',prefs:{...initial.prefs,scenery:'glassPlanet'}});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'actor.pmx'),path:'actor.pmx'}],
    live:{a:{runtimeId:'r',visible:true,position:[1,0,2]}}});
  host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(()=>root.render(<ScreenStage/>));
  Object.defineProperty(gl.domElement,'clientHeight',{value:480});gl.domElement.setPointerCapture=vi.fn();gl.domElement.releasePointerCapture=vi.fn();
});
afterEach(async()=>{await act(()=>root.unmount());host.remove();useBackpack.setState(bag);usePelvic.setState(pelvic);useMmdVrStore.setState(initial);vi.restoreAllMocks();vi.unstubAllGlobals();});

it('returns both close-up keys to the original hand-composed orbital view, even after reframing and changing sheets',async()=>{
  const select=host.querySelector<HTMLSelectElement>('.screen-corner select')!;
  await act(()=>{select.value=String(tourShots('glassPlanet').findIndex(s=>s.key==='opalSurveyAqua'));select.dispatchEvent(new Event('change',{bubbles:true}));});
  expect(Math.abs(camera.up.y)).toBeLessThan(.999);camera.zoom=1.2;camera.updateProjectionMatrix();
  move();wheel(-120);drag();const saved=snapshot();
  await openMilk();const milkKey=button('近看角色')!;await click('近看角色');
  expect(button('返回原机位')).toBe(milkKey);expect(camera.position.distanceTo(saved.eye)).toBeGreaterThan(.2);
  const close=snapshot();move();wheel(120);drag();expect(camera.position.distanceTo(close.eye)).toBeGreaterThan(.05);
  await click('返回原机位');expect(button('近看角色')).toBe(milkKey);expectView(saved);
  wheel(-120);expect(camera.position.distanceTo(saved.aim)).toBeLessThan(saved.eye.distanceTo(saved.aim));
  const second=snapshot();await click('近看角色');const chest=snapshot();await click('返回角色');
  await act(()=>{expect(enablePelvic('a',true)).toBe(true);});await click('插入');expectView(chest);
  const faceKey=button('近看表情')!;await click('近看表情');expect(button('返回原机位')).toBe(faceKey);
  expect(orbit.target.y).toBeGreaterThan(chest.aim.y);await click('返回原机位');expect(button('近看表情')).toBe(faceKey);expectView(second);
});

it('abandons an old return point on reset, actor/instance replacement and room/session changes',async()=>{
  await openMilk();const entry=snapshot();move();await click('近看角色');await act(()=>key('KeyR'));
  expectView(entry);expect(button('近看角色')).toBeDefined();
  await click('近看角色');await click(useLanguageStore.getState().t('settingsMmdVrResetView'));expectView(entry);
  await click('近看角色');await act(()=>{const b=useBackpack.getState();b.select(null);b.select('a');});
  expect(button('返回原机位')).toBeUndefined();expect(button('近看角色')).toBeDefined();
  await click('近看角色');await act(()=>{const b=useBackpack.getState();b.publishLive({...b.live,a:{...b.live.a,runtimeId:'replacement'}});});
  await openMilk();const unavailable=snapshot();await click('近看角色');expectView(unavailable);expect(button('返回原机位')).toBeUndefined();
  scene.children[0].userData.mmdModelId='replacement';await click('近看角色');expect(button('返回原机位')).toBeDefined();
  await act(()=>{const prefs=useMmdVrStore.getState().prefs;useMmdVrStore.setState({prefs:{...prefs,scenery:'floor'}});useMmdVrStore.setState({prefs});});
  expect(button('返回原机位')).toBeUndefined();await click('近看角色');
  await act(()=>useMmdVrStore.getState().openOverlay('screen'));expectView(entry);expect(button('近看角色')).toBeDefined();
});
