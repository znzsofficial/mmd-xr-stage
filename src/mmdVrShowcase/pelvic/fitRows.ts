import {setApertureMorph} from './apertureConfig';
import {defaultPelvicCalibration,type PelvicCalibration} from './contract';
import {buttons,field,key,note,percentRange,type Localize,type Row} from './controlRows';
import {patchPelvic,PELVIC_LIMITS as lim,type PelvicProfile,type PelvicSupport} from './store';

export type Fit='position'|'angle'|'size'|'model'|'morph';
type FitOptions={assetId:string;source:'screen'|'xr';l:Localize;profile:PelvicProfile;support?:PelvicSupport;fit:Fit;setFit:(s:Fit)=>void;
  morph:string|null;names:readonly string[];page:number;setPage:(n:number)=>void;clothes:()=>void;clear:()=>void};

export function fitRows({assetId,source,l,profile,support,fit,setFit,morph,names,page,setPage,clothes,clear}:FitOptions):Row[]{
  const c=profile.calibration,rows:Row[]=[],patch=(calibration:Partial<PelvicCalibration>)=>patchPelvic(assetId,{calibration,clothingClear:false});
  if(fit==='morph'){
    const none=l('不用形态键','None'),label=l('入口开合形态','Opening morph'),pick=(name:string|null)=>setApertureMorph(assetId,name);
    rows.push(note(l('选模型作者制作的开合形态。没有也能看剖面。','Choose a morph made for the opening. The diagram works without one.')));
    if(source==='screen')rows.push({kind:'choose',label,names,chosen:morph,none,pick});
    else{
      const pages=Math.max(1,Math.ceil(names.length/3)),i=Math.min(page,pages-1);
      rows.push(buttons(key(none,()=>pick(null),{active:!morph})),...names.slice(i*3,i*3+3).map(n=>buttons(key(n,()=>pick(n),{active:n===morph}))));
      if(pages>1)rows.push(buttons(key(l('上一页','Previous'),()=>setPage(i-1),{disabled:i===0}),key(l('下一页','Next'),()=>setPage(i+1),{disabled:i===pages-1})));
    }
    rows.push(buttons(key(l('返回模型设置','Back to model settings'),()=>setFit('model'))));return rows;
  }
  const sub:readonly [Fit,string][]=[['position',l('位置','Position')],['angle',l('角度','Angle')],['size',l('尺寸','Size')],['model',l('模型','Model')]];
  rows.push(buttons(...sub.map(([id,label])=>key(label,()=>setFit(id),{active:fit===id}))));
  if(fit==='position'){
    for(const [i,label] of [l('左右','Left / right'),l('上下','Up / down'),l('前后','In / out')].entries())rows.push(field(label,c.offsetM[i]*100,' cm',percentRange(lim.offsetM),.5,n=>{
      const offset:[number,number,number]=[...c.offsetM];offset[i]=n/100;patch({offsetM:offset});
    }));
  }else if(fit==='angle')rows.push(field(l('抬高或压低棒头','Tilt up / down'),c.pitchDeg,'°',lim.pitchDeg,1,n=>patch({pitchDeg:n})),
    field(l('向左或向右转','Turn left / right'),c.yawDeg,'°',lim.yawDeg,1,n=>patch({yawDeg:n})));
  else if(fit==='size')rows.push(field(l('阴道长度','Vaginal length'),c.lengthM*100,' cm',percentRange(lim.lengthM),.1,n=>patch({lengthM:n/100})),
    field(l('入口半径','Opening radius'),c.radiusM*100,' cm',percentRange(lim.radiusM),.1,n=>patch({radiusM:n/100})));
  else{
    // A visible attachment has its own use case: inspecting the actor's fit.
    // Exposing the port does not require a rod assignment or start a stand.
    const ready=!!support&&support.kind!=='missing'&&!support.obstruction;
    if(profile.showAdapter)rows.push(buttons(key(ready&&profile.clothingClear?l('隐藏外阴附件','Hide vulva attachment'):l('取消显示外阴附件','Turn attachment display off'),()=>patchPelvic(assetId,{showAdapter:false}))));
    if(profile.clothed&&ready)rows.push(buttons(key(l('我看到了入口','I can see the opening'),()=>patchPelvic(assetId,{clothingClear:true,showAdapter:false}))));
    if(!profile.showAdapter||!profile.clothingClear)rows.push(buttons(key(profile.clothingClear?l('显示外阴附件','Show vulva attachment'):
      l('入口已露出，显示外阴附件','Opening is clear · show attachment'),()=>patchPelvic(assetId,{showAdapter:true,clothingClear:true}),{disabled:!ready})));
    if(support?.obstruction)rows.push(buttons(key(l('调整衣物','Manage clothing'),clothes)));
    rows.push(
      buttons(key(l('选择开合形态','Choose opening morph'),()=>{setPage(Math.max(0,Math.floor(names.indexOf(morph??'')/3)));setFit('morph');})),
      buttons(key(c.manual?l('改用骨骼定位','Use bone position'):l('手动指定起点','Set origin manually'),()=>{if(c.manual)patch({manual:null});else if(support?.manualSeed){patch({manual:support.manualSeed});setFit('position');}},{disabled:!c.manual&&!support?.manualSeed})),
      buttons(key(l('还原入口设置','Reset opening fit'),()=>patch({...defaultPelvicCalibration,manual:c.manual}))),
      buttons(key(l('删除此角色的附件设置','Delete attachment settings'),clear,{danger:true})));
  }
  return rows;
}
