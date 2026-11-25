// On the built lab with ?probe=1, pick mixedMaskPmx() as the model and run
// await page.evaluate(checkMixedMaskGpu). This explicit readback uses the real
// predict/constrain/sample/gather pipelines, independent of the thigh fitter.
export async function checkMixedMaskGpu(){
  const q=globalThis.clothProbe(),a=q.actor,g=a.gpu,ok=(v,msg)=>{if(!v)throw Error(msg);};
  q.halt();try{
    const mobile=a.rig.nodes.flatMap((n,i)=>n.pin?[]:[i]);ok(mobile.length===4&&a.rig.capsules.length===62,'wrong test rig');
    const hands=a.hands.map(h=>h.clone().set(0,-100,0));
    // An inward -X display step should stop on the sphere for hem A, but go
    // through that same sphere for C and D. All four triangles are sampled.
    const data=new Float32Array(8*4);for(let i=0;i<8;i++)data[i*4]=-.01;
    ok(await g.prepareFaces({data,dims:[2,2,2],base:[-1,0,-1],cell:2})&&g.faceCount===4,'missing test faces');
    async function step(seed,faces){g.update(hands,true);const enc=q.device.createCommandEncoder();g.solve(enc,1,seed,undefined,faces);q.device.queue.submit([enc.finish()]);}
    let reference,fineCounts;
    for(const cull of [false,true]){
      await g.countTests(cull);const trajectory=[];
      for(let frame=0;frame<4;frame++){
        await step(frame===0,true);const raw=await g.raw(),shown=await g.sample();trajectory.push(...raw,...shown);
        if(frame===0){const [A,B,C,D]=mobile.map(i=>i*4);
          ok(raw[A]>.025&&raw[B+2]<-.025,'allowed sphere/capsule failed to eject hems A/B');
          ok([C,D].every(i=>Math.abs(raw[i])+Math.abs(raw[i+2])<1e-6),'one-way body contact in node solve');
          ok(Math.abs(shown[A]-raw[A])<.001&&[C,D].every(i=>shown[i]-raw[i]<-.0035),'face gather ignored per-node body permissions');
          const checks=Array.from(await g.checks());if(!cull){fineCounts=mobile.map(i=>checks[i]);ok(String(fineCounts)==='165,165,10,10','wrong full-scan narrowphase counts');}
          else ok(mobile.every((i,k)=>checks[i]<fineCounts[k]),'broadphase failed to skip far contacts');
        }
      }
      if(reference)ok(trajectory.every((v,i)=>v===reference[i]),'full scan and broadphase differ');else reference=trajectory;
    }
    for(const hand of hands){hand.set(-.02,.8,0);await step(true,false);const raw=await g.raw();
      ok(mobile.slice(2).every(i=>raw[4*i]>.025),'hand contact was gated by a PMX mask');hand.set(0,-100,0);}
    // Project A into the *next* PMX body. A stale broadphase box result
    // (computed at its starting foot) would miss that second projection.
    const first=a.rig.capsules[0],sphere=a.rig.capsules[60],next=a.rig.capsules[4],sa=next.a.clone(),sb=next.b.clone(),sr=next.r;
    a.rig.capsules[0]=sphere;a.rig.capsules[60]=first; // Both slots admit A only.
    try{const p=a.rig.nodes[mobile[0]].rest.clone();p.x+=.033;p.multiplyScalar(1/a.rig.scale).applyMatrix4(next.bone.matrixWorld.clone().invert());
      next.a.copy(p);next.b.copy(p);next.r=.018;let baseline;
      for(const cull of [false,true]){await g.countTests(cull);await step(true,false);const raw=await g.raw();
        const x=raw[4*mobile[0]];ok(x>.014&&x<.021,'missed projection into a later collider');
        if(baseline)ok(raw.every((x,i)=>x===baseline[i]),'order-dependent projection differs');else baseline=raw;}
    }finally{a.rig.capsules[0]=first;a.rig.capsules[60]=sphere;next.a.copy(sa);next.b.copy(sb);next.r=sr;}
    return {mobileNodes:mobile.length,fullScanChecks:fineCounts,faceSamples:g.faceCount};
  }finally{await g.countTests(null);a.reset();q.screen(performance.now());}
}
