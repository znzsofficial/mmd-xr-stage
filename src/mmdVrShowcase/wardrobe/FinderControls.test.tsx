// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, SkinnedMesh, Texture, TextureLoader } from 'three';
import { expect, it, vi } from 'vitest';
import { clearBackpack, useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import { createWardrobeModel } from './model';
import { WardrobeScreenControls } from './WardrobeControls';

it('finds a missed body-named piece, previews only that slot, removes it without disturbing later edits, and switches skin files through the screen',async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const file=new File([],'actor.pmx'),fromBag=new File([],'bag.webp'),fromInput=new File([],'other.png');
  const g=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(18),3))
    .setAttribute('uv',new Float32BufferAttribute(new Float32Array(12),2));g.addGroup(0,3,0);g.addGroup(3,3,1);
  const original=new Texture(),body=new MeshBasicMaterial({name:'Body',map:original}),coat=body.clone(),mesh=new SkinnedMesh(g,[body,coat]);
  const model=createWardrobeModel(mesh,file),[bodyKey,coatKey]=model.slots.map(s=>s.key);
  const host=document.createElement('div'),root=createRoot(host),stage=useMmdVrStore.getState;
  const setVisible=(id:string,key:string,v:boolean)=>{(key===bodyKey?body:coat).visible=v;};
  useBackpack.setState({files:[file,fromBag],entries:[{id:'a',kind:'model',path:file.name,file}],selected:'a',live:{a:{runtimeId:'r',position:[0,0,0],visible:true}}});
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen',materialModels:{r:[bodyKey,coatKey].map(name=>({name,visible:true,opacity:.73,roughness:.4,metallic:0,emission:0}))},
    runtimeRef:{getWardrobe:()=>model,setMaterialVisible:setVisible,setMaterialOverride:vi.fn()}});
  vi.stubGlobal('URL',class extends URL {static createObjectURL(){return 'blob:wardrobe';}static revokeObjectURL(){}});
  const decode=vi.spyOn(TextureLoader.prototype,'loadAsync').mockImplementation(async()=>new Texture<HTMLImageElement>());
  const press=async(label:string)=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===label);expect(button?.disabled,label).toBe(false);await act(()=>button!.click());};
  const select=async(i:number)=>{const el=host.querySelector('select')!;await act(()=>{el.selectedIndex=i;el.dispatchEvent(new Event('change',{bubbles:true}));});};
  try{
    await act(()=>root.render(<WardrobeScreenControls assetId="a" runtimeId="r" onBack={()=>{}}/>));expect(host.querySelectorAll('li')).toHaveLength(0);
    await press('查找漏件');await select(1);await press('预览网格范围');expect(coat.wireframe&&!body.wireframe).toBe(true);
    await press('返回衣柜');expect(coat.wireframe).toBe(false);expect(model.pieces).toHaveLength(0);
    await press('查找漏件');await select(1);await press('保存为衣件');await press('隐藏此件');expect([body.visible,coat.visible]).toEqual([true,false]);
    await act(()=>stage().setMaterialParam('r',coatKey,'roughness',.21));await press('返回衣柜');expect(host.querySelector('li')?.textContent).toContain(coatKey);
    await press('查找漏件');await select(1);await press('移出衣柜');expect(coat.visible).toBe(true);expect(stage().materialModels.r[1]).toMatchObject({roughness:.21,opacity:.73});
    await select(0);await press('更换皮肤贴图');await press('应用这张图');expect(body.map).not.toBe(original);expect(coat.map).toBe(original);expect(model.skin.status(bodyKey).active).toBe(fromBag);
    const input=host.querySelector<HTMLInputElement>('input[type=file]')!;await act(()=>{Object.defineProperty(input,'files',{value:[fromInput]});input.dispatchEvent(new Event('change',{bubbles:true}));});
    await press('应用这张图');expect(model.skin.status(bodyKey).active).toBe(fromInput);await press('恢复原图');expect(body.map).toBe(original);
    expect(model.skin.status(bodyKey).choices).toEqual([fromBag,fromInput]);expect(decode).toHaveBeenCalledTimes(2);
  }finally{await act(()=>root.unmount());model.dispose();clearBackpack();useMmdVrStore.setState({runtimeRef:null,materialModels:{},overlayOpen:false});vi.restoreAllMocks();vi.unstubAllGlobals();}
});
