import {useLanguageStore} from '../../languageStore';
import {PrivateLine} from './HudPrivateControls';
import type {PelvicActor} from './Section';
import {usePelvic} from './store';

// Only these fixed lines observe the outlet during reciprocation. In
// particular, crossing the rim never rebuilds the editor's button tree.
function useReadout({assetId,runtimeId}:PelvicActor){
  const zh=useLanguageStore(s=>s.language==='zh'),l=(a:string,b:string)=>zh?a:b;
  const signal=usePelvic(s=>{
    const a=s.active;if(a?.assetId!==assetId||a.runtimeId!==runtimeId||a.mode!=='standAuto')return 'none';
    if(!a.running)return s.parkedSample?'stopped':'placing';
    const p=s.byAsset[assetId];if(!p?.clothed&&s.support[assetId]?.obstruction)return 'blocked';
    return !s.sample?'starting':s.sample.outletInside?'inside':s.sample.outletVisible||s.sample.exteriorCovered?'outside':'rim';
  });
  const phase=usePelvic(s=>s.active?.assetId===assetId&&s.active.runtimeId===runtimeId?(s.strokeOrder?.phase??s.strokeReceipt):null);
  const p=usePelvic(s=>s.byAsset[assetId]);
  const position=signal==='stopped'?l('支架静止 · 可以开始','Stand stopped · ready to start'):signal==='placing'?l('正在摆放支架…','Positioning stand…'):
    signal==='blocked'?l('入口受阻 · 请检查衣着','Opening blocked · check clothing'):signal==='inside'?l('往复中 · 喷口在阴道内','Running · outlet inside vagina'):
    signal==='outside'?l('往复中 · 喷口在入口外','Running · outlet outside'):signal==='rim'?l('往复中 · 尚未确认进入','Running · entry unconfirmed'):l('正在读取喷口位置…','Reading outlet…');
  const action=phase==='waiting'?l('已预约 1 剂 · 等待本次进入','1 dose pending · awaiting entry'):phase==='dispatched'?l('已请求 1 剂 · 正在核对喷口','1 dose requested · checking outlet'):
    phase==='delivered'?l('本次已释放 1 单位','Delivered 1 unit'):phase==='missed'?l('本次未进入 · 未释放','Stroke missed · no release'):
    phase==='expired'?l('本次指令超时 · 未释放','Request expired · no release'):phase==='cancelled'?l('本次已取消 · 未释放','Request cancelled · no release'):
    l('单次释放 · 在内时计入','Single dose · requires verified entry');
  const site=p?.container==='fantasyUterine'?l('宫腔','Uterus'):l('阴道','Vagina');
  return {position,action,balance:p?`${site}　${p.fluid[p.container]} / ${p.capacity[p.container]}${p.overflow?l(` · 溢出 ${p.overflow}`,` · Overflow ${p.overflow}`):''}`:''};
}
export function StrokeScreenReadout(actor:PelvicActor){
  const r=useReadout(actor);
  return <div className="pelvic-stroke-readout"><span title={r.position}>{r.position}</span><span role="status" title={r.action}>{r.action}</span><output title={r.balance}>{r.balance}</output></div>;
}
export const strokeReadoutHeight=.234;
export function StrokeHudReadout({width,...actor}:PelvicActor&{width:number}){
  const r=useReadout(actor);
  return <group name="pelvic:motor-reading">{[r.position,r.action,r.balance].map((text,i)=><PrivateLine key={i} position={[0,(1-i)*.078,0]} width={width} text={text}/>)}</group>;
}
