const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// Device input only, observations from the actual fiber root, body store and
// submitted eye layers. Nothing below creates a port, debits or emits a drop.
async function observeMilk(id){
  const {useBodyState,fromMilkInteraction}=await import('/src/mmdVrShowcase/bodyState/store.ts');
  const {useMilkInteraction}=await import('/src/mmdVrShowcase/bodyState/lactation/interaction.ts');
  const state=gameTargets.floorState();
  const {scene,gl}=state, figure='body:breast-observation',drops='body:milk-droplets';
  let drawFrames=0,masked=null,wasVisible=false;
  const debits={left:0,right:0}, prior=scene.onBeforeRender;
  const unsub=useBodyState.subscribe((s,p)=>{
    const a=p.byAsset[id],b=s.byAsset[id];if(!a||a===b||!b||!fromMilkInteraction(b))return;
    for(const side of ['left','right'])debits[side]+=a[side]-b[side];
  });
  scene.onBeforeRender=function(...args){
    prior.apply(this,args);
    const d=scene.getObjectByName(drops);if(d?.count&&d.visible)drawFrames++;
    if(masked)masked.visible=false;
  };
  function read(){
    const interaction=useMilkInteraction.getState(),d=scene.getObjectByName(drops),art=scene.getObjectByName(figure);
    return {hold:interaction.hold?.mode,panel:!!interaction.panel,read:interaction.reading&&[interaction.reading.left,interaction.reading.right],
      left:useBodyState.getState().byAsset[id]?.left,right:useBodyState.getState().byAsset[id]?.right,debits:{...debits},drawFrames,
      drops:d?.visible?d.count:0,art:art?.material.map?.image?.dataset.view==='breast'};
  }
  function capture(kind){
    const art=kind==='figure',name=art?figure:drops;
    const cfg=window.labFixture;if(cfg.take)throw Error('Another eye take is active');
    // Same tracked camera and simulation time for the submitted image and its
    // control, hiding ONLY the observed mesh at draw time on the second frame.
    return new Promise((resolve,reject)=>{
      let pass=0,images,regions,worldX;
      const finish=()=>{cfg.take=null;if(masked){masked.visible=wasVisible;masked=null;}clearTimeout(timer);};
      const timer=setTimeout(()=>{finish();reject(Error('No XR submission for '+kind));},15000);
      cfg.take={eyeY:art?1.45:1.31,eyeZ:art?0:-1.02,time:performance.now(),inputs(){},afterDraw(s){
        try{
          const mesh=scene.getObjectByName(name);
          if(!pass){
            if(!mesh?.visible||(!art&&!mesh.count))throw Error('No displayed '+kind);
            const matrices=[];
            if(art)matrices.push(mesh.matrixWorld);else for(let i=0;i<mesh.count;i++){
              const m=mesh.matrix.clone();mesh.getMatrixAt(i,m);matrices.push(m.premultiply(mesh.matrixWorld));
            }
            worldX=matrices.map(m=>m.elements[12]);
            mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
            regions=gl.xr.getCamera().cameras.map(cam=>{
              const points=[];
              for(const m of matrices)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
                const p=mesh.position.clone().set(x,y,z).applyMatrix4(m).project(cam);points.push([(1+p.x)/2,(1-p.y)/2]);
              }
              return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
            });
            images=s.copyEyes();masked=mesh;wasVisible=mesh.visible;pass++;return;
          }
          const control=s.copyEyes();finish();
          Promise.all([images,control]).then(([actual,blank])=>{
            const eyes=actual.map((im,i)=>{
              const {width:w,height:h,data}=im,r=regions[i];let pixels=0,ink=0;
              for(let y=Math.max(0,Math.floor(r[1]*h)-8);y<Math.min(h,Math.ceil(r[3]*h)+8);y++)for(let x=Math.max(0,Math.floor(r[0]*w)-8);x<Math.min(w,Math.ceil(r[2]*w)+8);x++){
                const k=(y*w+x)*4;
                if(![0,1,2].some(c=>Math.abs(data[k+c]-blank[i].data[k+c])>10))continue;
                pixels++;if(data[k]>120&&data[k]-data[k+2]>30&&data[k+1]>.4*data[k])ink++;
              }
              return {pixels,ink};
            });
            const c=document.createElement('canvas');c.width=actual[0].width*2;c.height=actual[0].height;
            const ctx=c.getContext('2d');actual.forEach((im,i)=>ctx.putImageData(im,i*im.width,0));
            resolve({eyes,worldX,png:c.toDataURL('image/png').split(',')[1]});
          }).catch(reject);
        }catch(e){finish();reject(e);}
      }};
    });
  }
  window.milkTake={read,capture,dispose(){unsub();scene.onBeforeRender=prior;}};
}

module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,exposed}){
  const actor=await until('selected private actor',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,120000);
  // Take the garment control and both pixel pairs at one still pose. This is
  // also the player recovery for garments with GPU-only vertex displacement.
  if(actor.physics){
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('still actor',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');
    await target({name:'watch:quiet'});await pickMounted(ids.model);
  }
  await page.evaluate(observeMilk,ids.model);
  const read=()=>page.evaluate(()=>milkTake.read());
  const wait=async(fn,arg)=>{await (await page.waitForFunction(fn,arg,{timeout:30000})).dispose();};
  const press=async label=>{await aim(await target({name:'hud:'+label}));await trigger(true);await trigger(false);};
  const take=async(name,label)=>{
    const {png,...result}=await page.evaluate(n=>milkTake.capture(n),name);
    const dir=path.join(__dirname,'../../local-review/screenshots/floor-milk');await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,`${exposed?'exposed':'covered'}-${label}.png`),Buffer.from(png,'base64'));
    return result;
  };
  await click('actorMilk');await press('开启泌乳');await wait(()=>milkTake.read().art);
  const expected=exposed?'confirm':'blocked';await wait(k=>milkTake.read().read?.every(s=>s===k),expected);
  const figure=await take('figure','panel');assert(figure.eyes.every(e=>e.ink>80),'Missing breast illustration in an eye: '+JSON.stringify(figure.eyes));
  const beforeNavigation=await read();
  await press('看乳房');await target({name:'hud:定格图像'});await click('backToMilk');
  await press('服装');await target({name:'wardrobe-hud'});await click('backToMilk');
  await wait(()=>milkTake.read().art && !!milkTake.read().read);
  assert.deepEqual((await read()).debits,beforeNavigation.debits);
  const receipts={};
  for(const [side,label,other] of [['left','左侧','right'],['right','右侧','left']]){
    await press('确认露出');await press(label+' · 确认裸露');await press('返回泌乳');
    const expected=exposed?'ready':'blocked';await wait(([i,k])=>milkTake.read().read?.[i]===k,[side==='left'?0:1,expected]);
    if(exposed&&side==='left')assert.equal((await read()).read[1],'confirm');
    const before=await read();await aim(await target({name:'hud:按住'+label}));await trigger(true);
    await wait(([s,value])=>milkTake.read().debits[s]>value+.05,[side,before.debits[side]]);
    const held=await read();assert.equal(held.hold,side);assert(held[side]<before[side]);assert.equal(held.debits[other],before.debits[other]);
    let pixels=null;
    if(exposed){pixels=await take('drops',side);assert(pixels.eyes.every(e=>e.pixels>=3),'Missing droplet pixels: '+JSON.stringify(pixels));
      assert(pixels.worldX.length&&pixels.worldX.every(x=>side==='left'?x>.02:x<-.02),'Drops did not come from the named actor side');}
    else assert.equal(held.drawFrames,0,'Covered actor submitted drops');
    await trigger(false);const up=await read();assert(!up.hold);
    await wait(()=>milkTake.read().drops===0);await frames(4);assert.deepEqual((await read()).debits,up.debits);
    receipts[side]={left:held.left,right:held.right,debits:held.debits,pixels};
  }
  await press('关闭泌乳');await target({name:'hud:开启泌乳'});await press('返回角色');assert(!(await read()).panel);
  await click('actorMilk');await press('开启泌乳');await wait(()=>!!milkTake.read().read);
  await aim(await target({name:'hud:按住双侧'}));await trigger(true);await wait(()=>milkTake.read().hold==='both');
  await page.evaluate(()=>{labFixture.tracking=false;});await frames(2);assert(!(await read()).hold);
  const lost=await read();await page.evaluate(()=>{labFixture.tracking=true;});await frames(4);
  assert.deepEqual((await read()).debits,lost.debits);await trigger(false);await trigger(true);await wait(()=>milkTake.read().hold==='both');
  await bButton();await wait(()=>!milkTake.read().panel&&!milkTake.read().hold&&!milkTake.read().drops);const interrupted=await read();
  await trigger(false);await click('settingsVrDesktopExit',{retiring:true});await until('milk room retired',s=>s.phase==='ended'&&!s.overlay&&!s.live);
  const end=await read();assert.deepEqual(end.debits,interrupted.debits);assert(!end.art&&!end.panel&&!end.drops&&!end.hold);
  const adapters=await page.evaluate(()=>labFixture.adapters);assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software/i.test(JSON.stringify(a))));
  await page.evaluate(()=>milkTake.dispose());return {exposed,figure:figure.eyes,receipts,exited:true};
};
