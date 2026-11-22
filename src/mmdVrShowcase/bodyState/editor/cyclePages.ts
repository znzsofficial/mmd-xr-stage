import {actions, line, type Row} from '../controlRows';
import {BODY_DAY_SECONDS, sampleBody, type BodyProfile, type BodySample} from '../data';
import {action, atDay, clamp, percent, type EditorControls, type Localize} from './controls';

type CyclePage = 'cycle'|'organ'|'rhythm'|'lining'|'secretions';

function describe(s:BodySample,p:BodyProfile,l:Localize) {
  if(s.phase==='bleed' && s.shedding>.02 && s.lining>.02)return l('内膜正在脱落','Lining is shedding');
  if(s.phase==='ovulatory' && s.secretion>.50)return l('分泌较多','More secretions');
  if(p.liningOverride!=null)return l('内膜厚度固定','Lining depth is set');
  if(!p.liningGain)return l('内膜保持不变','Lining is steady');
  if(s.phase==='follicular')return l('内膜逐渐长回','Lining is regrowing');
  if(s.lining>.68)return l('内膜较厚','Thicker lining');
  if(s.lining<.3)return l('内膜较薄','Thinner lining');
  return l('内膜在变化','Lining is changing');
}

export function cycleRows(page: CyclePage, ui: EditorControls, stepDay: (days:number)=>void): Row[] {
  const {l,p,base,saved,effective,day,link,field,toggle,patch} = ui;
  switch(page){
    case 'cycle':
    case 'organ': {
      const phases = {bleed:l('经期','Menstrual'),follicular:l('经后期','Follicular'),ovulatory:l('排卵前后','Ovulatory'),luteal:l('黄体期','Luteal')};
      const reading = (profile:BodyProfile,s:BodySample,label:string) => ({tissue:s.tissue,caption:`${label} · ${day(atDay(profile))}`,
        phase:phases[s.phase],change:describe(s,profile,l)});
      return [{kind:'cycle',organ:page==='organ',
        views:[link('cycle',l('两日对照','Compare days'),page==='cycle'),link('organ',undefined,page==='organ')],
        pair:{samples:[reading(base,sampleBody(base),saved?l('已保存','Saved'):l('起点','Start')),reading(p,effective,l('预览','Preview'))]},
        date:{label:l('预览周期日','Preview cycle day'),value:atDay(p),max:p.length,
          change:n=>patch({day:Math.floor(n),daySeconds:Math.round((n%1)*BODY_DAY_SECONDS)})},
        previous:action(l('−1 天','−1 day'),()=>stepDay(-1)),next:action(l('+1 天','+1 day'),()=>stepDay(1)),
        settings:[toggle(p.locked?l('日期已冻结','Day frozen'):l('冻结日期','Freeze day'),'locked'),
          link('rhythm'), link('lining',l('剖面设置','Section settings'))],
      }];
    }
    case 'rhythm': {
      const rows:Row[] = [field(l('周期天数','Cycle length (days)'),'length',1),field(l('经期天数','Bleeding days'),'bleedDays',1),
        actions(toggle(p.ovulation?l('模拟排卵：开','Ovulation: on'):l('模拟排卵：关','Ovulation: off'),'ovulation'))];
      if(p.ovulation)rows.push(field(l('排卵段天数','Ovulatory days'),'peakDays',1),field(l('黄体段天数','Luteal days'),'lutealDays',1));
      rows.push(field(l('胸型随周期变化','Chest variation'),'cycleGain',.05,percent),
        line(l(`解冻后，每 ${BODY_DAY_SECONDS} 秒过一天。`,`One day every ${BODY_DAY_SECONDS} s when unfrozen.`)));
      return rows;
    }
    case 'lining':
    case 'secretions': {
      const lining=page==='lining',key=lining?'liningOverride':'secretionOverride';
      const level=lining?effective.lining:effective.secretion, manual=p[key]!=null, value=p[key]??level;
      return [actions(link('lining',l('内膜厚度','Lining'),lining),link('secretions',l('分泌物','Secretions'),!lining)),
        line(l(`${day(p.day)} · 当前水平 ${percent(level)}`,`${day(p.day)} · Current level ${percent(level)}`)),
        field(l('周期变化幅度','Cyclic variation'),lining?'liningGain':'secretionGain',.05,percent,manual),
        actions(action(l('随周期','Follow cycle'),()=>patch({[key]:null}),{active:!manual}),
          action(l('固定数值','Set value'),()=>patch({[key]:level}),{active:manual})),
        {kind:'field',label:l('固定水平','Fixed level'),value,formatted:percent(value),min:0,max:1,step:.05,disabled:!manual,change:n=>patch({[key]:clamp(n,0,1)})}];
    }
  }
}
