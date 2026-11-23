import { useLanguageStore } from '../../languageStore';
import { useBackpack, type BackpackEntry } from '../backpack';
import { nextMmdVrModelScale, previousMmdVrModelScale } from '../mmdVrAdjustments';
import { useMmdVrStore } from '../mmdVrStore';
import { useLayoutEffect, useRef, useState } from 'react';
import { isStoryRoom, shelfToys, STORIES, TOYS, toyLabel, type Hand, type Toy, type StoryRoom } from '../play/propCatalog';
import { canGiveTo, giveScreenToy, ownerOf, requestScreenWristUse, useStagePlay } from '../play/stagePlay';
import type { SceneryId } from '../scenery/catalog';
import {ScreenEnvironmentSettings} from './ScreenEnvironmentSettings';
import { resetEncore } from '../play/encore/encoreRound';
import {EggFields,fitScreenEgg,WandFields} from './ContactPropFields';
import {useRemoteEgg} from '../play/remoteEgg';
import {ActorActivities,type ActivityEntry} from '../interaction/ActorActivities';
import {PoseScreenControls} from '../pose/PoseControls';

function give(id:string,toy:Toy,hand:Hand,room:SceneryId){
  if(canGiveTo(useBackpack.getState().live[id],hand))giveScreenToy(id,toy,hand,room);
}

function ScreenToyGuide({toy,room,locked,close}:{toy:Toy;room:SceneryId;locked:boolean;close:()=>void}){
  const t=useLanguageStore(s=>s.t),dialog=useRef<HTMLDialogElement>(null),item=TOYS[toy],{vr,screen,end}=item.guide;
  useLayoutEffect(()=>{const el=dialog.current!;el.showModal();return ()=>el.close();},[]);
  return <dialog ref={dialog} className="screen-guide-dialog" aria-labelledby="toy-guide-title" onCancel={e=>{e.preventDefault();e.stopPropagation();close();}}>
    <h3 id="toy-guide-title">{t(toyLabel(toy,room))} · {t('toyGuide')}</h3><p>{t('toyShelfHome')}{t(item.homeLabel)}</p>
    {toy!=='remoteEgg'&&<p>{t('toyGuideScreenGive')}</p>}<p>{t(screen)}</p><p><strong>VR</strong> · {t(vr)}</p><p>{t(end)}</p>
    <div className="screen-buttons"><button autoFocus onClick={close}>{t('toyCloseGuide')}</button>{item.home&&room!==item.home&&<button disabled={locked} onClick={()=>{close();useMmdVrStore.getState().setPrefs({scenery:item.home});}}>{t(item.visit)}</button>}</div>
  </dialog>;
}

type LibraryProps = {
  view:'backpack'|'item'; suspended?:boolean; visit:number; locked:boolean;
  close:()=>void; openBackpack:()=>void; openItem:()=>void; frame:()=>void; closeUp?:(focus?:'face')=>void; storyView?:()=>void;
};

export function ScreenLibrary({view,suspended=false,visit,locked,close,openBackpack,openItem,frame,closeUp,storyView}:LibraryProps) {
  const t=useLanguageStore(s=>s.t),b=useBackpack(),selected=b.entries.find(e=>e.id===b.selected);
  const room=useMmdVrStore(s=>s.prefs.scenery);
  const motions=b.entries.filter(e=>e.kind==='motion');
  const [guide,setGuide]=useState<Toy|null>(null),actor=selected?.kind==='model'?b.live[selected.id]:null;
  const eggWearer=useRemoteEgg(s=>s.assetId);
  const [choice,choose]=useState<{id:string;toy:Toy}|null>(null);
  const palm=useMmdVrStore(s=>s.prefs.actorPalmCloth),physics=useMmdVrStore(s=>s.physicsEnabled);
  const start=(entry:BackpackEntry)=>{b.beginPlace(entry.id);if(useBackpack.getState().draft)close();};
  const title=useRef<HTMLHeadingElement>(null);
  useLayoutEffect(()=>{if(view==='backpack')title.current?.focus({preventScroll:true});},[view]);
  return <>
    {(view==='item'||suspended)&&selected&&b.live[selected.id]&&<SelectedItem key={`${selected.id}:${b.live[selected.id].runtimeId}:${visit}`} entry={selected} suspended={suspended} close={close} openBackpack={openBackpack}
      locked={locked} frame={frame} closeUp={closeUp} move={()=>start(selected)} choice={choice?.id===selected.id?choice.toy:null} setChoice={toy=>choose({id:selected.id,toy})}/>}
    {view==='backpack'&&<aside className="screen-library" aria-label={t('hudBackpack')}>
    <div className="screen-library-head"><h2 ref={title} tabIndex={-1}>{t('hudBackpack')}</h2><button onClick={close}>{t('screenHide')}</button></div>
    {!b.entries.length&&<p>{t('screenEmpty')}</p>}
    {(['model','object'] as const).map(kind=>{const list=b.entries.filter(e=>e.kind===kind);return list.length>0&&<section key={kind}>
      <h3>{t(kind==='model'?'hudCharacters':'hudObjects')} <small>{list.filter(e=>b.live[e.id]).length} / 3</small></h3>
      {list.map(e=><button className="screen-item" key={e.id} disabled={locked} aria-pressed={selected?.id===e.id} title={e.path} onClick={()=>{if(b.live[e.id]){b.select(e.id);openItem();}else start(e);}}>
        <span>{e.path}</span><strong>{t(!b.live[e.id]?'hudPlace':b.live[e.id].visible?'hudOnStage':'hudOnStageHidden')}</strong></button>)}
    </section>})}
    {motions.length>0&&<details className="screen-motion-list"><summary>{t('hudMotions')} · {motions.length}</summary>
      <p>{t('hudApplyFromCharacter')}</p><ul>{motions.map(e=><li key={e.id}>{e.path}</li>)}</ul></details>}
    {isStoryRoom(room)&&<ScreenCues key={room} room={room} locked={locked} view={storyView}/>}
    <details className="screen-toy-guide"><summary>{t('toyList')} · {shelfToys.length}</summary>
      <p>{t('toyGuideScreenGive')}</p><ul>{shelfToys.map(toy=>{return <li key={toy}>
        <span>{t(toyLabel(toy,room))}<small>{t('toyShelfHome')}{t(TOYS[toy].homeLabel)}</small></span>
         <div>{actor&&selected&&(toy==='remoteEgg'?<button disabled={locked||!actor.visible} onClick={()=>{if(fitScreenEgg(selected.id)){choose({id:selected.id,toy});openItem();}}}>{t(eggWearer===selected.id?'eggControls':eggWearer?'eggTransfer':'eggWear')}</button>:(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!canGiveTo(actor,hand)} onClick={()=>{choose({id:selected.id,toy});give(selected.id,toy,hand,room);}}>{t(hand==='left'?'propLeft':'propRight')}</button>))} <button onClick={()=>setGuide(toy)}>{t('toyGuide')}</button></div>
      </li>;})}</ul></details>
    {guide&&<ScreenToyGuide toy={guide} room={room} locked={locked} close={()=>setGuide(null)}/>}
    <ScreenEnvironmentSettings/>
    <details className="screen-stage-options"><summary>{t('contactDetails')}</summary>
      <p>{t('missingPalmContact')}</p><label><input type="checkbox" checked={palm} disabled={locked||physics} onChange={e=>useMmdVrStore.getState().setPrefs({actorPalmCloth:e.target.checked})}/>{t('actorPalmShort')}</label><p>{t(physics?'contactDisableFirst':'contactNextPhysics')}</p>
    </details>
  </aside>}</>;
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

function SelectedItem({entry,locked,frame,closeUp,move,choice,setChoice,suspended,close,openBackpack}:{entry:BackpackEntry;locked:boolean;frame:()=>void;closeUp?:(focus?:'face')=>void;move:()=>void;choice:Toy|null;setChoice:(toy:Toy)=>void;suspended:boolean;close:()=>void;openBackpack:()=>void}) {
  const t=useLanguageStore(s=>s.t),b=useBackpack(),live=b.live[entry.id];
  const transform=useMmdVrStore(s=>(entry.kind==='model'?s.models:s.objects).find(e=>e.id===live?.runtimeId));
  const stage=useMmdVrStore.getState(), prop=useStagePlay(s=>s.character), motions=b.entries.filter(e=>e.kind==='motion');
  const room=useMmdVrStore(s=>s.prefs.scenery),localToy=isStoryRoom(room)?STORIES[room].toy:null;
  const wearing=useRemoteEgg(s=>s.assetId===entry.id);
  const [editor,setEditor]=useState<'position'|'motion'|'pose'|ActivityEntry|null>(null);
  const panel=useRef<HTMLElement>(null),heading=useRef<HTMLHeadingElement>(null);
  useLayoutEffect(()=>{
    if(suspended||!panel.current)return;
    panel.current.scrollTop=0;
    (panel.current.querySelector<HTMLElement>('.body-page h4, [data-actor-activity] h3')??heading.current)?.focus({preventScroll:true});
  },[editor,suspended]);
  const toy=choice??(wearing?'remoteEgg':prop?.assetId===entry.id?prop.toy:localToy??'saber');
  const action=prop?.assetId===entry.id?TOYS[prop.toy].screenUse:undefined;
  if(!live)return null;
  // A physics rebuild briefly removes the transform record. Keeping the same
  // actor editor mounted preserves its unsaved preview while controls lock.
  const actorName=(transform?.name||entry.file.name).replace(/\.(pmx|pmd|glb|gltf)$/i,'')||entry.file.name;
  const onBack=()=>setEditor(null),actor={assetId:entry.id,runtimeId:live.runtimeId,onBack};
  const detail=live.visible&&editor!==null&&editor!=='position'&&editor!=='motion';
  const positioning=<div className="screen-buttons"><button disabled={locked||!transform} onClick={move}>{t('hudMove')}</button>
    {(['hudTurnLeft','hudTurnRight','hudSmaller','hudLarger'] as const).map((key,i)=><button key={key} disabled={locked||!transform} onClick={()=>transform&&(i<2?stage.requestModelRotation(live.runtimeId,transform.rotationY+(i?15:-15)):stage.requestModelScale(live.runtimeId,(i===2?previousMmdVrModelScale:nextMmdVrModelScale)(transform.scale)))}>{t(key)}</button>)}
  </div>;
  return <aside ref={panel} className="screen-library screen-actor-sheet" aria-label={actorName} hidden={suspended}>
    <div className="screen-library-head"><h2 ref={heading} tabIndex={-1} title={actorName}>{actorName}</h2>
      {!detail&&<button onClick={openBackpack}>{t('actorAllItems')}</button>}<button onClick={close}>{t('actorFold')}</button></div>
    {detail?<section className="screen-tools" data-focus-actor>
      {editor==='pose'?<PoseScreenControls {...actor}/>:<ActorActivities entry={editor} {...actor} onCloseUp={closeUp} suspended={suspended}/>}
    </section>:editor==='motion'||editor==='position'?<section className="screen-tool-detail"><div className="screen-library-head"><h3>{t(editor==='position'?'watchArrange':'hudMotions')}</h3><button onClick={onBack}>{t('actorBack')}</button></div>
      {editor==='position'?positioning:<>
        {(['body','face'] as const).map(kind=>{
          const bound=b.bindings[entry.id]?.[kind], item=motions.find(m=>m.file===bound);
          return <div key={kind}><label className="screen-field">{t(kind==='body'?'hudBodyMotion':'hudFaceMotion')}
            <select disabled={locked||!motions.length} value={item?.id??(bound?'current':'')} onChange={e=>{const motion=motions.find(m=>m.id===e.target.value);if(motion)b.applyMotion(entry.id,motion.file,kind);}}>
              <option value="" disabled>{t('hudMotionUnbound')}</option>{bound&&!item&&<option value="current" disabled>{bound.name}</option>}
              {motions.map(m=><option key={m.id} value={m.id}>{m.path}</option>)}
            </select></label>
            <button disabled={locked||!bound} onClick={()=>b.applyMotion(entry.id,null,kind)}>{t(kind==='body'?'hudClearBodyMotion':'hudClearFaceMotion')}</button>
          </div>;
        })}
        {!motions.length&&<p>{t('hudNoMotion')}</p>}
      </>}
    </section>:<section className="screen-tools screen-actor-home">
    {entry.kind==='model'?<><nav className="screen-actor-activities" aria-label={actorName}>
      {([['wardrobe','actorWardrobe'],['interact','actorInteraction'],['observe','actorObservation']] as const).map(([id,key])=><button key={id} data-main={id==='interact'||undefined} disabled={locked||!live.visible} onClick={()=>setEditor(id)}>{t(key)}</button>)}
    </nav><div className="screen-actor-primary">
      <button disabled={locked||!transform} onClick={()=>setEditor('position')}>{t('watchArrange')}</button><button disabled={locked} onClick={()=>setEditor('motion')}>{t('hudMotions')}</button>
       <button disabled={locked||!live.visible} onClick={()=>setEditor('pose')}>{t('actorPose')}</button>
    </div></>:positioning}
    <div className="screen-buttons"><button onClick={frame}>{t('screenFit')}</button><button disabled={locked} onClick={()=>stage.enqueueVisibilityToggle(live.runtimeId)}>{t(live.visible?'screenHideAsset':'screenShowAsset')}</button></div>
    {entry.kind==='model'&&<fieldset className="screen-props"><legend>{t('storyProp')}</legend>
      <select disabled={locked} aria-label={t('storyProp')} value={toy} onChange={e=>{const item=shelfToys.find(v=>v===e.target.value);if(item)setChoice(item);}}>{shelfToys.map(v=><option value={v} key={v}>{t(toyLabel(v,room))}</option>)}</select>
      {toy==='remoteEgg'?<EggFields id={entry.id} locked={locked||!live.visible}/>:<>{(['left','right'] as const).map(hand=><button key={hand} disabled={locked||!canGiveTo(live,hand)} aria-pressed={prop?.assetId===entry.id&&prop.toy===toy&&prop.hand===hand} onClick={()=>give(entry.id,toy,hand,room)}>{t(hand==='left'?'propLeft':'propRight')}</button>)}{!live.wrists?.left&&!live.wrists?.right&&<small>{t('propNoWrist')}</small>}</>}
      {prop&&action&&<button disabled={locked||!canGiveTo(live,prop.hand)} onClick={()=>requestScreenWristUse(prop,live.runtimeId)}>{t(action.label)}</button>}
      {prop?.assetId===entry.id&&prop.toy===toy&&<><button disabled={locked} onClick={()=>useStagePlay.getState().adjust(0,0,30)}>{t('propTurn')} {prop.turn}°</button>
        {([['propLower',-15,0],['propRaise',15,0],['propCloser',0,-1],['propFarther',0,1]] as const).map(([label,a,d])=><button key={label} disabled={locked||Math.abs(prop.tilt+a)>90||Math.abs(prop.inset+d)>5} onClick={()=>useStagePlay.getState().adjust(a,d)}>{t(label)}</button>)}</>}
      {prop?.assetId===entry.id&&prop.toy!==localToy&&<button disabled={locked} onClick={()=>useStagePlay.getState().stow()}>{t('toyStow')}</button>}
      {(toy==='wand'||prop?.toy==='wand')&&<WandFields live={live} locked={locked||!live.visible}/>}
    </fieldset>}
    <button disabled={locked} onClick={()=>b.putAway(entry.id)}>{t('hudPutAway')}</button>
  </section>}</aside>;
}
