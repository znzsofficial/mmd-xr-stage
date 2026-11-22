import {type Action, type Field} from '../controlRows';
import {BODY_DAY_SECONDS, DEFAULT_BODY_PROFILE, bodyRanges, sampleBody, type BodyProfile} from '../data';

// Screen and XR use the same page names. Shared detail pages return to the
// section that opened them (e.g. Breast view from either Chest or Lactation).
const pages = {
  chest: ['胸型', 'Chest shape', null],
  breast: ['乳房观察', 'Breast view', 'chest'],
  more: ['触碰与适配', 'Touch & model fit', 'chest'],
  fit: ['模型适配', 'Shape source', 'more'],
  morphs: ['选择形态键', 'Choose a morph', 'fit'],
  cycle: ['周期', 'Cycle', null],
  organ: ['子宫动态', 'Uterus in motion', 'cycle'],
  rhythm: ['周期设置', 'Cycle settings', 'cycle'],
  lining: ['内膜与分泌物', 'Lining & secretions', 'cycle'],
  secretions: ['内膜与分泌物', 'Lining & secretions', 'cycle'],
  contact: ['触碰', 'Touch', 'more'],
  sensitivity: ['触痛', 'Tenderness', 'contact'],
  milk: ['泌乳', 'Lactation', null],
  milkLevel: ['泌乳设置', 'Lactation settings', 'milk'],
} as const;

export type Page = keyof typeof pages;
export const mainPages = ['chest','cycle','milk'] as const;
export type Localize = (zh: string, en: string) => string;
export const pageTitle = (page: Page, l: Localize) => l(pages[page][0], pages[page][1]);
export type DetailParents = Partial<Record<'fit'|'breast',Page>>;
export const parentPage = (page: Page, parents: DetailParents): Page|null =>
  ((page === 'fit' || page === 'breast') && parents[page]) || pages[page][2];
export const percent = (n: number) => `${Math.round(n*100)}%`;
// A refilling side can hold less than a tenth of a percent. Don't display a
// successful drain as 0% → 0%, or a still-refilling side as full.
export const milkFill = (value:number) => {
  const tenths=Math.round(value*1000);
  if(tenths===0&&value>0)return '<0.1%';
  if(tenths===1000&&value<1)return '>99.9%';
  return `${tenths/10}%`;
};
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min,n));
export const atDay = (p: BodyProfile) => p.day + Math.floor(p.daySeconds/BODY_DAY_SECONDS*10+1e-8)/10;
export const action = (label: string, run: () => void, options: Omit<Partial<Action>,'label'|'run'> = {}): Action => ({label,run,...options});

type FieldKey = 'length'|'bleedDays'|'peakDays'|'lutealDays'|'compression'|'rebound'|'refillSeconds'|'fullness'|'cycleGain'|'liningGain'|'secretionGain'|'sensitivity'|'left'|'right';
type ToggleKey = 'ovulation'|'locked'|'lactating'|'bareLeft'|'bareRight';
type Patch = (changes: Partial<BodyProfile>) => void;

/** Page builders read a profile and describe controls. All actual mutations
 * come back through the owning editor's preview commands, never on a read. */
export function editorControls(l: Localize, saved: BodyProfile|undefined, draft: BodyProfile|null, go: (page:Page)=>void, patch: Patch) {
  const base = saved ?? DEFAULT_BODY_PROFILE, p = draft ?? base, bounds = bodyRanges(p);
  const field = (label: string, key: FieldKey, step: number, format: (n:number)=>string = String, disabled=false): Field => {
    const [min,max] = key in bounds ? bounds[key as keyof typeof bounds] : [0,1];
    return {kind:'field',label,value:p[key],formatted:format(p[key]),min,max,step,disabled,
      scrub:key==='length'||key==='refillSeconds'||key==='fullness'||key==='left'||key==='right', change:n=>patch({[key]:+clamp(n,min,max).toFixed(3)})};
  };
  const link = (page:Page, label=pageTitle(page,l), active?:boolean) => action(label,()=>go(page),{active,quiet:true});
  const toggle = (label:string,key:ToggleKey) => action(label,()=>patch({[key]:!p[key]}),{active:p[key]});
  const day = (n:number) => {const value=+n.toFixed(1);return l(`第 ${value} 天`,`Day ${value}`);};
  return {l,p,base,saved,inDraft:!!draft,effective:sampleBody(p),go,patch,field,toggle,link,day};
}

export type EditorControls = ReturnType<typeof editorControls>;
