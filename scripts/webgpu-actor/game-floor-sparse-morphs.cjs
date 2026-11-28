const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// The reference has a real blink but no UV morph. Append ONE independent UV
// morph only to the temporary second copy; retain its actual UVs and textures.
// The other placed actor is the unmodified original. The real constant-body
// dance is measured independently by --gpu-timing.
exports.prepare=async function(folder,pmx,first,second,motion){
  const {FallbackCore,parsePmxSectionInventory}=await import('@yohawing/three-mmd-loader/parser');
  const bytes=await fs.readFile(pmx),{header,sections}=parsePmxSectionInventory(bytes);
  const m=new FallbackCore().loadModel(bytes), section=sections.find(s=>s.name==='morphs');
  const blink=m.morphs().find(b=>b.name==='まばたき'&&b.type==='vertex');
  assert(blink?.vertexOffsets.length,'The take needs the authored まばたき vertex morph');
  const text=Buffer.from('SparseUv',header.encoding==='utf-8'?'utf8':'utf16le');
  const i32=n=>{const bytes=Buffer.alloc(4);bytes.writeInt32LE(n);return bytes;};
  const count=m.geometry().positions.length/3, stride=header.indexSizes.vertex+16;
  const offsets=Buffer.alloc(count*stride);
  for(let v=0;v<count;v++){
    const at=v*stride;offsets.writeUIntLE(v,at,header.indexSizes.vertex);offsets.writeFloatLE(.13,at+header.indexSizes.vertex);
  }
  const morph=Buffer.concat([i32(text.length),text,i32(0),Buffer.from([4,3]),i32(count),offsets]);
  const end=section.offset+section.byteLength;
  const copy=Buffer.concat([bytes.subarray(0,section.offset-4),i32(section.count+1),bytes.subarray(section.offset,end),morph,bytes.subarray(end)]);
  assert.equal(parsePmxSectionInventory(copy).sections.find(s=>s.name==='morphs').count,section.count+1);
  // Two independent VMD tracks; the pose stays fixed so only an actual visible
  // blink/atlas shift can distinguish half, full and reset. Names are CP932.
  const names=[Buffer.from('82dc82ce82bd82ab','hex'),Buffer.from('SparseUv')];
  assert.equal(new TextDecoder('shift_jis').decode(names[0]),'まばたき');
  const values=[[0,.5,1,0,0,0,0],[0,0,0,0,.5,1,0]];
  const vmd=Buffer.alloc(58+23*14+16);vmd.write('Vocaloid Motion Data 0002');vmd.write('SparseMorphStudy',30);vmd.writeInt32LE(14,54);
  values.forEach((track,k)=>track.forEach((w,i)=>{const at=58+23*(k*track.length+i);names[k].copy(vmd,at);vmd.writeUInt32LE(30*i,at+15);vmd.writeFloatLE(w,at+19);}));
  await Promise.all([fs.writeFile(path.join(folder,first),bytes),fs.writeFile(path.join(folder,second),copy),fs.writeFile(path.join(folder,motion),vmd)]);
};

exports.run=async function(ctx){
  const {page,ids,click,until,bButton,frames,target,pickMounted,idleRay,placeFromBag,first,second,landing}=ctx;
  const ready=await until('sparse pose actor ready',s=>s.ready&&s.live===1&&s.selected&&s.actor?.evaluations>0,null,120000);
  const clearance=await require('./game-floor-clearance.cjs')(ctx);
  async function quiet(){await target({name:'watch:quiet'});await idleRay();await frames(3);}
  await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
  await until('freeze physics for exact morph pair',s=>s.ready&&!s.physics);await click('hudBack');await quiet();await pickMounted(ids.model);
  await click('hudChangeMotion');await click('hudApplyBody');await until('bound calibration tracks',s=>s.playing&&s.hasBinding&&s.duration===6);
  await bButton();await click('settingsMmdVrPause');await until('held calibration',s=>s.ready&&!s.playing);await quiet();
  await placeFromBag(first,[.65,0,-1.85],1,1);
  await until('two independent sparse actors',(s,name)=>s.ready&&s.live===2&&gameTargets.model(name).selected,first,120000);
  await click('hudDone');await quiet();

  async function seek(t){
    await page.evaluate(async t=>{const {useMmdVrStore}=await import('/src/mmdVrShowcase/mmdVrStore.ts');useMmdVrStore.getState().requestSeek(t);},t);
    await until('exact held morph key',(s,t)=>!s.playing&&s.hasBinding&&s.time===t,t);await frames(3);
  }
  async function install(id){await page.evaluate(async id=>{const test=await import('/scripts/webgpu-actor/sparse-morph-observer.js');test.installPortrait(id);},id);}
  const capture=k=>page.evaluate(k=>sparsePortrait.capture(k),k);
  function clean(pair){assert(pair.eyes.every(e=>e.visible.every(v=>v>150)&&e.residual.every(v=>v===0)),JSON.stringify(pair));}
  const samples=[];await seek(0);await install(ready.runtimeId);
  for(const [t,blink,uv] of [[0,0,0],[1,.5,0],[2,1,0],[3,0,0],[4,0,.5],[5,0,1],[0,0,0]]){
    if(samples.length)await seek(t);
    const row=await capture(samples.length?'key'+t:'zero');clean(row);
    assert.deepEqual(row.weights,[blink,uv]);
    if(samples.length)assert.deepEqual(row.calls,[1,0],'Only the actor with changed weights submits a new group');
    assert(row.eyes.every(e=>e.changed[1]===0&&(blink||uv?e.changed[0]>2:e.changed[0]===0)),JSON.stringify(row));
    samples.push(row);
    const held=await capture('hold');clean(held);assert.deepEqual(held.calls,[0,0]);
  }
  await page.evaluate(()=>sparsePortrait.dispose());
  // Both actors fit in the portrait. Select the named backpack row rather
  // than sending a ray through the nearer actor's world selection volume.
  await bButton();await click('hudBackpack');await ctx.aim(await target({key:'hudSelect',row:second}));
  await ctx.trigger(true);await ctx.trigger(false);
  await until('selected original sparse actor before recall',(s,id)=>s.selected&&s.runtimeId===id,ready.runtimeId);
  await click('watchArrange');await click('hudPutAway');
  await until('retired first sparse output',s=>s.ready&&s.live===1&&!s.runtimeId);await quiet();
  await placeFromBag(second,landing,2,1);
  const remounted=await until('fresh runtime for restored PMX',(s,id)=>s.ready&&s.live===2&&s.selected&&s.runtimeId&&s.runtimeId!==id,ready.runtimeId,120000);
  await click('hudDone');await quiet();await seek(0);await install(remounted.runtimeId);
  const replacement=await capture('zero');clean(replacement);await page.evaluate(()=>sparsePortrait.dispose());
  const adapters=await page.evaluate(()=>labFixture.adapters);
  assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software|llvmpipe/i.test(JSON.stringify(a))));
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('sparse take ended',s=>s.phase==='ended'&&!s.live);
  return {clearance,samples,replacement,adapters};
};
