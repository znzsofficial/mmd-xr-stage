import {useLanguageStore} from '../../../languageStore';
import {PrivateButton,PrivateLine,PrivateSheet,PrivateSlider} from '../HudPrivateControls';
import {AtlasHudGraphic,AtlasScreenGraphic} from './AtlasGraphic';
import type {AtlasActor,AtlasScope} from './painter';
import {atlasAngles,setAtlasView,useAtlasView,type AtlasMode} from './view';
import './atlas.css';

type Props=AtlasActor&{scope:AtlasScope};
const presets=['front','oblique','side'] as const;
const modes=['entry','measure'] as const;
const copy={zh:{entry:'入口方向',organ:'子宫动态图',measure:'棒身位置',front:'正面',oblique:'斜前',side:'侧面',pause:'定格图像',play:'播放图像',rotate:'观察角度',view:'测量视图',drag:'横拖图面旋转'},
  en:{entry:'Opening axis',organ:'Uterine anatomy',measure:'Rod position',front:'Front',oblique:'Oblique',side:'Side',pause:'Freeze motion',play:'Play motion',rotate:'View angle',view:'Measurement view',drag:'Drag to rotate'}};
function ScreenPanel({scope,...actor}:Props){
  const v=useAtlasView(actor.assetId),t=useLanguageStore(s=>s.language==='zh'?copy.zh:copy.en);
  const set=(p:Parameters<typeof setAtlasView>[1])=>setAtlasView(actor.assetId,p),organ=scope==='body';
  const label=useLanguageStore(s=>s.language==='zh'?'标注':'Labels');
  return <div className="anatomy-atlas" data-atlas-scope={scope}>
    <div className="anatomy-atlas-head">
      {scope==='body'?<strong>{t.organ}</strong>:<label className="anatomy-mode">{t.view}<select value={v.mode} onChange={e=>set({mode:e.currentTarget.value as AtlasMode})}>
        {modes.map(k=><option key={k} value={k}>{t[k]}</option>)}</select></label>}
      {organ&&<button type="button" className="anatomy-freeze" aria-pressed={!v.motion} onClick={()=>set({motion:!v.motion})}>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">{v.motion?<path d="M3 2h3v12H3zm7 0h3v12h-3z"/>:<path d="M4 2v12l10-6z"/>}</svg>
        {v.motion?t.pause:t.play}</button>}
    </div>
    <AtlasScreenGraphic {...actor} scope={scope}/>
    <details className="anatomy-orbit-tools"><summary><span>{t.drag}</span><span>{t.rotate}　{v.degrees}°</span></summary>
    <div className="anatomy-angles" role="group" aria-label={t.rotate}>{presets.map(k=><button type="button" key={k}
      aria-pressed={v.degrees===atlasAngles[k]} onClick={()=>set({degrees:atlasAngles[k]})}>{t[k]}</button>)}{organ&&<button type="button" aria-pressed={v.labels} onClick={()=>set({labels:!v.labels})}>{label}</button>}</div>
    <label className="anatomy-orbit"><span>{t.rotate}</span><input aria-label={t.rotate} type="range" min={-90} max={90} value={v.degrees} step={1}
      onChange={e=>set({degrees:e.currentTarget.valueAsNumber})}/><output>{v.degrees}°</output></label></details>
  </div>;
}
function HudPanel({scope,widthM,...actor}:Props&{widthM:number}){
  const v=useAtlasView(actor.assetId),t=useLanguageStore(s=>s.language==='zh'?copy.zh:copy.en),body=scope==='body';
  const label=useLanguageStore(s=>s.language==='zh'?'标注':'Labels');
  const set=(p:Parameters<typeof setAtlasView>[1])=>setAtlasView(actor.assetId,p);
  return <group scale={widthM} name="pelvic:atlas-panel">
    {body&&<PrivateSheet size={[1.02,1.30]}/>}
    {body?<PrivateLine position={[-.18,.568,0]} width={.62} text={t.organ} title/>:
      modes.map((k,i)=><PrivateButton key={k} position={[(i-.5)*.5,.568,0]} size={[.47,.143]} label={t[k]} active={v.mode===k} onPress={()=>set({mode:k})}/>)}
    {body&&<PrivateButton position={[.333,.568,0]} size={[.315,.143]} label={v.motion?t.pause:t.play}
      active={!v.motion} onPress={()=>set({motion:!v.motion})}/>}
    <group position-y={.071}><AtlasHudGraphic {...actor} scope={scope} widthM={1}/></group>
      {body?<><PrivateButton position={[-.381,-.455,0]} size={[.21,.143]} label={label} active={v.labels} onPress={()=>set({labels:!v.labels})}/>
        <PrivateLine position={[-.19,-.455,0]} width={.15} text={`${v.degrees}°`}/></>:<PrivateLine position={[-.30,-.455,0]} width={.37} text={t.rotate} value={`${v.degrees}°`}/>}
      <PrivateSlider position={[.204,-.455,0]} width={.58} value={(v.degrees+90)/180} disabled={false} onChange={n=>set({degrees:n*180-90})}/>
  </group>;
}
export const AtlasScreenPanel=(props:AtlasActor)=><ScreenPanel {...props} scope="pelvic"/>;
export const OrganScreenPanel=(props:AtlasActor)=><ScreenPanel {...props} scope="body"/>;
export const AtlasHudPanel=(props:AtlasActor&{widthM:number})=><HudPanel {...props} scope="pelvic"/>;
export const OrganHudPanel=(props:AtlasActor&{widthM:number})=><HudPanel {...props} scope="body"/>;
