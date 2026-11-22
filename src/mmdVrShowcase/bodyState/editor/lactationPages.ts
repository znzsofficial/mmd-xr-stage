import {actions,destination,line,type Row} from '../controlRows';
import type {drainBodySide} from '../store';
import {action,milkFill,type EditorControls} from './controls';

export type MilkSide = 'left'|'right';
export type DrainReceipts = Partial<Record<MilkSide,NonNullable<ReturnType<typeof drainBodySide>>>>;

export function lactationRows(page:'milk'|'milkLevel',ui:EditorControls,receipts:DrainReceipts,drain:(side:MilkSide)=>void):Row[] {
  const {p,l,field,patch,link,go,toggle}=ui;
  const observe=destination(link('breast'),p.lactating?l('在示意图中比较两侧充盈度','Compare both sides in the illustration'):l('转动外观，或切换剖面','Rotate the figure or see inside'));
  if(!p.lactating)return [line(l('开启后可分侧排出，两侧会各自回充。','Turn on lactation to drain either side. Each side refills on its own.')),
    actions(action(l('开启泌乳','Turn on lactation'),()=>{patch({lactating:true});go('milk');},{primary:true})),observe];
  const label=(side:MilkSide)=>side==='left'?l('左侧充盈度','Left fullness'):l('右侧充盈度','Right fullness');
  if(page==='milkLevel')return [field(label('left'),'left',.05,milkFill),field(label('right'),'right',.05,milkFill),
    field(l('从空到满','Time from empty to full'),'refillSeconds',15,n=>l(`${Math.round(n)} 秒`,`${Math.round(n)} s`)),
    line(l('手动调节只改变数值，两侧各自回充至 100%。','Manual adjustments only set the level. Each side refills to 100%.')),
    {kind:'skinConfirmation',title:l('普通皮肤材质：露出确认','Body material: exposed skin'),
      instruction:l('只确认能看见裸露乳头的一侧。','Confirm only a side with a visibly bare nipple.'),
      choices:[toggle(l('左侧裸露','Left side bare'),'bareLeft'),toggle(l('右侧裸露','Right side bare'),'bareRight')],
      yes:l('已确认','Yes'),no:l('未确认','No'),
      note:l('独立乳头材质自动识别。缺少出口或被衣物遮挡时不会出液。','Nipple materials: auto. No drops if the outlet is missing or covered.')},
    actions(action(l('关闭泌乳','Turn off lactation'),()=>{patch({lactating:false});go('milk');},{quiet:true}))];
  const sideRow=(side:MilkSide):Row=>{
    const event=receipts[side], change=event&&`${milkFill(event.before)} → ${milkFill(event.after)}`;
    const feedback=event ? (event.visible?l(`上次已排出：${change}`,`Last drain: ${change}`):l(`上次仅更新充盈度：${change}`,`Last: fill only · ${change}`))
      :p[side]===1?l('已满','Full'):l('自动回充中','Refilling');
    return {kind:'milkSide',label:label(side),value:milkFill(p[side]),feedback,
      drain:action(side==='left'?l('排出左侧','Drain left'):l('排出右侧','Drain right'),()=>drain(side),{disabled:p[side]<=0})};
  };
  return [sideRow('left'),sideRow('right'),line(l('每侧每次最多减少 25 个百分点。','Each drain removes up to 25 percentage points.')),observe,
    destination(link('milkLevel'),l('调整充盈度、回充时间与分侧露出确认','Adjust levels, refill time and exposed skin'))];
}
