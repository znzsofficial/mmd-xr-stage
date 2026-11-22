// @vitest-environment jsdom
import {act,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import {Group,Mesh,MeshBasicMaterial,Scene} from 'three';
import {clearBackpack,useBackpack} from '../backpack';
import {useMmdVrStore} from '../mmdVrStore';
import {PelvicScreenControls} from './Controls';
import {assignPelvic,consumePelvicDose,enablePelvic,patchPelvic,publishParkedSample,publishPelvicSample,publishPelvicSupport,usePelvic,type PelvicSample} from './store';
import {mountPelvicRig} from './rig';
import {makeSilicone} from '../play/workshopModels';
import {siliconeMount,siliconeTilt} from '../play/siliconeProfile';

const stage=useMmdVrStore.getState(),pelvic=usePelvic.getState;
const actor={assetId:'a',runtimeId:'r'},initial:PelvicSample={tip:[0,0,.06],tail:[0,0,.18],depth:0,angleDeg:0,aligned:true,
  atCervix:false,outletInside:false,outletVisible:false,radiusM:.024,lengthM:.092};
afterEach(()=>{clearBackpack();useMmdVrStore.setState(stage);vi.restoreAllMocks();vi.unstubAllGlobals();});

it('keeps the named release on the controls, waits for room evidence and resumes the same rig after either navigation callback',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  function Parent(){const [page,go]=useState('insert');return page==='insert'?<PelvicScreenControls {...actor} backLabel="返回互动" onBack={()=>go('main')}
    onClothing={()=>go('wardrobe')} onObserve={()=>go('observe')}/>:<button onClick={()=>go('insert')}>{page} · 返回插入</button>;}
  const host=document.createElement('div'),root=createRoot(host);
  const button=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;
  const click=async(label:string)=>{expect(button(label)?.disabled).toBe(false);await act(()=>button(label).click());};
  try{
    await act(()=>root.render(<Parent/>));await click('为此成年角色放置支架');
    await act(()=>publishPelvicSupport('a',{runtimeId:'r',kind:'bones',anchorName:'hips',obstruction:'garment'}));
    expect(pelvic().active).toMatchObject({assetId:'a',running:false,mode:'standManual'});expect(button('推进')).toBeUndefined();
    expect(button('保持穿衣继续')).toBeUndefined();await act(()=>publishParkedSample(pelvic().active!.token,initial));
    expect(button('我看到了入口')).toBeUndefined();await click('保持穿衣继续');
    await act(()=>publishParkedSample(pelvic().active!.token,initial));await click('宫腔');expect(button('射入宫腔').disabled).toBe(true);
    await click('推进');const token=pelvic().active!.token;expect(button('射入宫腔').disabled).toBe(true);
    await act(()=>{publishPelvicSample(token,{...initial,exteriorCovered:true});});
    expect(host.querySelector('[role=status]')?.textContent).toContain('先推进才能射入');expect(button('向外释放').disabled).toBe(true);
    const inside={...initial,tip:[0,0,-.035] as const,outletInside:true,depth:.035,outletVisible:false};
    await act(()=>{publishPelvicSample(token,inside);});await click('射入宫腔');await act(()=>{expect(consumePelvicDose(token,inside)).toBe('internal');});
    expect(pelvic().byAsset.a.fluid).toEqual({vaginal:0,fantasyUterine:1});
    for(const [link,page] of [['身体观察','observe'],['服装','wardrobe']]){
      await click(link);await click(`${page} · 返回插入`);expect(button('操作').getAttribute('aria-pressed')).toBe('true');
      expect(pelvic().active).toMatchObject({token,running:true});expect(button('射入宫腔').disabled).toBe(false);
    }
    await click('停止');expect(button('停止').disabled).toBe(true);expect(button('射入宫腔').disabled).toBe(true);
    expect(pelvic().sample).toBeNull();expect(pelvic().byAsset.a.clothingClear).toBe(false);
  }finally{await act(()=>root.unmount());}
});

it('operates the actual paused stand from the recording sheet and requires a physical return before enabling playback',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(document,'hidden','get').mockReturnValue(false);
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',playing:false});
  useBackpack.setState({selected:'a',entries:[{id:'a',kind:'model',file:new File([],'a.pmx'),path:'a.pmx'}],live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});
  enablePelvic('a',true);patchPelvic('a',{calibration:{manual:{origin:[0,0,0],unitsPerMeter:1},pitchDeg:0}});patchPelvic('a',{clothed:true});
  const scene=new Scene(),host3D=new Group(),model=new Group(),piece=new Group(),rod=new Mesh(makeSilicone(),new MeshBasicMaterial());
  rod.name='play:piece:dildo';rod.position.fromArray(siliconeMount);rod.rotation.x=siliconeTilt;piece.add(rod);scene.add(host3D,model);host3D.add(piece);
  const room=mountPelvicRig({scene,host:host3D,getRoot:()=>model,standPiece:()=>piece,standSpray:()=>null});
  const frame=()=>room.advance(1/60);frame();assignPelvic('a','standManual','screen');frame();
  const host=document.createElement('div'),root=createRoot(host);
  const find=(s:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===s)!;
  const click=async(s:string)=>{expect(find(s)?.disabled).toBe(false);await act(()=>find(s).click());};
  const frames=async(n:number)=>act(()=>{for(let i=0;i<n;i++)frame();});
  try{
    await act(()=>root.render(<PelvicScreenControls {...actor}/>));await click('手法录放');await click('录制手法');
    expect(find('保存手法').disabled).toBe(true);await click('推进');await click('推进');await click('推进');await frames(36);
    const at=piece.matrixWorld.clone();expect(pelvic().sample?.outletInside).toBe(true);await click('保存手法');await frames(1);
    expect(find('播放手法').disabled).toBe(true);await click('退出到起点');expect(find('播放手法').disabled).toBe(true);await frames(36);
    await click('循环：关');await click('播放手法');await frames(35);expect(pelvic().sample?.outletInside).toBe(true);
    expect(piece.matrixWorld.elements.every((x,i)=>Math.abs(x-at.elements[i])<1e-6)).toBe(true);
    await click('停止回放');await frames(1);expect(pelvic().byAsset.a.fluid.vaginal).toBe(0);
    await click('清除手法');expect(find('播放手法')).toBeUndefined();expect(pelvic().byAsset.a.technique).toBeUndefined();
  }finally{await act(()=>root.unmount());room.dispose();rod.geometry.dispose();rod.material.dispose();}
});
