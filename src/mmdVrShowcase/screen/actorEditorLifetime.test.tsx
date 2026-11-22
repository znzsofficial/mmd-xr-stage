// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {useLanguageStore} from '../../languageStore';
import {clearBackpack,useBackpack} from '../backpack';
import {beginBodyPreview,patchBodyPreview,useBodyState} from '../bodyState/store';
import {useMmdVrStore} from '../mmdVrStore';
import {ScreenLibrary} from './ScreenLibrary';

vi.mock('../pelvic/Controls',()=>({PelvicScreenControls:()=>null}));
vi.mock('../pelvic/atlas/AtlasPanel',()=>({OrganScreenPanel:()=>null,OrganHudPanel:()=>null}));

it('preserves the open actor preview while physics rebuilds the transform, and discards it on leaving',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const stage=useMmdVrStore.getState(),model={id:'m',name:'actor',visible:true,scale:1,rotationY:0};
  useMmdVrStore.setState({models:[model],physicsBusy:false});
  useBackpack.setState({entries:[{id:'a',kind:'model',file:new File([],'actor.pmx'),path:'actor.pmx'}],live:{a:{runtimeId:'m',visible:true,position:[0,0,0]}},selected:'a'});
  const host=document.createElement('div'),root=createRoot(host);
  const show=(locked:boolean)=>root.render(<ScreenLibrary locked={locked} close={()=>{}} frame={()=>{}}/>);
  const click=(label:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===label)!.click();
  try{
    await act(()=>show(false));await act(()=>click(useLanguageStore.getState().t('actorBodyState')));
    await act(()=>{expect(beginBodyPreview('a',true)).toBe(true);patchBodyPreview('a',{fullness:.7});});
    const slider=host.querySelector<HTMLInputElement>('.body-screen input[type="range"]')!;
    await act(()=>{useMmdVrStore.setState({models:[],physicsBusy:true});show(true);});
    expect(host.contains(slider)&&slider.disabled).toBe(true);expect(useBodyState.getState().draft?.value.fullness).toBe(.7);
    await act(()=>{useMmdVrStore.setState({models:[model],physicsBusy:false});show(false);});
    expect(slider.disabled).toBe(false);expect(slider.valueAsNumber).toBe(.7);
    await act(()=>host.querySelector<HTMLButtonElement>('.body-page button')!.click());
    expect(useBodyState.getState().draft).toBeNull();expect(useBodyState.getState().byAsset).toEqual({});
  }finally{await act(()=>root.unmount());clearBackpack();useMmdVrStore.setState(stage);vi.unstubAllGlobals();}
});
