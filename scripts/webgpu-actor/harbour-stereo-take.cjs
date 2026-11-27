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
module.exports={captureHarbour};
