import type { LiningPair } from './LiningDiagram';

export type Action = { label: string; run: () => void; active?: boolean; primary?: boolean; disabled?: boolean; quiet?: boolean; danger?:boolean };
export type Field = { kind: 'field'; label: string; formatted: string; value: number; min: number; max: number; step: number; change: (n: number) => void; disabled?: boolean; scrub?: boolean };
export type BreastReading = {
  kind: 'breast'; caption: string; detail: string; readings: {label: string; value: string}[]; fullness: Field;
};
export type CycleReading = {
  kind: 'cycle'; organ: boolean; views: [Action, Action]; pair: LiningPair;
  date: { label: string; formatted:string; modes:[Action,Action]; value: number; max: number; change: (n: number) => void };
  previous: Action; next: Action; settings: Action[];
};
export type Row = { kind: 'actions'; items: Action[] } | Field | { kind: 'text'; text: string }
  | {kind:'destination';action:Action;detail:string}
  | CycleReading | BreastReading
  | { kind: 'morph'; label: string; names: readonly string[]; value: string|null; none: string; choose: (name: string|null) => void; browse: () => void };

export const actions = (...items: Action[]): Row => ({ kind:'actions',items });
export const line = (text: string): Row => ({ kind:'text',text });
export const destination = (action:Action,detail:string):Row => ({kind:'destination',action,detail});
