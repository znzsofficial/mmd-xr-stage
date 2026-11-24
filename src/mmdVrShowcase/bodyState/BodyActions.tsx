import { HudButton } from '../hud/PorcelainControls';
import type { Action } from './controlRows';

export const bodySpan = 1.45;

export function ScreenActions({ items, blocked }: { items: Action[]; blocked: boolean }) {
  return <div className="body-actions">{items.map(a=><button type="button" key={a.label} aria-pressed={a.active} data-primary={a.primary||undefined} data-danger={a.danger||undefined}
    disabled={blocked||a.disabled} onClick={a.run} aria-label={a.short?a.label:undefined}>{a.short??a.label}</button>)}</div>;
}

export function HudActions({ items, blocked, tabs=false, width=bodySpan }: { items: Action[]; blocked: boolean; tabs?: boolean; width?: number }) {
  const gap = .035, w = (width-gap*(items.length-1))/items.length;
  return items.map((a,i)=>{
    const common={position:[(i-(items.length-1)/2)*(w+gap),0,0] as [number,number,number],size:[w,.14] as [number,number],
      label:a.label,onPress:a.run,disabled:blocked||a.disabled,danger:a.danger};
    return <HudButton key={a.label} {...common} active={a.active} variant={tabs?'tab':a.primary?'primary':a.quiet?'quiet':'button'}/>;
  });
}
