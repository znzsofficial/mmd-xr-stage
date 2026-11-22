import { useLayoutEffect, useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import { BODY_DAY_SECONDS, bodyRanges, DEFAULT_BODY_PROFILE, sampleBody, type BodyProfile } from './data';
import { beginBodyPreview, cancelBodyPreview, commitBodyPreview, disableBodyState, drainBodySide, inspectBody, patchBodyPreview, stepBodyDay, useBodyState } from './store';
import { actions, line, type Action, type Field, type Row } from './controlRows';

export type BodyActor = { assetId: string; runtimeId: string };
type Page = 'chest'|'more'|'fit'|'cycle'|'organ'|'rhythm'|'lining'|'secretions'|'morphs'|'contact'|'sensitivity'|'milk'|'milkLevel';
const parent: Partial<Record<Page,Page>> = {more:'chest',fit:'more',cycle:'more',milk:'more',contact:'more',morphs:'fit',organ:'cycle',rhythm:'cycle',lining:'cycle',secretions:'cycle',sensitivity:'contact',milkLevel:'milk'};
const percent = (n: number) => `${Math.round(n*100)}%`;
const decimal = (n: number) => String(+n.toFixed(1));
const clamp = (n: number, min: number, max: number) => Math.min(max,Math.max(min,n));
const atDay = (p: BodyProfile) => p.day+Math.floor(p.daySeconds/BODY_DAY_SECONDS*10+1e-8)/10;

export function useBodyEditor({ assetId, runtimeId }: BodyActor) {
  const zh = useLanguageStore(s => s.language === 'zh');
  const l = (cn: string, en: string) => zh ? cn : en;
  const [page, go] = useState<Page>('chest'), [morphPage, setMorphPage] = useState(0);
  const [fitBack,setFitBack] = useState<Page>('more');
  const [undo, setUndo] = useState<{ previous: BodyProfile|undefined }|null>(null);
  const saved = useBodyState(s => s.byAsset[assetId]);
  const draft = useBodyState(s => s.draft?.assetId === assetId ? s.draft.value : null);
  const support = useBodyState(s => { const item = s.support[assetId]; return item?.runtimeId === runtimeId ? item : undefined; });
  const name = useBackpack(s => s.entries.find(e => e.id === assetId)?.file.name ?? '');
  const hidden = useBackpack(s => !s.live[assetId]?.visible);
  const busy = useBackpack(s => s.busy || s.selected !== assetId || s.live[assetId]?.runtimeId !== runtimeId);
  const blocked = useMmdVrStore(s => s.physicsBusy || s.assetLoad.running || s.physicsFatal) || busy || hidden;
  useLayoutEffect(() => inspectBody(assetId,runtimeId), [assetId,runtimeId]);
  const profile = draft ?? saved, inDraft = !!draft;
  // An explicit edit starts a preview. Merely opening or browsing the sheet
  // only inspects the rig, and must not enable a new asset's simulation.
  const start = () => !blocked && useBackpack.getState().live[assetId]?.runtimeId===runtimeId && beginBodyPreview(assetId,true);
  const patch = (change: Partial<BodyProfile>) => { if (start()) patchBodyPreview(assetId,change); };
  const act = (label: string, run: () => void, options: Partial<Omit<Action,'label'|'run'>> = {}): Action => ({label,run,...options});
  const navigate = (to: Page, cn: string, en: string, active?: boolean) => act(l(cn,en),() => {if(to==='fit')setFitBack(page);go(to);},{active,quiet:true});
  const titles: Record<Page,string> = {chest:l('胸型','Chest shape'),more:l('更多设置','More settings'),fit:l('模型适配','Shape source'),morphs:l('选择形态键','Choose a morph'),cycle:l('周期','Cycle'),organ:l('子宫动态','Uterus in motion'),rhythm:l('周期设置','Cycle settings'),lining:l('内膜与分泌物','Lining & secretions'),secretions:l('内膜与分泌物','Lining & secretions'),contact:l('触碰','Touch'),sensitivity:l('触痛','Tenderness'),milk:l('泌乳','Lactation'),milkLevel:l('分侧设置','Left & right')};
  const title=titles[page], back=l('返回','Back'), up=page==='fit'?fitBack:parent[page];
  const backAction=up?act(back,()=>go(up),{quiet:true}):null;
  const rows: Row[] = [], footer: Action[] = [];
  if (hidden) {
    rows.push(line(l('请先显示此角色，再编辑身体状态。','Show this actor on stage to edit body state.')));
    return { name,title,back,backAction,blocked,rows,footer,inDraft };
  }
  const p = profile ?? DEFAULT_BODY_PROFILE, bounds = bodyRanges(p), effective = sampleBody(p), base = saved ?? DEFAULT_BODY_PROFILE;
  const languagePhase = (phase: typeof effective.phase) => ({bleed:l('经期','Menstrual'),follicular:l('经后期','Follicular'),ovulatory:l('排卵前后','Ovulatory'),luteal:l('黄体期','Luteal')})[phase];
  const day = (n: number) => l(`第 ${decimal(n)} 天`,`Day ${decimal(n)}`);
  const toggle = (label: string, key: 'ovulation'|'locked'|'lactating') => act(label,() => patch({[key]:!p[key]}),{active:p[key]});
  function field(label: string, key: 'length'|'bleedDays'|'peakDays'|'lutealDays'|'compression'|'rebound'|'refillSeconds'|'fullness'|'cycleGain'|'liningGain'|'secretionGain'|'sensitivity'|'left'|'right', step: number, format: (n:number)=>string = String, disabled=false): Field {
    const [min,max] = key in bounds ? bounds[key as keyof typeof bounds] : [0,1];
    return {kind:'field',label,formatted:format(p[key]),value:p[key],step,min,max,disabled,scrub:key==='length'||key==='refillSeconds'||key==='fullness',
      change:n=>patch({[key]:+clamp(n,min,max).toFixed(3)})};
  }
  function override(key: 'liningOverride'|'secretionOverride', relative: number) {
    const manual = p[key] != null;
    rows.push(actions(act(l('随周期','Follow cycle'),()=>patch({[key]:null}),{active:!manual}),
      act(l('固定数值','Set value'),()=>patch({[key]:relative}),{active:manual})));
    const n = p[key] ?? relative;
    rows.push({kind:'field',label:l('固定水平','Fixed level'),value:n,formatted:percent(n),min:0,max:1,step:.05,disabled:!manual,change:v=>patch({[key]:clamp(v,0,1)})});
  }
  if(page==='more') {
    rows.push(actions(navigate('cycle','周期','Cycle'),navigate('milk','泌乳','Lactation')),
      actions(navigate('contact','触碰','Touch'),navigate('fit','模型适配','Shape source')));
    if(saved && !draft)rows.push(actions(act(l('关闭身体状态','Turn off body state'),()=>{disableBodyState(assetId);setUndo(null);go('chest');},{quiet:true})));
  } else if (page === 'cycle' || page === 'organ') {
    const a = sampleBody(base);
    rows.push({ kind:'cycle', organ:page === 'organ',
      views:[navigate('cycle','两日对照','Compare days',page==='cycle'),navigate('organ','子宫动态','Uterus in motion',page==='organ')],
      pair:{ legend:l('同尺度子宫壁切片：粉色为内膜，浮线为脱落。','Uterine wall, same scale. Pink: lining. Loose marks: shedding.'), samples:[
        {...a,caption:`${saved?l('已保存','Saved'):l('起点','Start')} · ${day(atDay(base))}`,phase:languagePhase(a.phase)},
        {...effective,caption:`${l('预览','Preview')} · ${day(atDay(p))}`,phase:languagePhase(effective.phase)}]},
      date:{label:l('预览周期日','Preview cycle day'),value:atDay(p),max:p.length,change:n=>patch({day:Math.floor(n),daySeconds:Math.round((n%1)*BODY_DAY_SECONDS)})},
      previous:act(l('−1 天','−1 day'),()=>{if(start())stepBodyDay(assetId,-1);}),
      next:act(l('+1 天','+1 day'),()=>{if(start())stepBodyDay(assetId,1);}),
      settings:[toggle(p.locked?l('日期已冻结','Day frozen'):l('冻结日期','Freeze day'),'locked'),
        navigate('rhythm','周期设置','Cycle settings'),navigate('lining','剖面设置','Section settings')],
    });
  } else if (page === 'rhythm') {
    rows.push(field(l('周期天数','Cycle length (days)'),'length',1),field(l('经期天数','Bleeding days'),'bleedDays',1),
      actions(toggle(p.ovulation?l('模拟排卵：开','Ovulation: on'):l('模拟排卵：关','Ovulation: off'),'ovulation')));
    if(p.ovulation) rows.push(field(l('排卵段天数','Ovulatory days'),'peakDays',1),field(l('黄体段天数','Luteal days'),'lutealDays',1));
    rows.push(field(l('胸型随周期变化','Chest variation'),'cycleGain',.05,percent),line(l(`解冻后，每 ${BODY_DAY_SECONDS} 秒过一天。`,`One day every ${BODY_DAY_SECONDS} s when unfrozen.`)));
  } else if (page === 'lining' || page === 'secretions') {
    const lining = page === 'lining';
    rows.push(actions(navigate('lining','内膜厚度','Lining',lining),navigate('secretions','分泌物','Secretions',!lining)),
      line(l(`${day(p.day)} · 当前水平 ${percent(lining?effective.lining:effective.secretion)}`,`${day(p.day)} · Current level ${percent(lining?effective.lining:effective.secretion)}`)),
      field(l('周期变化幅度','Cyclic variation'),lining?'liningGain':'secretionGain',.05,percent,(lining?p.liningOverride:p.secretionOverride)!=null));
    override(lining?'liningOverride':'secretionOverride',lining?effective.lining:effective.secretion);
  } else if (page === 'sensitivity') {
    const sensitivity = l('胀感／触痛','Tenderness'), mode = p.sensitivityMode;
    rows.push(line(`${day(p.day)} · ${sensitivity} ${percent(effective.sensitivity)}`),
      actions(...(['off','cycle','manual'] as const).map((m,i)=>act([l('关闭','Off'),l('随周期','Follow cycle'),l('手动','Manual')][i],
        ()=>patch({sensitivityMode:m}),{active:m===mode}))),
      field(mode==='cycle'?l('周期变化幅度','Cyclic variation'):l('手动水平','Manual level'),'sensitivity',.05,percent,mode==='off'),
      line(l('只记录感受，不改变外观。','Recorded only; does not change appearance.')));
  } else if (page === 'chest' || page==='fit' || page === 'morphs' || page === 'contact') {
    const names = support?.morphs ?? [], selected = p.morph;
    const missing = !!selected && !names.includes(selected);
    const bone = support?.bones ? l('胸部骨骼','Chest bones') : l('仅记录数值','Value only');
    const needsMorph=!!support&&(missing||(!selected&&!support.bones));
    const status = !support?l('模型尚未就绪。','Model not ready yet.'):
      missing?l('原形态键已缺失，请重新选择。','Saved morph missing. Choose another.'):
      needsMorph ? names.length?l('先选择胸型形态键，模型才会变化。','Choose a chest morph to see a change.'):l('此模型只能记录数值，外观不变。','Value only. This model cannot show the change.'):
      inDraft ? l(`原来 ${percent(sampleBody(base).fullness)} → 预览 ${percent(effective.fullness)}`,`Before ${percent(sampleBody(base).fullness)} → Preview ${percent(effective.fullness)}`):
      saved ? l(`已保存 · 当前胸型 ${percent(effective.fullness)}`,`Saved · Current shape ${percent(effective.fullness)}`):l('拖动即可预览此成年角色。','Drag to preview on this adult actor.');
    if(page === 'chest') rows.push(field(l('胸部饱满度','Chest fullness'),'fullness',.05,percent),line(status),
      actions(...(needsMorph&&(names.length||missing)?[navigate('fit','模型适配','Shape source')]:[]),navigate('more','更多设置','More settings')));
    else if(page==='fit')rows.push({kind:'morph',label:l('外观来源','Shape source'),names,value:selected,none:bone,choose:morph=>{patch({morph});go('chest');},browse:()=>{setMorphPage(Math.max(0,Math.floor(names.indexOf(selected??'')/3)));go('morphs');}},
      line(names.length?l('请选择会改变胸型的形态键。','Choose a morph that changes the chest.'):l('此模型没有可选形态键。','No vertex morphs available.')));
    else if(page === 'morphs') {
      const pages = Math.max(1,Math.ceil(names.length/3)), index = Math.min(morphPage,pages-1);
      rows.push(actions(act(bone,()=>{patch({morph:null});go('chest');},{active:!selected})),
        ...names.slice(index*3,index*3+3).map(n=>actions(act(n,()=>{patch({morph:n});go('chest');},{active:n===selected}))),
        actions(act(l('上一页','Previous'),()=>setMorphPage(index-1),{disabled:index===0}),act(l(`下一页 ${index+1}/${pages}`,`Next ${index+1}/${pages}`),()=>setMorphPage(index+1),{disabled:index+1>=pages})));
    } else {
      const sides = support?.sides, canPress = !!(sides?.left || sides?.right);
      rows.push(line(!canPress ? l('此模型不支持按压。','This model does not support pressure.') : sides?.left&&sides.right ? l('左右胸都可按压。','Both sides respond to pressure.') : sides?.left ? l('仅左胸可按压。','Only the left side responds.') : l('仅右胸可按压。','Only the right side responds.')),
        field(l('受压形变','Compression'),'compression',.05,percent,!canPress),field(l('回弹时间','Rebound'),'rebound',.02,n=>`${Math.round(n*1000)} ms`,!canPress),
        actions(navigate('sensitivity','胀感与触痛','Tenderness')));
    }
  } else {
    if(page==='milkLevel' && p.lactating) {
      rows.push(field(l('左侧充盈度','Left fullness'),'left',.05,percent),field(l('右侧充盈度','Right fullness'),'right',.05,percent),
        actions(...(['left','right'] as const).map(side=>act(side==='left'?l('排出左侧 25%','Drain left 25%'):l('排出右侧 25%','Drain right 25%'),()=>{if(start())drainBodySide(assetId,side);},{disabled:p[side]<=0}))),
        field(l('从空到满','Refill time'),'refillSeconds',15,n=>`${Math.round(n)} s`));
    } else {
      rows.push(actions(toggle(p.lactating?l('关闭泌乳','Turn off lactation'):l('开启泌乳','Turn on lactation'),'lactating')));
      if(p.lactating)rows.push(line(l(`左侧 ${percent(p.left)} · 右侧 ${percent(p.right)}`,`Left ${percent(p.left)} · Right ${percent(p.right)}`)),actions(navigate('milkLevel','分侧设置','Left & right')));
      else rows.push(line(l('开启后，左右侧各自回充。','Each side refills separately when on.')));
    }
  }
  if(inDraft) footer.push(act(l('取消预览','Cancel preview'),()=>{cancelBodyPreview(assetId);}),
    act(l('保存','Save'),()=>{if(blocked)return;setUndo({previous:saved});commitBodyPreview(assetId);},{primary:true}));
  else if(undo) footer.push(act(l('撤销保存','Undo save'),()=>{
      if(blocked)return;
      if(!undo.previous) disableBodyState(assetId);
      else if(start()){patchBodyPreview(assetId,undo.previous);commitBodyPreview(assetId);}
      setUndo(null);
    },{quiet:true}));
  return { name,title,back,backAction,blocked,rows,footer,inDraft };
}
