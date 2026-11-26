// Optional actor-specific replay for xr-room-smoke. Reuse two *actual skirt*
// contact sites from the lab fixture's plan, not its rendering pipeline.
// Observe the final eye colors AND independent, barycentric skin samples. The
// smoke runner injects the optional buffer copy; no readback in the room itself.
module.exports = async function verifyHands({sites}) {
  const cfg=window.labFixture, st=window.xrRoom, session=window.labSession;
  const factor=st.status.actorScale/.1, actorZ=-1.85;
  const toWorld=p=>({x:p[0]*factor,y:p[1]*factor,z:p[2]*factor+actorZ});
  const tracks=sites.map(s=>({start:toWorld(s.start),end:toWorld(s.end),away:toWorld(s.start.map((n,i)=>n+.16*s.radial[i])),spot:toWorld(s.spot)}));
  const eyeY=(tracks[0].spot.y+tracks[1].spot.y)/2-.025,eyeZ=Math.max(tracks[0].spot.z,tracks[1].spot.z)+.62;
  const trials=['empty','left','right','both'];const captures={},heights={};let frame=-170,trial=0,t=performance.now(),finish,fail;
  const complete=new Promise((r,j)=>{finish=r;fail=j;});
  const x=session.inputSources.find(s=>s.handedness==='left').gamepad.buttons[4];
  const mix=(a,b,u)=>{u=Math.max(0,Math.min(1,u));u=u*u*(3-2*u);return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};};
  const phases={112:'hold',184:'withdrawLeft',400:'release'};
  const take={eyeY,eyeZ,time:t,inputs(f){
    // Reset to the authored pose via the room's real X button, then let the
    // same empty motor settle before each route at an identical 72Hz clock.
    x.pressed=frame===-165 || frame===-161;
    t+=1000/72;take.time=t;
    const name=trials[trial];f.getPose=space=>{const i=space.handedness==='left'?0:1,side=i?'right':'left',h=tracks[i],release=i?200:128;
      if(frame<0||!(name===side||name==='both')||frame>=release+24)return null;
      const pos=frame<release?mix(h.start,h.end,(frame-12)/72):mix(h.end,h.away,(frame-release)/24);
      return {transform:{position:pos}};
    };
  },measure(device,mesh,rig,{points,goals}){
    const key=phases[frame];if(!key)return;
    // Test-only copy on this XR frame. The four trials use the same held pose:
    // base skin cancels per barycentric mark. Use original material triangle
    // indices + all four corner weights, not raw node/hand heights.
    const g=mesh.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,mat=mesh.matrixWorld.elements;
    const ys=[mat[1],mat[5],mat[9]].map(n=>n/rig.scale);
    const size=points.size,buf=device.createBuffer({size:size*2,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const enc=device.createCommandEncoder();enc.copyBufferToBuffer(points,0,buf,0,size);enc.copyBufferToBuffer(goals,0,buf,size,size);device.queue.submit([enc.finish()]);
    (heights[trials[trial]]??={})[key]=buf.mapAsync(GPUMapMode.READ).then(()=>{
      const a=new Float32Array(buf.getMappedRange()),base=size/4;
      return sites.map(s=>s.marks.map(({face,w})=>{
        if(!g.groups.some(gr=>gr.materialIndex===s.mat&&face>=gr.start&&face+2<gr.start+gr.count))throw Error('Wrong PMX material or triangle in hand plan');
        let y=0;for(let k=0;k<3;k++){const id=g.index.getX(face+k);for(let j=0;j<4;j++){
          const node=rig.byBone.get(si.getComponent(id,j));if(node===undefined)continue;
          for(let c=0;c<3;c++){const off=node*4+c;y+=w[k]*sw.getComponent(id,j)*ys[c]*(a[off]-a[base+off]);}
        }}return 1000*y;
      }));
    }).finally(()=>buf.destroy());
  },afterDraw(s){
    if(st.status.clothError||st.status.error){cfg.take=null;fail(Error(st.status.clothError||st.status.error));return;}
    const key=phases[frame];
    if(key)(captures[trials[trial]]??={})[key]=s.copyEyes();
    if(++frame>402){frame=-170;if(++trial===trials.length){cfg.take=null;x.pressed=false;finish();}}
  }};
  const timeout=setTimeout(()=>{cfg.take=null;fail(Error('Two-hand route did not finish'));},90000);
  try {cfg.take=take;await complete;} finally {clearTimeout(timeout);cfg.take=null;x.pressed=false;}
  for(const name of trials)for(const k of Object.keys(captures[name])){captures[name][k]=await captures[name][k];heights[name][k]=await heights[name][k];}
  const lift={};for(const name of trials){lift[name]={};for(const k of Object.values(phases))lift[name][k]=heights[name][k].map((v,i)=>{
    const delta=v.map((y,j)=>y-heights.empty[k][i][j]).sort((a,b)=>a-b);return +delta[Math.floor(delta.length/2)].toFixed(2);
  });}
  const patch=(a,b,i,eye)=>{
    // The shim projection is 1.1 * XY / -Z with a positive-height viewport.
    // Restrict the mask to each original textured front patch; no hand mesh is
    // rendered by this room. Do not count a change in the other eye or patch.
    const s=tracks[i].spot,z=eyeZ-s.z,ex=eye===0?-.032:.032;
    const cx=4+(1+(s.x-ex)*1.1/z)*116,cy=5+(1-(s.y-eyeY)*1.1/z)*115;
    const radius=Math.min(30,.095*1.1/z*116);let changed=0,total=0,peak=0;
    for(let y=Math.max(0,Math.floor(cy-radius));y<Math.min(a.height,cy+radius);y++)for(let x=Math.max(0,Math.floor(cx-radius));x<Math.min(a.width,cx+radius);x++){
      if((x-cx)**2+(y-cy)**2>radius*radius)continue;const k=(y*a.width+x)*4;
      const d=Math.max(...[0,1,2].map(j=>Math.abs(a.data[k+j]-b.data[k+j])));peak=Math.max(peak,d);changed+=d>8;total++;
    }return {changed,total,peak};
  };
  const diff=(a,b,phase)=>[0,1].map(eye=>[0,1].map(i=>patch(captures[a][phase][eye],captures[b][phase][eye],i,eye)));
  const evidence={bothVsEmpty:diff('both','empty','hold'),leftVsEmpty:diff('left','empty','hold'),rightVsEmpty:diff('right','empty','hold'),
    bothVsLeft:diff('both','left','hold'),bothVsRight:diff('both','right','hold'),withdrawVsRight:diff('both','right','withdrawLeft'),withdrawVsEmpty:diff('both','empty','withdrawLeft'),released:diff('both','empty','release')};
  const images={};for(const [n,phase] of [['empty','hold'],['both','hold'],['both','withdrawLeft'],['both','release']]){const data=captures[n][phase][0],c=document.createElement('canvas');c.width=data.width;c.height=data.height;c.getContext('2d').putImageData(data,0,0);images[n+'-'+phase]=c.toDataURL();}
  return {evidence,images,lift};
};
