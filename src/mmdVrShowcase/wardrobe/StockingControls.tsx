import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useLanguageStore } from '../../languageStore';
import { HudButton, HudLine, HudSheet } from '../hud/PorcelainControls';
import { armStockingTear, canDressStockings, disarmStockingTear, dressStockings, readStockingState, useStockings, type StockingActor } from './stockingState';
import { stockingFitStatus, subscribeStockingFit } from './stockingSurface';

export function StockingControls({ assetId, runtimeId, available, hud, onBack }: StockingActor & { available: boolean; hud?: boolean; onBack(): void }) {
  const actor = { assetId, runtimeId }, zh = useLanguageStore(s => s.language === 'zh'), l = (cn: string, en: string) => zh ? cn : en;
  const pair = useStockings(s => readStockingState(assetId, s));
  const armed = useStockings(s => s.armed?.assetId === assetId && s.armed.runtimeId === runtimeId);
  const fit = useSyncExternalStore(subscribeStockingFit, () => stockingFitStatus(runtimeId));
  useLayoutEffect(() => () => disarmStockingTear({ assetId, runtimeId }), [assetId, runtimeId]);
  const title = l('黑色长筒袜', 'Black thigh-highs'), back = l('返回衣柜', 'Back to wardrobe');
  const wear = pair.worn ? l('脱下', 'Take off') : l('穿上', 'Put on');
  const replace = l('换新一双', 'Replace pair'), mode = l('撕扯模式', 'Tear mode');
  const left = pair.tears.filter(t => t.side === 'left').length, right = pair.tears.length - left;
  const wearState = pair.worn ? l('已穿上', 'Worn') : l('未穿上', 'Off');
  const status = fit === 'unavailable' ? l('此模型没有可贴合的腿部。', 'No suitable leg surface on this model.') :
    pair.worn && fit === 'unknown' ? l('正在贴合腿部…', 'Fitting stockings…') : pair.tears.length ?
      l(`${wearState} · 左腿 ${left} 处破口，右腿 ${right} 处`, `${wearState} · Tears: left ${left}, right ${right}`) : `${wearState} · ${l('完好', 'Intact')}`;
  const hint = l('按住一侧袜面，拉动后松开。', 'Press a stocking, pull and release.');
  const locked = !available || !canDressStockings(actor), cannotWear = locked || (!pair.worn && fit === 'unavailable');
  const cannotTear = locked || !pair.worn || fit !== 'ready', cannotReplace = locked || !pair.worn || !pair.tears.length;
  const changeWear = () => { if (!cannotWear) dressStockings(actor, pair.worn ? 'remove' : 'wear'); };
  const changeMode = () => { if (armed) disarmStockingTear(actor); else if (!cannotTear && stockingFitStatus(runtimeId) === 'ready') armStockingTear(actor); };
  const newPair = () => { if (!cannotReplace) dressStockings(actor, 'replace'); };
  const leave = () => { disarmStockingTear(actor); onBack(); };
  if (hud) return <group name="wardrobe:stockings"><HudSheet size={[1.78, 1.04]}/>
    <HudLine position={[-.31, .37, 0]} width={1} text={title} role="title"/>
    <HudButton position={[.53, .37, 0]} size={[.60, .145]} label={back} variant="quiet" onPress={leave}/>
    <HudLine position={[0, .18, 0]} width={1.62} text={status} center/>
    <HudButton position={[-.42, -.02, 0]} size={[.80, .15]} label={wear} variant={pair.worn ? 'button' : 'primary'} disabled={cannotWear} onPress={changeWear}/>
    <HudButton position={[.42, -.02, 0]} size={[.80, .15]} label={replace} disabled={cannotReplace} onPress={newPair}/>
    <HudButton position={[0, -.22, 0]} size={[1.64, .15]} label={mode} active={armed} disabled={cannotTear} onPress={changeMode}/>
    {armed && <HudLine position={[0, -.40, 0]} width={1.62} text={hint} role="muted" center/>}
  </group>;
  return <div className="wardrobe-screen" role="group" aria-label={title}>
    <header><h3>{title}</h3><button type="button" onClick={leave}>{back}</button></header>
    <p role="status">{status}</p>
    <div className="wardrobe-tools"><button type="button" disabled={cannotWear} onClick={changeWear}>{wear}</button>
      <button type="button" disabled={cannotReplace} onClick={newPair}>{replace}</button></div>
    <button type="button" aria-pressed={armed} disabled={cannotTear} onClick={changeMode}>{mode}</button>
    {armed && <p className="wardrobe-note">{hint}</p>}
  </div>;
}
