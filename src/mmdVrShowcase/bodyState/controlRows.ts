import type { LiningPair } from './LiningDiagram';

export type Action = { label: string; run: () => void; active?: boolean; primary?: boolean; disabled?: boolean; quiet?: boolean };
export type Field = { kind: 'field'; label: string; formatted: string; value: number; min: number; max: number; step: number; change: (n: number) => void; disabled?: boolean; scrub?: boolean };
export type Row = { kind: 'actions'; items: Action[] } | Field | { kind: 'text'; text: string }
  | ({ kind: 'diagram' } & LiningPair) | { kind: 'date'; label: string; value: number; max: number; change: (n: number) => void }
  | { kind: 'morph'; label: string; names: readonly string[]; value: string|null; none: string; choose: (name: string|null) => void; browse: () => void };

export const actions = (...items: Action[]): Row => ({ kind:'actions',items });
export const line = (text: string): Row => ({ kind:'text',text });
