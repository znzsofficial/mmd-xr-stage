import { useLanguageStore } from '../../languageStore';
import { useBackpack, type BackpackEntry } from '../backpack';
import { nextMmdVrModelScale, previousMmdVrModelScale } from '../mmdVrAdjustments';
import { useMmdVrStore } from '../mmdVrStore';
import { useLayoutEffect, useRef, useState } from 'react';
import { isStoryRoom, shelfToys, STORIES, TOYS, toyLabel, type Hand, type Toy, type StoryRoom } from '../play/propCatalog';
import { canGiveTo, giveScreenToy, ownerOf, useStagePlay } from '../play/stagePlay';
import type { SceneryId } from '../scenery/catalog';
import {hasSceneryPeople,showSceneryGrid} from '../scenery/catalog';
import {getMmdVrRenderProfile} from '../mmdVrQuality';
import { resetEncore } from '../play/encore/encoreRound';

function give(id:string,toy:Toy,hand:Hand,room:SceneryId){
  if(canGiveTo(useBackpack.getState().live[id],hand))giveScreenToy(id,toy,hand,room);
}

function ScreenToyGuide({toy,room,locked,close}:{toy:Toy;room:SceneryId;locked:boolean;close:()=>void}){
  const t=useLanguageStore(s=>s.t),dialog=useRef<HTMLDialogElement>(null),item=TOYS[toy],{vr,screen,end}=item.guide;
  useLayoutEffect(()=>{const el=dialog.current!;el.showModal();return ()=>el.close();},[]);
  return <dialog ref={dialog} className="screen-guide-dialog" aria-labelledby="toy-guide-title" onCancel={e=>{e.preventDefault();e.stopPropagation();close();}}>
    <h3 id="toy-guide-title">{t(toyLabel(toy,room))} · {t('toyGuide')}</h3><p>{t('toyShelfHome')}{t(item.homeLabel)}</p>
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
  const prefs=useMmdVrStore(s=>s.prefs),profile=getMmdVrRenderProfile(prefs),grid=showSceneryGrid(room,profile.showGrid,prefs.gridPref==='on');
  const start=(entry:BackpackEntry)=>{b.beginPlace(entry.id);if(useBackpack.getState().draft)close();};
  return <aside className="screen-library" aria-label={t('hudBackpack')}>
    <div className="screen-library-head"><h2>{t('hudBackpack')}</h2><button onClick={close}>{t('screenHide')}</button></div>
    {isStoryRoom(room)&&<ScreenCues key={room} room={room} locked={locked} view={storyView}/>}
    <details className="screen-toy-guide"><summary>{t('toyList')} · {shelfToys.length}</summary>
      <p>{t('toyGuideScreenGive')}</p><ul>{shelfToys.map(toy=>{return <li key={toy}>
        <span>{t(toyLabel(toy,room))}<small>{t('toyShelfHome')}{t(TOYS[toy].homeLabel)}</small></span>
        <div>{actor&&selected&&(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!canGiveTo(actor,hand)} onClick={()=>{choose({id:selected.id,toy});give(selected.id,toy,hand,room);}}>{t(hand==='left'?'propLeft':'propRight')}</button>)} <button onClick={()=>setGuide(toy)}>{t('toyGuide')}</button></div>
      </li>;})}</ul></details>
    {guide&&<ScreenToyGuide toy={guide} room={room} locked={locked} close={()=>setGuide(null)}/>}
    <details className="screen-stage-options"><summary>{t('settingsEnvironment')}</summary>
      {hasSceneryPeople(room)&&<label><input type="checkbox" checked={prefs.showSceneryPeople} onChange={e=>useMmdVrStore.getState().setPrefs({showSceneryPeople:e.target.checked})}/>{t('sceneryPeople')}</label>}
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
  const t=useLanguageStore(s=>s.t),story=STORIES[room],owner=useStagePlay(ownerOf);
  const act=(side:Hand)=>{if(locked)return;const s=useStagePlay.getState();if(ownerOf(s)?.toy!==story.toy)s.equip(story.toy,'right');story.cue(side);};
  return <section className="screen-story"><h3>{t(story.name)}</h3><p>{t(story.help)}</p>
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
      <select disabled={locked} aria-label={t('storyProp')} value={toy} onChange={e=>{const item=shelfToys.find(v=>v===e.target.value);if(item)setChoice(item);}}>{shelfToys.map(v=><option value={v} key={v}>{t(toyLabel(v,room))}</option>)}</select>
      {(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!canGiveTo(live,hand)} aria-pressed={prop?.assetId===entry.id&&prop.toy===toy&&prop.hand===hand} onClick={()=>give(entry.id,toy,hand,room)}>{t(hand==='left'?'propLeft':'propRight')}</button>)}
      {prop?.assetId===entry.id&&prop.toy===toy&&<><button disabled={locked} onClick={()=>useStagePlay.getState().adjust(0,0,30)}>{t('propTurn')} {prop.turn}°</button>
        {([['propLower',-15,0],['propRaise',15,0],['propCloser',0,-1],['propFarther',0,1]] as const).map(([label,a,d])=><button key={label} disabled={locked||Math.abs(prop.tilt+a)>90||Math.abs(prop.inset+d)>5} onClick={()=>useStagePlay.getState().adjust(a,d)}>{t(label)}</button>)}</>}
      {prop?.assetId===entry.id&&prop.toy!==localToy&&<button disabled={locked} onClick={()=>useStagePlay.getState().stow()}>{t('toyStow')}</button>}
    </fieldset>}
    <button disabled={locked} onClick={()=>b.putAway(entry.id)}>{t('hudPutAway')}</button>
  </section>;
}
