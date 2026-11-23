import {type Action, type Field} from '../controlRows';
import {DEFAULT_BODY_PROFILE, BODY_BOUNDS, type BodyProfile} from '../data';

// Screen and XR share section names, navigation and the actor's working copy.
const pages = {
  chest: ['胸型', 'Chest shape', null],
  more: ['触碰与适配', 'Touch & model fit', 'chest'],
  fit: ['模型适配', 'Shape source', 'more'],
  morphs: ['选择形态键', 'Choose a morph', 'fit'],
  contact: ['触碰', 'Touch', 'more'],
  sensitivity: ['触痛', 'Tenderness', 'contact'],
  milk: ['泌乳', 'Lactation', null],
} as const;

export type Page = keyof typeof pages;
export const mainPages = ['chest','milk'] as const;
export type Localize = (zh: string, en: string) => string;
export const pageTitle = (page: Page, l: Localize) => l(pages[page][0], pages[page][1]);
export const parentPage = (page: Page, fitParent:Page): Page|null => page==='fit'?fitParent:pages[page][2];
export const percent = (n: number) => `${Math.round(n*100)}%`;
// A refilling side can hold less than a tenth of a percent.
export const milkFill = (value:number) => {
  const tenths=Math.round(value*1000);
  if(tenths===0&&value>0)return '<0.1%';
  if(tenths===1000&&value<1)return '>99.9%';
  return `${tenths/10}%`;
};
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min,n));
export const action = (label: string, run: () => void, options: Omit<Partial<Action>,'label'|'run'> = {}): Action => ({label,run,...options});

type FieldKey = keyof typeof BODY_BOUNDS;
type Patch = (changes: Partial<BodyProfile>) => void;

/** Page builders read a profile and describe controls. All actual mutations
 * come back through the owning editor's preview commands, never on a read. */
export function editorControls(l: Localize, saved: BodyProfile|undefined, draft: BodyProfile|null, go: (page:Page)=>void, patch: Patch) {
  const base = saved ?? DEFAULT_BODY_PROFILE, p = draft ?? base;
  const field = (label: string, key: FieldKey, step: number, format: (n:number)=>string = String, disabled=false): Field => {
    const [min,max] = BODY_BOUNDS[key];
    return {kind:'field',label,value:p[key],formatted:format(p[key]),min,max,step,disabled,
      scrub:key==='refillSeconds'||key==='fullness'||key==='left'||key==='right', change:n=>patch({[key]:+clamp(n,min,max).toFixed(3)})};
  };
  const link = (page:Page, label=pageTitle(page,l), active?:boolean) => action(label,()=>go(page),{active,quiet:true});
  return {l,p,base,saved,inDraft:!!draft,go,patch,field,link};
}

export type EditorControls = ReturnType<typeof editorControls>;
