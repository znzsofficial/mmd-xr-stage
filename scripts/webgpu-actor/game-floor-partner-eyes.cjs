// Executed in the mounted room. Only the simulated headset moves; the control
// frames filter a single renderer draw without touching the actor or rig.
module.exports = async function capturePartnerEyes(options) {
  const {scene, gl} = gameTargets.floorState();
  const partner = scene.getObjectByName('pelvic:partner');
  const parts = ['torso', 'head'].map(name => partner?.getObjectByName('pelvic:partner-' + name));
  if (parts.some(m => !m?.isMesh)) throw Error('Missing named partner torso or head mesh');
  const alpha=parts.map(o=>[o.material].flat().filter(m=>m.visible&&m.colorWrite).map(m=>m.transparent?m.opacity:1));
  const cfg = labFixture, origin = gl.xr.getCamera().parent, clock=cfg.take;
  if (clock && clock!==partnerTake.clock) throw Error('Overlapping XR takes');
  // The base smoke isolates torso and head. In the pose batch omit each whole
  // figure in turn: PMX and companion must both contribute a visible silhouette.
  const masks=parts.map(p=>new Set([p]));
  if(options) {
    const actor=scene.children.find(o=>o.userData.mmdModelId===options.runtime);
    if(!actor)throw Error('Missing posed actor root');
    [actor,partner].forEach((root,i)=>{masks[i].clear();root.traverseVisible(o=>{if(o.isMesh)masks[i].add(o);});});
    if(options.hands)for(const side of ['left','right']) {
      const hand=partner.getObjectByName('pelvic:partner-'+side+'-hand');
      if(!hand?.isMesh)throw Error('Missing '+side+' partner hand');
      masks.push(new Set([hand]));
    }
  }

  // Use the drawn vertices, not the group pivots (a mould can be authored
  // off-centre). Keep the operator sheet behind the side-on tracked head.
  function worldVertices(mesh) {
    const pos = mesh.geometry.attributes.position;
    return Array.from({length:pos.count}, (_, i) => mesh.position.clone().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
  }
  const clouds = parts.map(worldVertices);
  const point = partner.position.clone();
  const lo = point.clone().setScalar(Infinity), hi = point.clone().setScalar(-Infinity);
  function extend(v) {
    origin.worldToLocal(point.copy(v)); lo.min(point); hi.max(point);
  }
  const ground={};
  partner.traverseVisible(o=>{
    if (!o.isMesh) return;
    let minY=Infinity;
    for(const vertex of worldVertices(o)) {extend(vertex);minY=Math.min(minY,vertex.y);}
    if(options && o.name.startsWith('pelvic:partner-'))ground[o.name.slice('pelvic:partner-'.length)]=minY-options.floorY;
  });
  for (const xyz of partnerTake.pose()) extend(partner.position.clone().fromArray(xyz));
  const at = lo.clone().lerp(hi,.5);
  const sheet = scene.getObjectByName('backpack-world-tools');
  const side = sheet ? Math.sign(origin.worldToLocal(sheet.getWorldPosition(point)).x - at.x) || 1 : 1;
  const distance = Math.max(.68,lo.distanceTo(hi)*.87);
  const dx = side*distance, dz = distance*.21, dy = distance*.48;
  const radius=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz)+(options?.angle??0);
  const view=options?.view??{headX:at.x+radius*Math.sin(yaw),eyeZ:at.z+radius*Math.cos(yaw),eyeY:at.y+dy,eyeYaw:yaw,eyePitch:-Math.atan2(dy,radius)};
  const oldX = cfg.headX, prior = gl.getRenderObjectFunction();
  const draws = [], bounds = [], skipped = masks.map(()=>0);
  let mask = -1;
  const filter = function(object,...args) {
    if (masks[mask]?.has(object)) { skipped[mask]++; return; }
    return (prior ?? gl.renderObject).call(gl,object,...args);
  };
  cfg.headX = view.headX;
  let timer;
  try {
    await new Promise((resolve,reject) => {
      let frames = 0;
      timer = setTimeout(() => reject(Error('Missing submitted partner eye frames')),25000);
      cfg.take = {...view,
        inputs(){ if(clock)clock.inputs();this.time=clock?clock.time:performance.now(); }, afterDraw(session){
          try {
            clock?.afterDraw(session);
            if (++frames < 3) return;
            if (!draws.length) {
              for (let i=0;i<masks.length;i++) bounds.push(gl.xr.getCamera().cameras.map(camera => {
                if(options)return [-1,1,-1,1];
                const min = point.clone().setScalar(Infinity), max = point.clone().setScalar(-Infinity);
                for (const vertex of clouds[i]) { point.copy(vertex).project(camera); min.min(point); max.max(point); }
                return [min.x,max.x,min.y,max.y];
              }));
            }
            // Bracket every set of omitted draws with the full scene at the
            // same head pose to exclude moving HUD/scenery pixels.
            const copy = session.copyEyes(); copy.catch(reject); draws.push(copy);
            mask = draws.length-1;
            gl.setRenderObjectFunction(mask<masks.length ? filter : prior);
            if (draws.length===masks.length+2) resolve();
          } catch(error) { reject(error); }
        }};
    });
  } finally { clearTimeout(timer); gl.setRenderObjectFunction(prior); cfg.take=clock; cfg.headX=oldX; }

  const [full,...controls] = await Promise.all(draws), restored=controls.pop();
  const evidence = controls.map((control,part) => full.map((im,eye) => {
    const [x0,x1,y0,y1] = bounds[part][eye], {width:w,height:h} = im;
    const px = x => 4+(w-8)*(1+x)/2, py = y => 5+(h-10)*(1-y)/2;
    let pixels=0, sumX=0,sumY=0,minX=w,minY=h,maxX=-1,maxY=-1;
    for (let y=Math.max(5,Math.floor(py(y1))-1);y<Math.min(h-5,Math.ceil(py(y0))+1);y++) {
      for (let x=Math.max(4,Math.floor(px(x0))-1);x<Math.min(w-4,Math.ceil(px(x1))+1);x++) {
        const k=4*(y*w+x);
        let change=0,residual=0;
        for (let c=0;c<3;c++) {
          change=Math.max(change,Math.abs(im.data[k+c]-control[eye].data[k+c]));
          residual=Math.max(residual,Math.abs(im.data[k+c]-restored[eye].data[k+c]));
        }
        if (change>8 && residual<=2) {
          pixels++; sumX+=x;sumY+=y;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        }
      }
    }
    return {pixels,centerX:pixels ? sumX/pixels : null,...(options?{centerY:pixels?sumY/pixels:null,width:maxX-minX+1,height:maxY-minY+1}: {})};
  }));
  const {width,height}=full[0], canvas=document.createElement('canvas');
  canvas.width=2*width; canvas.height=(1+controls.length)*(height+24);
  const ctx=canvas.getContext('2d'); ctx.fillStyle='#202124'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='white'; ctx.font='16px sans-serif';
  const labels=options?['Actor + partner','Actor draw omitted','Partner draw omitted','Left hand omitted','Right hand omitted']:['Partner','Torso draw omitted','Head draw omitted'];
  [full,...controls].forEach((pair,row) => pair.forEach((im,eye) => {
    const y=row*(height+24); ctx.putImageData(im,eye*width,y+24);
    ctx.fillText(`${labels[row]} / ${eye?'right':'left'}`,eye*width+8,y+18);
  }));
  const png=canvas.toDataURL('image/png').split(',')[1];
  return options?{png,actor:evidence[0],partner:evidence[1],hands:evidence.slice(2),ground,view,skipped}:{png,torso:evidence[0],head:evidence[1],alpha,skipped};
};
