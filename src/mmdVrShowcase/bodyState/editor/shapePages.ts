import {actions,line,type Row} from '../controlRows';
import {sampleBody} from '../data';
import type {BodySupport} from '../store';
import {action,atDay,percent,type EditorControls} from './controls';

type ShapePage = 'chest'|'breast'|'fit'|'morphs'|'contact'|'sensitivity';
type MorphBrowser = {page:number;setPage:(page:number)=>void};
const morphsPerPage = 3;

export function shapeRows(page:ShapePage,ui:EditorControls,support:BodySupport|undefined,browser:MorphBrowser):Row[] {
  const {l,p,effective,base,saved,inDraft,field,day,link,patch,go}=ui;
  const names=support?.morphs??[], selected=p.morph, missing=!!selected&&!names.includes(selected);
  const bone=support?.bones?l('胸部骨骼','Chest bones'):l('仅记录数值','Value only');
  const choose=(morph:string|null)=>{patch({morph});go('chest');};

  switch(page){
    case 'chest': {
      const needsMorph=!!support&&(missing||(!selected&&!support.bones));
      function status(){
        if(!support)return l('模型尚未就绪。','Model not ready yet.');
        if(missing)return l('原形态键已缺失，请重新选择。','Saved morph missing. Choose another.');
        if(needsMorph)return names.length?l('先选择胸型形态键，模型才会变化。','Choose a chest morph to see a change.'):
          l('此模型只能记录数值，外观不变。','Value only. This model cannot show the change.');
        if(inDraft)return l(`原来 ${percent(sampleBody(base).fullness)} → 预览 ${percent(effective.fullness)}`,`Before ${percent(sampleBody(base).fullness)} → Preview ${percent(effective.fullness)}`);
        return saved?l(`已保存 · 当前胸型 ${percent(effective.fullness)}`,`Saved · Current shape ${percent(effective.fullness)}`):
          l('拖动即可预览此成年角色。','Drag to preview on this adult actor.');
      }
      const fitLink=needsMorph&&(names.length||missing)?[link('fit')]:[];
      return [field(l('胸部饱满度','Chest fullness'),'fullness',.05,percent),line(status()),actions(link('breast'),...fitLink,link('more'))];
    }
    case 'breast':
      return [{kind:'breast',caption:l('角色状态预览','Character preview'),detail:l('结构示意，非 PMX 扫描','Illustration, not a PMX scan'),
        readings:[{label:l('当前饱满度','Current fullness'),value:percent(effective.fullness)}, {label:l('周期','Cycle'),value:day(atDay(p))},
          ...(p.lactating?[{label:l('左侧充盈','Left fill'),value:percent(p.left)},{label:l('右侧充盈','Right fill'),value:percent(p.right)}]:
            [{label:l('泌乳','Lactation'),value:l('关','Off')}])],
        fullness:field(l('基础饱满度','Base fullness'),'fullness',.05,percent)}];
    case 'fit':
      return [{kind:'morph',label:l('外观来源','Shape source'),names,value:selected,none:bone,choose,
        browse:()=>{browser.setPage(Math.max(0,Math.floor(names.indexOf(selected??'')/morphsPerPage)));go('morphs');}},
        line(names.length?l('请选择会改变胸型的形态键。','Choose a morph that changes the chest.'):l('此模型没有可选形态键。','No vertex morphs available.'))];
    case 'morphs': {
      const pages=Math.max(1,Math.ceil(names.length/morphsPerPage)), index=Math.min(browser.page,pages-1);
      return [actions(action(bone,()=>choose(null),{active:!selected})),
        ...names.slice(index*morphsPerPage,(index+1)*morphsPerPage).map(n=>actions(action(n,()=>choose(n),{active:n===selected}))),
        actions(action(l('上一页','Previous'),()=>browser.setPage(index-1),{disabled:index===0}),
          action(l(`下一页 ${index+1}/${pages}`,`Next ${index+1}/${pages}`),()=>browser.setPage(index+1),{disabled:index+1>=pages}))];
    }
    case 'contact': {
      const sides=support?.sides,canPress=!!(sides?.left||sides?.right);
      const description=!canPress?l('此模型不支持按压。','This model does not support pressure.'):
        sides?.left&&sides.right?l('左右胸都可按压。','Both sides respond to pressure.'):
        sides?.left?l('仅左胸可按压。','Only the left side responds.'):l('仅右胸可按压。','Only the right side responds.');
      return [line(description),field(l('受压形变','Compression'),'compression',.05,percent,!canPress),
        field(l('回弹时间','Rebound'),'rebound',.02,n=>`${Math.round(n*1000)} ms`,!canPress),actions(link('sensitivity',l('胀感与触痛','Tenderness')))];
    }
    case 'sensitivity': {
      const mode=p.sensitivityMode,sensitivity=l('胀感／触痛','Tenderness');
      const modes=[['off',l('关闭','Off')],['cycle',l('随周期','Follow cycle')],['manual',l('手动','Manual')]] as const;
      return [line(`${day(p.day)} · ${sensitivity} ${percent(effective.sensitivity)}`),
        actions(...modes.map(([value,label])=>action(label,()=>patch({sensitivityMode:value}),{active:mode===value}))),
        field(mode==='cycle'?l('周期变化幅度','Cyclic variation'):l('手动水平','Manual level'),'sensitivity',.05,percent,mode==='off'),
        line(l('只记录感受，不改变外观。','Recorded only; does not change appearance.'))];
    }
  }
}
