import {useState} from 'react';
import {useLanguageStore} from '../../languageStore';
import type {BackpackLive} from '../backpack';
import {useRemoteEgg,bindRemoteEgg,selectEggPattern,stopRemoteEgg,removeRemoteEgg,onEggWearer,adjustRemoteEgg,resetEggOffset} from '../play/remoteEgg';
import {eggPatterns,eggAxes,eggAxesIndices} from '../play/propControlLabels';
import {useStagePlay} from '../play/stagePlay';
import {cycleWand,useWandMotor} from '../play/wandMotor';
import {defaultWandResponse,useWandResponse,setWandResponse,setWandResponseEnabled} from '../play/wandResponse';
import {HudButton,HudLine} from './PorcelainControls';

export function EggControls({id,locked}:{id:string;locked:boolean}){
  const t=useLanguageStore(s=>s.t),s=useRemoteEgg(),[fit,setFit]=useState(false);
  const act=(action:()=>void)=>()=>onEggWearer(id,action);
  if(s.assetId!==id)return <HudButton position={[0,.03,0]} size={[1.20,.17]} variant="primary" label={t(s.assetId?'eggTransfer':'eggWear')} disabled={locked} onPress={()=>{setFit(false);bindRemoteEgg(id);}}/>;
  if(fit)return <>
    <HudButton position={[0,.18,0]} size={[1.20,.14]} label={t('eggControls')} variant="quiet" onPress={()=>setFit(false)}/>
    {eggAxesIndices.map(axis=><group key={axis} position-y={-.002-axis*.17}>
      <HudLine position={[0,0,0]} width={.62} center text={`${t(eggAxes[axis])} ${s.offset[axis]} cm`}/>
      {([-1,1] as const).map(k=><HudButton key={k} position={[k*.46,0,0]} size={[.27,.13]} label={k<0?'−1':'+1'} disabled={locked} onPress={act(()=>adjustRemoteEgg(axis,k))}/>)}
    </group>)}
    <HudButton position={[0,-.53,0]} size={[1.20,.14]} label={t('eggReset')} disabled={locked} onPress={act(resetEggOffset)}/>
  </>;
  return <>
    {eggPatterns.map(([mode,label],i)=><HudButton key={mode} position={[(i-1)*.41,.18,0]} size={[.39,.16]} label={t(label)} active={s.mode===mode} disabled={locked} onPress={act(()=>selectEggPattern(mode))}/>)}
    <HudButton position={[-.31,-.03,0]} size={[.58,.14]} danger label={t('eggStop')} disabled={locked||!s.mode} onPress={act(stopRemoteEgg)}/>
    <HudButton position={[.31,-.03,0]} size={[.58,.14]} label={t('eggRemove')} disabled={locked} onPress={()=>removeRemoteEgg(id)}/>
    <HudButton position={[0,-.25,0]} size={[1.20,.14]} variant="quiet" label={t('eggFit')} disabled={locked} onPress={()=>setFit(true)}/>
  </>;
}

export function WandControls({live,locked}:{live:BackpackLive;locked:boolean}){
  const t=useLanguageStore(s=>s.t),enabled=useWandResponse(s=>s.enabled),choice=useWandResponse(s=>s.byActor[live.runtimeId]);
  const wrist=useStagePlay(s=>s.character?.toy==='wand'),speed=useWandMotor(s=>s.speed);
  const list=live.propMorphs??[],{morph,strength}=choice??defaultWandResponse;
  // The picker previews three names per page; paging alone never changes a face.
  const [index,page]=useState(()=>Math.max(0,Math.floor(list.indexOf(morph??'')/3)));
  const pages=Math.ceil(list.length/3),i=Math.max(0,Math.min(index,pages-1));
  const choose=(name:string|null)=>setWandResponse(live.runtimeId,name,strength);
  return <>
    <HudButton position={[wrist ? -.32 : 0,.18,0]} size={[wrist ? .59 : 1.20,.14]} label={t('wandEnabled')} active={enabled} disabled={locked} onPress={()=>setWandResponseEnabled(!enabled)}/>
    {wrist&&<HudButton position={[.32,.18,0]} size={[.59,.14]} label={`${t('wandMotor')}: ${t((['eggOff','wandLow','wandHigh'] as const)[speed])}`} disabled={locked} onPress={cycleWand}/>}
    <HudLine position={[0,.015,0]} width={1.20} center role="muted" text={!enabled?t('wandDisabled'):!list.length?t('wandNoMorph'):`${t('wandMorph')}: ${morph??t('wandNone')}`}/>
    {enabled&&list.length>0&&<>
      {list.slice(i*3,i*3+3).map((n,j)=><HudButton key={n} position={[(j-1)*.42,-.14,0]} size={[.40,.14]} label={n} active={n===morph} disabled={locked} onPress={()=>choose(n)}/>)}
      <HudButton position={[-.46,-.32,0]} size={[.29,.13]} label={t('loadPrevious')} disabled={locked||i===0} onPress={()=>page(i-1)}/>
      <HudButton position={[0,-.32,0]} size={[.54,.13]} label={t('wandNone')} active={!morph} disabled={locked} onPress={()=>choose(null)}/>
      <HudButton position={[.46,-.32,0]} size={[.29,.13]} label={t('loadNext')} disabled={locked||i+1>=pages} onPress={()=>page(i+1)}/>
      <HudLine position={[0,-.50,0]} width={.78} center text={`${t('wandStrength')} ${Math.round(strength*100)}%`}/>
      {([-1,1] as const).map(k=><HudButton key={k} position={[k*.50,-.50,0]} size={[.22,.13]} label={k<0?'−':'+'} disabled={locked||!morph||(k<0?strength<=0:strength>=1)} onPress={()=>setWandResponse(live.runtimeId,morph,Math.max(0,Math.min(1,(Math.round(strength*100)+k*10)/100)))}/>)}
    </>}
  </>;
}
