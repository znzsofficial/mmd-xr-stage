import { HudButton } from '../components/PorcelainControls';
import { PrivateButton } from '../pelvic/HudPrivateControls';
import type { Action } from './controlRows';

export const bodySpan = 1.45;

export function ScreenActions({ items, blocked }: { items: Action[]; blocked: boolean }) {
  return <div className="body-actions">{items.map((a,i)=><button type="button" key={i} aria-pressed={a.active} data-primary={a.primary||undefined}
    disabled={blocked||a.disabled} onClick={a.run}>{a.label}</button>)}</div>;
}

export function HudActions({ items, blocked, tabs=false, gallery=false, width=bodySpan }: { items: Action[]; blocked: boolean; tabs?: boolean; gallery?: boolean; width?: number }) {
  const Button = gallery ? PrivateButton : HudButton;
  const gap = .035, w = (width-gap*(items.length-1))/items.length;
  return items.map((a,i)=><Button key={i} position={[(i-(items.length-1)/2)*(w+gap),0,0]} size={[w,.14]} label={a.label}
    variant={tabs?'tab':a.quiet&&!gallery?'quiet':'button'} active={a.active||a.primary} disabled={blocked||a.disabled} onPress={a.run}/>);
}
