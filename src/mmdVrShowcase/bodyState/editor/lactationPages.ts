import {actions,line,type Row} from '../controlRows';
import {action,percent,type EditorControls} from './controls';

export function lactationRows(page:'milk'|'milkLevel',ui:EditorControls,drain:(side:'left'|'right')=>void):Row[] {
  const {p,l,field,patch,link,go}=ui;
  if(!p.lactating)return [line(l('开启后可分侧排出，两侧会各自回充。','Turn on lactation to drain either side. Each side refills on its own.')),
    actions(action(l('开启泌乳','Turn on lactation'),()=>{patch({lactating:true});go('milk');},{primary:true}))];
  if(page==='milkLevel')return [field(l('从空到满','Time from empty to full'),'refillSeconds',15,n=>l(`${Math.round(n)} 秒`,`${Math.round(n)} s`)),
    line(l('两侧各自自动回充，到 100% 停止。','Each side refills automatically until it reaches 100%.'))];
  return [field(l('左侧充盈度','Left fullness'),'left',.05,percent),field(l('右侧充盈度','Right fullness'),'right',.05,percent),
    line(l('每次最多减少 25 个百分点：50% → 25%。','Up to 25 percentage points per drain: 50% → 25%.')),
    actions(action(l('排出左侧','Drain left'),()=>drain('left'),{disabled:p.left<=0}),
      action(l('排出右侧','Drain right'),()=>drain('right'),{disabled:p.right<=0})),
    actions(link('milkLevel'),action(l('关闭泌乳','Turn off lactation'),()=>patch({lactating:false}),{quiet:true}))];
}
