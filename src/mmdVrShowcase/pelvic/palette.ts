import type { CSSProperties } from 'react';

/** Inks for the entire in-session UI; never applied to the preparation page or stage lights. */
export const PRIVATE_COLORS = {
  paper: '#291d29', inset: '#201820', control: '#402d3b', raised: '#513849',
  ink: '#fff1df', muted: '#d5bcc4', gold: '#e4c28b', rule: '#997852',
  rouge: '#d990a3', selected: '#6c374e', danger: '#ffcfca', dangerFill: '#772f40',
  disabled: '#b59faa',
} as const;

export const PRIVATE_TITLE_FACE = '"Yu Mincho", "Songti SC", SimSun, Georgia, serif';

export type ButtonVariant = 'button' | 'quiet' | 'tab' | 'primary' | 'stop';
export type ButtonState = { variant?: ButtonVariant; active?: boolean; disabled?: boolean; danger?: boolean; hovered?: boolean };

const c = PRIVATE_COLORS;
const keys = {
  normal: {face:c.control, letters:c.ink, edge:c.rule},
  quiet: {face:c.paper, letters:c.ink, edge:c.rule},
  hover: {face:c.raised, letters:c.ink, edge:c.gold},
  selected: {face:c.selected, letters:c.gold, edge:c.gold},
  primary: {face:c.gold, letters:c.paper, edge:c.gold},
  stop: {face:c.dangerFill, letters:c.danger, edge:c.rouge},
  disabled: {face:c.inset, letters:c.disabled, edge:c.rule},
} as const;
const hoverInk = {selected:{...keys.selected, edge:c.ink}, primary:{...keys.primary, face:c.ink}, stop:{...keys.stop, edge:c.danger}};

/** A color pair is atomic, so hover cannot put a primary key's dark letters on a dark face. */
export function buttonInks({variant, active, disabled, danger, hovered}: ButtonState) {
  if (disabled) return keys.disabled;
  if (danger || variant === 'stop') return hovered ? hoverInk.stop : keys.stop;
  if (variant === 'primary') return hovered ? hoverInk.primary : keys.primary;
  if (active) return hovered ? hoverInk.selected : keys.selected;
  return hovered ? keys.hover : variant === 'quiet' || variant === 'tab' ? keys.quiet : keys.normal;
}

export const stageHudVars = {
  ...Object.fromEntries(Object.entries(c).map(([key, value]) =>
    [`--pelvic-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`, value])),
  ...Object.fromEntries(Object.entries(keys).flatMap(([state, inks]) =>
    Object.entries(inks).map(([part, value]) => [`--key-${state}-${part}`, value]))),
  '--key-selected-hover-edge':hoverInk.selected.edge, '--key-primary-hover-face':hoverInk.primary.face,
  '--key-stop-hover-edge':hoverInk.stop.edge, '--pelvic-title-face':PRIVATE_TITLE_FACE,
} as CSSProperties;
