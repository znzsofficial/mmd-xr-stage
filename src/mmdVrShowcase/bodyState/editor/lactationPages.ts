import {actions,line,type Row} from '../controlRows';
import {action,milkFill,type EditorControls} from './controls';

export function lactationRows({p,l,inDraft,field,patch}:EditorControls):Row[] {
  return [actions(action(l('开启泌乳','Lactation on'),()=>patch({lactating:true}),{active:p.lactating}),
    action(l('关闭泌乳','Lactation off'),()=>patch({lactating:false}),{active:!p.lactating})),
    field(l('左侧起始存量','Left starting level'),'left',.05,milkFill),
    field(l('右侧起始存量','Right starting level'),'right',.05,milkFill),
    field(l('从空回充到满','Refill from empty to full'),'refillSeconds',15,n=>l(`${Math.round(n)} 秒`,`${Math.round(n)} s`)),
    line(!p.lactating?l('泌乳已关。起始存量会保留，不会回充。','Lactation is off. Starting levels are kept without refilling.'):
      inDraft?l('保存后，两侧从设定的存量各自回充。','After saving, each side refills from its starting level.'):
      l('现在显示角色的实时存量。保存新值后，从新值回充。','These are the actor’s live levels. Save to refill from new levels.')),
    line(l('按压和确认露出在「互动 → 泌乳」。','For pressure and skin confirmation, open Interact → Lactation.'))];
}
