// Browser-side, read-only observers. Keep File references here rather than
// serializing names, paths, material keys or contents to a smoke report.
exports.observeStage = async function observeStage({ modelPath, motionName, optionalToon }) {
  const { useBackpack } = await import('/src/mmdVrShowcase/backpack/store.ts');
  const { useMmdVrStore } = await import('/src/mmdVrShowcase/mmdVrStore.ts');
  const { getMmdVrClock } = await import('/src/mmdVrShowcase/stage/mmdVrClock.ts');
  const b = useBackpack.getState();
  const model = b.entries.find(e => e.kind === 'model' && e.path === modelPath);
  const motion = b.entries.find(e => e.kind === 'motion' && e.path === motionName);
  if (!model || (motionName && !motion)) throw Error('Named PMX or separately imported VMD is not in the actual prep backpack');
  const files = [...b.files];
  // Count even short-lived place commands: an immediate/failed commit must
  // not look like a successful draft-only or invalid-target control.
  let placeCommands=0,confirmedOn=null;
  useBackpack.subscribe((s,prev)=>{if(s.command?.type==='place' && s.command.token!==prev.command?.token){
    placeCommands++;confirmedOn=window.labSession?.dispatchingInput??null;
  }});
  const bound=file=>motion?file===motion.file:!!file;
  function saved(layout) {
    if (!layout) return null;
    const m = layout.models.find(m => m.file === model.file);
    const slot = layout.assets.find(s => s.kind === 'model' && s.modelFile === model.file);
    return { scenery: layout.scenery, models: layout.models.length, objects: layout.objects.length,
      assets: layout.assets.length, hasModel: !!m && !!slot, hasMotion: bound(slot?.bodyMotionFile),
      position: m && [m.transform.positionX, m.transform.positionY, m.transform.positionZ], scale: m?.transform.scale,
      time: layout.time, playing: layout.playing, physics: layout.physicsEnabled };
  }
  window.stageProbe = { read() {
    const b = useBackpack.getState(), s = useMmdVrStore.getState(), h = window.labFixture.hostStatus?.() ?? stageRoomTest.status;
    const live = b.live[model.id], entry = s.models.find(e => e.id === live?.runtimeId);
    const failures=s.assetLoad.failures;
    const knownToon=optionalToon && failures.length===1 && failures[0].phase==='model' &&
      failures[0].fileName===model.path && failures[0].message===`${optionalToon}\nTEXTURE_RESOLVE_FAILED: ${optionalToon}`;
    return { phase: h.phase, frames: h.frames, actor: h.actor, bullet: h.bulletSteps, dynamic: h.dynamicBodies,
      modelCount: s.modelCount, live: Object.keys(b.live).length, visible: live?.visible, position: live?.position,
      runtimeId:live?.runtimeId, selected:b.selected===model.id,
      draft:b.draft===model.id, previewMs:b.previewDelayMs, placeCommands,confirmedOn,
      scale: entry?.scale, yaw:entry?.rotationY, hasBinding: bound(b.bindings[model.id]?.body),
      filesIntact: files.length === b.files.length && files.every((f,i) => b.files[i] === f) &&
        b.entries.some(e => e.id === model.id && e.file === model.file) && (!motion || b.entries.some(e => e.id === motion.id && e.file === motion.file)),
      floor: saved(b.layouts.floor), saved: saved(s.savedStage), room: s.prefs.scenery,
      stagePhase: s.phase, presentation: s.presentation, overlay: s.overlayOpen, playing: s.playing,
      time: getMmdVrClock().time, duration: getMmdVrClock().duration, physics: s.physicsEnabled,
      ready: !!s.captureStage && !s.assetLoad.running && !s.physicsBusy && !b.busy,
      missingFixtureToon:!!knownToon, fixtureBagNotice:!!(knownToon && b.error===failures[0].message),
      problem:h.error || s.physicsError || (s.physicsFatal && 'Fatal physics error') ||
        (!knownToon && failures.map(f=>`${f.phase}/${f.fileName}: ${f.message}`).join('; ')) ||
        (b.error && (!knownToon || b.error!==failures[0].message) && b.error) || false };
  } };
  return { model: model.id, motion: motion?.id, index: b.entries.filter(e => e.kind === 'model').indexOf(model) };
};

// The final color-converted layers, ordered by the binding's *reported* eye
// slice. Calibrate each slice with BOTH poses moved to the physical left/right
// eye in turn. Parallax alone would also pass with interchanged images.
exports.inspectEyes = async function inspectEyes(kind) {
  const cfg = window.labFixture, session = window.labSession;
  async function eyes(bothAt) {
    if (cfg.take) throw Error('Another XR observer is active');
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cfg.take = null; reject(Error('No tracked WebGPU submission for eye readback')); }, 10000);
      cfg.take = { eyeY: 1.45, eyeZ: 0, time: 0, inputs(f) {
        this.time = performance.now();
        if (bothAt != null) for (const v of f.getViewerPose().views) v.transform.inverse.matrix[12] = -bothAt;
      }, afterDraw(s) {
        cfg.take = null; clearTimeout(timer);
        try { resolve(s.copyEyes()); } catch (e) { reject(e); }
      } };
    });
  }
  // Ignore the subimage's unused border. A consumed File, node count, rendered
  // triangle count, or a difference somewhere in the other eye isn't an image.
  function diff(a,b,threshold, actorBox = false) {
    let changed = 0;
    for (let y=actorBox ? 65 : 6;y<(actorBox ? 218 : 234);y++) for (let x=actorBox ? 70 : 5;x<(actorBox ? 170 : 235);x++) {
      const k = 4*(y*a.width+x);
      if ([0,1,2].some(j => Math.abs(a.data[k+j]-b.data[k+j]) > threshold)) changed++;
    }
    return changed;
  }
  const pair = await eyes();
  if (kind === 'baseline') { session.emptyPair = pair; return; }
  if (kind === 'empty') {
    const refs = [await eyes(-.032), await eyes(.032)];
    // Fetch the stereo pair again after the controls (static stage print may
    // have been decoded since the very first submitted frame).
    const base = await eyes(); session.emptyPair = base;
    return { different: diff(...base,2), controls: refs.map(p => diff(...p,0)),
      matched: base.map((p,i) => diff(p,refs[i][0],2)), crossed: base.map((p,i) => diff(p,refs[1-i][0],2)) };
  }
  const mono = await eyes(0);
  return { different: diff(...pair,2), mono: diff(...mono,0),
    characterPixels: pair.map((p,i) => diff(p,session.emptyPair[i],15,true)) };
};

// Compare two captures of the actual WebGL Canvas compositor with the actor
// shown / hidden via its normal screen sheet. No readPixels on a cleared
// default framebuffer, and no synthetic second render of the actor.
exports.screenDiff = async function screenDiff(encoded) {
  const frames = [];
  for (const png of encoded) {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img,0,0); frames.push(ctx.getImageData(0,0,c.width,c.height));
  }
  const [a,b] = frames; if (a.width !== b.width || a.height !== b.height) throw Error('WebGL framing changed during comparison');
  let changed = 0;
  for (let y=Math.floor(a.height*.15);y<a.height*.82;y++) for (let x=Math.floor(a.width*.15);x<a.width*.85;x++) {
    const k=4*(x+y*a.width); if ([0,1,2].some(j=>Math.abs(a.data[k+j]-b.data[k+j])>15)) changed++;
  }
  return changed;
};
