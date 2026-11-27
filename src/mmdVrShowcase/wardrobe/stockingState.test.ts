import { afterEach, expect, it } from 'vitest';
import { clearBackpack, prepareBackpackEntry, syncBackpackFiles, useBackpack } from '../backpack/store';
import { useHudWorldInput } from '../hud/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { enablePelvic, patchPelvic, usePelvic } from '../pelvic/store';
import { armStockingTear, dressStockings, readStockingState, recordStockingTear, rejectStockingFit, useStockings } from './stockingState';

const tear = { side: 'left', u: .01, v: .42, du: -.08, dv: .02 } as const;
afterEach(() => { clearBackpack(); useMmdVrStore.setState(useMmdVrStore.getInitialState()); useHudWorldInput.setState({blocked:false}); });

it('keeps damage with one file across put-away and room restore, revokes exposure, and separates removing from replacing', () => {
  const a = new File([], 'same.pmx'), b = new File([], 'same.pmx');
  // Different relative paths, same filename, two independent actor identities.
  Object.defineProperty(a, 'webkitRelativePath', { value: 'a/same.pmx' });
  Object.defineProperty(b, 'webkitRelativePath', { value: 'b/same.pmx' });
  syncBackpackFiles([a,b]);
  const [actor, other] = useBackpack.getState().entries.map((e,i) => ({ assetId:e.id, runtimeId:`m${i}` }));
  const place = (id: typeof actor) => useBackpack.setState({ selected:id.assetId, live:{[id.assetId]:{runtimeId:id.runtimeId, visible:true, position:[0,0,0]}} });
  useMmdVrStore.setState({ overlayOpen:true, presentation:'xr' }); place(actor);
  enablePelvic(actor.assetId, true); patchPelvic(actor.assetId, {clothingClear:true});
  expect(dressStockings(actor, 'wear')).toBe(true); expect(usePelvic.getState().byAsset[actor.assetId].clothingClear).toBe(false);
  expect(recordStockingTear(actor, tear)).toBe(false);
  armStockingTear(actor); const old = useStockings.getState().armed!;
  expect(recordStockingTear(old, tear)).toBe(true);
  useHudWorldInput.setState({blocked:true}); useHudWorldInput.setState({blocked:false});
  expect(recordStockingTear(old, tear)).toBe(false);
  place(other); dressStockings(other, 'wear'); armStockingTear(other);
  expect(recordStockingTear(useStockings.getState().armed!, {...tear, side:'right'})).toBe(true);
  prepareBackpackEntry(true); place({...actor, runtimeId:'rebuilt'});
  expect(useStockings.getState().armed).toBeNull(); expect(readStockingState(actor.assetId)).toEqual({worn:true, tears:[tear]});
  expect(dressStockings(actor, 'remove')).toBe(false);
  const restored = {...actor,runtimeId:'rebuilt'};
  dressStockings(restored,'remove'); expect(readStockingState(actor.assetId)).toEqual({worn:false,tears:[tear]});
  dressStockings(restored,'wear'); armStockingTear(restored); dressStockings(restored,'replace');
  expect(useStockings.getState().armed).toBeNull(); expect(readStockingState(actor.assetId)).toEqual({worn:true,tears:[]});
  expect(readStockingState(other.assetId).tears).toEqual([{...tear,side:'right'}]);
  syncBackpackFiles([b]); expect(useStockings.getState().actors[actor.assetId]).toBeUndefined();
  expect(readStockingState(other.assetId).worn).toBe(true);
});

it('requires an explicit rearm after a batched room, selection, placement or visibility round trip', () => {
  const file = new File([], 'adult.pmx'); syncBackpackFiles([file]);
  const actor = {assetId:useBackpack.getState().entries[0].id,runtimeId:'mounted'};
  useBackpack.setState({selected:actor.assetId,live:{[actor.assetId]:{runtimeId:actor.runtimeId,visible:true,position:[0,0,0]}}});
  useMmdVrStore.setState({overlayOpen:true,presentation:'screen'}); dressStockings(actor,'wear');
  const bag = useBackpack.getState();
  const transitions = [() => {bag.beginPlace(actor.assetId);bag.cancelPlace();}, () => {bag.select(null);bag.select(actor.assetId);},
    () => {const s=useMmdVrStore.getState();s.enqueueVisibilityToggle(actor.runtimeId);s.takeVisibilityToggles();},
    () => useMmdVrStore.setState(s=>({entryEpoch:s.entryEpoch+1})),
    () => {useMmdVrStore.setState({physicsBusy:true});useMmdVrStore.setState({physicsBusy:false});}];
  for (const change of transitions) {
    armStockingTear(actor); const press=useStockings.getState().armed!;
    change(); expect(useStockings.getState().armed).toBeNull();
    armStockingTear(actor); expect(recordStockingTear(press,tear)).toBe(false);
  }
  expect(readStockingState(actor.assetId)).toEqual({worn:true,tears:[]});
  rejectStockingFit({...actor,runtimeId:'retired'});
  expect(readStockingState(actor.assetId).worn).toBe(true);
  rejectStockingFit(actor);
  expect(readStockingState(actor.assetId).worn).toBe(false);
});
