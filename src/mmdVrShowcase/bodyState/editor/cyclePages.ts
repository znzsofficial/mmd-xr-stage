import {actions, line, type Row} from '../controlRows';
import {BODY_DAY_SECONDS, sampleBody, type BodyProfile, type BodySample} from '../data';
import {action, atDay, clamp, percent, type EditorControls, type Localize} from './controls';

type CyclePage = 'cycle'|'compare'|'calendar'|'rhythm'|'lining'|'secretions';
export const daysPerPage=15;

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

type Calendar = {index:number;setIndex:(index:number)=>void;choose:(day:number)=>void};
export function cycleRows(page: CyclePage, ui: EditorControls, stepDay: (days:number)=>void, calendar:Calendar): Row[] {
  const {l,p,base,saved,inDraft,effective,day,link,field,toggle,patch} = ui;
  const phases = {bleed:l('经期','Menstrual'),follicular:l('经后期','Follicular'),ovulatory:l('排卵前后','Ovulatory'),luteal:l('黄体期','Luteal')};
  const chooseDate=actions(action(l('上一天','Previous day'),()=>stepDay(-1)),link('calendar',l('选择日期','Choose day')),action(l('下一天','Next day'),()=>stepDay(1)));
  switch(page){
    case 'cycle': {
      const source=p.reproduction?(inDraft?l('组织周期日 · 草稿预览','Tissue cycle day · preview'):l('组织周期日','Tissue cycle day')):inDraft?l('模拟日期 · 草稿预览','Simulation day · preview'):saved?l('当前模拟日期','Current simulation day'):l('模拟日期 · 默认','Simulation day · default');
      const dayMode=(label:string,locked:boolean)=>action(label,()=>patch({locked}),{active:p.locked===locked});
      return [{kind:'reading',label:source,value:l(`第 ${p.day} 天 / 共 ${p.length} 天`,`Day ${p.day} of ${p.length}`)},
        line(`${phases[effective.phase]} · ${describe(effective,p,l)}`),chooseDate,
        actions(dayMode(l('固定日期','Fixed day'),true),dayMode(l('自动过日','Auto-advance'),false)),
        line(l(`固定时只手动改日；自动时每 ${BODY_DAY_SECONDS} 秒舞台时间过一天。`,`Fixed: change days by hand. Auto: one day per ${BODY_DAY_SECONDS} s on stage.`)),
        actions(link('compare'),link('rhythm'))];
    }
    case 'calendar': {
      const lastIndex=Math.floor((p.length-1)/daysPerPage), index=clamp(calendar.index,0,lastIndex);
      const first=index*daysPerPage+1,last=Math.min(first+daysPerPage-1,p.length);
      return [line(l(`当前第 ${p.day} 天 · 点选目标日期`,`Currently day ${p.day} · Choose a day`)),
        ...(lastIndex>0?[actions(...Array.from({length:lastIndex+1},(_,i)=>action(`${i*daysPerPage+1}–${Math.min((i+1)*daysPerPage,p.length)}`,
          ()=>calendar.setIndex(i),{active:index===i})))]:[]),
        {kind:'dayGrid',items:Array.from({length:last-first+1},(_,i)=>action(day(first+i),()=>calendar.choose(first+i),{active:p.day===first+i,short:String(first+i)}))}];
    }
    case 'compare': {
      const reading = (profile:BodyProfile,s:BodySample,label:string) => ({tissue:s.tissue,caption:`${label} · ${day(atDay(profile))}`,
        phase:phases[s.phase],change:describe(s,profile,l)});
      return [{kind:'liningPair',pair:{samples:[reading(base,sampleBody(base),saved?l('角色已存','Actor’s saved day'):l('角色默认','Actor default')),
        reading(p,effective,inDraft?l('草稿预览','Draft preview'):l('当前日期','Current day'))]}},chooseDate,
        line(l('选择日期，右图会预览同一角色当天的内膜。','Choose a day to preview this actor’s lining on the right.'))];
    }
    case 'rhythm': {
      const rows:Row[] = [field(l('周期天数','Cycle length (days)'),'length',1),field(l('经期天数','Bleeding days'),'bleedDays',1),
        actions(toggle(p.ovulation?l('模拟排卵：开','Ovulation: on'):l('模拟排卵：关','Ovulation: off'),'ovulation'))];
      if(p.ovulation)rows.push(field(l('排卵段天数','Ovulatory days'),'peakDays',1),field(l('黄体期天数','Luteal days'),'lutealDays',1),
        field(l('胸型随周期变化','Cyclic chest variation'),'cycleGain',.05,percent));
      rows.push(actions(link('lining')));
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
