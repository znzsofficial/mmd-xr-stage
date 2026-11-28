import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useLanguageStore } from '../../languageStore';
import { HudButton, HudLine, HudSheet } from '../hud/PorcelainControls';
import { armStockingTear, canDressStockings, disarmStockingTear, dressStockings, readStockingState, useStockings, type StockingActor } from './stockingState';
import type { StockingFitReason } from './stockingFit';
import { readStockingFit, subscribeStockingFit } from './stockingSurface';

const fitFailures = {
  'leg-rig': ['无法贴合 · 未识别出可用的腿骨', 'No fit · Leg bones couldn’t be matched'],
  'no-surface': ['无法贴合 · 未找到可用的腿部表面', 'No fit · No suitable leg surface found'],
  'leg-coverage': ['无法贴合 · 连续的腿面不足以穿上袜身', 'No fit · Not enough continuous leg surface'],
  'topology-limit': ['无法贴合 · 模型网格超出贴合上限', 'No fit · Model mesh exceeds the fitting limit'],
} as const satisfies Record<StockingFitReason, readonly [string, string]>;

export function StockingControls({ assetId, runtimeId, title, available, hud, onBack }: StockingActor & { title: string; available: boolean; hud?: boolean; onBack(): void }) {
  const actor = { assetId, runtimeId }, zh = useLanguageStore(s => s.language === 'zh'), l = (cn: string, en: string) => zh ? cn : en;
  const pair = useStockings(s => readStockingState(assetId, s));
  const armed = useStockings(s => s.armed?.assetId === assetId && s.armed.runtimeId === runtimeId);
  const fit = useSyncExternalStore(subscribeStockingFit, () => readStockingFit(runtimeId));
  useLayoutEffect(() => () => disarmStockingTear({ assetId, runtimeId }), [assetId, runtimeId]);
  const back = l('返回衣柜', 'Back to wardrobe');
  const wear = pair.worn ? l('脱下', 'Take off') : l('穿上', 'Put on');
  const replace = l('换新袜', 'Replace stockings'), mode = l('撕扯模式', 'Tear mode');
  const left = pair.tears.filter(t => t.side === 'left').length, right = pair.tears.length - left;
  const wearState = pair.worn ? l('已穿上', 'Worn') : l('未穿上', 'Off');
  const leftLeg = fit?.patches?.some(p => p.side === 'left'), rightLeg = fit?.patches?.some(p => p.side === 'right');
  let status = pair.tears.length
    ? l(`${wearState} · 左腿 ${left} 处破口，右腿 ${right} 处`, `${wearState} · Tears: left ${left}, right ${right}`)
    : `${wearState} · ${l('完好', 'Intact')}`;
  if (!fit) {
    status = pair.worn ? l('正在试穿…', 'Checking fit…') : l('未穿上 · 穿上时检查贴合', 'Off · Put on to check fit');
  } else if (fit.reason) {
    status = fitFailures[fit.reason][zh ? 0 : 1];
  } else if (leftLeg !== rightLeg) {
    const side = leftLeg ? l('仅左腿可穿', 'Left leg only') : l('仅右腿可穿', 'Right leg only');
    const count = leftLeg ? left : right;
    status = `${wearState} · ${side} · ${count ? l(`${count} 处破口`, `Tears: ${count}`) : l('完好', 'Intact')}`;
  }
  let hint = !pair.worn && !fit?.reason ? l('只撕这双外穿的丝袜，原有衣物不变。', 'Tears affect only the added pair, not the original outfit.') : '';
  if (fit?.patches) {
    const leftFootMissing = leftLeg && !fit.foot.left, rightFootMissing = rightLeg && !fit.foot.right;
    let foot = '';
    if (leftFootMissing && rightFootMissing) foot = l('袜身可穿，脚面未贴合。', 'Legs fit; no foot coverage. ');
    else if (leftFootMissing) foot = l('左脚面未贴合。', 'Left foot not covered. ');
    else if (rightFootMissing) foot = l('右脚面未贴合。', 'Right foot not covered. ');
    const tear = armed ? l('按住露出的袜面，拉动后松开。', 'Hold exposed fabric, pull and release.')
      : l('被衣物遮住的袜面不能撕。', 'Only exposed fabric can tear.');
    if (pair.worn || foot) hint = foot + tear;
  }
  const locked = !available || !canDressStockings(actor), cannotWear = locked || (!pair.worn && !!fit?.reason);
  const cannotTear = locked || !pair.worn || !fit?.patches, cannotReplace = locked || !pair.worn || !pair.tears.length;
  const changeWear = () => { if (!cannotWear) dressStockings(actor, pair.worn ? 'remove' : 'wear'); };
  const changeMode = () => { if (armed) disarmStockingTear(actor); else if (!cannotTear && readStockingFit(runtimeId) === fit) armStockingTear(actor); };
  const newPair = () => { if (!cannotReplace) dressStockings(actor, 'replace'); };
  const leave = () => { disarmStockingTear(actor); onBack(); };
  if (hud) return <group name="wardrobe:stockings"><HudSheet size={[1.78, 1.04]}/>
    <HudLine position={[-.31, .37, 0]} width={1} text={title} role="title"/>
    <HudButton position={[.53, .37, 0]} size={[.60, .145]} label={back} variant="quiet" onPress={leave}/>
    <HudLine position={[0, .18, 0]} width={1.62} text={status} center/>
    <HudButton position={[-.42, -.02, 0]} size={[.80, .15]} label={wear} variant={pair.worn ? 'button' : 'primary'} disabled={cannotWear} onPress={changeWear}/>
    <HudButton position={[.42, -.02, 0]} size={[.80, .15]} label={replace} disabled={cannotReplace} onPress={newPair}/>
    <HudButton position={[0, -.22, 0]} size={[1.64, .15]} label={mode} active={armed} disabled={cannotTear} onPress={changeMode}/>
    {hint && <HudLine position={[0, -.40, 0]} width={1.62} text={hint} role="muted" center/>}
  </group>;
  return <div className="wardrobe-screen" role="group" aria-label={title}>
    <header><h3>{title}</h3><button type="button" onClick={leave}>{back}</button></header>
    <p role="status">{status}</p>
    <div className="wardrobe-tools"><button type="button" disabled={cannotWear} onClick={changeWear}>{wear}</button>
      <button type="button" disabled={cannotReplace} onClick={newPair}>{replace}</button></div>
    <button type="button" aria-pressed={armed} disabled={cannotTear} onClick={changeMode}>{mode}</button>
    {hint && <p className="wardrobe-note">{hint}</p>}
  </div>;
}
