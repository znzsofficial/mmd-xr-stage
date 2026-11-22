import type { CSSProperties } from 'react';

/** Private actor sheet only. DOM controls and unlit XR textures use the same inks. */
export const PRIVATE_COLORS = {
  paper: '#291d29', inset: '#201820', control: '#402d3b', raised: '#513849',
  ink: '#fff1df', muted: '#d5bcc4', gold: '#e4c28b', rule: '#997852',
  rouge: '#d990a3', selected: '#6c374e', danger: '#ffcfca', dangerFill: '#772f40',
  disabled: '#b59faa',
} as const;

export const privateVars = Object.fromEntries(Object.entries(PRIVATE_COLORS).map(([key, value]) =>
  [`--pelvic-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, value])) as CSSProperties;

export const PRIVATE_TITLE_FACE = '"Yu Mincho", "Songti SC", SimSun, Georgia, serif';
