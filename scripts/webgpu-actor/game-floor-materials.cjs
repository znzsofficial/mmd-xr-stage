const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// The production floor, a clothed PMX, a held body VMD, and the same two
// projection slices the player sees. Only the ordinary HUD writes game state.
async function observe({asset, id}) {
  const {useMmdVrStore} = await import('/src/mmdVrShowcase/mmdVrStore.ts');
  const {useBackpack} = await import('/src/mmdVrShowcase/backpack/store.ts');
  const {scene, gl} = gameTargets.floorState();
  let mesh;
  scene.traverse(o => {if (o.isSkinnedMesh && o.userData.mmdModelId === id && o.userData.mmdMorphs) mesh = o;});
  const file = useBackpack.getState().entries.find(e => e.id === asset).file;
  const wardrobe = useMmdVrStore.getState().runtimeRef.getWardrobe(id, file);
  const slot = wardrobe.slots.find(s => s.textured && s.source.visible && s.source.opacity === 1 && /^(?:face|面|顔|脸|臉)(?:$|[\d _.-])|顔肌|脸部|面部/i.test(s.label));
  if (!slot) throw Error('Use a reference PMX with a visible textured face slot');
  const draws = [mesh.material].flat(), surface = slot.source, original = surface.map;
  const neighbors = draws.filter(m => m !== surface && m.map).map(m => [m,m.map]);
  const edgeDraws = draws.filter(m => m === surface || m.userData.mmdTslOutlineMaterial?.sourceMaterialIndex === slot.index);
  const state = () => useMmdVrStore.getState().materialModels[id].find(m => m.name === slot.key);
  const eyes = ['左目','右目'].map(name => mesh.skeleton.bones.find(b => b.name === name));
  if (eyes.some(b => !b)) throw Error('Missing eye landmarks');
  const eye = eyes[0].getWorldPosition(mesh.position.clone()).lerp(eyes[1].getWorldPosition(mesh.position.clone()), .5);
  gl.xr.getCamera().parent.worldToLocal(eye); eye.y -= .065; eye.z += .46;
  const pairs = new Map();
  const pose = () => [...mesh.skeleton.boneMatrices, ...mesh.morphTargetInfluences];
  const initialPose = pose();
  async function capture(label) {
    // A grade changes every slot, including the hair behind an omitted face.
    // Its control must omit the whole actor so the background stays identical.
    const subject = ['balanced','bright','balanced-restored'].includes(label) ? [mesh] : edgeDraws;
    const cfg = labFixture, head = cfg.headX, shown = subject.map(m => m.visible);
    if (cfg.take) throw Error('Overlapping projection captures');
    cfg.headX = eye.x;
    let timer;
    try {
      const image = await new Promise((resolve,reject) => {
        timer = setTimeout(() => reject(Error('Missing submitted views: ' + label)), 16000);
        let frames = 0, visible;
        cfg.take = {eyeY:eye.y, eyeZ:eye.z, inputs(){this.time=performance.now();}, afterDraw(s){
          if (++frames < 4) return;
          if (!visible) {visible = s.copyEyes(); for (const m of subject) m.visible = false; return;}
          cfg.take = null; resolve(Promise.all([visible,s.copyEyes()]));
        }};
      });
      pairs.set(label, image);
      const [a,b] = image[0], c = document.createElement('canvas'); c.width = a.width * 2; c.height = a.height;
      c.getContext('2d').putImageData(a,0,0); c.getContext('2d').putImageData(b,a.width,0);
      return c.toDataURL().split(',')[1];
    } finally {
      clearTimeout(timer); cfg.take = null; cfg.headX = head; subject.forEach((m,i) => {m.visible = shown[i];});
    }
  }
  // Pixels that both the baseline and this take identify as the actual slot.
  // An unchanged background or a moving HUD label cannot pass this comparison.
  function compare(a,b) {
    return [0,1].map(i => {
      const [drawA,offA] = pairs.get(a).map(p => p[i].data), [drawB,offB] = pairs.get(b).map(p => p[i].data);
      let measured = 0, changed = 0, residual = 0, towardBackground = 0, brighter = 0;
      for (let k=0;k<drawA.length;k+=4) {
        const diff = (x,y) => Math.abs(x[k]-y[k])+Math.abs(x[k+1]-y[k+1])+Math.abs(x[k+2]-y[k+2]);
        const start = diff(drawA,offA), end = diff(drawB,offB);
        if (start<48 || end<6 || diff(offA,offB)>2) continue;
        measured++; const delta = diff(drawA,drawB); residual+=delta;
        if (delta>15) changed++;
        if (end<start*.85 && end>start*.08) towardBackground++;
        if (drawB[k]+drawB[k+1]+drawB[k+2]>drawA[k]+drawA[k+1]+drawA[k+2]+15) brighter++;
      }
      return {measured,changed,residual,towardBackground,brighter};
    });
  }
  const isolated = () => neighbors.every(([m,map])=>m.map===map && m.userData.stageMaterial.diffuse.value===map);
  window.materialTake = {capture,compare,state,grade:()=>useMmdVrStore.getState().prefs.balancedModelColor,
    active:()=>wardrobe.skin.status(slot.key).active?.name ?? null,
    isolatedSkin:()=>surface.map!==original && surface.map===surface.userData.stageMaterial.diffuse.value && isolated(),
    intact:()=>surface.map===original && surface.userData.stageMaterial.diffuse.value===original && isolated() &&
      pose().every((v,i)=>v===initialPose[i]),
    slider(field,value) {
      const hits = []; scene.getObjectByName('hud:material-panel').traverse(m=>{if(m.renderOrder===33)hits.push(m);});
      hits.sort((a,b)=>b.parent.position.y-a.parent.position.y);
      if(hits.length!==2) throw Error('Expected native opacity and emission sliders');
      const m = hits[field==='opacity'?0:1]; return m.localToWorld(m.position.clone().set(.6*(value-.5),0,0)).toArray();
    },
  };
  return {cursor:wardrobe.slots.indexOf(slot), index:slot.index, key:slot.key, images:useBackpack.getState().files.length};
}

module.exports = async function({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,idleRay}) {
  const actor = await until('selected actor for material edits',s=>s.ready&&s.selected&&s.actor?.evaluations>0);
  const quiet = async()=>{await target({name:'watch:quiet'});await idleRay();await frames(2);};
  if (actor.physics) {
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('physics off',s=>s.ready&&!s.physics);await click('hudBack');await quiet();await pickMounted(ids.model);
  }
  await click('hudChangeMotion');await click('hudApplyBody');await until('bound performance',s=>s.playing&&s.hasBinding&&s.time>.12);
  await bButton();await click('settingsMmdVrPause');const paused=await until('held material pose',s=>!s.playing&&s.actor.poseSeconds===s.time);
  await quiet();await pickMounted(ids.model);
  const slot = await page.evaluate(observe,{asset:ids.model,id:actor.runtimeId});
  const press = async label=>{await aim(await target({name:'hud:'+label}));await trigger(true);await trigger(false);};
  const wait = async(fn,arg)=>{await(await page.waitForFunction(fn,arg)).dispose();};
  const dir = path.resolve(__dirname,'../../local-review/screenshots/webgpu-materials');await fs.mkdir(dir,{recursive:true});
  const take = async label=>{await idleRay();const png=await page.evaluate(label=>materialTake.capture(label),label);
    await fs.writeFile(path.join(dir,label+'.png'),Buffer.from(png,'base64'));await frames(3);};
  async function switchedGrade(key){await bButton();await click('hudMore');await click('settingsCharacter');await click(key);await click('hudBack');await quiet();}
  async function slide(field,value) {
    // Inside the hit padding, outside the visual track, reaches a precise endpoint.
    await aim(await page.evaluate(([f,v])=>materialTake.slider(f,v),[field,value===1?1.04:value===0?-.04:value]));
    await trigger(true);await trigger(false);
    await wait(([f,v])=>Math.abs(materialTake.state()[f]-(f==='emission'?2*v:v))<.025,[field,value]);
  }
  const receipt = {};
  async function compare(a,b,field){const result=await page.evaluate(([a,b])=>materialTake.compare(a,b),[a,b]);
    assert(result.every(e=>e.measured>200&&(field==='residual'?e.residual===0:e[field]>80)),`${a}/${b}: ${JSON.stringify(result)}`);
    receipt[b]=result;
  }
  await click('actorWardrobe');await press('查找漏件');for(let i=0;i<slot.cursor;i++)await press('下一槽');
  await press('更换皮肤贴图');await target({name:'wardrobe-skin-picker'});
  for(let i=0;!await page.evaluate(()=>gameTargets.floorState().scene.getObjectByName('wardrobe-skin-picker').children.some(o=>o.name.endsWith('000-wardrobe-take.png')));i++){
    assert(i<slot.images,'Synthetic comparison map not in the imported folder');await press('下一张');
  }
  await take('skin-original');await press('应用这张图');await wait(()=>materialTake.active()==='000-wardrobe-take.png');
  assert(await page.evaluate(()=>materialTake.isolatedSkin()),'Replacement changed a neighboring material');
  await take('skin-applied');await compare('skin-original','skin-applied','changed');
  await press('恢复原图');await wait(()=>materialTake.active()===null);await take('skin-restored');await compare('skin-original','skin-restored','residual');
  await press('返回材质槽');await press('返回衣柜');await click('actorBack');
  async function openMaterial() {
    await click('watchArrange');await click('watchDetails');await click('settingsMmdVrMaterials');
    for(let i=0;i<Math.floor(slot.index/4);i++)await press('›');
    const base=slot.key.replace(/\.[^.]+$/,'');await press(base.length>14?base.slice(0,13)+'…':base);
  }
  async function photographMaterial(label) {
    // Dismiss the physical sheet: it ignores scene depth and would otherwise
    // print the slider over the same face the slider is supposed to change.
    await click('settingsMmdVrMaterials');await click('hudModels');await bButton();await click('hudBack');await quiet();await take(label);
  }
  await openMaterial();await photographMaterial('material-original');await pickMounted(ids.model);await openMaterial();
  await slide('opacity',.46);await photographMaterial('material-translucent');await compare('material-original','material-translucent','towardBackground');
  await pickMounted(ids.model);await openMaterial();await slide('opacity',1);await slide('emission',.32);await photographMaterial('material-emission');await compare('material-original','material-emission','brighter');
  await pickMounted(ids.model);await openMaterial();await slide('emission',0);await photographMaterial('material-restored');await compare('material-original','material-restored','residual');
  assert.equal(await page.evaluate(()=>materialTake.grade()),true);await take('balanced');await switchedGrade('modelColorBalanced');
  await take('bright');await compare('balanced','bright','changed');await switchedGrade('modelColorBright');await take('balanced-restored');
  await compare('balanced','balanced-restored','residual');assert(await page.evaluate(()=>materialTake.intact()),'The PMX maps or held pose did not restore');
  await pickMounted(ids.model);await until('same selected paused evaluator after edits',(s,p)=>s.ready&&s.selected&&!s.physics&&!s.playing&&s.hasBinding&&s.runtimeId===p.id&&s.time===p.time,{id:actor.runtimeId,time:paused.time});
  await page.evaluate(()=>{delete window.materialTake;});return receipt;
};
