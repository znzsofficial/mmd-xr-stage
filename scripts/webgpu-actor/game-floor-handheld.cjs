const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// The controller moves along a short straight stroke. Its real rendered child
// and both reservoirs are observed separately. Never position the prop, inject
// an intersection, run a solver, or synthesize an input callback in the game.
async function prepareTake(id){
  const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {useStagePlay}=await import('/src/mmdVrShowcase/play/stagePlay.ts');
  const {siliconeOutlet,tipHeight,centerZ}=await import('/src/mmdVrShowcase/play/siliconeProfile.ts');
  const {scene,gl}=gameTargets.floorState(),port=scene.getObjectByName(`pelvic:adapter:${id}`),origin=gl.xr.getCamera().parent;
  const left=labSession.inputSources.find(s=>s.handedness==='left'),side=left.gamepad.buttons[1];
  const v=()=>port.position.clone();
  const localQ=port.quaternion.clone().setFromUnitVectors(v().fromArray(siliconeOutlet.direction).normalize(),v().set(0,0,-1));
  const q=origin.getWorldQuaternion(port.quaternion.clone()).invert().multiply(port.getWorldQuaternion(port.quaternion.clone())).multiply(localQ);
  const offset=v().fromArray(siliconeOutlet.position).applyQuaternion(q);
  function point(z,down=false,lost=false){
    const p=origin.worldToLocal(port.localToWorld(v().set(0,0,z))).sub(offset);
    const pose={position:{x:p.x,y:p.y,z:p.z},orientation:{x:q.x,y:q.y,z:q.z,w:q.w}};
    labSession.setControllerPose('left',lost?null:pose,pose);
    Object.assign(side,{value:+down,pressed:down,touched:down});
  }
  const child=()=>scene.getObjectByName('play:piece:dildo');
  function read(){const {active:a,sample,byAsset}=usePelvic.getState(),tool=child(),root=tool?.parent;
    const tip=tool&&port.worldToLocal(tool.localToWorld(v().set(0,tipHeight,centerZ(tipHeight))));
    return {mode:a?.mode,running:a?.running,inside:sample?.outletInside,source:root?.userData.propSource?.handedness,shown:!!(root?.visible&&tool?.visible),
      z:tip?.z,sampleZ:sample?.tip[2],fluid:byAsset[id]?.fluid,held:useStagePlay.getState().held?.hand,observer:!!scene.getObjectByName('pelvic:observer')?.visible,
      covering:usePelvic.getState().support[id]?.obstruction,spraying:scene.getObjectByName('play:liquid-spray')?.count??0};}
  function stroke(){
    const near=.042,inside=-.024,points=[];
    const hold=(z,count,down=false,lost=false,tag)=>{for(let i=0;i<count;i++)points.push({z,down,lost,tag:i===count-1?tag:undefined});};
    const move=(a,b)=>{for(let i=1;i<=28;i++)points.push({z:a+(b-a)*i/28});};
    hold(near,10,false,false,'start');move(near,inside);hold(inside,18,true,false,'delivered');hold(inside,4);
    move(inside,near);hold(near,15,true,false,'withdrawn');hold(near,5);
    move(near,inside);hold(inside,12,false,false,'beforeLoss');hold(inside,4,true,true,'lost');hold(inside,16,true,false,'recovered');
    const cfg=labFixture,results={},receipts=[];let i=0,maxSpray=0,picture;
    const unsub=usePelvic.subscribe((s,p)=>{if(s.byAsset[id]?.fluid!==p.byAsset[id]?.fluid)receipts.push(read());});
    return new Promise((resolve,reject)=>{
      const finish=()=>{cfg.take=null;unsub();clearTimeout(timeout);};
      const timeout=setTimeout(()=>{finish();reject(Error('Incomplete tracked take'));},15000);
      cfg.take={eyeZ:-.82,eyeY:1.12,time:performance.now(),inputs(){this.time+=1000/72;const p=points[i];point(p.z,p.down,p.lost);},afterDraw(s){try{
        const p=points[i++],r=read();maxSpray=Math.max(maxSpray,r.spraying);
        if(p.tag)results[p.tag]=r;
        if(p.tag==='start')picture=s.copyEyes();
        if(i===points.length){finish();picture.then(images=>{const c=document.createElement('canvas');c.width=images[0].width*2;c.height=images[0].height;
          images.forEach((im,k)=>c.getContext('2d').putImageData(im,k*im.width,0));resolve({results,receipts,maxSpray,png:c.toDataURL('image/png').split(',')[1]});},reject);}
      }catch(e){finish();reject(e);}}};
    });
  }
  window.handheldTake={point,read,stroke};point(.042);
}

module.exports=async function({page,ids,click,until,bButton,target,pickMounted,aim,trigger}){
  const actor=await until('clothed reference actor placed',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,120000);
  if(actor.physics){await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('still reference pose',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);}
  const press=async text=>{await aim(await target({name:'hud:'+text}));await trigger(true);await trigger(false);};
  await click('actorInsert');await press('交给左手');await press('保持穿衣继续');await press('目标：宫腔');
  await page.evaluate(prepareTake,ids.model);await press('开始手持并收起面板');
  await until('left controller owns calibrated tool',s=>!s.selected&&handheldTake.read().running&&handheldTake.read().source==='left');
  const {png,...evidence}=await page.evaluate(()=>handheldTake.stroke());
  const dir=path.join(__dirname,'../../local-review/screenshots/floor-handheld');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'tracked-left-stereo.png'),Buffer.from(png,'base64'));
  const {results:r,receipts,maxSpray}=evidence;console.log(JSON.stringify(evidence));
  assert(r.start.shown&&r.start.source==='left'&&r.start.covering==='garment'&&!r.start.inside&&r.start.z>.035);
  assert(r.delivered.inside&&r.delivered.observer&&r.delivered.z<-.018&&Math.abs(r.delivered.z-r.delivered.sampleZ)<.001);
  assert.equal(receipts.length,1);assert(receipts[0].inside&&receipts[0].z<-.018);
  assert(!r.withdrawn.inside&&r.withdrawn.z>.035);assert(r.beforeLoss.inside);assert(!r.lost.running&&!r.lost.shown&&!r.lost.inside);
  assert(!r.recovered.running&&!r.recovered.inside&&r.recovered.shown&&r.recovered.z<-.018);assert.equal(maxSpray,0);
  assert.deepEqual(r.recovered.fluid,{vaginal:0,fantasyUterine:1});
  await page.evaluate(()=>handheldTake.point(.042));await pickMounted(ids.model);await click('actorInsert');await press('收起假阳具');
  assert(!await page.evaluate(()=>handheldTake.read().held));await bButton();await click('settingsVrDesktopExit',{retiring:true});
  await until('calibrated handheld room retired',s=>s.phase==='ended'&&!s.overlay&&!s.live);return evidence;
};
