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
  const {l,p,base,saved,inDraft,effective,day,link,field,toggle,patch} = ui;
  switch(page){
    case 'cycle':
    case 'organ': {
      const phases = {bleed:l('经期','Menstrual'),follicular:l('经后期','Follicular'),ovulatory:l('排卵前后','Ovulatory'),luteal:l('黄体期','Luteal')};
      const reading = (profile:BodyProfile,s:BodySample,label:string) => ({tissue:s.tissue,caption:`${label} · ${day(atDay(profile))}`,
        phase:phases[s.phase],change:describe(s,profile,l)});
      const previewDay=atDay(p);
      const dayMode=(label:string, locked:boolean)=>action(label,()=>{if(p.locked!==locked)patch({locked});},{active:p.locked===locked});
      return [{kind:'cycle',organ:page==='organ',
        views:[link('cycle',l('两日对照','Compare days'),page==='cycle'),link('organ',undefined,page==='organ')],
        pair:{samples:[reading(base,sampleBody(base),saved?l('已保存','Saved'):l('默认','Default')),
          reading(p,effective,inDraft?l('预览','Preview'):l('当前','Current'))]},
        date:{label:l('预览周期日','Preview cycle day'),value:previewDay,max:p.length,
          formatted:l(`第 ${previewDay} 天 / 共 ${p.length} 天`,`Day ${previewDay} of ${p.length}`),
          modes:[dayMode(l('固定日期','Fixed day'),true),dayMode(l('自动前进','Auto-advance'),false)],
          change:n=>patch({day:Math.floor(n),daySeconds:Math.round((n%1)*BODY_DAY_SECONDS)})},
        previous:action(l('上一天','Previous day'),()=>stepDay(-1)),next:action(l('下一天','Next day'),()=>stepDay(1)),
        settings:[link('rhythm'),link('lining')],
      }];
    }
    case 'rhythm': {
      const rows:Row[] = [field(l('周期天数','Cycle length (days)'),'length',1),field(l('经期天数','Bleeding days'),'bleedDays',1),
        actions(toggle(p.ovulation?l('模拟排卵：开','Ovulation: on'):l('模拟排卵：关','Ovulation: off'),'ovulation'))];
      if(p.ovulation)rows.push(field(l('排卵段天数','Ovulatory days'),'peakDays',1),field(l('黄体期天数','Luteal days'),'lutealDays',1),
        field(l('胸型随周期变化','Cyclic chest variation'),'cycleGain',.05,percent));
      rows.push(line(l(`自动前进：每 ${BODY_DAY_SECONDS} 秒模拟时间过一天。`,`Auto-advance: one day per ${BODY_DAY_SECONDS} s of stage time.`)));
      return rows;
    }
    case 'lining':
    case 'secretions': {
      const lining=page==='lining',key=lining?'liningOverride':'secretionOverride';
      const level=lining?effective.lining:effective.secretion, manual=p[key]!=null;
      return [actions(link('lining',l('内膜厚度','Lining'),lining),link('secretions',l('分泌物','Secretions'),!lining)),
        line(`${day(atDay(p))} · ${lining?l('内膜厚度','Lining depth'):l('分泌量','Secretion level')} ${percent(level)}`),
        actions(action(l('随周期','Follow cycle'),()=>{if(manual)patch({[key]:null});},{active:!manual}),
          action(l('手动设定','Set manually'),()=>{if(!manual)patch({[key]:level});},{active:manual})),
        manual ? {kind:'field',label:lining?l('固定厚度','Fixed depth'):l('固定分泌量','Fixed amount'),value:level,formatted:percent(level),
          min:0,max:1,step:.05,change:n=>patch({[key]:clamp(n,0,1)})}
          : field(l('周期变化幅度','Cyclic variation'),lining?'liningGain':'secretionGain',.05,percent)];
    }
  }
}
