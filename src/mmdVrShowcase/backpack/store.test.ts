import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearBackpack, invalidateBackpackCommands, prepareBackpackEntry, syncBackpackFiles, useBackpack } from "./store";
import { withAssetPath } from "../../mmdImport/assetPaths";
import {beginMmdVrAssetSession,endMmdVrAssetSession} from './sessionAssets';

const get = useBackpack.getState;
beforeEach(clearBackpack);
afterEach(endMmdVrAssetSession);

describe('page backpack and stage ownership', () => {
  it('shares mixed layout capacity and exact library choices on return to WebGL',()=>{
    const files=['a.pmx','b.pmx','room.glb'].map(name=>new File([],name));syncBackpackFiles(files);
    const [a,b,obj]=get().entries.map(e=>e.id);
    beginMmdVrAssetSession([],'webgpu');
    try {
      get().beginPlace(obj);expect(get().draft).toBe(obj);get().cancelPlace();
      get().beginPlace(b);expect(get().draft).toBe(b);get().cancelPlace();
      get().publishLive({[b]:{runtimeId:'b',visible:true,position:[0,0,-2]}});
      get().beginPlace(a);expect(get().draft).toBe(a);get().cancelPlace();
      get().beginPlace(b);get().confirmPlace(b,1,-1,90);expect(get().command).toMatchObject({id:b,moveRuntimeId:'b'});
    } finally {endMmdVrAssetSession();}
    prepareBackpackEntry(true);get().publishLive({[b]:{runtimeId:'restored-b',visible:true,position:[1,0,-1]}});
    get().beginPlace(a);expect(get().draft).toBe(a);get().cancelPlace();
    get().beginPlace(obj);expect(get().draft).toBe(obj);expect(get().files).toEqual(files);
  });
  it.each(['webgl','webgpu'] as const)('keeps the fourth character in the library; moving a mounted character costs no extra slot on %s', renderer => {
    beginMmdVrAssetSession([],renderer);
    const files = [1,2,3,4].map(i => withAssetPath(new File([], 'hero.pmx'), `package-${i}/hero.pmx`));
    syncBackpackFiles(files);
    const ids = get().entries.map(e => e.id);
    get().publishLive(Object.fromEntries(ids.slice(0,3).map(id => [id, { runtimeId: 'live'+id, position: [0,0,0], visible: true }])));
    get().beginPlace(ids[3]);
    expect(get().error).toBeTruthy(); expect(get().draft).toBe(null);
    get().beginPlace(ids[1]); get().cancelPlace();
    get().confirmPlace(ids[1], 1, 2, 45);
    expect(get().command).toBeNull(); expect(Object.keys(get().live)).toHaveLength(3);
    get().beginPlace(ids[1]); get().confirmPlace(ids[0], 1, 2, 45); expect(get().command).toBeNull();
    get().confirmPlace(ids[1], 1, 2, 45);
    expect(get().command).toMatchObject({ type: 'place', x: 1, z: 2, yaw: 45, id: ids[1], moveRuntimeId: 'live'+ids[1] });
    expect(get().placement?.wasMove).toBe(true);
    syncBackpackFiles([...files, new File([], 'tex.png')]);
    expect(get().entries.map(e => e.id)).toEqual(ids);
  });

  it('does not complete twice, or leak a late completion into the next room', () => {
    syncBackpackFiles([new File([], 'preview.glb')]); const id = get().entries[0].id;
    get().beginPlace(id); get().confirmPlace(id, 1, -2, 0); const obsolete = get().command!;
    get().confirmPlace(id, 3, -4, 0); expect(get().command).toBe(obsolete);
    invalidateBackpackCommands(); get().beginPlace(id); get().confirmPlace(id, 3, -4, 0);
    const current = get().command!;
    get().finishCommand(obsolete, 'late decoder error');
    expect(get().command).toBe(current); expect(get().error).toBeNull();
    get().finishCommand(current); expect(get().selected).toBe(id); expect(get().busy).toBe(false);
  });

  it('only accepts a bag motion for a live character; fresh/continue are different from clearing the library', () => {
    const file = new File([], 'hero.pmx'), motion = new File([], 'walk.vmd');
    syncBackpackFiles([file,motion]); const id = get().entries[0].id;
    get().applyMotion(id, motion, 'body'); expect(get().command).toBeNull();
    get().publishLive({ [id]: {runtimeId:'1',visible:true,position:[1,0,1]} });
    get().applyMotion(id, new File([], 'walk.vmd'), 'body'); expect(get().command).toBeNull();
    get().applyMotion(id, motion, 'body'); expect(get().command).toMatchObject({type:'motion', id, file:motion});
    useBackpack.setState({ bindings: { [id]: {body: motion} } });
    prepareBackpackEntry(true); expect(get().bindings[id].body).toBe(motion); expect(get().live).toEqual({});
    prepareBackpackEntry(false); expect(get().bindings).toEqual({}); expect(get().files).toEqual([file,motion]);
    clearBackpack(); expect(get().files).toEqual([]); expect(get().entries).toEqual([]);
  });
});
