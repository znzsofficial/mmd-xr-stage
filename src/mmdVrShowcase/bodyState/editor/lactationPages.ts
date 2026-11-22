import {actions,line,type Row} from '../controlRows';
import {action,percent,type EditorControls} from './controls';

export function lactationRows(page:'milk'|'milkLevel',ui:EditorControls,drain:(side:'left'|'right')=>void):Row[] {
  const {p,l,field,toggle,link}=ui;
  if(page==='milkLevel' && p.lactating){
    return [field(l('左侧充盈度','Left fullness'),'left',.05,percent),field(l('右侧充盈度','Right fullness'),'right',.05,percent),
      actions(...(['left','right'] as const).map(side=>action(side==='left'?l('排出左侧 25%','Drain left 25%'):l('排出右侧 25%','Drain right 25%'),
        ()=>drain(side),{disabled:p[side]<=0}))),field(l('从空到满','Refill time'),'refillSeconds',15,n=>`${Math.round(n)} s`)];
  }
  const switchRow=actions(toggle(p.lactating?l('关闭泌乳','Turn off lactation'):l('开启泌乳','Turn on lactation'),'lactating'));
  if(!p.lactating)return [switchRow,line(l('开启后，左右侧各自回充。','Each side refills separately when on.'))];
  return [switchRow,line(l(`左侧 ${percent(p.left)} · 右侧 ${percent(p.right)}`,`Left ${percent(p.left)} · Right ${percent(p.right)}`)),actions(link('milkLevel'))];
}
