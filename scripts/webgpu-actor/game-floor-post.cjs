const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// Everything here observes the game room. Only the simulated device supplies
// input; no store actions, fabricated hits, mesh visibility edits or second render.
async function observePost() {
  const {useLunarCard} = await import('/src/mmdVrShowcase/play/lunarCard.ts');
  const {useStagePlay} = await import('/src/mmdVrShowcase/play/stagePlay.ts');
  const shots = new Map();
  function read() {
    const room = gameTargets.floorState()?.scene;
    const tool = room?.getObjectByName('play:piece:post');
    return {held:useStagePlay.getState().held, stamps:useLunarCard.getState().stamps,
      source:tool?.parent.userData.propSource?.handedness, piece:!!tool,
      station:!!room?.getObjectByName('play:moon-post'), card:!!room?.getObjectByName('post:finished')};
  }
  async function snap(tag, meshName, localBox) {
    const cfg = window.labFixture;
    if (cfg.take) throw Error('Another eye take is active');
    await new Promise((resolve,reject) => {
      const timer = setTimeout(() => { cfg.take=null; reject(Error('Missing projection readback: '+tag)); },15000);
      cfg.take = {inputs(){this.time=performance.now();}, afterDraw(s) {
        cfg.take=null;clearTimeout(timer);
        try {
          const {gl,scene}=gameTargets.floorState(), mesh=meshName && scene.getObjectByName(meshName);
          if(meshName && !mesh)throw Error('Missing '+meshName);
          const regions=mesh && gl.xr.getCamera().cameras.map(cam=>{
            mesh.geometry.computeBoundingBox();const bounds=mesh.geometry.boundingBox;
            const [min,max]=localBox??[bounds.min.toArray(),bounds.max.toArray()];
            const points=[];
            for(const x of [min[0],max[0]])for(const y of [min[1],max[1]])for(const z of [min[2],max[2]]){
              const p=mesh.position.clone().set(x,y,z).applyMatrix4(mesh.matrixWorld).project(cam);
              points.push([(1+p.x)/2,(1-p.y)/2]);
            }
            return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
          });
          s.copyEyes().then(images=>{shots.set(tag,{images,regions});resolve();},reject);
        }catch(e){reject(e);}
      }};
    });
  }
  function compare(before,after,region) {
    const a=shots.get(before), b=shots.get(after);
    return shots.get(region).regions.map(([x0,y0,x1,y1],eye)=>{
      const {width:w,height:h,data}=a.images[eye], other=b.images[eye].data;
      // The simulated projection viewport has a 4px horizontal / 5px vertical inset.
      let changed=0;
      for(let y=Math.max(5,Math.floor(5+y0*(h-10)));y<Math.min(h-5,Math.ceil(5+y1*(h-10)));y++){
        for(let x=Math.max(4,Math.floor(4+x0*(w-8)));x<Math.min(w-4,Math.ceil(4+x1*(w-8)));x++){
          const k=(y*w+x)*4;
          if([0,1,2].some(c=>Math.abs(data[k+c]-other[k+c])>15))changed++;
        }
      }
      return changed;
    });
  }
  function stereoPng(tag) {
    const [left,right]=shots.get(tag).images, canvas=document.createElement('canvas');
    canvas.width=left.width*2;canvas.height=left.height;const ctx=canvas.getContext('2d');
    ctx.putImageData(left,0,0);ctx.putImageData(right,left.width,0);return canvas.toDataURL('image/png').split(',')[1];
  }
  window.postTake={read,snap,compare,stereoPng};
}

module.exports=async function({page,click,until,bButton,frames,target,aim,trigger,placeFromBag,actorName}) {
  await page.evaluate(observePost);
  const read=()=>page.evaluate(()=>postTake.read());
  const snap=(...args)=>page.evaluate(args=>postTake.snap(...args),args);
  const diff=(...args)=>page.evaluate(args=>postTake.compare(...args),args);
  async function portal() {
    const gate=await target({name:'portal:floor'});gate[1]+=1.15;
    await aim(gate);await trigger(true);assert.equal((await page.evaluate(()=>stageProbe.read())).room,'astralCourt');
    await trigger(false);await until('lunar gate opens the plinth',s=>s.room==='floor'&&s.ready&&!gameTargets.find({name:'portal:floor'}));
  }
  async function shelf() {
    await bButton();await click('hudBackpack');await click('hudToys');await click('loadNext');await target({name:'play:shelf:post'});
  }
  async function point(hand,mark=null) {
    const at=mark==null?null:await target({name:'post:mark:'+mark});
    await page.evaluate(([side,world])=>{
      const state=gameTargets.floorState(),origin=state.gl.xr.getCamera().parent;
      const at=world && origin.worldToLocal(origin.position.clone().fromArray(world)).toArray();
      // Use the actual fixed gripSpace position of stereoShim as ray origin.
      labSession.aimRay(side,at,{x:side==='left'?-.25:.15,y:1.1,z:-.60});
    },[hand,at]);await frames(3);
    if(mark!=null)await target({name:'post:aim'});
  }
  async function grip(hand,down) {
    await page.evaluate(([side,down])=>{
      const b=labSession.inputSources.find(s=>s.handedness===side).gamepad.buttons[1];
      Object.assign(b,{pressed:down,touched:down,value:Number(down)});
    },[hand,down]);await frames(3);
  }
  async function equip(hand) {
    await shelf();await click(hand==='left'?'toyLeft':'toyRight',{toy:'post'});await target({name:'watch:quiet'});
    await target({name:'play:piece:post'});await point('left');await point('right');
    const item=await read();assert.deepEqual(item.held,{toy:'post',hand});assert.equal(item.source,hand);
  }
  async function stow() {
    await shelf();await click('toyStow');await target({name:'watch:quiet'});await point('right');
    const item=await read();assert(!item.held&&!item.piece);
  }
  async function squeezeMark(side,index) {await point(side,index);await grip(side,true);await grip(side,false);}
  const hardware=await page.evaluate(()=>labFixture.adapters);
  assert(hardware.some(a=>a.xrCompatible)&&hardware.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software|llvmpipe/i.test(JSON.stringify(a))),'Expected a native hardware WebGPU adapter');
  await portal();await placeFromBag(actorName,[-.55,0,-2.5],0);
  const actor=await until('one actor on the postal set',s=>s.ready&&s.selected&&s.live===1&&s.actor?.evaluations>0,null,90000);
  await click('hudDone');await target({name:'watch:quiet'});await point('left');await point('right');await snap('empty');

  await equip('left');await snap('left','play:piece:post');await snap('plain','post:mark:1');
  await point('left',1);await grip('right',true);await grip('right',false);assert.deepEqual((await read()).stamps,[]);
  await grip('left',true);await point('left',0);assert.deepEqual((await read()).stamps,[1]); // one press cannot stamp a second target
  await grip('left',false);await point('left');await snap('stamped','post:mark:1');
  await stow();assert.deepEqual((await read()).stamps,[1]);assert(!(await read()).station);
  await equip('right');await snap('right','play:piece:post');await squeezeMark('right',0);await squeezeMark('right',2);
  await target({name:'post:finished'});assert.deepEqual((await read()).stamps,[1,0,2]);
  const top=[[-2.95,.65,0],[2.95,1.72,0]],seal=[[1.77,.62,0],[2.92,1.64,0]];
  await point('right');await snap('completed','post:finished',top);await stow();await snap('stowed','post:finished',seal);
  const metrics={leftTool:await diff('empty','left','left'),rightTool:await diff('empty','right','right'),
    stampedMark:await diff('plain','stamped','plain'),backdrop:await diff('empty','stowed','completed'),afterStow:await diff('completed','stowed','completed')};
  for(const key of ['leftTool','rightTool','stampedMark'])assert(metrics[key].every(n=>n>35),key+': '+JSON.stringify(metrics));
  assert(metrics.backdrop.every(n=>n>2000)&&metrics.afterStow.every(n=>n<10),JSON.stringify(metrics));

  await shelf();await click('toyNewCard');assert.deepEqual((await read()).stamps,[]);await click('toyRight',{toy:'post'});
  await target({name:'watch:quiet'});for(const i of [2,1,0])await squeezeMark('right',i);
  await target({name:'post:finished'});await point('right');await snap('otherSeal','post:finished',seal);
  metrics.firstSeal=await diff('stowed','otherSeal','stowed');assert(metrics.firstSeal.every(n=>n>50),JSON.stringify(metrics));
  await until('stamping kept the same placed actor',(s,id)=>s.ready&&s.runtimeId===id&&s.live===1,actor.runtimeId);
  const png=await page.evaluate(()=>postTake.stereoPng('stowed'));
  const dir=path.join(__dirname,'../../local-review/screenshots/lunar-post');await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(dir,'stowed-stereo.png'),Buffer.from(png,'base64'));

  await bButton();await click('returnPortalHall');await until('hall retires the completed card and tool',s=>s.room==='astralCourt'&&s.ready&&!s.live);
  const clean={held:null,stamps:[],source:undefined,piece:false,station:false,card:false};
  assert.deepEqual(await read(),clean);await portal();
  await until('floor restores the actor without the card',s=>s.ready&&s.live===1&&s.actor?.evaluations>0,null,90000);
  assert.deepEqual(await read(),clean);await equip('left');await squeezeMark('left',2);assert.deepEqual((await read()).stamps,[2]);
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('end retires a held punch and incomplete card',s=>s.phase==='ended'&&!s.overlay&&!s.live);
  assert.deepEqual(await read(),clean);return {entry:'astralCourt → floor',firstSeals:[1,2],changedPixelsByEye:metrics,roomAndExitClean:true};
};
