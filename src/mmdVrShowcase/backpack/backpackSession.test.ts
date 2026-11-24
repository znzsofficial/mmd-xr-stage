import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearBackpack, syncBackpackFiles, useBackpack } from './store';
import { useMmdVrStore } from '../mmdVrStore';
import type { StageSnapshot } from '../stage/stageSnapshot';

const initial = useMmdVrStore.getState();
afterEach(() => { useMmdVrStore.setState(initial); clearBackpack(); });

describe('backpack session boundary', () => {
  const room: StageSnapshot = { scenery:'classroom',assets:[],models:[],objects:[],time:0,playing:false,loop:true,physicsEnabled:false,controllerCollisions:true };
  it('captures before discarding a draft; Continue uses the captured room, not a later prep selection', () => {
    syncBackpackFiles([new File([], 'prop.glb')]);
    const b = useBackpack.getState(), id = b.entries[0].id;
    initial.openOverlay(); b.beginPlace(id);
    const capture = vi.fn(() => { expect(useBackpack.getState().draft).toBe(id); return room; });
    initial.setStageCapture(capture); initial.closeOverlay();
    expect(capture).toHaveBeenCalledOnce(); expect(useBackpack.getState().draft).toBeNull();
    initial.setPrefs({scenery:'pool'}); initial.prepareStage(true);
    expect(useMmdVrStore.getState().prefs.scenery).toBe('classroom');
    expect(useBackpack.getState().entries[0].id).toBe(id);
  });
  it('does not overwrite the last committed room with an in-flight drop or accept its late completion', () => {
    initial.setPrefs({scenery:'classroom'}); initial.openOverlay();
    useBackpack.setState({ layouts:{classroom:room} });
    syncBackpackFiles([new File([], 'large.pmx')]); const b=useBackpack.getState(), id=b.entries[0].id;
    b.beginPlace(id); b.confirmPlace(id,0,-1,0); const pending=useBackpack.getState().command!;
    const capture=vi.fn(); initial.setStageCapture(capture); initial.closeOverlay();
    expect(capture).not.toHaveBeenCalled(); expect(useMmdVrStore.getState().savedStage).toBe(room);
    b.finishCommand(pending); expect(useBackpack.getState().selected).toBeNull();
  });
});
