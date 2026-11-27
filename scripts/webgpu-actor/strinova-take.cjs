const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// Capture both real projection-layer slices. Reuse the exact tracked camera
// for every grade, and omit only this actor's draws to locate its visible pixels.
async function portrait({id,label,omit=false,withoutMarks=false}) {
  const {scene,gl}=gameTargets.floorState(), root=scene.children.find(o=>o.userData.mmdModelId===id);
  if(!root)throw Error('No mounted portrait actor');
  const cfg=labFixture, origin=gl.xr.getCamera().parent, heads=cfg.styleViews??={};
  const children=new Set(), weights=new Map();
  root.traverse(o=>{
    children.add(o);
    if(o.material)for(const m of [o.material].flat()){
      const w=m.userData.stageMaterial?.originalDiffuseWeight;if(w&&!weights.has(w))weights.set(w,w.value);
    }
  });
  if(!heads[id]) {
    const joint=name=>[...children].find(o=>o.isBone && [o.name,o.userData.mmdBoneName].includes(name));
    const head=joint('頭'),hip=joint('下半身');if(!head||!hip)throw Error('Portrait take requires head and lower-body joints');
    const at=b=>origin.worldToLocal(b.getWorldPosition(root.position.clone()));
    const l=joint('左目'),r=joint('右目'),eyes=l&&r?at(l).lerp(at(r),.5):at(head);
    const bust=at(head).distanceTo(at(hip));
    heads[id]={x:eyes.x,y:eyes.y-bust*.27,z:eyes.z+bust*.76};
  }
  const {x,y,z}=heads[id],oldX=cfg.headX, prior=gl.getRenderObjectFunction();
  let timer;
  try {
    cfg.headX=x;
    if(omit)gl.setRenderObjectFunction(function(object,...args){if(!children.has(object))return (prior??gl.renderObject).call(gl,object,...args);});
    if(withoutMarks)for(const w of weights.keys())w.value=0;
    const eyes=await new Promise((ok,no)=>{
      let n=0;timer=setTimeout(()=>no(Error('No portrait eye submission')),20000);
      cfg.take={eyeY:y,eyeZ:z,inputs(){this.time=performance.now();},afterDraw(s){if(++n===5)ok(s.copyEyes());}};
    });
    (cfg.stylePortraits??={})[label]=eyes;
  } finally {
    clearTimeout(timer);cfg.take=null;cfg.headX=oldX;gl.setRenderObjectFunction(prior);
    if(withoutMarks)for(const [w,value] of weights)w.value=value;
  }
}

function compare({reference,hidden,a,b}) {
  const p=labFixture.stylePortraits;
  return p[a].map((im,e)=>{
    let pixels=0,changed=0,residual=0;
    const peak=(a,b,k)=>Math.max(Math.abs(a[k]-b[k]),Math.abs(a[k+1]-b[k+1]),Math.abs(a[k+2]-b[k+2]));
    for(let k=0;k<im.data.length;k+=4){
      if(peak(p[reference][e].data,p[hidden][e].data,k)<12)continue;
      const d=peak(im.data,p[b][e].data,k);pixels++;if(d>5)changed++;if(d)residual++;
    }
    return {pixels,changed,residual};
  });
}

module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted,idleRay,placeFromBag,first}) {
  const start=await until('first portrait actor ready',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,120000);
  async function quiet(){await target({name:'watch:quiet'});await idleRay();await frames(3);}
  if(start.physics){
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('held physics for both portraits',s=>s.ready&&!s.physics);await click('hudBack');await quiet();await pickMounted(ids.model);
  }
  await click('hudChangeMotion');await click('hudApplyBody');
  await until('performing real VMD',(s,id)=>s.playing&&s.hasBinding&&s.runtimeId===id&&s.time>.15,start.runtimeId);
  await bButton();await click('settingsMmdVrPause');
  const held=await until('held displayed VMD',s=>s.ready&&!s.playing&&s.time>0&&s.time===s.actor.poseSeconds);
  await quiet();await placeFromBag(first,[1.2,0,-2.1],1,1);
  const cast=await until('two independent actors',(s,name)=>s.ready&&s.live===2&&gameTargets.model(name).selected,first,120000);
  const other=cast.actor.actors.find(a=>a.id!==start.runtimeId)?.id;assert(other);
  await click('hudDone');await quiet();
  async function style(mode,key){
    await pickMounted(ids.model);await click(key);
    await until('selected actor uses '+mode,(s,[id,mode,other])=>s.actor.actors.some(a=>a.id===id&&a.style===mode)&&s.actor.actors.some(a=>a.id===other&&a.style==='mmd'),[start.runtimeId,mode,other],90000);
    await click('hudDone');await quiet();
  }
  const take=(label,id=start.runtimeId,opts={})=>page.evaluate(portrait,{id,label,...opts});
  await take('absent',start.runtimeId,{omit:true});await take('mmd');
  await take('otherAbsent',other,{omit:true});await take('otherMmd',other);
  await style('strinova','actorStyleStrinova');await take('strinova');await take('otherHeld',other);
  if(process.env.STRINOVA_STRAND_MASK)await take('withoutMarks',start.runtimeId,{withoutMarks:true});
  await style('endfield','actorStyleEndfield');await take('endfield');
  await style('strinova','actorStyleStrinova');await take('returned');
  await style('mmd','actorStyleMmd');await take('restored');
  const diff=(a,b,reference='mmd',hidden='absent')=>page.evaluate(compare,{a,b,reference,hidden});
  const result={changed:await diff('mmd','strinova'),distinct:await diff('endfield','strinova'),
    returnStyle:await diff('strinova','returned'),restored:await diff('mmd','restored'),other:await diff('otherMmd','otherHeld','otherMmd','otherAbsent')};
  if(process.env.STRINOVA_STRAND_MASK)result.marked=await diff('strinova','withoutMarks');
  const dir=path.join(__dirname,'../../local-review/screenshots/strinova-stage');await fs.mkdir(dir,{recursive:true});
  const png=await page.evaluate(()=>{
    const p=labFixture.stylePortraits,keys=['mmd','strinova','endfield','restored','otherMmd','otherHeld'];if(p.withoutMarks)keys.push('withoutMarks');
    const c=document.createElement('canvas'),{width:w,height:h}=p.mmd[0];c.width=3*w;c.height=Math.ceil(keys.length/3)*(h+28);
    const ctx=c.getContext('2d');ctx.fillStyle='#232323';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.font='16px sans-serif';
    keys.forEach((k,i)=>{const x=i%3*w,y=Math.floor(i/3)*(h+28);ctx.fillText(k,x+8,y+19);ctx.putImageData(p[k][0],x,y+28);});
    return c.toDataURL('image/png').split(',')[1];
  });
  await fs.writeFile(path.join(dir,'portraits.png'),Buffer.from(png,'base64'));
  assert(result.changed.every(v=>v.changed>250)&&result.distinct.every(v=>v.changed>250),JSON.stringify(result));
  for(const group of [result.returnStyle,result.restored,result.other])assert(group.every(v=>v.pixels>400&&v.residual===0),JSON.stringify(result));
  if(result.marked)assert(result.marked.every(v=>v.changed>5&&v.changed<v.pixels*.15),'UV-mark ablation: '+JSON.stringify(result.marked));
  await until('same held performance after style comparison',(s,t)=>s.time===t&&!s.playing&&s.hasBinding,held.time);
  await bButton();await click('settingsMmdVrPlay');await until('resume performance',(s,t)=>s.playing&&s.hasBinding&&s.time>t+.06,held.time);
  await style('strinova','actorStyleStrinova');
  const running=await until('switched in motion',(s,p)=>s.runtimeId===p.id&&s.playing&&s.hasBinding&&s.time>p.time+.12,{id:start.runtimeId,time:held.time});
  const gpu=await page.evaluate(()=>labFixture.adapters);assert(gpu.some(a=>a.xrCompatible)&&gpu.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software|llvmpipe/i.test(JSON.stringify(a))));
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('room retired',s=>s.phase==='ended'&&!s.live);
  return {...result,held:held.time,resumed:running.time};
};
