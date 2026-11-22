import { useLayoutEffect, useState } from 'react';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { useMmdVrStore } from '../mmdVrStore';
import { BODY_DAY_SECONDS, bodyRanges, DEFAULT_BODY_PROFILE, sampleBody, type BodyProfile } from './data';
import { beginBodyPreview, cancelBodyPreview, commitBodyPreview, disableBodyState, drainBodySide, patchBodyPreview, stepBodyDay, useBodyState } from './store';
import { actions, line, type Action, type Field, type Row } from './controlRows';

export type BodyActor = { assetId: string; runtimeId: string };
type Page = 'cycle'|'rhythm'|'lining'|'secretions'|'chest'|'morphs'|'contact'|'sensitivity'|'milk'|'milkLevel';
const percent = (n: number) => `${Math.round(n*100)}%`;
const decimal = (n: number) => String(+n.toFixed(1));
const clamp = (n: number, min: number, max: number) => Math.min(max,Math.max(min,n));
const atDay = (p: BodyProfile) => p.day+Math.floor(p.daySeconds/BODY_DAY_SECONDS*10+1e-8)/10;

export function useBodyEditor({ assetId, runtimeId }: BodyActor) {
  const zh = useLanguageStore(s => s.language === 'zh');
  const l = (cn: string, en: string) => zh ? cn : en;
  const [page, go] = useState<Page>('cycle'), [morphPage, setMorphPage] = useState(0);
  const [undo, setUndo] = useState<{ previous: BodyProfile|undefined }|null>(null);
  const saved = useBodyState(s => s.byAsset[assetId]);
  const draft = useBodyState(s => s.draft?.assetId === assetId ? s.draft.value : null);
  const support = useBodyState(s => { const item = s.support[assetId]; return item?.runtimeId === runtimeId ? item : undefined; });
  const name = useBackpack(s => s.entries.find(e => e.id === assetId)?.file.name ?? '');
  const hidden = useBackpack(s => !s.live[assetId]?.visible);
  const busy = useBackpack(s => s.busy || s.selected !== assetId || s.live[assetId]?.runtimeId !== runtimeId);
  const blocked = useMmdVrStore(s => s.physicsBusy || s.assetLoad.running || s.physicsFatal) || busy || hidden;
  useLayoutEffect(() => () => { cancelBodyPreview(assetId); }, [assetId,runtimeId]);
  const profile = draft ?? saved, inDraft = !!draft;
  const start = () => {
    if (blocked) return false;
    return useBodyState.getState().draft?.assetId === assetId || beginBodyPreview(assetId);
  };
  const patch = (change: Partial<BodyProfile>) => { if (start()) patchBodyPreview(assetId,change); };
  const act = (label: string, run: () => void, options: Partial<Omit<Action,'label'|'run'>> = {}): Action => ({label,run,...options});
  const navigate = (to: Page, cn: string, en: string, active?: boolean) => act(l(cn,en),() => go(to),{active,quiet:true});
  const tab = page === 'chest' || page === 'contact' || page === 'sensitivity' || page === 'morphs' ? 'chest' : page === 'milk' || page === 'milkLevel' ? 'milk' : 'cycle';
  const tabs: Action[] = [navigate('cycle','周期','Cycle',tab==='cycle'),navigate('chest','胸型','Chest',tab==='chest'),navigate('milk','泌乳','Lactation',tab==='milk')];
  const title = l('身体状态','Body state'), back = l('返回','Back');
  const rows: Row[] = [], footer: Action[] = [];
  if (hidden) {
    rows.push(line(l('请先显示此角色，再编辑身体状态。','Show this actor on stage to edit body state.')));
    return { name,title,back,blocked,tabs:[],rows,footer,inDraft };
  }
  if (!profile) {
    rows.push(line(l('当前角色的身体状态已关闭。','Body state is off for this actor.')),
      actions(act(l('为此成年角色启用','Enable for this adult'),() => { if (!blocked && beginBodyPreview(assetId,true)) go('cycle'); })));
    return { name,title,back,blocked,tabs:[],rows,footer,inDraft };
  }
  const p = profile, bounds = bodyRanges(p), effective = sampleBody(p), base = saved ?? DEFAULT_BODY_PROFILE;
  const languagePhase = (phase: typeof effective.phase) => ({bleed:l('经期','Menstrual'),follicular:l('经后期','Follicular'),ovulatory:l('排卵前后','Ovulatory'),luteal:l('黄体期','Luteal')})[phase];
  const day = (n: number) => l(`第 ${decimal(n)} 天`,`Day ${decimal(n)}`);
  const toggle = (label: string, key: 'ovulation'|'locked'|'lactating') => act(label,() => patch({[key]:!p[key]}),{active:p[key]});
  function field(label: string, key: 'length'|'bleedDays'|'peakDays'|'lutealDays'|'compression'|'rebound'|'refillSeconds'|'fullness'|'cycleGain'|'liningGain'|'secretionGain'|'sensitivity'|'left'|'right', step: number, format: (n:number)=>string = String, disabled=false): Field {
    const [min,max] = key in bounds ? bounds[key as keyof typeof bounds] : [0,1];
    return {kind:'field',label,formatted:format(p[key]),value:p[key],step,min,max,disabled,scrub:key==='length'||key==='refillSeconds',
      change:n=>patch({[key]:+clamp(n,min,max).toFixed(3)})};
  }
  function override(key: 'liningOverride'|'secretionOverride', relative: number) {
    const manual = p[key] != null;
    rows.push(actions(act(l('随周期','Follow cycle'),()=>patch({[key]:null}),{active:!manual}),
      act(l('固定数值','Set value'),()=>patch({[key]:relative}),{active:manual})));
    const n = p[key] ?? relative;
    rows.push({kind:'field',label:l('固定水平','Fixed level'),value:n,formatted:percent(n),min:0,max:1,step:.05,disabled:!manual,change:v=>patch({[key]:clamp(v,0,1)})});
  }
  const backTo = (to: Page, cn: string, en: string) => actions(navigate(to,cn,en));
  if (page === 'cycle') {
    const a = sampleBody(base);
    rows.push({kind:'diagram',legend:l('粉色：子宫内膜　浮起的短线：脱落','Pink: uterine lining · Loose marks: shedding'),samples:[
      {...a,caption:`${saved?l('已确认','Saved'):l('起点','Start')} · ${day(atDay(base))}`,phase:languagePhase(a.phase)},
      {...effective,caption:`${l('预览','Preview')} · ${day(atDay(p))}`,phase:languagePhase(effective.phase)}]},
      {kind:'date',label:l('预览周期日','Preview cycle day'),value:atDay(p),max:p.length,change:n=>patch({day:Math.floor(n),daySeconds:Math.round((n%1)*BODY_DAY_SECONDS)})},
      actions(act(l('−1 天','−1 day'),()=>{if(start())stepBodyDay(assetId,-1);}),
        toggle(p.locked?l('日期已冻结','Day frozen'):l('冻结日期','Freeze day'),'locked'),
        act(l('+1 天','+1 day'),()=>{if(start())stepBodyDay(assetId,1);})),
      actions(navigate('rhythm','周期设置','Cycle settings'),navigate('lining','剖面设置','Section settings')));
  } else if (page === 'rhythm') {
    rows.push(field(l('周期天数','Cycle length (days)'),'length',1),field(l('经期天数','Bleeding days'),'bleedDays',1),
      actions(toggle(p.ovulation?l('模拟排卵：开','Ovulation: on'):l('模拟排卵：关','Ovulation: off'),'ovulation')));
    if(p.ovulation) rows.push(field(l('排卵段天数','Ovulatory days'),'peakDays',1),field(l('黄体段天数','Luteal days'),'lutealDays',1));
    rows.push(line(l(`解冻后每 ${BODY_DAY_SECONDS} 秒舞台时间过一天。`,`Unfrozen: one day per ${BODY_DAY_SECONDS} stage seconds.`)),backTo('cycle','返回日期对照','Back to dates'));
  } else if (page === 'lining' || page === 'secretions') {
    const lining = page === 'lining';
    rows.push(actions(navigate('lining','内膜厚度','Lining',lining),navigate('secretions','分泌物','Secretions',!lining)),
      line(l(`${day(p.day)} · 当前水平 ${percent(lining?effective.lining:effective.secretion)}`,`${day(p.day)} · Current level ${percent(lining?effective.lining:effective.secretion)}`)),
      field(l('周期变化幅度','Cyclic variation'),lining?'liningGain':'secretionGain',.05,percent,(lining?p.liningOverride:p.secretionOverride)!=null));
    override(lining?'liningOverride':'secretionOverride',lining?effective.lining:effective.secretion);
    rows.push(backTo('cycle','返回日期对照','Back to dates'));
  } else if (page === 'sensitivity') {
    const sensitivity = l('胀感／触痛','Tenderness'), mode = p.sensitivityMode;
    rows.push(line(`${day(p.day)} · ${sensitivity} ${percent(effective.sensitivity)}`),
      actions(...(['off','cycle','manual'] as const).map((m,i)=>act([l('关闭','Off'),l('随周期','Follow cycle'),l('手动','Manual')][i],
        ()=>patch({sensitivityMode:m}),{active:m===mode}))),
      field(mode==='cycle'?l('周期变化幅度','Cyclic variation'):l('手动水平','Manual level'),'sensitivity',.05,percent,mode==='off'),
      line(l('此项只记录感受，不改变受压、回弹或表情。','State only. No change to pressure, rebound or expression.')),
      backTo('contact','返回接触响应','Back to contact'));
  } else if (page === 'chest' || page === 'morphs' || page === 'contact') {
    const names = support?.morphs ?? [], selected = p.morph;
    const missing = !!selected && !names.includes(selected);
    const bone = support?.bones ? l('专用胸骨','Chest bones') : l('仅记录状态','State only');
    const status = !support?l('尚未读取此模型的适配信息','Model support is not available yet'):
      missing?l('上次的形态键不可用，请重新选择。','Previous morph unavailable. Choose a new source.'):
      !names.length&&!support.bones?l('无兼容形态键或胸骨；仅记录状态。','No compatible morphs or bones. State only.'):
      !names.length?l('无兼容形态键，可使用专用胸骨。','No compatible morphs. Chest bones available.'):
      !support.bones?l('选用形态键后，模型才会显示胸型变化。','Select a morph to show fullness on this model.'):
      l('仅模型已适配的衣物随动。','Only clothing rigged for this effect follows.');
    if(page === 'chest') rows.push(line(status),
      {kind:'morph',label:l('胸型适配','Shape source'),names,value:selected,none:bone,choose:morph=>patch({morph}),browse:()=>{setMorphPage(Math.max(0,Math.floor(names.indexOf(selected??'')/3)));go('morphs');}},
      ...(names.length?[line(l('从顶点形态键里选改变胸型的一项。','Choose a vertex morph that shapes the chest.'))]:[]),
      field(l('基础饱满度','Base fullness'),'fullness',.05,percent),field(l('周期变化幅度','Cyclic variation'),'cycleGain',.05,percent),
      line(l(`${day(p.day)} · 饱满度 ${percent(effective.fullness)}`,`${day(p.day)} · Fullness ${percent(effective.fullness)}`)),backTo('contact','接触响应','Contact response'));
    else if(page === 'morphs') {
      const pages = Math.max(1,Math.ceil(names.length/3)), index = Math.min(morphPage,pages-1);
      rows.push(line(l('仅选择用来改变胸型的形态键。','Choose only a morph that shapes the chest.')),actions(act(bone,()=>{patch({morph:null});go('chest');},{active:!selected})),
        ...names.slice(index*3,index*3+3).map(n=>actions(act(n,()=>{patch({morph:n});go('chest');},{active:n===selected}))),
        actions(act(l('上一页','Previous'),()=>setMorphPage(index-1),{disabled:index===0}),act(`${index+1} / ${pages} · ${back}`,()=>go('chest'),{quiet:true}),act(l('下一页','Next'),()=>setMorphPage(index+1),{disabled:index+1>=pages})));
    } else {
      const sides = support?.sides, canPress = !!(sides?.left || sides?.right);
      rows.push(line(!canPress ? l('没有适配的受压骨链，局部受压不可用。','No compatible bone chain for contact deformation.') : sides?.left&&sides.right ? l('左右胸均支持局部受压。','Both sides support contact deformation.') : sides?.left ? l('仅左胸支持局部受压。','Only the left side supports contact.') : l('仅右胸支持局部受压。','Only the right side supports contact.')),
        field(l('受压形变','Compression'),'compression',.05,percent,!canPress),field(l('回弹时间','Rebound'),'rebound',.02,n=>`${Math.round(n*1000)} ms`,!canPress),
        line(l('仅模型已适配的衣物随动。','Only clothing rigged for this effect follows.')),
        actions(navigate('sensitivity',`胀感／触痛 · ${percent(effective.sensitivity)}`,`Tenderness · ${percent(effective.sensitivity)}`)),
        backTo('chest','返回胸型','Back to chest'));
    }
  } else {
    rows.push(actions(toggle(p.lactating?l('泌乳：已开启','Lactation: on'):l('开启泌乳','Enable lactation'),'lactating')));
    if(!p.lactating) rows.push(line(l('独立于周期；开启后左右侧分别回充。','Independent of the cycle. Each side refills separately.')));
    else if(page==='milkLevel') rows.push(field(l('左侧充盈度','Left fullness'),'left',.05,percent),field(l('右侧充盈度','Right fullness'),'right',.05,percent),
      field(l('从空到满','Empty to full'),'refillSeconds',15,n=>`${Math.round(n)} s`),backTo('milk','返回左右状态','Back to levels'));
    else {
      for(const side of ['left','right'] as const) rows.push(line(`${side==='left'?l('左侧充盈度','Left fullness'):l('右侧充盈度','Right fullness')} · ${percent(p[side])}`),
        actions(act(side==='left'?l('排出左侧 25%','Drain left 25%'):l('排出右侧 25%','Drain right 25%'),()=>{if(start())drainBodySide(assetId,side);},{disabled:p[side]<=0})));
      rows.push(backTo('milkLevel','调节充盈与恢复时间','Set levels & refill time'));
    }
  }
  if(inDraft) footer.push(act(l('撤销预览','Discard preview'),()=>{cancelBodyPreview(assetId);}),
    act(l('确认','Confirm'),()=>{if(blocked)return;setUndo({previous:saved});commitBodyPreview(assetId);},{primary:true}));
  else {
    if(undo) footer.push(act(l('撤销确认','Undo confirm'),()=>{
      if(blocked)return;
      if(!undo.previous) disableBodyState(assetId);
      else if(start()){patchBodyPreview(assetId,undo.previous);commitBodyPreview(assetId);}
      setUndo(null);
    },{quiet:true}));
    footer.push(act(l('关闭身体状态','Turn off body state'),()=>{disableBodyState(assetId);setUndo(null);go('cycle');},{quiet:true}));
  }
  return { name,title,back,blocked,tabs,rows,footer,inDraft };
}
