// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Bone,Group,Mesh,MeshBasicMaterial,Scene,Skeleton,SkinnedMesh,Vector3} from 'three';
import {expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {clearBackpack,useBackpack} from '../backpack/store';
import {useMmdVrStore} from '../mmdVrStore';
import {ScreenLibrary} from '../screen/ScreenLibrary';
import {makeSilkSpool,ribbonPenOutlet} from './festival/drawingToyModels';
import {createRibbonInk} from './festival/RibbonPen';
import {TOYS} from './propCatalog';
import {mountScreenWristCue} from './screenWristCue';
import {requestScreenWristUse,useStagePlay} from './stagePlay';
import {poseWristToy} from './wristSocket';

vi.mock('../pose/PoseControls',()=>({PoseScreenControls:()=>null}));
vi.mock('../interaction/ActorActivities',async original=>({...await original(),ActorActivities:()=>null}));

it('draws from a selected actor’s visible winding eye and never transfers a pending stroke',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const stage=useMmdVrStore.getState(),bag=useBackpack.getState(),play=useStagePlay.getState,t=useLanguageStore.getState().t;
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',physicsBusy:false,physicsFatal:false});
  const entries=['a','b'].map(id=>({id,file:new File([],id+'.pmx'),path:id+'.pmx',kind:'model' as const}));
  const live=(runtimeId:string)=>({runtimeId,visible:true,wrists:{left:false,right:true},position:[0,0,0] as [number,number,number]});
  useBackpack.setState({entries,live:{a:live('A'),b:live('B')},selected:'a'});
  const scene=new Scene(),actor=new Group(),skin=new SkinnedMesh(),bone=new Bone(),knuckle=new Bone();
  scene.add(actor);actor.add(skin);skin.add(bone);bone.add(knuckle);bone.name='右手首';knuckle.name='右中指１';
  bone.position.set(.5,1.2,-.1);knuckle.position.set(.07,0,0);actor.updateMatrixWorld(true);skin.bind(new Skeleton([bone,knuckle]));
  actor.scale.setScalar(.87);actor.position.set(1.3,.4,-2.8);actor.rotation.y=.65;
  const wrist=new Group(),reel=new Mesh(makeSilkSpool(),new MeshBasicMaterial()),ink=createRibbonInk();
  wrist.add(reel);scene.add(wrist,ink.group);
  const canvas=document.createElement('canvas'),room=stage.prefs.scenery;
  const mount=()=>mountScreenWristCue({scene,canvas,wrist:{current:wrist},getRoot:id=>id==='A'?actor:null,
    isRoomStale:()=>useMmdVrStore.getState().prefs.scenery!==room},'ribbonPen',ribbonPenOutlet,{current:ink.step});
  let cue=mount();
  const ui=document.createElement('div'),root=createRoot(ui),key=(label:string)=>[...ui.querySelectorAll('button')].find(b=>b.textContent===label);
  const click=(label:string)=>act(()=>{const button=key(label);expect(button?.disabled).toBe(false);button!.click();});
  const label=t(TOYS.ribbonPen.screenUse!.label),rows=ink.group.children[0] as Mesh;
  const tick=()=>{const owner=play().character;if(owner)poseWristToy(wrist,actor,owner);
    cue.advance(1/36,owner&&wrist.visible?actor:null);};
  const visibleStrips=()=>ink.group.children.filter(n=>n.visible).length;
  try{
    await act(()=>root.render(<ScreenLibrary view="item" visit={1} locked={false} close={()=>{}} frame={()=>{}} openItem={()=>{}} openBackpack={()=>{}}/>));
    const choice=ui.querySelector<HTMLSelectElement>('.screen-props select')!;
    await act(()=>{choice.value='ribbonPen';choice.dispatchEvent(new Event('change',{bubbles:true}));});
    expect(key(label)).toBeUndefined();expect(key(t('propLeft'))?.disabled).toBe(true);
    await click(t('propRight'));tick();expect(visibleStrips()).toBe(0);
    await click(label);
    // The button can't cache its own ray. Move the evaluated wrist BETWEEN
    // click and render. The first woven row starts at the eye of the real reel.
    bone.rotateY(.37);tick();const eye=reel.localToWorld(new Vector3(...ribbonPenOutlet.position));
    const positions=rows.geometry.getAttribute('position');
    const firstRow=()=>new Vector3().fromBufferAttribute(positions,0).lerp(new Vector3().fromBufferAttribute(positions,3),.5);
    expect(firstRow().distanceTo(eye)).toBeLessThan(1e-6);
    bone.rotateZ(.45);tick();tick();expect(rows.visible).toBe(true);
    expect(firstRow().distanceTo(eye)).toBeLessThan(1e-6);expect(firstRow().distanceTo(reel.localToWorld(new Vector3(...ribbonPenOutlet.position)))).toBeGreaterThan(.01);
    for(let i=0;i<Math.ceil(36*TOYS.ribbonPen.screenUse!.duration!)+2;i++)tick();
    const length=rows.geometry.drawRange.count;bone.rotateZ(.22);tick();tick();expect(rows.geometry.drawRange.count).toBe(length);

    for(const interrupt of [()=>{bag.select('b');bag.select('a');},()=>{play().adjust(0,0,30);play().adjust(0,0,-30);},
      ()=>{useMmdVrStore.setState({physicsBusy:true});useMmdVrStore.setState({physicsBusy:false});},
      ()=>{canvas.dispatchEvent(new Event('webglcontextlost'));canvas.dispatchEvent(new Event('webglcontextrestored'));},
      ()=>{stage.setPrefs({scenery:room==='pool'?'lawn':'pool'});stage.setPrefs({scenery:room});}]){
      await click(label);await act(interrupt);tick();tick();expect(visibleStrips()).toBe(1);
    }
    const owner=play().character!;
    await click(label);scene.remove(actor);tick();expect(requestScreenWristUse(owner,'A')).toBe(false);scene.add(actor);tick();tick();
    expect(visibleStrips()).toBe(1);
    reel.visible=false;expect(requestScreenWristUse(owner,'A')).toBe(false);reel.visible=true;
    expect(requestScreenWristUse(owner,'B')).toBe(false);
    await act(()=>bag.select('b'));expect(key(label)).toBeUndefined();expect(requestScreenWristUse(owner,'A')).toBe(false);
    await act(()=>bag.select('a'));await click(label);const old=cue;cue=mount();old.dispose();old.advance(1/36,actor);tick();tick();
    expect(visibleStrips()).toBe(1);await click(label);tick();tick();expect(visibleStrips()).toBe(2);
    await act(()=>play().stow());expect(key(label)).toBeUndefined();expect(requestScreenWristUse(owner,'A')).toBe(false);
  }finally{
    cue.dispose();await act(()=>root.unmount());ink.dispose();reel.geometry.dispose();reel.material.dispose();skin.skeleton.dispose();
    play().reset();clearBackpack();useMmdVrStore.setState(stage);vi.unstubAllGlobals();
  }
});
