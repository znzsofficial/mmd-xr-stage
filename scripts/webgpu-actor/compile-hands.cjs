// Adapt the single-actor indexed-triangle fixture to the current subject.
// Both actors still dispatch in this room; only the observation is filtered.
exports.trial=function trial(single){
  function replace(src,needle,replacement){
    if(src.split(needle).length!==2)throw Error('Update the two-actor hand fixture: '+needle);
    return src.replace(needle,()=>replacement);
  }
  let src=replace(single.toString(),'{ name, sites, pose }','{ name, sites, pose, runtimeId }');
  src=replace(src,'if (pose) window.stagePaused.verify(s,pose);',`const {useMmdVrStore}=await import('/src/mmdVrShowcase/mmdVrStore.ts');
    const target=useMmdVrStore.getState().models.find(m=>m.id===runtimeId);
    if(!target)throw Error('Missing measured actor');
    const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
    const foot=Object.values(useBackpack.getState().live).find(m=>m.runtimeId===runtimeId)?.position;
    if(!foot || !foot.every(Number.isFinite))throw Error('Missing mounted actor position');
    Object.assign(s,{scale:target.scale,yaw:target.rotationY,position:foot});
    if (pose) window.stagePaused.verify(s,pose);`);
  src=replace(src,'const moved=cfg.movement,view=moved?.view(tracks);',`const moved=undefined;
    // Put the simulated head at the same actor-relative position, including
    // the second actor's real drop yaw. Compare its visible original faces.
    const local=sites.map(site=>site.spot.map(v=>v*s.scale/.1));
    const front=Math.max(...local.map(p=>p[2]))+.62, height=(local[0][1]+local[1][1])*.5-.025;
    const view={eyeX:s.position[0]+sn*front,eyeY:s.position[1]+height,eyeZ:s.position[2]+c*front,
      areas:[-.032,.032].map(ex=>local.map(([x,y,z])=>[120+116*1.1*(x-ex)/(front-z),120-115*1.1*(y-height)/(front-z),Math.min(30,.095*1.1*116/(front-z))]))};`);
  src=replace(src,'const take = { eyeY, eyeZ,','const take = { eyeY, eyeZ, eyeYaw:yaw,');
  src=replace(src,'const phase = phases[frame]; if (!phase) return;','const phase = phases[frame]; if (!phase || mesh.userData.mmdModelId!==runtimeId) return;');
  return require('node:vm').runInThisContext('('+src+')');
};
