// Capture the finished XR projection, not a second offscreen render. Hold the
// animation clock across all samples so wave motion cannot fake parallax.
async function captureHarbour(){
  const s=window.labSession,cfg=window.labFixture,yaw=Math.atan2(-4.4,10.79);
  const poses=[[2.25,yaw],[2.75,yaw],[2.25,yaw+.0015],[2.25,yaw]];
  const [a,step,turn,back]=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cfg.take=null;cfg.headX=0;reject(Error('Missing tracked harbour draw'));},8000);
    const reads=[];let remaining=4;cfg.headX=poses[0][0];
    cfg.take={time:performance.now(),eyeY:1.1,eyeZ:-17.21,eyeYaw:yaw,eyePitch:Math.atan2(1,Math.hypot(4.4,10.79)),inputs(){},
      afterDraw(){if(--remaining)return;reads.push(s.copyEyes());remaining=3;
        if(reads.length===poses.length){cfg.take=null;cfg.headX=0;clearTimeout(timer);Promise.all(reads).then(resolve,reject);}
        else [cfg.headX,this.eyeYaw]=poses[reads.length];
      }};
  });
  function delta(x,y,lo,hi){let sum=0,changed=0,n=0;
    for(let row=Math.ceil(x.height*lo);row<Math.floor(x.height*hi);row++)for(let col=12;col<x.width-12;col++){
      const i=(row*x.width+col)*4,peak=Math.max(...[0,1,2].map(k=>Math.abs(x.data[i+k]-y.data[i+k])));
      sum+=peak;n++;if(peak>4)changed++;
    }return {mean:sum/n,changed};
  }
  function png(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(im,0,0);return c.toDataURL().split(',')[1];}
  return {images:[...a,...step].map(png),stats:a.map((im,i)=>({skyWalk:delta(im,step[i],.07,.31),seaWalk:delta(im,step[i],.68,.89),skyTurn:delta(im,turn[i],.07,.31),seaTurn:delta(im,turn[i],.68,.89),skyReturn:delta(im,back[i],.07,.31),seaReturn:delta(im,back[i],.68,.89)}))};
}
// Read the final color-converted projection at human eye height, rather than
// relying on a correctly shaped basin or a nonzero shader clock.
async function capturePark(){
  const cfg=window.labFixture;
  async function photo(eye,at,frames){
    const dx=eye[0]-at[0],dz=eye[2]-at[2];cfg.headX=eye[0];
    return new Promise((done,fail)=>{
      const timer=setTimeout(()=>{cfg.take=null;fail(Error('Park projection timed out'));},15000);
      cfg.take={eyeY:eye[1],eyeZ:eye[2],eyeYaw:Math.atan2(dx,dz),eyePitch:Math.atan2(at[1]-eye[1],Math.hypot(dx,dz)),
        inputs(){this.time=performance.now();},afterDraw(s){if(--frames)return;cfg.take=null;clearTimeout(timer);s.copyEyes().then(done,fail);}};
    });
  }
  function diff(a,b,x0,y0,x1,y1){let changed=0;
    for(let y=Math.floor(a.height*y0);y<a.height*y1;y++)for(let x=Math.floor(a.width*x0);x<a.width*x1;x++){
      const k=4*(y*a.width+x);if([0,1,2].some(c=>Math.abs(a.data[k+c]-b.data[k+c])>5))changed++;
    }return changed;
  }
  const overviewEye=[-.9,1.6,17],overviewAt=[4,1,24],rimEye=[3.1,1.43,19.8],waterAt=[4,.37,23];
  try{
    const overview=await photo(overviewEye,overviewAt,12),near=await photo(rimEye,waterAt,6),later=await photo(rimEye,waterAt,23);
    const png=im=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').putImageData(im,0,0);return c.toDataURL().split(',')[1];};
    return {motion:near.map((eye,i)=>diff(eye,later[i],.32,.43,.68,.65)),parallax:diff(overview[0],overview[1],.08,.17,.92,.92),
      images:[...overview,near[0]].map(png)};
  }finally{cfg.headX=0;cfg.take=null;}
}
module.exports={captureHarbour,capturePark};
