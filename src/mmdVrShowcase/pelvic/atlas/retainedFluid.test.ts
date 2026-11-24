import {afterEach,expect,it,vi} from 'vitest';
import {useBackpack} from '../../backpack/store';
import {useMmdVrStore} from '../../mmdVrStore';
import {defaultPelvicCalibration} from '../contract';
import {drainPelvic,patchPelvic,setPelvicCapacity,usePelvic} from '../store';
import {atlasPainter} from './painter';
import {setAtlasView,useAtlasSettings} from './view';

// Read the production raster before any caption, marker or DOM/HUD readout.
// Reduce its pixels to a small plate, so a single full-resolution glint alone
// cannot pass. No browser, native canvas library or extra graphics context.
function raster(){
  class Surface {
    pixels?:Uint8ClampedArray;
    getContext(){return {createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:(img:ImageData)=>{this.pixels=img.data.slice();}};}
  }
  vi.stubGlobal('OffscreenCanvas',Surface);let frame:Uint8ClampedArray|undefined;
  const context=new Proxy({getTransform:()=>({a:1,b:0,c:0,d:1}),measureText:()=>({width:25}),drawImage:(s:Surface)=>{frame=s.pixels;}},
    {get:(o,k)=>Reflect.get(o,k)??(()=>{}),set:()=>true});
  const w=344,h=282,canvas={width:w,height:h,dataset:{},getContext:()=>context,setAttribute:()=>{},getAttribute:()=>''} as unknown as HTMLCanvasElement;
  function read(){const src=frame!;expect(src.length).toBe(w*h*4);const out=new Uint8Array(w*h/4);
    for(let y=0,i=0;y<h;y+=2)for(let x=0;x<w;x+=2,i++){
      const j=4*(y*w+x)+1;out[i]=(src[j]+src[j+4]+src[j+4*w]+src[j+4*w+4])/4;
    }return out;}
  return {canvas,read};
}
const area=(a:Uint8Array,b:Uint8Array)=>a.reduce((n,value,i)=>n+Number(Math.abs(value-b[i])>22),0);
afterEach(()=>{useBackpack.setState(useBackpack.getInitialState());usePelvic.setState(usePelvic.getInitialState());useAtlasSettings.setState({actors:{}});
  useMmdVrStore.setState(useMmdVrStore.getInitialState());vi.unstubAllGlobals();});

it.each(['vagina','uterus'] as const)('repaints only the observed %s balance after a drain / capacity change, at three angles',part=>{
  const actor={assetId:'a',runtimeId:'r'},key=part==='vagina'?'vaginal':'fantasyUterine',other=key==='vaginal'?'fantasyUterine':'vaginal';
  const capacity={vaginal:8,fantasyUterine:16},base={calibration:defaultPelvicCalibration,clothingClear:true,container:other,showAdapter:false,
    fluid:{...capacity,[key]:capacity[key]-1},capacity,drained:0,overflow:0,stroke:.5,speedHz:1} as const;
  useMmdVrStore.setState({overlayOpen:true,physicsBusy:false,physicsFatal:false});
  useBackpack.setState({selected:'a',live:{a:{runtimeId:'r',visible:true,position:[0,0,0]}}});setAtlasView('a',{degrees:0,motion:false});
  const paper=raster(),driver=atlasPainter(paper.canvas,actor,part,()=>{},()=>{});let time=0;
  const frame=()=>{driver.tick(time+=100);return paper.read();};
  try{for(const degrees of [0,38,90]){
    setAtlasView('a',{degrees});usePelvic.setState({byAsset:{a:base}});const near=frame(); // other compartment selected
    expect(patchPelvic('a',{container:key})).toBe(true);expect(drainPelvic('a',capacity[key]-2)).toBe(true);const low=frame();
    expect(setPelvicCapacity('a',capacity[key]*2)).toBe(true);const expanded=frame();
    expect(drainPelvic('a',1)).toBe(true);const dry=frame();
    expect(area(low,dry)).toBeGreaterThan(13);expect(area(near,dry)).toBeGreaterThan(3*area(low,dry));expect(area(expanded,low)).toBeGreaterThan(2);
    expect(patchPelvic('a',{container:other})).toBe(true);expect(drainPelvic('a',capacity[other])).toBe(true);
    expect(area(frame(),dry)).toBe(0);
  }}finally{driver.dispose();}
});
