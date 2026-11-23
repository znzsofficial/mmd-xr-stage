import {useLanguageStore} from '../../languageStore';
import {PrivateLine} from './HudPrivateControls';
import type {PelvicActor} from './Section';
import {usePelvic} from './store';

// The close-up shows the individual strokes. Captions hold still until the
// stand or the player's one-shot order changes, including on a fast motor.
function useReadout({assetId,runtimeId}:PelvicActor){
  const zh=useLanguageStore(s=>s.language==='zh'),l=(a:string,b:string)=>zh?a:b;
  const signal=usePelvic(s=>{
    const a=s.active;if(a?.assetId!==assetId||a.runtimeId!==runtimeId||a.mode!=='standAuto')return 'none';
    if(!a.running)return s.parkedSample?'stopped':'placing';
    const p=s.byAsset[assetId];if(!p?.clothed&&s.support[assetId]?.obstruction)return 'blocked';
    return s.sample?'running':'starting';
  });
  const phase=usePelvic(s=>s.active?.assetId===assetId&&s.active.runtimeId===runtimeId?(s.strokeOrder?.phase??s.strokeReceipt):null);
  const p=usePelvic(s=>s.byAsset[assetId]);
  const site=p?.container==='fantasyUterine'?l('宫腔','Uterus'):l('阴道','Vagina');
  const position=signal==='stopped'?l('支架静止','Stand at rest'):signal==='blocked'?l('入口受阻','Opening blocked'):
    signal==='running'?l('支架往复中','Stand in motion'):signal==='starting'?l('支架启动中','Starting the stand'):l('支架就位中','Positioning the stand');
  const action=phase==='waiting'||phase==='dispatched'?l('待释放 · 1 单位','Release pending · 1 unit'):
    phase==='delivered'?l('已释放 · 1 单位','Released · 1 unit'):
    phase==='missed'?l('本次未释放','Not released'):phase==='expired'?l('未释放 · 已超时','Not released · timed out'):
    phase==='cancelled'?l('已取消释放','Release cancelled'):
    signal==='running'?l('单次释放 · 1 单位','Single release · 1 unit'):'';
  return {position,action,delivered:phase==='delivered',balance:p?`${site}　${p.fluid[p.container]} / ${p.capacity[p.container]}${p.overflow?l(` · 溢出 ${p.overflow}`,` · Overflow ${p.overflow}`):''}`:''};
}
export function StrokeScreenReadout(actor:PelvicActor){
  const r=useReadout(actor);
  return <div className="pelvic-stroke-readout" data-delivered={r.delivered||undefined}><span title={r.position}>{r.position}</span><span role="status">{r.action}</span><span className="pelvic-balance" title={r.balance}>{r.balance}</span></div>;
}
export const strokeReadoutHeight=.234;
export function StrokeHudReadout({width,...actor}:PelvicActor&{width:number}){
  const r=useReadout(actor);
  return <group name="pelvic:motor-reading">{[r.position,r.action,r.balance].map((text,i)=><PrivateLine key={i} position={[0,(1-i)*.078,0]} width={width} text={text} rose={i===1&&r.delivered}/>)}</group>;
}
