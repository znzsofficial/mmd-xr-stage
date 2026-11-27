const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

async function prepare(id){
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {wandTakeSite}=await import('/scripts/webgpu-actor/wandTakeSite.js');
  const {authoredSurface}=await import('/src/mmdVrShowcase/play/authoredSurface.ts');
  const {siliconeCap}=await import('/src/mmdVrShowcase/play/wandHead.ts');
  const {scene,gl}=gameTargets.floorState(),origin=gl.xr.getCamera().parent;
  const runtimeId=useBackpack.getState().live[id].runtimeId;
  let mesh;scene.traverse(o=>{if(o.userData.mmdModelId===runtimeId&&authoredSurface.has(o))mesh=o;});
  const {site,eye}=wandTakeSite(mesh,authoredSurface.get(mesh),true);
  const local=p=>origin.worldToLocal(p.clone()),face=local(eye),hip=local(site);
  const rod=()=>scene.getObjectByName('play:piece:dildo');
  let raw,normal,gripOffset;
  function bindRod(){const m=rod();raw=m.geometry.attributes.position.array.slice();normal=m.geometry.attributes.normal.array.slice();
    gripOffset=m.parent.worldToLocal(m.localToWorld(siliconeCap.center.clone()));}
  function move(close){const p=hip.clone().sub(gripOffset);p.z+=close ? .006 : .30;p.y-=.005;
    const pose={position:{x:p.x,y:p.y,z:p.z},orientation:{x:0,y:0,z:0,w:1}};
    labSession.setControllerPose('left',pose,pose);}
  function travel(){let max=0;const a=rod().geometry.attributes.position.array;
    for(let j=0;j<a.length;j+=3)max=Math.max(max,Math.hypot(a[j]-raw[j],a[j+1]-raw[j+1],a[j+2]-raw[j+2]));return max;}
  const state=()=>usePelvic.getState(),profile=()=>state().byAsset[id];
  const names=state().support[id].responseMorphs,choice=names.find(n=>/^(まばたき|瞬き|眨眼|blink|eyesclosed)$/i.test(n))??names[0];
  if(!choice)throw Error('Take needs a drawable face channel');
  const slot=mesh.morphTargetDictionary[choice],base=mesh.morphTargetInfluences[slot],images={};
  function read(){return {inside:!!state().sample?.outletInside,choice:profile()?.responseMorph,weight:mesh.morphTargetInfluences[slot],
    drops:scene.getObjectByName('play:liquid-spray')?.count??0,fluid:profile()?.fluid,running:state().active?.running};}
  // Same eye and held prop for both rod images. In the control draw remove
  // just the measured dimple, after the product's normal contact pass.
  function capture(tag,cap=false,control=false){const cfg=labFixture,c=cap?hip:face,x=cap ? .16 : 0,z=cap ? .08 : .30;
    if(cfg.take)throw Error('Overlapping capture');const before=cfg.headX;cfg.headX=c.x+x;
    let apply=false,previous=scene.onBeforeRender,savedPosition,savedNormal;
    const geometry=cap&&rod().geometry;
    function set(p,n){const a=geometry.attributes;a.position.array.set(p);a.normal.array.set(n);a.position.needsUpdate=a.normal.needsUpdate=true;}
    if(control)scene.onBeforeRender=function(...args){previous.apply(this,args);if(!apply||savedPosition)return;
      savedPosition=geometry.attributes.position.array.slice();savedNormal=geometry.attributes.normal.array.slice();set(raw,normal);};
    return new Promise((resolve,reject)=>{
      const end=()=>{cfg.take=null;cfg.headX=before;clearTimeout(timer);if(control)scene.onBeforeRender=previous;if(savedPosition)set(savedPosition,savedNormal);};
      const timer=setTimeout(()=>{end();reject(Error('No submitted contact frame'));},15000);let frames=0;
      cfg.take={eyeY:c.y-(cap ? .07 : 0),eyeZ:c.z+z,eyeYaw:Math.atan2(x,z),eyePitch:cap ? .42 : 0,inputs(){this.time=performance.now();apply=frames>=2;},afterDraw(s){
        if(++frames<3)return;try{const pair=s.copyEyes();end();pair.then(im=>{images[tag]=im;resolve(read());},reject);}catch(e){end();reject(e);}}};
    });}
  function difference(a,b){return images[a].map((im,i)=>{const other=images[b][i];let n=0;
    for(let y=Math.floor(im.height*.27);y<im.height*.73;y++)for(let x=Math.floor(im.width*.18);x<im.width*.82;x++){
      const p=4*(y*im.width+x);if([0,1,2].some(k=>Math.abs(im.data[p+k]-other.data[p+k])>6))n++;}return n;});}
  function sheet(...tags){const c=document.createElement('canvas'),{width,height}=images[tags[0]][0];c.width=2*width;c.height=tags.length*height;
    tags.forEach((tag,y)=>images[tag].forEach((im,x)=>c.getContext('2d').putImageData(im,x*width,y*height)));return c.toDataURL().split(',')[1];}
  window.contactTake={move,bindRod,travel,capture,difference,read,sheet};return {choice,at:names.indexOf(choice),base};
}

module.exports=async function({page,ids,bButton,click,until,target,pickMounted,aim,trigger,frames,idleRay}){
  const press=async text=>{await aim(await target({name:'hud:'+text}));await trigger(true);await trigger(false);};
  const actor=await until('ready for contact take',s=>s.selected&&s.ready&&s.actor?.evaluations>0);
  if(actor.physics){await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('same actor at rest without cloth motion',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);}
  if(actor.playing){await bButton();await click('settingsMmdVrPause');await target({name:'watch:quiet'});await pickMounted(ids.model);}
  await click('actorInsert');await press('手动支架');await press('保持穿衣继续');
  // The overlay draws over the face even with a close headset. Drag the real
  // title away; otherwise measuring Stop changing colour can pass for a blink.
  const drag=await page.evaluate(()=>{const scene=gameTargets.floorState().scene,handle=scene.getObjectByName('actor:move-sheet');
    const sign=Math.sign(scene.getObjectByName('backpack-world-tools').position.x)||1;
    return [handle.getWorldPosition(handle.position.clone()).toArray(),handle.localToWorld(handle.position.clone().set(sign*1.15,0,0)).toArray()];});
  await aim(drag[0]);await trigger(true);await aim(drag[1]);await trigger(false);
  await press('更多操作');
  const choice=await page.evaluate(prepare,ids.model),picture=(tag,cap=false,control=false)=>page.evaluate(args=>contactTake.capture(...args),[tag,cap,control]);
  const diff=(a,b)=>page.evaluate(([a,b])=>contactTake.difference(a,b),[a,b]);
  const dir=path.resolve('local-review/screenshots/pose-and-contact');await fs.mkdir(dir,{recursive:true});
  const save=async(name,...tags)=>fs.writeFile(path.join(dir,name),Buffer.from(await page.evaluate(tags=>contactTake.sheet(...tags),tags),'base64'));
  try{
    await press('换回应：自动');for(let i=0;i<choice.at;i++)await press('换回应：'+(await page.evaluate(()=>contactTake.read().choice)));
    assert.equal(await page.evaluate(()=>contactTake.read().choice),choice.choice);await press('返回操作');
    await picture('baseline');await press('推进');await until('verified inside with selected expression',()=>contactTake.read().inside&&contactTake.read().weight>0);
    const inside=await picture('responding');assert(inside.inside&&inside.weight>choice.base+.01);
    await press('更多操作');await press('关闭回应');await press('返回操作');
    const off=await picture('off');assert(off.choice===null&&off.inside&&off.weight===choice.base);
    const face=await diff('baseline','responding'),residual=await diff('baseline','off');
    await save('response-stereo.png','baseline','responding','off');
    assert(face.every((n,i)=>n>15&&residual[i]<n*.1),JSON.stringify({face,residual}));
    await press('更多操作');await press('启用角色回应');await press('返回操作');await frames(4);
    assert.equal((await page.evaluate(()=>contactTake.read())).weight,choice.base,'Enabling while inside replayed the crossing');
    await press('停止');await press('退回起点');await press('收起假阳具');
    await press('交给左手');await press('开始手持并收起面板');await target({name:'watch:quiet'});await idleRay();
    await page.evaluate(()=>{contactTake.bindRod();contactTake.move(false);});await frames(6);assert.equal(await page.evaluate(()=>contactTake.travel()),0);
    await page.evaluate(()=>contactTake.move(true));await until('crown touches the drawn hem',()=>contactTake.travel()>.00015,null,60000);
    const travel=await page.evaluate(()=>contactTake.travel());await picture('dimple',true);await picture('manufactured',true,true);
    const cap=await diff('dimple','manufactured');await save('rod-tip-stereo.png','dimple','manufactured');assert(cap.every(x=>x>3),JSON.stringify({cap,travel}));
    await page.evaluate(()=>contactTake.move(false));await frames(5);assert.equal(await page.evaluate(()=>contactTake.travel()),0);
    const after=await page.evaluate(()=>contactTake.read());assert.deepEqual(after.fluid,inside.fluid);assert(!after.inside&&!after.drops);
    await pickMounted(ids.model);await click('actorInsert');await press('收起假阳具');await press('返回角色');
    return {face,residual,cap,capMm:travel*1000};
  }finally{await page.evaluate(()=>{delete window.contactTake;});}
};
