import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { clearBackpack, syncBackpackFiles, useBackpack } from '../../backpack';
import { adjustRemoteEgg, bindRemoteEgg, cycleRemoteEgg, resetEggOffset, useRemoteEgg } from '../remoteEgg';
import { handleGripStart, useStagePlay } from '../stagePlay';
import { createEggFeedback } from './eggFeedback';
import { eggEnvelope } from './remoteMotor';
import type { GripFrame } from '../propView';

const play=useStagePlay.getState, egg=useRemoteEgg.getState, bag=useBackpack.getState;
const a=new File(['a'],'a.pmx'),b=new File(['b'],'b.pmx'),obj=new File(['mesh'],'o.glb');
const id=(f:File)=>bag().entries.find(e=>e.file===f)!.id;
beforeEach(()=>{
  play().reset();clearBackpack();syncBackpackFiles([a,b,obj]);
  bag().publishLive(Object.fromEntries(bag().entries.map(e=>[e.id,{runtimeId:`runtime:${e.id}`,visible:true,position:[0,0,0]}])));
});
afterEach(()=>{play().reset();clearBackpack();vi.restoreAllMocks();});

it('requires a live visible character and an independently held transmitter, never a wrist',()=>{
  expect(bindRemoteEgg(id(a))).toBe(false); play().equip('remoteEgg','left');
  cycleRemoteEgg();expect(egg().mode).toBe(0);
  expect(bindRemoteEgg(id(obj))).toBe(false);
  play().give(id(a),'right'); expect(play().character).toBeNull();
  expect(bindRemoteEgg(id(a))).toBe(true);
  cycleRemoteEgg();adjustRemoteEgg(0,2);adjustRemoteEgg(1,-3);adjustRemoteEgg(2,1);
  expect(egg()).toEqual({assetId:id(a),mode:1,offset:[2,-3,1]});
  play().equip('remoteEgg','right');expect(play().held?.hand).toBe('right');
  expect(bindRemoteEgg(id(a))).toBe(true);expect(egg().mode).toBe(1);expect(egg().offset).toEqual([2,-3,1]);
  bag().select(id(a));expect(bindRemoteEgg(id(b))).toBe(false); // obsolete binding action against an unselected actor
  bag().select(id(b));expect(egg().assetId).toBe(id(a));
  handleGripStart('remoteEgg','pool',new Vector3(),new Vector3());expect(egg().mode).toBe(2);
  expect(bindRemoteEgg(id(b))).toBe(true);expect(egg()).toEqual({assetId:id(b),mode:0,offset:[0,0,0]});
  for(const i of [1,2,3,0]){cycleRemoteEgg();expect(egg().mode).toBe(i);}
  adjustRemoteEgg(1,Infinity);expect(egg().offset[1]).toBe(0);adjustRemoteEgg(2,-10000);expect(egg().offset[2]).toBe(-50);
  resetEggOffset();expect(egg().offset).toEqual([0,0,0]);
});

it.each(['invisible','removed','put away','replaced','unlisted','new toy','exit','room retired'] as const)('cuts feedback and binding synchronously when %s, without a later implicit rebind',reason=>{
  play().equip('remoteEgg','left');bindRemoteEgg(id(a));cycleRemoteEgg();adjustRemoteEgg(1,4);
  const original=bag().live, who=id(a), other=id(b);
  bag().publishLive({...original,[other]:{...original[other],visible:false}});
  expect(bindRemoteEgg(other)).toBe(false);expect(egg().mode).toBe(1);
  if(reason==='invisible')bag().publishLive({...original,[who]:{...original[who],visible:false}});
  if(reason==='removed')bag().publishLive(Object.fromEntries(Object.entries(original).filter(([k])=>k!==who)));
  if(reason==='put away')bag().putAway(who);
  if(reason==='replaced')bag().publishLive({...original,[who]:{...original[who],runtimeId:'new instance'}});
  if(reason==='unlisted')syncBackpackFiles([b,obj]);
  if(reason==='new toy')play().equip('saber','left');
  if(reason==='exit')play().reset();
  if(reason==='room retired')bag().publishLive({});
  expect(egg()).toEqual({assetId:null,mode:0,offset:[0,0,0]});expect(play().held?.toy).not.toBe('remoteEgg');
  cycleRemoteEgg();adjustRemoteEgg(2,2);bag().publishLive(original);expect(egg().assetId).toBeNull();
});

it('uses one bounded phase for steady power, repeating rise and a real silent interval',()=>{
  for(const t of [0,90,490,960,3500]){expect(eggEnvelope(0,t)).toBe(0);expect(eggEnvelope(1,t)).toBe(eggEnvelope(1,0));}
  expect(eggEnvelope(2,2500)).toBeGreaterThan(eggEnvelope(2,1500));expect(eggEnvelope(2,3500)).toBe(eggEnvelope(2,500));
  expect([0,320,879,880].map(t=>eggEnvelope(3,t)>0)).toEqual([true,false,false,true]);
});

it('samples only the usable hand and preference, on a bounded cadence, never by writing global state',()=>{
  vi.spyOn(performance,'now').mockReturnValue(0);
  const pulse=vi.fn(()=>true), right=vi.fn(()=>true);
  const pad=(fn:typeof pulse)=>({hapticActuators:[{pulse:fn}]} as unknown as Gamepad);
  const frame:GripFrame={usable:true,gamepad:pad(pulse),action:'held',at:new Vector3(),dir:new Vector3(),dt:1/90};
  const driver=createEggFeedback();play().equip('remoteEgg','left');bindRemoteEgg(id(a));cycleRemoteEgg();cycleRemoteEgg();cycleRemoteEgg();
  const changed=vi.fn(),off=useRemoteEgg.subscribe(changed);
  try{
    for(let t=0;t<=870;t+=10)driver.update(frame,'normal',t);
    expect(pulse).toHaveBeenCalledTimes(2); // 0 and 170 in the powered part of the cycle
    const normal=pulse.mock.calls[0] as unknown as number[];
    driver.update(frame,'off',880);expect(pulse).toHaveBeenCalledTimes(2);
    frame.usable=false;driver.update(frame,'normal',880);expect(pulse).toHaveBeenCalledTimes(2);
    frame.gamepad=pad(right);frame.usable=true;driver.update(frame,'low',880);
    expect(right).toHaveBeenCalledTimes(1);expect((right.mock.calls[0] as unknown as number[])[0]).toBeLessThan(normal[0]);
    expect(changed).not.toHaveBeenCalled();
    cycleRemoteEgg();frame.action='start';driver.update(frame,'low',890);expect(right).toHaveBeenCalledTimes(2); // confirm off
    frame.action='held';driver.update(frame,'normal',1200);expect(right).toHaveBeenCalledTimes(2);
    play().stow();frame.action='start';driver.update(frame,'normal',1600);expect(right).toHaveBeenCalledTimes(2);
  }finally{off();driver.reset();}
});
