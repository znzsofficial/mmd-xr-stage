import {useLanguageStore} from '../../../languageStore';
import {PrivateButton,PrivateLine,PrivateSheet,PrivateSlider} from '../HudPrivateControls';
import {AtlasHudGraphic,AtlasScreenGraphic} from './AtlasGraphic';
import type {AtlasActor,AtlasScope} from './painter';
import {atlasAngles,setAtlasView,useAtlasView} from './view';
import './atlas.css';

type Props=AtlasActor&{scope:AtlasScope};
const presets=['front','oblique','side'] as const;
const copy={zh:{organ:'器官动态',measure:'测量剖面',front:'正面',oblique:'斜前',side:'侧面',pause:'定格图像',play:'播放图像',rotate:'观察角度'},
  en:{organ:'Organ motion',measure:'Measurements',front:'Front',oblique:'Oblique',side:'Side',pause:'Freeze motion',play:'Play motion',rotate:'View angle'}};
function ScreenPanel({scope,...actor}:Props){
  const v=useAtlasView(actor.assetId),t=useLanguageStore(s=>s.language==='zh'?copy.zh:copy.en);
  const set=(p:Parameters<typeof setAtlasView>[1])=>setAtlasView(actor.assetId,p),organ=scope==='body'||v.mode==='organ';
  return <div className="anatomy-atlas" data-atlas-scope={scope}>
    <div className="anatomy-atlas-head">
      {scope==='body'?<strong>{t.organ}</strong>:<div className="anatomy-atlas-modes">{(['organ','measure'] as const).map(k=><button type="button" key={k}
        aria-pressed={v.mode===k} onClick={()=>set({mode:k})}>{t[k]}</button>)}</div>}
      {organ&&<button type="button" className="anatomy-freeze" aria-pressed={!v.motion} onClick={()=>set({motion:!v.motion})}>
        <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13" fill="currentColor">{v.motion?<path d="M3 2h3v12H3zm7 0h3v12h-3z"/>:<path d="M4 2v12l10-6z"/>}</svg>
        {v.motion?t.pause:t.play}</button>}
    </div>
    <AtlasScreenGraphic {...actor} scope={scope}/>
    <div className="anatomy-angles" role="group" aria-label={t.rotate}>{presets.map(k=><button type="button" key={k}
      aria-pressed={v.degrees===atlasAngles[k]} onClick={()=>set({degrees:atlasAngles[k]})}>{t[k]}</button>)}</div>
    <label className="anatomy-orbit"><span>{t.rotate}</span><input aria-label={t.rotate} type="range" min={-90} max={90} value={v.degrees} step={1}
      onChange={e=>set({degrees:e.currentTarget.valueAsNumber})}/><output>{v.degrees}°</output></label>
  </div>;
}
function HudPanel({scope,widthM,...actor}:Props&{widthM:number}){
  const v=useAtlasView(actor.assetId),t=useLanguageStore(s=>s.language==='zh'?copy.zh:copy.en),body=scope==='body';
  const set=(p:Parameters<typeof setAtlasView>[1])=>setAtlasView(actor.assetId,p);
  return <group scale={widthM} name="pelvic:atlas-panel">
    {body&&<PrivateSheet size={[1.02,1.30]}/>}
    {body?<PrivateLine position={[-.14,.568,0]} width={.70} text={t.organ} title/>:<>
      <PrivateButton position={[-.333,.568,0]} size={[.31,.143]} label={t.organ} active={v.mode==='organ'} variant="tab" onPress={()=>set({mode:'organ'})}/>
      <PrivateButton position={[0,.568,0]} size={[.325,.143]} label={t.measure} active={v.mode==='measure'} variant="tab" onPress={()=>set({mode:'measure'})}/></>}
    {(body||v.mode==='organ')&&<PrivateButton position={[.333,.568,0]} size={[.315,.143]} label={v.motion?t.pause:t.play}
      active={!v.motion} onPress={()=>set({motion:!v.motion})}/>}
    <group position-y={.071}><AtlasHudGraphic {...actor} scope={scope} widthM={1}/></group>
    {presets.map((k,i)=><PrivateButton key={k} position={[(i-1)*.336,-.43,0]} size={[.310,.143]} label={t[k]}
      active={v.degrees===atlasAngles[k]} onPress={()=>set({degrees:atlasAngles[k]})}/>)}
    <PrivateLine position={[-.38,-.584,0]} width={.21} text={`${v.degrees}°`}/>
    <PrivateSlider position={[.107,-.582,0]} width={.715} value={(v.degrees+90)/180} disabled={false} onChange={n=>set({degrees:n*180-90})}/>
  </group>;
}
export const AtlasScreenPanel=(props:AtlasActor)=><ScreenPanel {...props} scope="pelvic"/>;
export const OrganScreenPanel=(props:AtlasActor)=><ScreenPanel {...props} scope="body"/>;
export const AtlasHudPanel=(props:AtlasActor&{widthM:number})=><HudPanel {...props} scope="pelvic"/>;
export const OrganHudPanel=(props:AtlasActor&{widthM:number})=><HudPanel {...props} scope="body"/>;
