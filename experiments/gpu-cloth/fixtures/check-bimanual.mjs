// Run on a freshly loaded, standing original PMX in the built lab (?probe=1).
// const baseline = await page.evaluate(checkBimanual, {});
// const candidate = await page.evaluate(checkBimanual, {plan:baseline.plan});
// Self-contained for Playwright serialization; no fixture imports in the viewer.
// Reports/plans contain local geometry indices. Keep them in local-review/.
export async function checkBimanual({plan: replay = null, materialIndex = null, material = materialIndex} = {}) {
  const q = globalThis.clothProbe?.(), actor = q?.actor;
  if (!actor || actor.raised) throw Error('Load a standing PMX on ?probe=1 before sampling');
  const {gpu, rig, model:{mesh}} = actor, {geometry, skeleton} = mesh;
  const {position, skinWeight, skinIndex} = geometry.attributes, index = geometry.index;
  const V = rig.nodes[0].rest.constructor, vec = a => new V().fromArray(a);
  const must = (v, msg) => { if (!v) throw Error('Bimanual fixture: ' + msg); };
  const quantile = (xs, p) => { must(xs.length && xs.every(Number.isFinite), 'empty or non-finite sample');
    const sorted = xs.slice().sort((a,b) => a-b); return sorted[Math.round((sorted.length-1)*p)]; };
  const mm = m => m * 1000, sides = ['left', 'right'], radius = .055, dt = 1/72;
  const version = 'indexed-palm-1', shape = [position.count,index.count,rig.nodes.length,skeleton.bones.length];
  if (replay) must(replay.version === version && String(replay.shape) === String(shape), 'incompatible replay or PMX');
  const tris = [], byId = new Map(), mats = [].concat(mesh.material);
  const mobile = new Float32Array(position.count);
  for (let i=0;i<position.count;i++) for (let j=0;j<4;j++) {
    const n=rig.nodes[rig.byBone.get(skinIndex.getComponent(i,j))];
    if (n && !n.pin) mobile[i]+=skinWeight.getComponent(i,j);
  }
  for (const gr of geometry.groups) {
    const m=mats[gr.materialIndex]; if (m?.visible===false || !(m?.opacity>.001)) continue;
    for(let id=gr.start;id<gr.start+gr.count;id+=3){
      const ids=[0,1,2].map(k=>index.getX(id+k));
      const f={id, ids, mat:gr.materialIndex, free:ids.reduce((s,i)=>s+mobile[i],0)/3}; tris.push(f);byId.set(id,f);
    }
  }
  // Independent CPU LBS of the indexed corners from the actual draw palette,
  // weighted display particles AND any final per-corner offsets. Do not use a
  // solver-owned contact point, acquisition flag or reported penetration depth.
  const points = Array.from({length:position.count},()=>new V()), posed = points.map(()=>new V());
  function skin(ids, cloth, offsets){
    const m=skeleton.boneMatrices,t=gpu.targets;
    for(const id of ids){const x=position.getX(id),y=position.getY(id),z=position.getZ(id),p=points[id].set(0,0,0),base=posed[id].set(0,0,0);
      for(let k=0;k<4;k++){const w=skinWeight.getComponent(id,k);if(!w)continue;
        const b=skinIndex.getComponent(id,k),j=b*16, s=w*rig.scale;
        base.x+=s*(m[j]*x+m[j+4]*y+m[j+8]*z+m[j+12]);base.y+=s*(m[j+1]*x+m[j+5]*y+m[j+9]*z+m[j+13]);
        base.z+=s*(m[j+2]*x+m[j+6]*y+m[j+10]*z+m[j+14]);
        const node=rig.byBone.get(b);if(node!==undefined){const h=node*4;p.x+=w*(cloth[h]-t[h]);p.y+=w*(cloth[h+1]-t[h+1]);p.z+=w*(cloth[h+2]-t[h+2]);}
      }
      p.add(base);if(offsets){const h=id*4;p.x+=offsets[h];p.y+=offsets[h+1];p.z+=offsets[h+2];}
      must(Number.isFinite(p.x+p.y+p.z), 'non-finite displayed vertex');
    }
  }
  function step(hands){actor.update(dt,hands);const enc=q.device.createCommandEncoder();
    gpu.solve(enc,1,actor.takeSeed(),undefined,actor.faceState==='active');q.device.queue.submit([enc.finish()]);}
  async function sample(ids){const [cloth,off]=await Promise.all([gpu.sample(),gpu.offsets()]);skin(ids,cloth,off);
    let err=0;for(const [i,n] of rig.nodes.entries())if(n.pin){const j=4*i;err=Math.max(err,Math.hypot(...[0,1,2].map(k=>cloth[j+k]-gpu.targets[j+k])));}
    must(Number.isFinite(err),'invalid pin');return mm(err);}
  const absent=[null,null];
  function settle(){actor.reset();for(let i=0;i<100;i++)step(absent);}
  const at = (s,vertices=points) => {const ids=byId.get(s.face).ids;return new V().addScaledVector(vertices[ids[0]],s.w[0]).addScaledVector(vertices[ids[1]],s.w[1]).addScaledVector(vertices[ids[2]],s.w[2]);};
  const normal = f => points[f.ids[1]].clone().sub(points[f.ids[0]]).cross(points[f.ids[2]].clone().sub(points[f.ids[0]])).normalize();
  // Distance to the filled triangle, including interior and edges. Measuring
  // only the corners would miss the middle of precisely the sparse panels.
  const ab=new V(), ac=new V(), ap=new V(), tmp=new V(), edge=new V(), test=new V(), closest=new V();
  function nearTri(p,f,out){const [a,b,c]=f.ids.map(i=>points[i]);ab.subVectors(b,a);ac.subVectors(c,a);ap.subVectors(p,a);
    const d=ab.dot(ab),e=ab.dot(ac),g=ac.dot(ac),h=ap.dot(ab),k=ap.dot(ac),det=d*g-e*e;
    if(det>1e-20){const u=(g*h-e*k)/det,v=(d*k-e*h)/det;if(u>=0&&v>=0&&u+v<=1){out.copy(a).addScaledVector(ab,u).addScaledVector(ac,v);return out.distanceTo(p);}}
    let best=Infinity;for(const [s,t] of [[a,b],[b,c],[c,a]]){edge.subVectors(t,s);const w=Math.min(1,Math.max(0,tmp.subVectors(p,s).dot(edge)/(edge.lengthSq()||1)));
      test.copy(s).addScaledVector(edge,w);const dist=test.distanceToSquared(p);if(dist<best){best=dist;out.copy(test);}}
    return Math.sqrt(best);
  }
  function centerOfWaist(){const pins=rig.nodes.filter(n=>n.pin);return pins.reduce((p,n)=>p.add(n.rest),new V()).divideScalar(pins.length);}
  const center=centerOfWaist();
  // The lab's fragment shader discards sampled alpha < .16. A transparent
  // lace hole in an otherwise visible draw is not an exterior witness. Read
  // only the four source texels surrounding a ray hit, never a whole texture.
  let ctx;const mod=(n,m)=>(n%m+m)%m;
  function drawn(f,w){const m=mats[f.mat],im=m.map?.image;if(!im)return m.opacity>=.16;
    ctx??=new OffscreenCanvas(1,1).getContext('2d',{willReadFrequently:true});
    const uv=geometry.attributes.uv,u=f.ids.reduce((s,id,i)=>s+w[i]*uv.getX(id),0),v=f.ids.reduce((s,id,i)=>s+w[i]*uv.getY(id),0);
    const width=im.width,height=im.height,x=u*width-.5,y=(m.map.flipY?1-v:v)*height-.5,ix=Math.floor(x),iy=Math.floor(y);
    let alpha=0;ctx.globalCompositeOperation='copy';
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){ctx.drawImage(im,mod(ix+i,width),mod(iy+j,height),1,1,0,0,1,1);
      alpha+=ctx.getImageData(0,0,1,1).data[3]/255*(i?x-ix:1-x+ix)*(j?y-iy:1-y+iy);}
    return alpha*m.opacity>=.16;
  }
  // Cast from outside through ALL visible draw groups. The frontmost hit must
  // itself be mobile cloth; never choose a lining just by its name or weight.
  function ray(rad,tangentOffset,y){const tang=new V(rad.z,0,-rad.x);let best=-Infinity,hit=null;
    for(const f of tris){const [a,b,c]=f.ids.map(i=>points[i]);if(y<Math.min(a.y,b.y,c.y)||y>Math.max(a.y,b.y,c.y))continue;
      const u=a.dot(tang),bu=b.dot(tang)-u,cu=c.dot(tang)-u,bv=b.y-a.y,cv=c.y-a.y,det=bu*cv-cu*bv;
      if(Math.abs(det)<1e-13)continue;const du=center.dot(tang)+tangentOffset-u,dv=y-a.y;
      const v=(du*cv-dv*cu)/det,w=(bu*dv-bv*du)/det;if(v<0||w<0||v+w>1)continue;
      const t=(1-v-w)*a.dot(rad)+v*b.dot(rad)+w*c.dot(rad);
      if(t>best&&drawn(f,[1-v-w,v,w])){best=t;hit={face:f.id,w:[1-v-w,v,w]};}
    }return hit;
  }
  function pickSide(side,requested){const sign=side?1:-1, rad=new V(.70*sign,0,Math.sqrt(1-.7**2));
    const ys=[];for(const f of tris){if(f.free<.55)continue;const p=at({face:f.id,w:[1/3,1/3,1/3]}),r=p.clone().sub(center);r.y=0;
      if(r.normalize().dot(rad)>.90)ys.push(p.y);}
    must(ys.length,'no skirt in the selected sector');
    // Select only by coverage in the settled, empty standing pose. No trial
    // with a palm is made to pick a triangle, material, path or threshold.
    const y=quantile(ys,.13), hits=[];
    for(const dy of [0,-.012,.012,-.024,.024])for(const dx of [0,-.018,.018,-.036,.036]){
      const hit=ray(rad,dx,y+dy);if(!hit)continue;const f=byId.get(hit.face);
      if(f.free>.55 && (requested==null||f.mat===requested))hits.push({...hit,dx,dy,mat:f.mat});}
    must(hits.length>=3,'no visible mobile lower panel; check the PMX or material override');
    const votes=new Map();for(const h of hits)votes.set(h.mat,(votes.get(h.mat)??0)+1);
    const mat=[...votes].sort((a,b)=>b[1]-a[1])[0][0], patch=hits.filter(h=>h.mat===mat).sort((a,b)=>Math.hypot(a.dx,a.dy)-Math.hypot(b.dx,b.dy));
    must(patch.length>=3,'outer patch has fewer than three visible material points');
    const marks=patch.map(({face,w})=>({face,w})),p=at(marks[0]),n=normal(byId.get(marks[0].face));if(n.dot(rad)<0)n.negate();
    const path=p.clone().addScaledVector(rad,-.012);let lowest=p.y;
    for(const f of tris){if(f.mat!==mat)continue;for(const i of f.ids){const v=points[i];if(Math.hypot(v.x-path.x,v.z-path.z)<.075)lowest=Math.min(lowest,v.y);}}
    return {mat, marks, spot:p.toArray(), normal:n.toArray(), radial:rad.toArray(),
      start:[path.x,lowest-radius-.04,path.z], end:[path.x,p.y+.080-radius,path.z],
      bind:byId.get(marks[0].face).ids.map(i=>new V().fromBufferAttribute(position,i).toArray())};
  }
  // A static oracle checked against each build, including its old and new draw
  // outputs. Returning measurements (even failed ones) allows baseline capture.
  const priorMode=actor.mode; q.halt();
  try {
    actor.mode='gpu';settle();await sample(points.keys());
    const sites=replay?.sites??[pickSide(0,material),pickSide(1,material)];
    must(sites.length===2,'missing site');
    for(const s of sites){must(s.marks.length>=3 && s.marks.every(h=>byId.get(h.face)?.mat===s.mat),'replay material/face mismatch');
      const ids=byId.get(s.marks[0].face).ids;must(ids.every((id,k)=>new V().fromBufferAttribute(position,id).distanceTo(vec(s.bind[k]))<1e-6),'replay corner mismatch');}
    must(vec(sites[0].end).distanceTo(vec(sites[1].end))>radius*2.5,'palms would sample overlapping sites');
    const plan=replay??{version,shape,sites};
    const regions=sites.map((s,i)=>{if(replay?.regions)return replay.regions[i].map(id=>{const f=byId.get(id);must(f?.mat===s.mat,'replay region mismatch');return f;});
      const p=vec(s.spot);return tris.filter(f=>f.mat===s.mat&&nearTri(p,f,closest)<.23);});
    if(!replay)plan.regions=regions.map(fs=>fs.map(f=>f.id));
    const outer=tris.filter(f=>sites.some(s=>s.mat===f.mat)), outerIds=[...new Set(outer.flatMap(f=>f.ids))];
    const high=quantile(outerIds.map(i=>points[i].y),.85);
    let waist=replay?.waist??outerIds.filter(i=>points[i].y>=high && mobile[i]<.01);
    if(!replay && waist.length<3){ // Hem trim can be a separate draw group. Find the actual pinned cloth at the top.
      const pinW=i=>{let w=0;for(let k=0;k<4;k++)if(rig.nodes[rig.byBone.get(skinIndex.getComponent(i,k))]?.pin)w+=skinWeight.getComponent(i,k);return w;};
      waist=[...new Set(tris.flatMap(f=>f.ids))].filter(i=>mobile[i]<.01 && pinW(i)>.5 && Math.abs(points[i].y-center.y)<.075);
    }
    must(waist.length>=3,'no measurable fixed waistband vertices');
    if(!replay){waist=waist.filter((_,i)=>i%Math.ceil(waist.length/32)===0);plan.waist=waist;}
    const ids=new Set([...regions.flat().flatMap(f=>f.ids),...waist,...sites.flatMap(s=>s.marks.flatMap(h=>byId.get(h.face).ids))]);
    const originWaist=waist.map(i=>points[i].clone());
    const track=sites.map(s=>{const start=vec(s.start),end=vec(s.end),away=start.clone().addScaledVector(vec(s.radial),.16);
      const n=vec(s.normal),p=vec(s.spot),before=p.clone().addScaledVector(n,-radius-.012),after=p.clone().addScaledVector(n,radius+.012);
      return {start,end,away,before,after,n,p};});
    // Fixed steps, not browser time. Use the actor's normal update/seed path,
    // including untracked null slots. Readbacks never feed the next hand pose.
    const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a.clone().lerp(b,smooth(Math.max(0,Math.min(1,t))));
    function hand(side,t){const h=track[side],release=side?200:128;
      if(t<0)return null;if(t<12)return h.start;if(t<84)return mix(h.start,h.end,(t-12)/72);
      if(t<release)return h.end;if(t<release+24)return mix(h.end,h.away,(t-release)/24);
      return null;
    }
    const phases=t=>t<12?'clear':t<84?'rise':t<128?'hold':t<152?'withdrawLeft':t<200?'rightOnly':t<224?'withdrawRight':'rest';
    let pinMax=0,waistMax=0;
    async function readPose(){pinMax=Math.max(pinMax,await sample(ids));waistMax=Math.max(waistMax,...waist.map((i,k)=>mm(points[i].distanceTo(originWaist[k]))));}
    function observe(side,palm){const s=sites[side],marks=s.marks.map(h=>at(h).toArray());let surface=null;
      if(palm){const crown=palm.clone();crown.y+=radius;let distance=Infinity,crownGap=Infinity;
        for(const f of regions[side]){distance=Math.min(distance,nearTri(palm,f,closest));crownGap=Math.min(crownGap,nearTri(crown,f,closest));}
        surface={penetrationMm:mm(Math.max(0,radius-distance)),crownGapMm:mm(crownGap),palmTopY:crown.y};}
      return {marks,base:s.marks.map(h=>at(h,posed).toArray()),surface};
    }
    const trials={}, bits={empty:0,left:1,right:2,both:3};
    // Let the caller draw the already solved production buffers and hand slots,
    // without advancing the actor. center stays fixed across all four images;
    // contacts follows the sampled fabric. Await capture before the next step.
    const framingCenter=vec(sites[0].spot).lerp(vec(sites[1].spot),.5).toArray();
    for(const [name,mask] of Object.entries(bits)){
      settle();const rows=[];
      for(let t=0;t<=440;t++){const palms=sites.map((_,s)=>(mask&(1<<s))?hand(s,t):null);step(palms);
        if((t<=224&&t%4===0)||[244,276,328,384,416,440].includes(t)){
          await readPose();rows.push({t,sides:sites.map((_,s)=>observe(s,hand(s,t)))});
          const key=name==='empty'&&t===112?'empty-hold':name==='both'?({112:'both-hold',184:'left-withdrawn',416:'both-withdrawn'})[t]:null;
          if(key)await globalThis.captureClothPhase?.(key,{frame:t,trial:name,center:[...framingCenter],
            contacts:sites.map(s=>at(s.marks[0]).toArray()),hands:palms.map(p=>p?.toArray()??null),
            materialIndices:sites.map(s=>s.mat),radius,stepHz:72});
        }}trials[name]=rows;
    }
    // Difference each fixed material point against its own empty counterpart
    // BEFORE pooling. Always keep the full traces (including negative lift).
    const traces={};for(const name of Object.keys(bits))traces[name]=trials[name].map((r,i)=>({t:r.t,phase:phases(r.t),sides:r.sides.map((v,s)=>{
      const base=trials.empty[i].sides[s].marks,dy=v.marks.map((p,k)=>mm(p[1]-base[k][1])),dist=v.marks.map((p,k)=>mm(vec(p).distanceTo(vec(base[k]))));
      const paletteDriftMm=Math.max(...v.base.map((p,k)=>mm(vec(p).distanceTo(vec(trials.empty[i].sides[s].base[k])))));
      return {midLiftMm:quantile(dy,.5),hitLiftMm:dy[0],p90OffsetMm:quantile(dist,.90),paletteDriftMm,...v.surface};})}));
    const checks=[];
    function check(name,v,op,limit,unit){must(Number.isFinite(v),'non-finite metric '+name);checks.push({name,value:v,unit,op,limit,pass:op==='>='?v>=limit:v<=limit});}
    const range=(name,lo,hi,s,key)=>traces[name].filter(r=>r.t>=lo&&r.t<=hi).map(r=>r.sides[s][key]);
    for(const [s,label] of sides.entries()){
      check(label+' underlying palette matches no-hand',Math.max(...['left','right','both'].flatMap(n=>range(n,0,440,s,'paletteDriftMm'))),'<=',2,'mm');
      check(label+' repeatable clear start',Math.max(...['left','right','both'].flatMap(n=>range(n,0,8,s,'p90OffsetMm'))),'<=',2,'mm');
      for(const name of [label,'both']){
        const prefix=name+'/'+label+' ';
        check(prefix+'held material lift P10',quantile(range(name,96,124,s,'midLiftMm'),.1),'>=',20,'mm');
        check(prefix+'held marked hit P10',quantile(range(name,96,124,s,'hitLiftMm'),.1),'>=',15,'mm');
        const contact=traces[name].filter(r=>r.t>=12&&r.t<=124&&r.sides[s].palmTopY>=sites[s].spot[1]+.015).map(r=>r.sides[s]);
        check(prefix+'active sphere penetration P90',quantile(contact.map(v=>v.penetrationMm),.90),'<=',radius*1000/3,'mm');
        check(prefix+'upper support coverage',contact.filter(v=>v.crownGapMm<=radius*1000*.55).length/contact.length,'>=',.70,'fraction');
      }
      const other=s?'left':'right';
      check('both/'+label+' additional lift over opposite only',quantile(range('both',96,124,s,'midLiftMm').map((x,i)=>x-range(other,96,124,s,'midLiftMm')[i]),.1),'>=',12,'mm');
      for(const name of [label,'both'])check(name+'/'+label+' after both withdrawn',Math.max(...range(name,384,440,s,'p90OffsetMm')),'<=',12,'mm');
    }
    check('released left follows right-only control',quantile(range('both',176,196,0,'midLiftMm').map((v,i)=>Math.abs(v-range('right',176,196,0,'midLiftMm')[i])),.90),'<=',14,'mm');
    check('right stays supported after left leaves',quantile(range('both',160,196,1,'midLiftMm'),.10),'>=',20,'mm');
    check('right crown after left leaves',quantile(range('both',160,196,1,'crownGapMm'),.90),'<=',radius*1000*.55,'mm');

    // Same start/end points either side of the selected fabric. Track the
    // whole step vs lose the source before crossing; neither arm is dragged
    // from the parked sentinel. The empty run samples the same palette/steps.
    const fast={}, impulseSide=0, h=track[impulseSide],hitFace=byId.get(sites[0].marks[0].face);
    function preCross(){const n=normal(hitFace),a=points[hitFace.ids[0]],v=h.after.clone().sub(h.before),denom=n.dot(v);
      if(Math.abs(denom)<1e-10)return false;const t=n.dot(a.clone().sub(h.before))/denom;
      return t>=0&&t<=1&&nearTri(h.before.clone().addScaledVector(v,t),hitFace,closest)<.00001;}
    for(const name of ['empty','stopBefore','stayMissing','continuous','reacquired']){settle();const rows=[];
      const gap=name==='reacquired'||name==='stayMissing';
      for(let t=0;t<=130;t++){const palm=name==='empty'?null:t<16?h.before:t<24?(gap?null:h.before):
          t<30&&(name==='continuous'||name==='reacquired')?h.after:null;
        step([palm,null]);if([15,23,24,25,26,27,29,32,48,130].includes(t)){await readPose();const hit=at(sites[0].marks[0]);
           const signed=hit.clone().sub(h.p).dot(h.n);rows.push({t,point:hit.toArray(),normalMm:mm(signed),segmentHitsFace:preCross(),
             startClearanceMm:mm(nearTri(h.before,hitFace,closest)-radius),endClearanceMm:mm(nearTri(h.after,hitFace,closest)-radius),
             endPanelClearanceMm:mm(regions[0].reduce((d,f)=>Math.min(d,nearTri(h.after,f,closest)),Infinity)-radius)});}}
      fast[name]=rows;}
    for(const name of ['continuous','reacquired'])fast[name].forEach((v,i)=>{const b=fast.empty[i],matched=fast[name==='continuous'?'stopBefore':'stayMissing'][i];
      v.deltaMm=mm(vec(v.point).distanceTo(vec(b.point)));v.normalDeltaMm=v.normalMm-b.normalMm;
      v.matchedMm=mm(vec(v.point).distanceTo(vec(matched.point)));v.matchedNormalMm=v.normalMm-matched.normalMm;});
    const fastRange=(name,lo,hi,key)=>fast[name].filter(r=>r.t>=lo&&r.t<=hi).map(r=>r[key]);
    const pre=fast.continuous.find(r=>r.t===23);
    check('fast step starts clear of marked triangle',pre.startClearanceMm,'>=',2,'mm');
    check('fast endpoint clear before crossing',pre.endClearanceMm,'>=',2,'mm');
    check('fast segment crosses the displayed triangle',+pre.segmentHitsFace,'>=',1,'boolean');
    check('fast tracked crossing pushes along sweep',Math.max(...fastRange('continuous',24,26,'matchedNormalMm')),'>=',4,'mm');
    check('reacquisition endpoint clear of outer panel',fast.stayMissing.find(r=>r.t===23).endPanelClearanceMm,'>=',0,'mm');
    check('reacquisition across cloth does not sweep or attach',Math.max(...fastRange('reacquired',24,29,'matchedMm')),'<=',6,'mm');
    check('fast contact releases',fast.continuous.at(-1).deltaMm,'<=',12,'mm');
    check('fixed pins',pinMax,'<=',.1,'mm');check('displayed waistband',waistMax,'<=',2,'mm');
    return {pass:checks.every(c=>c.pass),plan,checks,traces,fast,
      coverage:{siteFaces:sites.map(s=>new Set(s.marks.map(h=>h.face)).size),marks:sites.map(s=>s.marks.length),regionFaces:regions.map(r=>r.length),waistVertices:waist.length,mode:actor.mode,stepHz:72,radiusMm:mm(radius)}};
  } finally {actor.mode=priorMode;q.screen(performance.now());}
}
