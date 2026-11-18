import { create } from "zustand";
import { useLanguageStore } from "../languageStore";
import { listMmdModels, listMmdMotions, listMmdObjects, relativePath } from "../mmdImport/folderFiles";
import { MMD_VR_MAX_MODELS, MMD_VR_MAX_OBJECTS } from "./mmdVrAssets";
import type { SceneryId } from "./scenery/catalog";
import type { SavedModel, SavedObject, StageSnapshot } from "./stageSnapshot";

// Page-owned file library. Only the stage consumer owns renderable instances.
export type BackpackEntry = { id: string; kind: "model" | "object" | "motion"; file: File; path: string; warning?: string };
export type BackpackLive = { runtimeId: string; position: [number, number, number]; visible: boolean;
  bounds?: { center: [number,number,number]; size: [number,number,number] } };
export type BackpackCommand =
  | { token: number; type: "place"; id: string; x: number; z: number; yaw: number }
  | { token: number; type: "remove"; id: string }
  | { token: number; type: "motion"; id: string; file: File; kind: "body" | "face" };
export type BackpackPlacementTiming = { token: number; kind: "model" | "object"; confirmedAt: number; wasMove: boolean; previewDelayMs: number | null; work?: import('./placementWork').PlacementWork };

type State = {
  entries: BackpackEntry[]; files: readonly File[];
  live: Record<string, BackpackLive>; layouts: Partial<Record<SceneryId, StageSnapshot>>;
  stored: Record<string, SavedModel | SavedObject>; bindings: Record<string, { body?: File; face?: File }>;
  selected: string | null; draft: string | null; command: BackpackCommand | null; busy: boolean; error: string | null;
  draftStartedAt: number | null; previewDelayMs: number | null;
  placement: BackpackPlacementTiming | null; lastCompletedPlacement: BackpackPlacementTiming | null;
  select(id: string | null): void; beginPlace(id: string): void; cancelPlace(): void;
  confirmPlace(id: string, x: number, z: number, yaw: number): void;
  putAway(id: string): void; applyMotion(id: string, file: File, kind: "body" | "face"): void;
  finishCommand(command: BackpackCommand, error?: string, work?: BackpackPlacementTiming['work']): void; publishLive(map: State["live"]): void; dismissError(): void;
};

const identities = new WeakMap<File, string>();
let sequence = 0, token = 0;
function fileId(file: File) {
  let id = identities.get(file);
  if (!id) { id = `asset-${++sequence}`; identities.set(file, id); }
  return id;
}
function capacityError(s: State, entry: BackpackEntry) {
  if (s.live[entry.id]) return null;
  const limit = entry.kind === "model" ? MMD_VR_MAX_MODELS : MMD_VR_MAX_OBJECTS;
  if (s.entries.filter(e => e.kind === entry.kind && s.live[e.id]).length < limit) return null;
  return useLanguageStore.getState().language === "zh" ? "舞台位置已满，请先收回一个同类资产。" : "Stage is full. Put away an item of the same type first.";
}
const transient = () => ({ live: {}, selected: null, draft: null, draftStartedAt: null, previewDelayMs: null, command: null, busy: false, error: null, placement: null, lastCompletedPlacement: null });
export const useBackpack = create<State>((set, get) => ({
  ...transient(), entries: [], files: [], layouts: {}, stored: {}, bindings: {},
  select: id => { if (!get().busy && (id == null || get().live[id])) set({ selected: id, draft: null, error: null }); },
  beginPlace: id => {
    const s = get(), entry = s.entries.find(e => e.id === id);
    if (s.busy || !entry || entry.kind === "motion") return;
    const error = capacityError(s, entry);
    if (error) { set({ error }); return; }
    set({ draft: id, error: null, draftStartedAt: performance.now(), previewDelayMs: null });
  },
  cancelPlace: () => set({ draft: null }),
  confirmPlace: (id, x, z, yaw) => {
    const s = get(), entry = s.entries.find(e => e.id === id);
    if (s.busy || s.draft !== id || !entry || entry.kind === "motion" || ![x,z,yaw].every(Number.isFinite)) return;
    const error = capacityError(s, entry);
    if (error) { set({ error, draft: null }); return; }
    const command = { type: "place", token: ++token, id, x, z, yaw } as const;
    set({ busy: true, command, draft: null, error: null,
      placement: { token, kind: entry.kind, confirmedAt: performance.now(), wasMove: Boolean(s.live[id]), previewDelayMs: s.previewDelayMs } });
  },
  putAway: id => {
    if (get().busy || !get().live[id]) return;
    set({ busy: true, draft: null, error: null, command: { token: ++token, type: "remove", id } });
  },
  applyMotion: (id, file, kind) => {
    const s = get();
    if (s.busy || !s.live[id] || !s.entries.some(e => e.id === id && e.kind === "model") || !s.entries.some(e => e.kind === "motion" && e.file === file)) return;
    set({ busy: true, draft: null, error: null, command: { token: ++token, type: "motion", id, file, kind } });
  },
  finishCommand: (command, error, work) => {
    const s = get();
    if (s.command?.token !== command.token) return; // an obsolete room / session cannot complete a new request
    set({ busy: false, command: null, placement: null, error: error ?? null,
      lastCompletedPlacement: !error && command.type === "place" && s.placement ? {...s.placement,work} : s.lastCompletedPlacement,
      selected: error ? s.selected : command.type === "remove" ? null : command.id });
  },
  publishLive: live => set({ live }), dismissError: () => set({ error: null }),
}));

export function syncBackpackFiles(files: readonly File[], warnings?: ReadonlyMap<string,string>) {
  const list = (group: File[], kind: BackpackEntry["kind"]): BackpackEntry[] => group.map(file => {
    const path = relativePath(file);
    return { id: fileId(file), file, kind, path, warning: warnings?.get(path) };
  });
  const entries = [...list(listMmdModels(files), "model"), ...list(listMmdObjects(files), "object"), ...list(listMmdMotions(files), "motion")];
  const ids = new Set(entries.map(e => e.id)), members = new Set(files);
  useBackpack.setState(state => ({ files, entries,
    stored: Object.fromEntries(Object.entries(state.stored).filter(([id]) => ids.has(id))),
    bindings: Object.fromEntries(Object.entries(state.bindings).filter(([id]) => ids.has(id)).map(([id, {body,face}]) => [id, {
      body: body && members.has(body) ? body : undefined, face: face && members.has(face) ? face : undefined,
    }])),
  }));
}
export function invalidateBackpackCommands() {
  useBackpack.setState({ command: null, busy: false, draft: null, selected: null, error: null, placement: null });
}
export function prepareBackpackEntry(resume: boolean) {
  useBackpack.setState(resume ? transient() : { ...transient(), layouts: {}, stored: {}, bindings: {} });
}
export function clearBackpack() {
  useBackpack.setState({ ...transient(), layouts: {}, stored: {}, bindings: {}, entries: [], files: [] });
}
