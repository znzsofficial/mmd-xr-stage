import { HudButton } from '../components/PorcelainControls';
import { PrivateButton } from '../pelvic/HudPrivateControls';
import type { Action } from './controlRows';

export const bodySpan = 1.45;

export function ScreenActions({ items, blocked }: { items: Action[]; blocked: boolean }) {
  return <div className="body-actions">{items.map(a=><button type="button" key={a.label} aria-pressed={a.active} data-primary={a.primary||undefined} data-danger={a.danger||undefined}
    disabled={blocked||a.disabled} onClick={a.run}>{a.label}</button>)}</div>;
}

export function HudActions({ items, blocked, tabs=false, gallery=false, width=bodySpan, label }: { items: Action[]; blocked: boolean; tabs?: boolean; gallery?: boolean; width?: number; label?:(a:Action)=>string }) {
  const gap = .035, w = (width-gap*(items.length-1))/items.length;
  return items.map((a,i)=>{
    const common={position:[(i-(items.length-1)/2)*(w+gap),0,0] as [number,number,number],size:[w,.14] as [number,number],
      label:label?.(a)??a.label,onPress:a.run,disabled:blocked||a.disabled,danger:a.danger};
    return gallery?<PrivateButton key={a.label} {...common} active={a.active} variant={tabs?'tab':a.primary?'primary':'button'}/>:
      <HudButton key={a.label} {...common} active={a.active} variant={tabs?'tab':a.primary?'primary':a.quiet?'quiet':'button'}/>;
  });
}
