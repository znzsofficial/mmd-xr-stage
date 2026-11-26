// Playwright serialization. Original group/triangle identity is checked once;
// readback is test-only, on the same frame as the displayed textured panels.
exports.install=function install(sites){
  const captured=new WeakMap();
  function captureBind(mesh){
    const g=mesh.geometry, original=g.attributes.position;
    for(const {marks,mat,bind} of sites){const face=marks[0].face;
      if(!marks.every(mark=>Number.isInteger(mark.face)&&mark.face%3===0&&mark.w.length===3&&Math.abs(mark.w.reduce((a,b)=>a+b,0)-1)<1e-5&&g.groups.some(gr=>gr.materialIndex===mat&&mark.face>=gr.start&&mark.face+2<gr.start+gr.count)))throw Error('Unknown authored cloth group');
      for(let j=0;j<3;j++)if(mesh.position.clone().fromBufferAttribute(original,g.index.getX(face+j)).distanceTo(mesh.position.clone().fromArray(bind[j]))>1e-5)throw Error('Plan does not describe this PMX triangle');
    }
    captured.set(mesh,original);
  }
  function displayed({device,renderer,mesh,rig,points,goals}){
    const g=mesh.geometry,pos=g.attributes.position,ix=g.index,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,original=captured.get(mesh);
    const gpuPos=pos!==original && renderer.backend.has(pos) && renderer.backend.get(pos).buffer;
    if(!original || (pos!==original && !gpuPos))throw Error('Cannot read the actual morphed surface positions');
    const stride=gpuPos&&gpuPos.size/pos.count/4;
    if(gpuPos && stride!==3 && stride!==4)throw Error('Unsupported morph buffer stride');
    const wm=mesh.matrixWorld.clone(),out=wm.clone().multiply(mesh.bindMatrixInverse),palette=new Map();
    const groups=sites.map(s=>s.marks.map(({face,w})=>w.map((weight,k)=>{
      const v=ix.getX(face+k),skin=[];
      for(let j=0;j<4;j++){const b=si.getComponent(v,j),k=sw.getComponent(v,j);if(k<=0)continue;
        if(!palette.has(b))palette.set(b,out.clone().multiply(mesh.skeleton.bones[b].matrixWorld).multiply(mesh.skeleton.boneInverses[b]).multiply(mesh.bindMatrix));
        skin.push([palette.get(b),rig.byBone.get(b),k]);
      }return {v,weight,skin};
    })));
    const n=points.size,b=device.createBuffer({size:n*2+(gpuPos?.size||0),usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),enc=device.createCommandEncoder();
    enc.copyBufferToBuffer(points,0,b,0,n);enc.copyBufferToBuffer(goals,0,b,n,n);if(gpuPos)enc.copyBufferToBuffer(gpuPos,0,b,n*2,gpuPos.size);device.queue.submit([enc.finish()]);
    return b.mapAsync(GPUMapMode.READ).then(()=>{const data=new Float32Array(b.getMappedRange());
      return groups.map(marks=>marks.map(corners=>{
        const pt=mesh.position.clone().setScalar(0),off=pt.clone();
        for(const {v,weight,skin} of corners){const bind=pt.clone();if(gpuPos)bind.fromArray(data,n/2+v*stride);else bind.fromBufferAttribute(original,v);
          for(const [matrix,i,k] of skin){pt.addScaledVector(bind.clone().applyMatrix4(matrix),weight*k);
            if(i!==undefined)for(let j=0;j<3;j++){const idx=i*4+j;off.setComponent(j,off.getComponent(j)+weight*k*(data[idx]-data[idx+n/4])/rig.scale);}
          }
        }return pt.add(off.applyMatrix4(wm).sub(mesh.position.clone().setFromMatrixPosition(wm))).toArray();
      }));
    }).finally(()=>b.destroy());
  }
  function verify(s,pose){if(!s.selected||s.runtimeId!==pose.id||s.playing||!s.hasBinding||s.time!==pose.time||s.actor.poseSeconds!==pose.time)throw Error('The selected actor or its reference VMD frame changed');}
  window.stagePaused={verify,captureBind,displayed};
};

exports.register=async function register({sites,pose}){
  const cfg=window.labFixture,s=stageProbe.read();stagePaused.verify(s,pose);
  let frames=0,latest,clock=performance.now(),finish,fail;
  const complete=new Promise((yes,no)=>{finish=yes;fail=no;});
  const take={time:clock,eyeY:1,eyeZ:0,inputs(f){this.time=clock+=1000/72;f.getPose=()=>null;},
    measure(device,mesh,rig,points,goals,renderer){latest={device,mesh,rig,points,goals,renderer};},afterDraw(){
      if(++frames<160||!latest)return;
      cfg.take=null;stagePaused.displayed(latest).then(finish,fail);
    }};
  const timer=setTimeout(()=>fail(Error('No empty-pose cloth calibration')),15000);
  let points;try{cfg.take=take;points=await complete;}finally{clearTimeout(timer);cfg.take=null;}
  const tracks=sites.map(({spot,start,end,radial},i)=>{const actual=points[i][0];
    const shifted=p=>p.map((n,j)=>actual[j]+(n-spot[j])*s.scale/.1);
    return {spot:actual,start:shifted(start),end:shifted(end),away:shifted(start.map((v,i)=>v+.16*radial[i]))};});
  const [a,b]=tracks.map(t=>t.spot);const eyeX=(a[0]+b[0])/2,eyeY=(a[1]+b[1])/2-.025,eyeZ=Math.max(a[2],b[2])+.62;
  const areas=[-.032,.032].map(dx=>tracks.map(({spot:[x,y,z]})=>{const depth=eyeZ-z;return [4+(1+(x-eyeX-dx)*1.1/depth)*116,5+(1-(y-eyeY)*1.1/depth)*115,Math.min(30,.095*1.1/depth*116)];}));
  for(const [a,b] of areas)if(Math.hypot(a[0]-b[0],a[1]-b[1])<=a[2]+b[2])throw Error('Posed cloth patches overlap in the selected camera');
  stagePaused.route={tracks,eyeX,areas};
};
