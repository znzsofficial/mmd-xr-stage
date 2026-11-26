// Same original-PMX triangle plans and grip trajectories as xr-cloth-take.
// Here X removes the real actor. The caller remounts it between trials; the
// synthetic clock, diagnostic copies, and output images exist only in smoke.
const assert = require('node:assert/strict');

exports.driverProbe = (observeHands,paused=false) => ({
  name: 'stage-smoke-observe-original-cloth', enforce: 'pre',
  transform(src,id) {
    const file=id.split('?')[0].replaceAll('\\','/');
    if(paused && file.endsWith('/scripts/webgpu-actor/roomCloth.js')) {
      const at='const rig = fitRig(mesh);';assert.equal(src.split(at).length,2,'Update pre-TSL bind witness site');
      return src.replace(at,'window.stagePaused.captureBind(mesh);\n'+at);
    }
    if (!file.endsWith('/scripts/webgpu-actor/clothDriver.js')) return;
    const init = 'const device=renderer.backend.device,mesh=model.mesh';
    assert.equal(src.split(init).length,2,'Update the smoke driver-init fault site');
    src=src.replace(init,`if (window.labFixture.failNextDriver) {
      window.labFixture.failNextDriver=false; ++window.labFixture.driverFailures;
      throw Error('stage smoke: injected cloth driver init failure');
    }\n${init}`);
    if (!observeHands) return src;
    const at = 'seed=false;return steps;';
    assert.equal(src.split(at).length,2,'Update the smoke observation site after a cloth driver change');
    return src.replace(at,'window.labFixture?.take?.measure?.(device,mesh,rig,points,goals,renderer);\n'+at);
  },
});

exports.trial = async function trial({ name, sites, pose }) {
  const cfg = window.labFixture, s = window.stageProbe.read();
  if (pose) window.stagePaused.verify(s,pose);
  else if (s.duration || s.time || s.hasBinding) throw Error('Rest trials need an unbound actor');
  if (!s.scale || cfg.take) throw Error('Missing scale or another running take');
  // Real ray placement faces the tracked viewer. Transform the rest plan with
  // the actor, rather than assuming the old fixed-point, zero-yaw shortcut.
  const yaw=s.yaw*Math.PI/180, c=Math.cos(yaw),sn=Math.sin(yaw);
  const world = ([x,y,z]) => [c*x+sn*z,y,-sn*x+c*z].map((v,i) => v*s.scale/.1+s.position[i]);
  const route=pose && window.stagePaused.route;
  const tracks = route?.tracks ?? sites.map(p => ({ start:world(p.start), end:world(p.end), spot:world(p.spot), away:world(p.start.map((v,i)=>v+.16*p.radial[i])) }));
  const eyeY = (tracks[0].spot[1]+tracks[1].spot[1])/2-.025, eyeZ = Math.max(...tracks.map(p=>p.spot[2]))+.62;
  const phases = {112:'hold',184:'withdrawLeft',400:'release'};
  const images = {}, offsets = {}, grips = {}, native={};let submittedSample,maxBones=0,prevNative=s.actor.bulletSimulatedSteps;
  let frame = -160, clock = performance.now(), done, fail;
  const complete = new Promise((yes,no) => { done=yes; fail=no; });
  const take = { eyeY, eyeZ, time: clock,
    inputs(f) {
      take.time = clock += 1000/72;
      f.getPose = space => {
        const i = labSession.inputSources.findIndex(src => src.gripSpace === space);
        if (i<0) return null;
        const side = labSession.inputSources[i].handedness, h = tracks[side==='left'?0:1], release = side==='left'?128:200;
        if (frame<0 || (name!==side && name!=='both') || frame>=release+24) return null;
        const [a,b,u] = frame<release ? [h.start,h.end,(frame-12)/72] : [h.end,h.away,(frame-release)/24];
        const t = Math.max(0,Math.min(1,u)), w = t*t*(3-2*t), [x,y,z]=a.map((n,k)=>n+(b[k]-n)*w);
        return {transform:{position:{x,y,z},orientation:{x:0,y:0,z:0,w:1},matrix:[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]}};
      };
    },
    measure(device,mesh,rig,points,goals,renderer) {
      const phase = phases[frame]; if (!phase) return;
      if(pose) {submittedSample={device,mesh,rig,points,goals,renderer};return;}
      if (offsets[phase]) throw Error('More than one cloth measurement in one tracked frame');
      const g=mesh.geometry, si=g.attributes.skinIndex, sw=g.attributes.skinWeight;
      const ys=[1,5,9].map(i=>mesh.matrixWorld.elements[i]/rig.scale);
      const size=points.size, b=device.createBuffer({size:size*2,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
      const cmd=device.createCommandEncoder();
      cmd.copyBufferToBuffer(points,0,b,0,size); cmd.copyBufferToBuffer(goals,0,b,size,size); device.queue.submit([cmd.finish()]);
      // These are world-Y displacements contributed by the displayed GPU
      // cloth positionNode to an original textured skin triangle, not heights
      // of a controller/node. The simultaneous two-eye copies below contain
      // the complete post-skinning PMX, including the native body solver.
      offsets[phase]=b.mapAsync(GPUMapMode.READ).then(()=>{
        const data=new Float32Array(b.getMappedRange()), base=size/4;
        return sites.map(site=>site.marks.map(({face,w})=>{
          if (!g.groups.some(gr=>gr.materialIndex===site.mat && face>=gr.start && face+2<gr.start+gr.count)) throw Error('Hand plan does not match original PMX material triangles');
          let y=0;
          for (let k=0;k<3;k++) {
            const vertex=g.index.getX(face+k);
            for (let j=0;j<4;j++) {
              const node=rig.byBone.get(si.getComponent(vertex,j)); if (node===undefined) continue;
              const weight=w[k]*sw.getComponent(vertex,j);
              for (let c=0;c<3;c++) { const at=node*4+c; y+=weight*ys[c]*(data[at]-data[base+at]); }
            }
          }
          return 1000*y;
        }));
      }).finally(()=>b.destroy());
      offsets[phase].catch(fail);
    },
    afterDraw(session) {
      if (stageRoomTest.status.phase!=='active') { fail(Error('Room retired during hands trial')); return; }
      const at=phases[frame];
      if(pose) {
        const a=stageRoomTest.status.actor;
        if(a.mode!=='gpu'||a.poseSeconds!==pose.time) {fail(Error('Frozen evaluated pose changed during '+name));return;}
        maxBones=Math.max(maxBones,a.updatedBones);
        if(at) try {
          const state=stageProbe.read();window.stagePaused.verify(state,pose);
          if(!submittedSample || a.bulletSimulatedSteps<=prevNative || !(maxBones>0)) throw Error('No joint writeback/native simulation or submitted cloth for '+at);
          native[at]={simulated:a.bulletSimulatedSteps,maxUpdatedBones:maxBones,time:state.time};prevNative=a.bulletSimulatedSteps;maxBones=0;
          // Copy after the TSL morph pass and draw, with this frame's actual
          // bone palette. For these trials offsets contains *full* world Y.
          offsets[at]=window.stagePaused.displayed(submittedSample).then(rows=>rows.map(ms=>ms.map(p=>p[1]*1000)));offsets[at].catch(fail);
          submittedSample=undefined;
        }catch(e){fail(e);return;}
      }
      if (at) {
        if (!offsets[at]) { fail(Error('Missing rendered cloth sample on '+at)); return; }
        images[at]=session.copyEyes(); images[at].catch(fail);
        grips[at]=stageRoomTest.status.actor.palms;
      }
      if (++frame>400) { cfg.take=null; done(); }
    },
  };
  const timer=setTimeout(()=>fail(Error('Timed out waiting for submitted hand-route frames')),90000);
  const oldX=cfg.headX;
  try { if(route)cfg.headX=route.eyeX;cfg.take=take; await complete; } finally { clearTimeout(timer); cfg.take=null;cfg.headX=oldX; }
  for (const phase of Object.values(phases)) { offsets[phase]=await offsets[phase]; images[phase]=await images[phase]; }
  // Store only in this page while the next real actor is loading. Never put
  // diagnostic skin geometry, readback promises or photos in the stage store.
  (window.stageTakes??={})[name]={eyeY,eyeZ,tracks,images,offsets,grips,native,areas:route?.areas};
};

exports.compare = function compare(saveImages) {
  const takes=window.stageTakes;
  const {eyeY,eyeZ,tracks,areas}=takes.empty;
  function diff(a,b,phase) {
    return [0,1].map(eye=>tracks.map(({spot},side)=>{
      const [x,y,z]=spot, depth=eyeZ-z, ex=eye===0?-.032:.032;
      const [cx,cy,r]=areas?.[eye][side]??[4+(1+(x-ex)*1.1/depth)*116,5+(1-(y-eyeY)*1.1/depth)*115,Math.min(30,.095*1.1/depth*116)];
      const p=takes[a].images[phase][eye], q=takes[b].images[phase][eye];
      let changed=0;
      for (let j=Math.max(0,Math.floor(cy-r));j<Math.min(p.height,cy+r);j++) for (let i=Math.max(0,Math.floor(cx-r));i<Math.min(p.width,cx+r);i++) {
        if ((i-cx)**2+(j-cy)**2>r*r) continue;
        const k=4*(j*p.width+i); if ([0,1,2].some(c=>Math.abs(p.data[k+c]-q.data[k+c])>8)) changed++;
      }
      return changed;
    }));
  }
  const pixels={both:diff('both','empty','hold'),left:diff('left','empty','hold'),right:diff('right','empty','hold'),
    addRight:diff('both','left','hold'),addLeft:diff('both','right','hold'),withdraw:diff('both','empty','withdrawLeft'),
    vsRight:diff('both','right','withdrawLeft'),released:diff('both','empty','release')};
  const lift={}, images={};
  for (const [name,t] of Object.entries(takes)) {
    lift[name]={};
    for (const [phase,patches] of Object.entries(t.offsets)) {
      lift[name][phase]=patches.map((samples,i)=>{
        const d=samples.map((n,j)=>n-takes.empty.offsets[phase][i][j]).sort((a,b)=>a-b); return +d[Math.floor(d.length/2)].toFixed(2);
      });
      if (saveImages && (name==='both'||name==='empty'&&phase==='hold')) t.images[phase].forEach((p,eye)=>{
        const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;canvas.getContext('2d').putImageData(p,0,0);
        images[`${name}-${phase}-${eye?'right':'left'}`]=canvas.toDataURL('image/png').split(',')[1];
      });
    }
  }
  const grips=Object.fromEntries(Object.entries(takes).map(([key,t])=>[key,t.grips]));
  const native=areas && Object.fromEntries(Object.entries(takes).map(([k,t])=>[k,t.native]));
  delete window.stageTakes; return {pixels,lift,grips,images,...(native&&{native})};
};

exports.check = function check({pixels,lift,grips}) {
  for (const [key,want] of Object.entries({empty:['missing','missing'],left:['grip','missing'],right:['missing','grip'],both:['grip','grip']})) {
    assert.deepEqual(grips[key].hold,want,`${key}: not the actual XR grip pair`);
    assert.deepEqual(grips[key].release,['missing','missing']);
  }
  assert.deepEqual(grips.both.withdrawLeft,['missing','grip']);
  for (let i=0;i<2;i++) {
    const own=i?'right':'left',other=i?'left':'right';
    assert(lift[own].hold[i]>18 && lift.both.hold[i]>18 && lift.both.hold[i]-lift[other].hold[i]>10,`No independently supported triangle patch ${i}`);
    assert(Math.abs(lift.both.withdrawLeft[i]-lift.right.withdrawLeft[i])<14,`Patch ${i} did not approach right-only control`);
    assert(Math.abs(lift.both.release[i])<12,`Patch ${i} did not release`);
    for (let eye=0;eye<2;eye++) {
      assert([pixels.both,pixels[own],i?pixels.addRight:pixels.addLeft].every(pair=>pair[eye][i]>10),`No independently visible movement: eye ${eye} patch ${i}`);
      assert(pixels.released[eye][i]<pixels.both[eye][i],`Final eye ${eye} patch ${i} did not relax`);
    }
  }
  assert(lift.both.withdrawLeft[1]>18 && lift.both.withdrawLeft[0]<lift.both.hold[0]-10,'Wrong patch lost support');
  for(let e=0;e<2;e++) assert(pixels.withdraw[e][1]>10,'Right patch disappeared after left withdrawal');
};
