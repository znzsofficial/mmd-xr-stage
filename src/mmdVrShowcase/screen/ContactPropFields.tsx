import {useLanguageStore} from '../../languageStore';
import type {BackpackLive} from '../backpack';
import {useRemoteEgg,bindRemoteEgg,adjustRemoteEgg,cycleRemoteEgg,resetEggOffset} from '../play/remoteEgg';
import {eggModes,eggAxes,eggAxesIndices} from '../play/propControlLabels';
import {useStagePlay} from '../play/stagePlay';
import {cycleWand,useWandMotor} from '../play/wandMotor';
import {defaultWandResponse,useWandResponse,setWandResponse,setWandResponseEnabled} from '../play/wandResponse';

export function fitScreenEgg(id:string){
  const play=useStagePlay.getState();if(play.held?.toy!=='remoteEgg')play.equip('remoteEgg','right');bindRemoteEgg(id);
}
export function EggFields({id,locked}:{id:string;locked:boolean}){
  const t=useLanguageStore(s=>s.t),s=useRemoteEgg();
  if(s.assetId!==id)return <button disabled={locked} onClick={()=>fitScreenEgg(id)}>{t('eggWear')}</button>;
  return <>
    <div className="screen-buttons"><button disabled={locked} onClick={cycleRemoteEgg}>{t('eggMode')}: {t(eggModes[s.mode])}</button><button disabled={locked} onClick={()=>useStagePlay.getState().stow()}>{t('toyStow')}</button></div>
    <details><summary>{t('eggFit')}</summary>{eggAxesIndices.map(i=><div className="screen-egg-axis" key={i}>
      <span>{t(eggAxes[i])} <output>{s.offset[i]} cm</output></span>{([-1,1] as const).map(k=><button key={k} aria-label={`${t(eggAxes[i])} ${k<0?'−1':'+1'} cm`} disabled={locked} onClick={()=>adjustRemoteEgg(i,k)}>{k<0?'−1':'+1'}</button>)}
    </div>)}<button disabled={locked} onClick={resetEggOffset}>{t('eggReset')}</button></details>
  </>;
}
export function WandFields({live,locked}:{live:BackpackLive;locked:boolean}){
  const t=useLanguageStore(s=>s.t),enabled=useWandResponse(s=>s.enabled),choice=useWandResponse(s=>s.byActor[live.runtimeId]);
  const active=useStagePlay(s=>s.character?.toy==='wand'),speed=useWandMotor(s=>s.speed);
  const {morph,strength}=choice??defaultWandResponse,names=live.propMorphs??[];
  return <details className="screen-stage-options"><summary>{t('wandResponse')}</summary>
    {active&&<button disabled={locked} onClick={cycleWand}>{t('wandMotor')}: {t((['eggOff','wandLow','wandHigh'] as const)[speed])}</button>}
    <label><input type="checkbox" checked={enabled} disabled={locked} onChange={e=>setWandResponseEnabled(e.target.checked)}/>{t('wandEnabled')}</label>
    {enabled&&(names.length?<><label className="screen-field">{t('wandMorph')}<select aria-label={t('wandMorph')} disabled={locked} value={morph??''} onChange={e=>setWandResponse(live.runtimeId,e.target.value||null,strength)}>
      <option value="">{t('wandNone')}</option>{names.map(n=><option key={n}>{n}</option>)}
    </select></label><label className="screen-field">{t('wandStrength')} · {Math.round(strength*100)}% <input aria-label={t('wandStrength')} type="range" min="0" max="100" disabled={locked||!morph} value={Math.round(strength*100)} onChange={e=>setWandResponse(live.runtimeId,morph,e.target.valueAsNumber/100)}/></label></>:<small>{t('wandNoMorph')}</small>)}
  </details>;
}
