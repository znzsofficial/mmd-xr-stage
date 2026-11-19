import { Canvas } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { BackpackPlacement } from '../components/BackpackPlacement';
import { MmdVrStageContent } from '../components/MmdVrStage';
import { getMmdVrClock } from '../mmdVrClock';
import { getMmdVrRenderProfile } from '../mmdVrQuality';
import { useMmdVrStore } from '../mmdVrStore';
import { MmdVrThemeProvider } from '../mmdVrTheme';
import { isStoryRoom } from '../play/stagePlay';
import { StoryStations } from '../play/StoryStations';
import { PrepIcon } from '../prep/PrepIcon';
import { resolveScenery, SCENERY, sceneryIds } from '../scenery/catalog';
import { ScreenCamera, tourShots, type CameraActions } from './ScreenCamera';
import { ScreenLibrary } from './ScreenLibrary';
import './screen-stage.css';

function timecode(t:number){return `${Math.floor(t/60)}:${String(Math.floor(t)%60).padStart(2,'0')}`;}
function Transport({locked}:{locked:boolean}) {
  const physics=useMmdVrStore(s=>s.physicsEnabled),count=useMmdVrStore(s=>s.modelCount);
  const t=useLanguageStore(s=>s.t),duration=useMmdVrStore(s=>s.duration),playing=useMmdVrStore(s=>s.playing),loop=useMmdVrStore(s=>s.loop);
  const [time,setTime]=useState(0);
  useEffect(()=>{const read=()=>setTime(getMmdVrClock().time);read();if(duration>0){const timer=window.setInterval(read,125);return ()=>clearInterval(timer);}},[duration]);
  const stage=useMmdVrStore.getState();
  return <footer className="screen-transport"><button className="screen-play" disabled={locked||duration<=0} onClick={()=>{if(!playing&&getMmdVrClock().time>=duration)stage.requestSeek(0);stage.setPlaying(!playing);}}>
    <PrepIcon name={playing?'pause':'play'} size={16}/>{t(playing?'settingsMmdVrPause':'settingsMmdVrPlay')}</button>
    <output>{timecode(time)}</output><input aria-label={t('screenSeek')} type="range" min={0} max={duration||1} step={.01} value={Math.min(time,duration)} disabled={locked||duration<=0} onChange={e=>{const n=e.target.valueAsNumber;stage.requestSeek(n);setTime(n);}}/><output>{timecode(duration)}</output>
    <label><input type="checkbox" checked={loop} onChange={e=>stage.setLoop(e.target.checked)}/>{t('screenLoop')}</label>
    {count>0&&<label><input type="checkbox" checked={physics} disabled={locked} onChange={e=>stage.setPhysicsEnabled(e.target.checked)}/>{t('hudPhysics')}</label>}
  </footer>;
}

export function ScreenStage(){
  const t=useLanguageStore(s=>s.t),prefs=useMmdVrStore(s=>s.prefs),profile=getMmdVrRenderProfile(prefs);
  const stage=useMmdVrStore.getState(),load=useMmdVrStore(s=>s.assetLoad),physicsBusy=useMmdVrStore(s=>s.physicsBusy),fatal=useMmdVrStore(s=>s.physicsFatal),physicsError=useMmdVrStore(s=>s.physicsError);
  const busy=useBackpack(s=>s.busy),draft=useBackpack(s=>s.draft),err=useBackpack(s=>s.error),selected=useBackpack(s=>s.selected);
  const [library,setLibrary]=useState(false),dialog=useRef<HTMLDialogElement>(null),actions=useRef<CameraActions|null>(null),life=useRef(0);
  const [cameraReady,setCameraReady]=useState(false),locked=!cameraReady||busy||load.running||physicsBusy||fatal;
  useLayoutEffect(()=>{const el=dialog.current!;el.showModal();return ()=>el.close();},[]);
  useEffect(()=>{const generation=++life.current,epoch=useMmdVrStore.getState().entryEpoch;
    return ()=>queueMicrotask(()=>{const s=useMmdVrStore.getState();if(generation===life.current&&s.entryEpoch===epoch&&s.overlayOpen)s.closeOverlay();});},[]);
  useEffect(()=>{if(selected)setLibrary(true);},[selected]);
  const close=()=>stage.closeOverlay();
  const message=err||physicsError||load.failures.map(f=>`${f.fileName}: ${f.message}`).join(' · ');
  return <dialog ref={dialog} className="screen-stage" aria-label={t('screenWatch')} onCancel={e=>{e.preventDefault();if(draft)useBackpack.getState().cancelPlace();else if(library)setLibrary(false);else close();}}>
    <header className="screen-header"><h1><PrepIcon name="screen"/>{t('screenWatch')}</h1>
      <select aria-label={t('sceneryPicker')} value={prefs.scenery} disabled={locked} onChange={e=>stage.setPrefs({scenery:resolveScenery(e.target.value)})}>
        {sceneryIds.map(id=><option key={id} value={id}>{t(SCENERY[id].label)}</option>)}
      </select><button className="screen-back" onClick={close}>{t('loadBack')}</button></header>
    <div className="screen-workspace"><div className="screen-picture">
      <MmdVrThemeProvider><Canvas gl={{antialias:prefs.antialiasPref!=='off',powerPreference:'high-performance'}} shadows={profile.shadows} dpr={prefs.dprPref==='auto'?[1,1.6]:profile.dpr} camera={{position:[0,1.65,4],near:.03,far:prefs.viewDistance,fov:50}} fallback={<p role="alert">{t('screenWebgl')}</p>}>
        <MmdVrStageContent/><StoryStations/><BackpackPlacement onScreenPick={()=>setLibrary(true)}/><ScreenCamera actions={actions} onReady={setCameraReady}/>
      </Canvas></MmdVrThemeProvider>
      <div className="screen-corner"><button aria-expanded={library&&!draft} onClick={()=>{if(draft){useBackpack.getState().cancelPlace();setLibrary(true);}else setLibrary(v=>!v);}}><PrepIcon name="bag"/>{t('hudBackpack')}</button><button onClick={()=>actions.current?.reset()}>{t('settingsMmdVrResetView')}</button>
        {tourShots(prefs.scenery).length>0&&<select aria-label={t('courtTour')} value="" onChange={e=>actions.current?.tour(Number(e.target.value))}><option value="" disabled>{t('courtTour')}</option>{tourShots(prefs.scenery).map((s,i)=><option key={s.key} disabled={(s.key==='campusGoLawn'||s.key==='campusGoClass')&&(locked||!!draft||load.failures.length>0)} value={i}>{t(s.key)}</option>)}</select>}
      </div>
      <div className="screen-caption" role="status">{message?<><span>{message}</span>{load.failures.length>0&&<button disabled={locked} onClick={stage.retryFailedAssets}>{t('loadRetry')}</button>}{err&&<button onClick={()=>useBackpack.getState().dismissError()}>{t('hudDone')}</button>}</>:locked?t('hudWorking'):draft?<><span>{t('screenAim')}</span><button onClick={()=>actions.current?.center()}>{t('screenCenter')}</button><button onClick={()=>useBackpack.getState().cancelPlace()}>{t('hudCancelPlace')}</button></>:t('screenOrbit')}</div>
    </div>{library&&!draft&&<ScreenLibrary locked={locked} frame={()=>actions.current?.frame()} storyView={isStoryRoom(prefs.scenery)?()=>actions.current?.story():undefined} close={()=>setLibrary(false)}/>}</div>
    <Transport locked={locked}/>
  </dialog>;
}
