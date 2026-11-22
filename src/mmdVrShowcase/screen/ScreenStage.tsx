import { Canvas } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { BackpackPlacement } from '../components/BackpackPlacement';
import { MmdVrStageContent } from '../components/MmdVrStage';
import { getMmdVrClock } from '../mmdVrClock';
import { getMmdVrRenderProfile } from '../mmdVrQuality';
import { useMmdVrStore } from '../mmdVrStore';
import { isStoryRoom } from '../play/stagePlay';
import { StoryStations } from '../play/StoryStations';
import { PrepIcon } from '../prep/PrepIcon';
import { isPortalRoom, portalHall, resolveScenery } from '../scenery/catalog';
import { SceneryOptions } from '../scenery/SceneryOptions';
import { ScreenCamera, type CameraActions } from './ScreenCamera';
import {planetTourGroups,tourShots} from '../scenery/roomViews';
import { ScreenLibrary } from './ScreenLibrary';
import { ScreenMusic } from '../music/ScreenMusic';
import {usePelvic} from '../pelvic/store';
import {stageHudVars} from '../pelvic/palette';
import {useScreenPanels} from './useScreenPanels';
import './screen-stage.css';

function timecode(t:number){return `${Math.floor(t/60)}:${String(Math.floor(t)%60).padStart(2,'0')}`;}
function Transport({locked}:{locked:boolean}) {
  const physics=useMmdVrStore(s=>s.physicsEnabled),count=useMmdVrStore(s=>s.modelCount);
  const chest=useMmdVrStore(s=>s.prefs.chestCompression);
  const t=useLanguageStore(s=>s.t),duration=useMmdVrStore(s=>s.duration),playing=useMmdVrStore(s=>s.playing),loop=useMmdVrStore(s=>s.loop);
  const [time,setTime]=useState(0);
  useEffect(()=>{const read=()=>setTime(getMmdVrClock().time);read();if(duration>0){const timer=window.setInterval(read,125);return ()=>clearInterval(timer);}},[duration]);
  const stage=useMmdVrStore.getState();
  return <footer className="screen-transport"><button className="screen-play" data-primary={!playing||undefined} data-playing={playing||undefined} disabled={locked||duration<=0} onClick={()=>{if(!playing&&getMmdVrClock().time>=duration)stage.requestSeek(0);stage.setPlaying(!playing);}}>
    <PrepIcon name={playing?'pause':'play'} size={16}/>{t(playing?'settingsMmdVrPause':'settingsMmdVrPlay')}</button>
    <output>{timecode(time)}</output><input aria-label={t('screenSeek')} type="range" min={0} max={duration||1} step={.01} value={Math.min(time,duration)} disabled={locked||duration<=0} onChange={e=>{const n=e.target.valueAsNumber;stage.requestSeek(n);setTime(n);}}/><output>{timecode(duration)}</output>
    <label><input type="checkbox" checked={loop} onChange={e=>stage.setLoop(e.target.checked)}/>{t('screenLoop')}</label>
    {count>0&&<label><input type="checkbox" checked={physics} disabled={locked} onChange={e=>stage.setPhysicsEnabled(e.target.checked)}/>{t('hudPhysics')}</label>}
    {count>0&&<label><input type="checkbox" checked={chest} disabled={locked} onChange={e=>stage.setPrefs({chestCompression:e.target.checked})}/>{t('chestPressure')}</label>}
  </footer>;
}

export function ScreenStage(){
  const t=useLanguageStore(s=>s.t),prefs=useMmdVrStore(s=>s.prefs),profile=getMmdVrRenderProfile(prefs);
  const stage=useMmdVrStore.getState(),load=useMmdVrStore(s=>s.assetLoad),physicsBusy=useMmdVrStore(s=>s.physicsBusy),fatal=useMmdVrStore(s=>s.physicsFatal),physicsError=useMmdVrStore(s=>s.physicsError);
  const busy=useBackpack(s=>s.busy),draft=useBackpack(s=>s.draft),err=useBackpack(s=>s.error),selected=useBackpack(s=>s.selected);
  const library=useScreenPanels(),resume=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLDialogElement>(null),actions=useRef<CameraActions|null>(null),life=useRef(0);
  const viewport=useRef<HTMLDivElement>(null);
  const inspectStand=usePelvic(s=>!!selected&&s.active?.assetId===selected&&s.active.mode!=='xrManual'&&!!(s.parkedSample||s.sample));
  const [cameraReady,setCameraReady]=useState(false),locked=!cameraReady||busy||load.running||physicsBusy||fatal;
  useLayoutEffect(()=>{const el=dialog.current!;el.showModal();viewport.current?.focus({preventScroll:true});return ()=>el.close();},[]);
  useEffect(()=>{const generation=++life.current,epoch=useMmdVrStore.getState().entryEpoch;
    return ()=>queueMicrotask(()=>{const s=useMmdVrStore.getState();if(generation===life.current&&s.entryEpoch===epoch&&s.overlayOpen)s.closeOverlay();});},[]);
  useLayoutEffect(()=>{if(library.suspended&&!library.bag)resume.current?.focus({preventScroll:true});},[library.suspended,library.bag]);
  const close=()=>stage.closeOverlay();
  const message=err||physicsError||load.failures.map(f=>`${f.fileName}: ${f.message}`).join(' · ');
  return <dialog ref={dialog} className="screen-stage" style={stageHudVars} aria-label={t('screenWatch')} onCancel={e=>{e.preventDefault();if(draft)useBackpack.getState().cancelPlace();else if(library.visible)library.close();else close();}}>
    <header className="screen-header"><h1><PrepIcon name="screen"/>{t('screenWatch')}</h1>
      <select aria-label={t('sceneryPicker')} value={prefs.scenery} disabled={locked} onChange={e=>stage.setPrefs({scenery:resolveScenery(e.target.value)})}>
        <SceneryOptions current={prefs.scenery}/>
      </select><button className="screen-back" onClick={close}>{t('loadBack')}</button></header>
    <div className="screen-workspace"><div className="screen-picture" ref={viewport} tabIndex={0} role="region" aria-label={t('screenWatch')} aria-describedby="screen-camera-hint"
      onPointerDownCapture={e=>{if(e.target instanceof HTMLCanvasElement)e.currentTarget.focus({preventScroll:true});}}>
      <Canvas gl={{antialias:prefs.antialiasPref!=='off',powerPreference:'high-performance'}} shadows={profile.shadows} dpr={prefs.dprPref==='auto'?[1,1.6]:profile.dpr} camera={{position:[0,1.65,4],near:.03,far:prefs.viewDistance,fov:50}} fallback={<p role="alert">{t('screenWebgl')}</p>}>
        <MmdVrStageContent/><StoryStations/><BackpackPlacement onScreenPick={library.openItem}/><ScreenCamera actions={actions} onReady={setCameraReady} viewport={viewport}/>
      </Canvas>
      <div className="screen-corner"><button aria-expanded={library.bag&&!draft} onClick={()=>{if(draft)useBackpack.getState().cancelPlace();if(library.bag&&!draft)library.close();else library.openBackpack();}}><PrepIcon name="bag"/>{t('hudBackpack')}</button>
         {library.suspended&&!draft&&<button ref={resume} className="screen-resume-preview" onClick={library.openItem}>{t('bodyResume')}</button>}
         <button onClick={()=>actions.current?.reset()}>{t('settingsMmdVrResetView')}</button>
         {tourShots(prefs.scenery).length>0&&<select aria-label={t('courtTour')} value="" onChange={e=>actions.current?.tour(Number(e.target.value))}><option value="" disabled>{t('courtTour')}</option>{prefs.scenery==='glassPlanet'?planetTourGroups.map(g=><optgroup key={g.label} label={t(g.label)}>{g.items.map(s=><option key={s.key} value={s.index}>{t(s.key)}</option>)}</optgroup>):tourShots(prefs.scenery).map((s,i)=><option key={s.key} disabled={!!s.link&&(locked||!!draft||load.failures.length>0)} value={i}>{t(s.key)}</option>)}</select>}
         {library.visible&&inspectStand&&!draft&&<button disabled={locked} onClick={()=>actions.current?.inspectStand()}>{t('screenInspectStand')}</button>}
         {isPortalRoom(prefs.scenery)&&<button disabled={locked||!!draft} onClick={()=>stage.setPrefs({scenery:portalHall})}>{t('returnPortalHall')}</button>}
       </div>
       {prefs.scenery===portalHall&&!draft&&<div className="screen-arcade-hint">{t('portalHint')}</div>}
       {prefs.scenery==='arcadeHall'&&!draft&&<div className="screen-arcade-hint">{t('arcPassHint')}</div>}
       {prefs.scenery==='glassPlanet'&&!draft&&<div className="screen-arcade-hint">{t('planetWindHint')}</div>}
       <div id="screen-camera-hint" className="screen-caption" data-camera-help={!message&&!locked&&!draft||undefined} role="status">{message?<><span>{message}</span>{load.failures.length>0&&<button disabled={locked} onClick={stage.retryFailedAssets}>{t('loadRetry')}</button>}{err&&<button onClick={()=>useBackpack.getState().dismissError()}>{t('hudDone')}</button>}</>:locked?t('hudWorking'):draft?<><span>{t('screenAim')}</span>{prefs.scenery!=='arcadeHall'&&<button onClick={()=>actions.current?.center()}>{t('screenCenter')}</button>}<button onClick={()=>useBackpack.getState().cancelPlace()}>{t('hudCancelPlace')}</button></>:<>{t('screenOrbit')}<span className="screen-key-hint">{t('screenCameraKeys')}</span></>}</div>
    </div>{!draft&&(library.visible||library.suspended)&&<ScreenLibrary key={prefs.scenery} view={library.bag?'backpack':'item'} visit={library.visit} suspended={library.suspended} locked={locked}
      frame={()=>actions.current?.frame()} closeUp={focus=>actions.current?.upperBody(focus)} storyView={isStoryRoom(prefs.scenery)?()=>actions.current?.story():undefined} close={library.close} openItem={library.openItem} openBackpack={library.openBackpack}/>}</div>
    <div><ScreenMusic/><Transport locked={locked}/></div>
  </dialog>;
}
