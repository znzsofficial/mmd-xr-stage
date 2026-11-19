import { useLanguageStore } from '../../languageStore';
import { useBackpack, type BackpackEntry } from '../backpack';
import { nextMmdVrModelScale, previousMmdVrModelScale } from '../mmdVrAdjustments';
import { useMmdVrStore } from '../mmdVrStore';
import { useLayoutEffect, useRef, useState } from 'react';
import { isStoryRoom, shelfToys, STORIES, TOYS, TOY_GUIDES, toyHomeLabel, toyWorksHere, useStagePlay, type Hand, type Toy, type StoryRoom } from '../play/stagePlay';
import type { SceneryId } from '../scenery/catalog';
import {showSceneryGrid} from '../scenery/catalog';
import {getMmdVrRenderProfile} from '../mmdVrQuality';
import { cueStory, resetEncore } from '../play/storyActions';

function giveScreenToy(id:string,toy:Toy,hand:Hand,room:SceneryId){
  const actor=useBackpack.getState().live[id];if(!actor?.visible||!actor.wrists?.[hand])return;
  const play=useStagePlay.getState();if(play.held?.toy!==toy&&(play.character?.assetId!==id||play.character.toy!==toy)){
    play.equip(toy,hand);if(toy==='saber'&&toyWorksHere(toy,room))play.toggleSaber();
  }play.give(id,hand);
}

function ScreenToyGuide({toy,room,locked,close}:{toy:Toy;room:SceneryId;locked:boolean;close:()=>void}){
  const t=useLanguageStore(s=>s.t),dialog=useRef<HTMLDialogElement>(null),item=TOYS[toy],[vr,screen,end]=TOY_GUIDES[toy];
  useLayoutEffect(()=>{const el=dialog.current!;el.showModal();return ()=>el.close();},[]);
  return <dialog ref={dialog} className="screen-guide-dialog" aria-labelledby="toy-guide-title" onCancel={e=>{e.preventDefault();e.stopPropagation();close();}}>
    <h3 id="toy-guide-title">{t(item.label)} · {t('toyGuide')}</h3><p>{t('toyShelfHome')}{t(toyHomeLabel[toy])}</p>
    <p>{t('toyGuideScreenGive')}</p><p>{t(screen)}</p><p><strong>VR</strong> · {t(vr)}</p><p>{t(end)}</p>
    <div className="screen-buttons"><button autoFocus onClick={close}>{t('toyCloseGuide')}</button>{item.home&&room!==item.home&&<button disabled={locked} onClick={()=>{close();useMmdVrStore.getState().setPrefs({scenery:item.home});}}>{t(item.visit)}</button>}</div>
  </dialog>;
}

export function ScreenLibrary({locked,close,frame,storyView}:{locked:boolean;close:()=>void;frame:()=>void;storyView?:()=>void}) {
  const t=useLanguageStore(s=>s.t),b=useBackpack(),selected=b.entries.find(e=>e.id===b.selected);
  const room=useMmdVrStore(s=>s.prefs.scenery);
  const assets=b.entries.filter(e=>e.kind!=='motion');
  const [guide,setGuide]=useState<Toy|null>(null),actor=selected?.kind==='model'?b.live[selected.id]:null;
  const [choice,choose]=useState<{id:string;toy:Toy}|null>(null);
  const palm=useMmdVrStore(s=>s.prefs.actorPalmCloth),physics=useMmdVrStore(s=>s.physicsEnabled);
  const prefs=useMmdVrStore(s=>s.prefs),profile=getMmdVrRenderProfile(prefs),grid=showSceneryGrid(room,profile.showGrid,prefs.gridPref==='on',false);
  const start=(entry:BackpackEntry)=>{b.beginPlace(entry.id);if(useBackpack.getState().draft)close();};
  return <aside className="screen-library" aria-label={t('hudBackpack')}>
    <div className="screen-library-head"><h2>{t('hudBackpack')}</h2><button onClick={close}>{t('screenHide')}</button></div>
    {isStoryRoom(room)&&<ScreenCues key={room} room={room} locked={locked} view={storyView}/>}
    <details className="screen-toy-guide"><summary>{t('toyList')} · {shelfToys.length}</summary>
      <p>{t('toyGuideScreenGive')}</p><ul>{shelfToys.map(toy=>{const {label}=TOYS[toy];return <li key={toy}>
        <span>{t(room==='pool'&&toy==='bubbles'?'toyShell':label)}<small>{t('toyShelfHome')}{t(toyHomeLabel[toy])}</small></span>
        <div>{actor&&selected&&(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!actor.visible||!actor.wrists?.[hand]} onClick={()=>{choose({id:selected.id,toy});giveScreenToy(selected.id,toy,hand,room);}}>{t(hand==='left'?'propLeft':'propRight')}</button>)} <button onClick={()=>setGuide(toy)}>{t('toyGuide')}</button></div>
      </li>;})}</ul></details>
    {guide&&<ScreenToyGuide toy={guide} room={room} locked={locked} close={()=>setGuide(null)}/>}
    <details className="screen-stage-options"><summary>{t('settingsEnvironment')}</summary>
      <label><input type="checkbox" checked={profile.shadows} onChange={e=>useMmdVrStore.getState().setPrefs({shadowsPref:e.target.checked?'on':'off'})}/>{t('settingsMmdVrShadows')}</label>
      <label><input type="checkbox" checked={grid} onChange={e=>useMmdVrStore.getState().setPrefs({gridPref:e.target.checked?'on':'off'})}/>{t('settingsMmdVrGrid')}</label>
    </details>
    <details className="screen-stage-options"><summary>{t('contactDetails')}</summary>
      <p>{t('missingPalmContact')}</p><label><input type="checkbox" checked={palm} disabled={locked||physics} onChange={e=>useMmdVrStore.getState().setPrefs({actorPalmCloth:e.target.checked})}/>{t('actorPalmShort')}</label><p>{t(physics?'contactDisableFirst':'contactNextPhysics')}</p>
    </details>
    {!assets.length&&<p>{t('screenEmpty')}</p>}
    {(['model','object'] as const).map(kind=>{const list=assets.filter(e=>e.kind===kind);return list.length>0&&<section key={kind}>
      <h3>{t(kind==='model'?'hudCharacters':'hudObjects')} <small>{list.filter(e=>b.live[e.id]).length} / 3</small></h3>
      {list.map(e=><button className="screen-item" key={e.id} disabled={locked} aria-pressed={selected?.id===e.id} title={e.path} onClick={()=>b.live[e.id]?b.select(e.id):start(e)}>
        <span>{e.path}</span><strong>{t(b.live[e.id]?'hudOnStage':'hudPlace')}</strong></button>)}
    </section>})}
    {selected&&b.live[selected.id]&&<SelectedItem key={selected.id} entry={selected} locked={locked} frame={frame} move={()=>start(selected)} choice={choice?.id===selected.id?choice.toy:null} setChoice={toy=>choose({id:selected.id,toy})}/>}
  </aside>;
}

function ScreenCues({room,locked,view}:{room:StoryRoom;locked:boolean;view?:()=>void}) {
  const t=useLanguageStore(s=>s.t),story=STORIES[room],owner=useStagePlay(s=>s.character??s.held);
  const act=(side:Hand)=>{if(locked)return;const s=useStagePlay.getState();if((s.character??s.held)?.toy!==story.toy)s.equip(story.toy,'right');cueStory(room,side);};
  return <section className="screen-story"><h3>{t(story.name)}</h3><p>{t(room==='pool'?'storyFerryHelp':room==='lawn'?'storyKiteHelp':'storyEncoreHelp')}</p>
    <div className="screen-buttons">{(['left','right'] as const).map(side=><button key={side} disabled={locked} onClick={()=>act(side)}>{t(story[side])}</button>)}
      <button onClick={view}>{t('storyView')}</button>
      {room==='liveHouse'&&<button disabled={locked} onClick={resetEncore}>{t('storyClear')}</button>}
      {owner?.toy===story.toy&&<button disabled={locked} onClick={()=>useStagePlay.getState().stow()}>{t('toyStow')}</button>}
    </div></section>;
}

function SelectedItem({entry,locked,frame,move,choice,setChoice}:{entry:BackpackEntry;locked:boolean;frame:()=>void;move:()=>void;choice:Toy|null;setChoice:(toy:Toy)=>void}) {
  const t=useLanguageStore(s=>s.t),b=useBackpack(),live=b.live[entry.id];
  const transform=useMmdVrStore(s=>(entry.kind==='model'?s.models:s.objects).find(e=>e.id===live?.runtimeId));
  const stage=useMmdVrStore.getState(), prop=useStagePlay(s=>s.character), motions=b.entries.filter(e=>e.kind==='motion');
  const room=useMmdVrStore(s=>s.prefs.scenery),localToy=isStoryRoom(room)?STORIES[room].toy:null;
  const toy=choice??(prop?.assetId===entry.id?prop.toy:localToy??'saber');
  const give=(hand:Hand)=>giveScreenToy(entry.id,toy,hand,room);
  if(!live||!transform)return null;
  return <section className="screen-tools"><h3>{entry.file.name}</h3>
    <div className="screen-buttons"><button onClick={frame}>{t('screenFit')}</button><button disabled={locked} onClick={move}>{t('hudMove')}</button>
      {(['hudTurnLeft','hudTurnRight','hudSmaller','hudLarger'] as const).map((key,i)=><button key={key} disabled={locked} onClick={()=>i<2?stage.requestModelRotation(live.runtimeId,transform.rotationY+(i?15:-15)):stage.requestModelScale(live.runtimeId,(i===2?previousMmdVrModelScale:nextMmdVrModelScale)(transform.scale))}>{t(key)}</button>)}
      <button disabled={locked} onClick={()=>stage.enqueueVisibilityToggle(live.runtimeId)}>{t(live.visible?'screenHideAsset':'screenShowAsset')}</button>
    </div>
    {entry.kind==='model'&&motions.length>0&&(['body','face'] as const).map(kind=><label className="screen-field" key={kind}>{t(kind==='body'?'hudApplyBody':'hudApplyFace')}
      <select disabled={locked} value={motions.find(e=>e.file===b.bindings[entry.id]?.[kind])?.id??''} onChange={e=>{const motion=motions.find(m=>m.id===e.target.value);if(motion)b.applyMotion(entry.id,motion.file,kind);}}>
        <option value="" disabled>{t('screenPickMotion')}</option>{motions.map(m=><option key={m.id} value={m.id}>{m.path}</option>)}
      </select></label>)}
    {(live.wrists?.left||live.wrists?.right)&&<fieldset className="screen-props"><legend>{t('storyProp')}</legend>
      <select disabled={locked} aria-label={t('storyProp')} value={toy} onChange={e=>{const item=shelfToys.find(v=>v===e.target.value);if(item)setChoice(item);}}>{shelfToys.map(v=><option value={v} key={v}>{t(room==='pool'&&v==='bubbles'?'toyShell':TOYS[v].label)}</option>)}</select>
      {(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!live.visible||!live.wrists?.[hand]} aria-pressed={prop?.assetId===entry.id&&prop.toy===toy&&prop.hand===hand} onClick={()=>give(hand)}>{t(hand==='left'?'propLeft':'propRight')}</button>)}
      {prop?.assetId===entry.id&&prop.toy!==localToy&&<button disabled={locked} onClick={()=>useStagePlay.getState().stow()}>{t('toyStow')}</button>}
    </fieldset>}
    <button disabled={locked} onClick={()=>b.putAway(entry.id)}>{t('hudPutAway')}</button>
  </section>;
}
