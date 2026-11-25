// CPU-only ownership check for a local reference PMX. Real stage commands and
// restore queue, no renderer/texture decoding, Quest, or simulated GL counts.
// node scripts/verify-model-memory-cycle.mjs <local.pmx>
import assert from 'node:assert/strict';
import {openAsBlob} from 'node:fs';
import {Scene} from 'three';
import {loadNodeBulletStage} from './node-bullet-stage.mjs';

if (!process.argv[2]) throw Error('Supply one local PMX');
const file = new File([await openAsBlob(process.argv[2])], 'actor.pmx');
const {createMmdRuntimeHandle,close} = await loadNodeBulletStage();
try {
  const {inspectMountedRoot} = await import('../src/mmdVrShowcase/diagnostics/modelMemoryInventory.ts');
  const {createStageActors} = await import('../src/mmdVrShowcase/stage/stageActors.ts');
  const {mountedModelBytePool:pool,MODEL_BYTES_BUDGET} = await import('../src/mmdVrShowcase/mmdRuntime/mountedModelBytes.ts');
  const {useBackpack,syncBackpackFiles,clearBackpack} = await import('../src/mmdVrShowcase/backpack/store.ts');
  const bag = useBackpack.getState; syncBackpackFiles([file]); const id=bag().entries[0].id;
  const createRoom = () => {
    const scene=new Scene(), runtime=createMmdRuntimeHandle(scene);
    return {scene,runtime,actors:createStageActors(scene,runtime,()=>false,()=>0)};
  };
  let room=createRoom(); const rows=[];
  const leave = () => {
    room.runtime.dispose();room.actors.disposeObjects();assert.equal(room.scene.children.length,0);
  };
  const snapshot = phase => {
    const [root]=room.scene.children;
    rows.push({phase,models:room.runtime.listModels().length,pmxSourceReservedBytes:pool.reservedBytes,...(root&&{resources:inspectMountedRoot(root)})});
  };
  const command = async place => {
    if (place) {bag().beginPlace(id);bag().confirmPlace(id,0,-2,0);} else bag().putAway(id);
    const cmd=bag().command; assert(cmd);
    await room.actors.execute(cmd,()=>false);room.actors.publishLive();bag().finishCommand(cmd);
  };
  try {
    snapshot('empty'); await command(true); snapshot('placed');
    const saved=room.actors.capture(); assert.equal(saved.models.length,1);
    leave();room=createRoom();snapshot('other-room');
    leave();room=createRoom();
    for(const task of room.actors.restoreTasks(saved.assets,saved,()=>false)) await task.run();
    room.actors.publishLive();snapshot('restored');
    await command(false);snapshot('put-away'); await command(true);snapshot('replaced');
    assert.deepEqual(rows.map(r=>r.models),[0,1,0,1,0,1]);
    const reserved=file.size<=MODEL_BYTES_BUDGET?file.size:0;
    assert.deepEqual(rows.map(r=>r.pmxSourceReservedBytes),[0,reserved,0,reserved,0,reserved]);
    assert(rows[1].resources.positionBackingBytes>0);
    for(const n of [3,5]) assert.deepEqual(rows[n].resources,rows[1].resources);
  } finally {leave();clearBackpack();}
  assert.equal(pool.reservedBytes,0); console.log(JSON.stringify({rows,exitReservedBytes:pool.reservedBytes},null,2));
} finally {close();}
