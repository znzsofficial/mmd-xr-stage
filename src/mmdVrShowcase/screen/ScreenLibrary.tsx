import { useLanguageStore } from '../../languageStore';
import { useBackpack, type BackpackEntry } from '../backpack';
import { nextMmdVrModelScale, previousMmdVrModelScale } from '../mmdVrAdjustments';
import { useMmdVrStore } from '../mmdVrStore';
import { useState } from 'react';
import { isStoryRoom, STORIES, TOYS, useStagePlay, type Hand, type Toy, type StoryRoom } from '../play/stagePlay';
import { cueStory, resetEncore } from '../play/storyActions';

export function ScreenLibrary({locked,close,frame,storyView}:{locked:boolean;close:()=>void;frame:()=>void;storyView?:()=>void}) {
  const t=useLanguageStore(s=>s.t),b=useBackpack(),selected=b.entries.find(e=>e.id===b.selected);
  const room=useMmdVrStore(s=>s.prefs.scenery);
  const assets=b.entries.filter(e=>e.kind!=='motion');
  const start=(entry:BackpackEntry)=>{b.beginPlace(entry.id);if(useBackpack.getState().draft)close();};
  return <aside className="screen-library" aria-label={t('hudBackpack')}>
    <div className="screen-library-head"><h2>{t('hudBackpack')}</h2><button onClick={close}>{t('screenHide')}</button></div>
    {isStoryRoom(room)&&<ScreenCues key={room} room={room} locked={locked} view={storyView}/>}
    {!assets.length&&<p>{t('screenEmpty')}</p>}
    {(['model','object'] as const).map(kind=>{const list=assets.filter(e=>e.kind===kind);return list.length>0&&<section key={kind}>
      <h3>{t(kind==='model'?'hudCharacters':'hudObjects')} <small>{list.filter(e=>b.live[e.id]).length} / 3</small></h3>
      {list.map(e=><button className="screen-item" key={e.id} disabled={locked} aria-pressed={selected?.id===e.id} title={e.path} onClick={()=>b.live[e.id]?b.select(e.id):start(e)}>
        <span>{e.path}</span><strong>{t(b.live[e.id]?'hudOnStage':'hudPlace')}</strong></button>)}
    </section>})}
    {selected&&b.live[selected.id]&&<SelectedItem key={selected.id} entry={selected} locked={locked} frame={frame} move={()=>start(selected)}/>}
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

function SelectedItem({entry,locked,frame,move}:{entry:BackpackEntry;locked:boolean;frame:()=>void;move:()=>void}) {
  const t=useLanguageStore(s=>s.t),b=useBackpack(),live=b.live[entry.id];
  const transform=useMmdVrStore(s=>(entry.kind==='model'?s.models:s.objects).find(e=>e.id===live?.runtimeId));
  const stage=useMmdVrStore.getState(), prop=useStagePlay(s=>s.character), motions=b.entries.filter(e=>e.kind==='motion');
  const room=useMmdVrStore(s=>s.prefs.scenery),localToy=isStoryRoom(room)?STORIES[room].toy:null;
  const [choice,setChoice]=useState<'local'|'saber'>('local');
  const toy:Toy=choice==='local'&&localToy?localToy:'saber';
  const give=(hand:Hand)=>{if(!live?.visible||!live.wrists?.[hand])return; const play=useStagePlay.getState();
    if(play.held?.toy!==toy&&(play.character?.assetId!==entry.id||play.character.toy!==toy)){play.equip(toy,hand);if(toy==='saber')play.toggleSaber();}play.give(entry.id,hand);};
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
    {(live.wrists?.left||live.wrists?.right)&&<fieldset className="screen-props"><legend>{t(localToy?'storyProp':'screenSaber')}</legend>
      {localToy&&<select aria-label={t('storyProp')} value={toy} onChange={e=>setChoice(e.target.value===localToy?'local':'saber')}><option value={localToy}>{t(localToy==='bubbles'?'toyShell':TOYS[localToy].label)}</option><option value="saber">{t('toySaber')}</option></select>}
      {(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!live.visible||!live.wrists?.[hand]} aria-pressed={prop?.assetId===entry.id&&prop.toy===toy&&prop.hand===hand} onClick={()=>give(hand)}>{t(hand==='left'?'propLeft':'propRight')}</button>)}
      {prop?.assetId===entry.id&&prop.toy!==localToy&&<button disabled={locked} onClick={()=>useStagePlay.getState().stow()}>{t('toyStow')}</button>}
    </fieldset>}
    <button disabled={locked} onClick={()=>b.putAway(entry.id)}>{t('hudPutAway')}</button>
  </section>;
}
