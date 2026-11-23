import {useLayoutEffect,useRef} from 'react';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {useHudWorldInput} from '../components/hudWorldInput';
import {useMmdVrStore} from '../mmdVrStore';
import {DEFAULT_BODY_PROFILE} from '../bodyState/data';
import {fastForwardReproduction,setActorReproduction,useBodyState} from '../bodyState/store';
import {nextMilestone,reproductiveSample} from '../bodyState/reproduction/game';
import {reproductionReadings} from '../bodyState/reproduction/readings';
import {automaticDays,setReproductivePace,useReproduction} from '../bodyState/reproduction/store';
import {ObservationDiagram} from '../observation/ObservationDiagram';
import {HudReproductionReadouts,ScreenReproductionReadouts} from '../observation/ReproductionReadouts';
import {PrivateButton,PrivateLine,PrivateSheet} from '../pelvic/HudPrivateControls';
import {readAtlasView,setAtlasView,useAtlasSettings} from '../pelvic/atlas/view';
import '../pelvic/controls.css';
import '../observation/observation.css';
import './fertility.css';

export type FertilityProps={assetId:string;runtimeId:string;onBack:()=>void;onInsertion?:()=>void;backLabel?:string};
type Source='screen'|'xr';
const actorReady=(s:ReturnType<typeof useBackpack.getState>,id:string,runtime:string)=>s.selected===id&&!s.busy&&!s.draft&&
  s.live[id]?.runtimeId===runtime&&s.live[id].visible&&s.entries.some(e=>e.kind==='model'&&e.id===id);
const stageReady=(s:ReturnType<typeof useMmdVrStore.getState>,source:Source)=>s.overlayOpen&&s.presentation===source&&!s.physicsBusy&&!s.physicsFatal&&!s.assetLoad.running;

function useWorkbench({assetId:id,runtimeId,backLabel,onInsertion,onBack}:FertilityProps,source:Source){
  const zh=useLanguageStore(s=>s.language==='zh'),l=(cn:string,en:string)=>zh?cn:en;
  const account=useReproduction(s=>s.byAsset[id]),enabled=!!account?.enabled,game=account?.game;
  // The body clock may publish every 250 ms. Only two discrete values matter here.
  const locked=useBodyState(s=>s.byAsset[id]?.locked??DEFAULT_BODY_PROFILE.locked);
  const tissueDay=useBodyState(s=>s.byAsset[id]?.day??DEFAULT_BODY_PROFILE.day);
  const selected=useBackpack(s=>actorReady(s,id,runtimeId)),stage=useMmdVrStore(s=>stageReady(s,source));
  const worldBlocked=useHudWorldInput(s=>source==='xr'&&s.blocked),allowed=selected&&stage&&!worldBlocked;
  const alive=useRef(false);
  useLayoutEffect(()=>{alive.current=true;return ()=>{alive.current=false;};},[id,runtimeId]);
  const current=()=>alive.current&&!document.hidden&&actorReady(useBackpack.getState(),id,runtimeId)&&stageReady(useMmdVrStore.getState(),source)&&
    (source!=='xr'||!useHudWorldInput.getState().blocked)&&useReproduction.getState().byAsset[id]===account;
  const sample=game&&reproductiveSample(game),record=sample&&reproductionReadings(sample,zh),next=game&&nextMilestone(game);
  const names={release:l('快进至排卵','Skip to ovulation'),day:sample?.stage==='fertilized'?l('推进至 2 细胞','Advance to 2 cells'):l('推进一天','Advance one day'),
    four:l('推进至 4 细胞','Advance to 4 cells'),eight:l('推进至 8 细胞','Advance to 8 cells'),cavity:l('快进至宫腔','Skip to cavity arrival'),
    implant:l('查看着床结果','Resolve implantation'),weeks:l(`推进 ${next?.days} 孕日`,`Advance ${next?.days} gestation days`),round:l('进入下一周期','Next cycle'),end:l('孕期已完成','Gestation complete')};
  const auto=automaticDays(account,{locked}),motion=useAtlasSettings(s=>(s.actors[id]??readAtlasView(id)).motion);
  const awaitingDose=enabled&&sample?.stage==='ovulated'&&!sample.tried;
  if(awaitingDose&&record)record.progress.value=l('已排卵 · 等待体内释放','Ovulated · awaiting internal release');
  const advance={id:enabled?`${id}:${game?.day}:${sample?.stage}`:account?'resume':'start',
    label:enabled&&next?names[next.key]:account?l('恢复生育模拟','Resume simulation'):l('开启生育模拟','Start simulation'),disabled:!allowed||enabled&&!next?.days,
    run:()=>{if(!current())return;if(enabled&&game)fastForwardReproduction(id,game);else setActorReproduction({assetId:id,runtimeId},true);}};
  // When opened by the insertion monitor the router keeps that page on the
  // trail. Returning to it must not reselect a destination or create a dose.
  const insert={id:'insertion',label:l('插入操作','Insertion controls'),disabled:!allowed,run:()=>{if(current())(onInsertion??onBack)();}};
  const actions=awaitingDose?[insert,advance]:onInsertion?[advance,insert]:[advance];
  return {title:l('生育进程','Fertility'),back:backLabel??l('返回互动','Back to interaction'),loading:l('绘制中…','Drawing…'),actions,
    record,enabled,allowed,dates:l(`组织周期日 ${tissueDay}`,`Tissue day ${tissueDay}`),
    status:!account?l('生育模拟未开启','Simulation off'):!enabled?l('生育模拟已暂停','Simulation paused'):null,
    pause:l('暂停生育模拟','Pause simulation'),stop:()=>{if(enabled&&current())setActorReproduction({assetId:id,runtimeId},false);},
    pace:l('生育过日方式','Game clock'),paces:[{label:l('手动','Manual'),auto:false},{label:l('自动','Automatic'),auto:true}],auto,
    setAuto:(v:boolean)=>{if(account&&enabled&&current())setReproductivePace(id,account,v);},
    picture:motion?l('定格图像','Freeze figure'):l('播放图像','Animate figure'),pictureAction:()=>setAtlasView(id,{motion:!motion}),frozen:!motion};
}

export function FertilityScreenControls(props:FertilityProps){
  const w=useWorkbench(props,'screen'),{assetId,runtimeId}=props;
  return <div className="pelvic-screen fertility-workbench" role="group" aria-label={w.title}>
    <header className="pelvic-heading"><h3>{w.title}</h3><button type="button" className="pelvic-key pelvic-back" onClick={props.onBack}>{w.back}</button></header>
    <div className="fertility-columns"><div className="fertility-study"><ObservationDiagram key={`${assetId}:${runtimeId}`} assetId={assetId} runtimeId={runtimeId} part="uterus" fertility loading={w.loading}/>
      <button type="button" className="pelvic-key" aria-pressed={w.frozen} onClick={w.pictureAction}>{w.picture}</button></div>
    <div className="fertility-actions">
      {w.status&&<p className="pelvic-note" role="status">{w.status}</p>}
      {w.record&&<ScreenReproductionReadouts record={w.record}/>}
      {w.actions.map((a,i)=><button key={a.id} type="button" className="pelvic-key" data-primary={!i||undefined} disabled={a.disabled} onClick={a.run}>{a.label}</button>)}
      {w.enabled&&<><fieldset><legend>{w.pace}</legend><div className="pelvic-keys">{w.paces.map(p=><button key={p.label} type="button" className="pelvic-key" disabled={!w.allowed}
        aria-pressed={p.auto===w.auto} onClick={()=>w.setAuto(p.auto)}>{p.label}</button>)}</div></fieldset>
        <button type="button" className="pelvic-key" disabled={!w.allowed} onClick={w.stop}>{w.pause}</button></>}
      <small>{w.dates}</small>
    </div></div>
  </div>;
}

export function FertilityHudControls(props:FertilityProps){
  const w=useWorkbench(props,'xr'),{assetId,runtimeId}=props,x=.49,width=.79;
  return <group name="fertility:workbench" pointerEventsOrder={1} pointerEventsType={{allow:['ray']}}>
    <PrivateSheet size={[1.87,1.42]}/>
    <PrivateLine position={[-.31,.605,0]} width={1.12} title text={w.title}/><PrivateButton position={[.57,.605,0]} size={[.63,.14]} variant="quiet" label={w.back} onPress={props.onBack}/>
    <group position={[-.43,.096,0]}><ObservationDiagram key={`${assetId}:${runtimeId}`} assetId={assetId} runtimeId={runtimeId} part="uterus" fertility widthM={.91} loading={w.loading}/></group>
    <PrivateButton position={[-.43,-.392,0]} size={[.91,.135]} label={w.picture} active={w.frozen} onPress={w.pictureAction}/>
    <PrivateLine position={[x,.436,0]} width={width} text={w.status??w.dates}/>
    {w.actions.map((a,i)=><PrivateButton key={a.id} position={[x,.294-i*.179,0]} size={[width,.15]} variant={!i?'primary':'button'} label={a.label} disabled={a.disabled} onPress={a.run}/>)}
    {w.enabled&&<><PrivateLine position={[x,-.031,0]} width={width} text={w.pace}/>
      {w.paces.map((p,i)=><PrivateButton key={p.label} position={[x+(i-.5)*.405,-.166,0]} size={[.385,.14]} label={p.label} active={p.auto===w.auto} disabled={!w.allowed} onPress={()=>w.setAuto(p.auto)}/>)}
      <PrivateButton position={[x,-.392,0]} size={[width,.135]} label={w.pause} disabled={!w.allowed} onPress={w.stop}/></>}
    {w.record&&<group position-y={-.531}><HudReproductionReadouts record={w.record} width={1.77}/></group>}
  </group>;
}
