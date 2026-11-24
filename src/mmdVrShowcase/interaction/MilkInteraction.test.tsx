// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Group,Scene,type Vector3,type WebGLRenderer} from 'three';
import {expect,it,vi} from 'vitest';
import {clearBackpack,useBackpack} from '../backpack/store';
import {mountRoomMilk} from '../bodyState/lactation/roomMilk';
import {DEFAULT_BODY_PROFILE} from '../bodyState/data';
import {useBodyState} from '../bodyState/store';
import {useMmdVrStore} from '../mmdVrStore';
import {MilkScreenControls} from './MilkInteraction';

it('holds over a real DOM target, ignores taps and a competing touch, stops on slide-off/observation and reopens with committed stock',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),scene=new Scene(),actor=new Group();scene.add(actor);
  const panel={assetId:'a',runtimeId:'r'},gl={domElement:document.createElement('canvas')} as WebGLRenderer;
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',path:'test.pmx',file:new File([],'test.pmx')}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  useMmdVrStore.getState().openOverlay('screen');
  const room=mountRoomMilk(scene,gl,{getModelRoot:()=>actor,sampleMilkOutlet:(_id,side,v:Vector3,n:Vector3,bare)=>{v.set(0,1,0);n.set(0,0,1);return side==='left'&&!!bare;}},()=>false);
  let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const tick=async(seconds=.02)=>act(()=>{now+=seconds*1000;room.advance(seconds);});
  const onObserve=vi.fn(),onBack=vi.fn(),mount=()=>act(()=>root.render(<MilkScreenControls {...panel} onObserve={onObserve} onBack={onBack}/>));
  const by=(label:string)=>[...host.querySelectorAll('button')].find(el=>el.textContent===label)!;
  const click=(label:string)=>act(()=>by(label).click());
  const stock=()=>useBodyState.getState().byAsset.a;
  let pointed:Element=host;const old=Object.getOwnPropertyDescriptor(document,'elementFromPoint');
  Object.defineProperty(document,'elementFromPoint',{configurable:true,value:()=>pointed});
  const fire=(target:Element,type:string,id:number)=>act(()=>{target.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,button:0,buttons:1,pointerType:'touch'}));});
  try{
    await mount();expect(stock()).toBeUndefined();await click('开启泌乳');await tick();expect(stock()).toEqual({...DEFAULT_BODY_PROFILE,lactating:true});
    expect(host.textContent).toContain('待确认裸露');expect(host.textContent).toContain('出口被遮挡');
    const left=by('按住左侧');pointed=left;await click('按住左侧');await tick(.17);expect(stock().left).toBe(.5);
    await fire(left,'pointerdown',1);await fire(left,'pointerup',1);await tick();expect(host.textContent).toContain('轻点未排出');expect(stock().left).toBe(.5);
    await fire(left,'pointerdown',1);await tick();expect(stock().left).toBeCloseTo(.466);await fire(left,'pointerup',2);await tick(.27);expect(stock().left).toBeCloseTo(.432);expect(stock().right).toBe(.5);
    const first=stock();pointed=host;await fire(left,'pointermove',1);pointed=left;await tick(.17);expect(stock()).toBe(first);
    await click('确认露出');await act(()=>host.querySelector<HTMLInputElement>('input')!.click());await tick();expect(host.textContent).toContain('可出滴');await click('确认露出');
    const both=by('按住双侧');both.focus();await act(()=>{both.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));});await tick();await tick(.17);
    expect(scene.getObjectByName('body:milk-droplets')?.visible).toBe(true);const second=stock();expect(second.left).toBeLessThan(first.left);expect(second.right).toBeLessThan(first.right);
    await click('看乳房');expect(onObserve).toHaveBeenCalledOnce();await tick(.17);expect(stock()).toBe(second);
    await act(()=>root.render(null));await mount();await click('返回角色');expect(onBack).toHaveBeenCalledOnce();expect(stock()).toBe(second);expect(useBodyState.getState().draft).toBeNull();
  }finally{await act(()=>root.unmount());room.dispose();host.remove();clearBackpack();useMmdVrStore.getState().closeOverlay();useBodyState.setState(useBodyState.getInitialState());
    if(old)Object.defineProperty(document,'elementFromPoint',old);else Reflect.deleteProperty(document,'elementFromPoint');vi.restoreAllMocks();vi.unstubAllGlobals();}
});
