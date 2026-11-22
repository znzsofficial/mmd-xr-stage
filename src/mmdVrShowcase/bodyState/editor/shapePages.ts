import {actions,destination,line,type Row} from '../controlRows';
import {sampleBody} from '../data';
import type {BodySupport} from '../store';
import {action,percent,type EditorControls} from './controls';

type ShapePage = 'chest'|'fit'|'morphs'|'contact'|'sensitivity';
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
        if(!support)return l('正在检查角色能否改变胸型。','Checking the model’s shape controls.');
        if(missing)return l('之前的形态键已缺失，请重新选择。','The saved shape is missing. Choose another.');
        if(needsMorph)return names.length?l('先选择模型自带的胸型，角色才会变化。','Choose a model morph to change the actor’s shape.'):
          l('此模型只记录数值。示意图在角色的「身体观察」。','This model stores the value only. See Body observation for the figure.');
        if(inDraft)return `${saved?l('已存','Saved'):l('默认','Default')} ${percent(sampleBody(base).fullness)} · ${l('预览','Preview')} ${percent(effective.fullness)}`;
        return saved?l(`角色当前外观：${percent(effective.fullness)}`,`Current shape on actor: ${percent(effective.fullness)}`):
          l('拖动滑杆，直接看角色的轮廓变化。','Drag the slider to see the change on the actor.');
      }
      return [field(l('胸部饱满度','Chest fullness'),'fullness',.05,percent),line(status()),
        ...(needsMorph&&(names.length||missing)?[actions(link('fit',l('选择模型胸型','Choose model morph')))]:[]),
        destination(link('more'),l('调整按压反应，选择模型胸型','Adjust pressure response or choose a model morph'))];
    }
    case 'fit':
      return [{kind:'morph',label:l('用什么改变胸型','Shape control'),names,value:selected,none:bone,choose,
        browse:()=>{browser.setPage(Math.max(0,Math.floor(names.indexOf(selected??'')/morphsPerPage)));go('morphs');}},
        line(names.length?l('选择模型作者制作的胸型，选好后返回胸型页。','Choose a chest morph to return to Chest shape.'):l('此模型没有可选形态键。','No vertex morphs available.'))];
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
        field(l('松手后回弹','Recovery time'),'rebound',.02,n=>`${Math.round(n*1000)} ms`,!canPress),actions(link('sensitivity',l('胀感与触痛','Tenderness')))];
    }
    case 'sensitivity': {
      const mode=p.sensitivityMode,sensitivity=l('胀感／触痛','Tenderness');
      const modes=[['off',l('关闭','Off')],['cycle',l('随周期','Follow cycle')],['manual',l('手动','Manual')]] as const;
      return [line(`${day(p.day)} · ${sensitivity} ${percent(effective.sensitivity)}`),
        actions(...modes.map(([value,label])=>action(label,()=>patch({sensitivityMode:value}),{active:mode===value}))),
        ...(mode==='off'?[]:[field(mode==='cycle'?l('周期变化幅度','Cyclic variation'):l('手动水平','Manual level'),'sensitivity',.05,percent)]),
        line(l('只记录感受，不改变外观。','Recorded only; does not change appearance.'))];
    }
  }
}
