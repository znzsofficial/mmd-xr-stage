// node scripts/verify-city-district.cjs [--dev] [--shots]
// Defaults to the existing dist/. CITY_URL can point to an already running server.
// Uses the project's pinned IWER and Playwright Core from PLAYWRIGHT_CORE or
// XR_SMOKE_DIR/node_modules/playwright-core (same Edge setup as the park check).
// One browser, one tab. Only the screen placement camera is prepositioned; the
// XR route uses the two Touch sticks from the station spawn through all four doors.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const outdoor = 'seasideTerminus';
const smoke = process.env.XR_SMOKE_DIR || path.join(os.tmpdir(), 'opencode/xr-browser-smoke');
const out = path.resolve('local-review/verification/city-district');

// Independent expectations in seaside metres, surveyed against city/site.ts.
// Gate positions are directional: do not turn around before crossing the second line.
const venues = {
  clinic:     {origin:[0,51],       axis:0, center:53.8,   enter:8.36,  leave:8.94,  inside:[6.5,2.8],     sign:[4.96,3.42]},
  classroom:  {origin:[44,48],      axis:1, center:39.97,  enter:53.48, leave:53.96, inside:[-4.03,4.45],  sign:[-4.76,3.53]},
  pool:       {origin:[-30.4,63.7], axis:1, center:-24.25, enter:71.35, leave:72.05, inside:[6.15,5.80],   sign:[5.55,-20.22]},
  arcadeHall: {origin:[20,68.6],    axis:1, center:29.1,   enter:83.05, leave:83.75, inside:[9.10,4.30],   sign:[.6,8.8]},
};
const farActor = [25,86.1], farSign = [26.55,86.1]; // sports-street, clear of the walking centreline
const along = (v, gate) => v.axis === 0 ? [gate,v.center] : [v.center,gate];

function install() {
  localStorage.setItem('neko-virt-os.mmd-vr-showcase.v2', JSON.stringify({
    scenery:'seasideTerminus', movementMode:'normal', walkSpeedPref:'fast', normalEyeOffset:0,
    renderQuality:'balanced', advancedRenderOverrides:true, shadowsPref:'off', dprPref:1,
  }));
  const device = window.cityDevice = new IWER.XRDevice(IWER.metaQuest3, {stereoEnabled:true});
  device.installRuntime({forceInstall:true,polyfillLayers:false});
  device.position.set(.19,1.61,-.14);
  const q = window.cityQA = {frames:0, xrFrames:0, history:[], errors:[], checks:0};
  q.stamp = () => {
    let stamp = null;
    q.scene?.traverseVisible(o=>{
      if (o.isGroup && o.children.length===2 && o.children.every(c=>c.isGroup && c.children[0]?.material?.map?.isCanvasTexture)) {
        stamp={position:o.position.toArray(),valid:o.children[0].visible};
      }
    });
    return stamp;
  };
  q.clicks=[];
  for (const type of ['pointerdown','pointerup']) window.addEventListener(type,e=>{
    if (e.target?.tagName!=='CANVAS' || !q.camera) return;
    q.clicks.push({type,room:q.room,xy:[e.clientX,e.clientY],eye:q.camera.position.toArray(),stamp:q.stamp()});
    if (q.clicks.length>6) q.clicks.shift();
  },true);
  const proto = WebGL2RenderingContext.prototype, link = proto.linkProgram;
  proto.linkProgram = function(program) {
    link.call(this,program);
    if (!this.getProgramParameter(program,this.LINK_STATUS)) q.errors.push(this.getProgramInfoLog(program));
    for (const s of this.getAttachedShaders(program)) {
      if (!this.getShaderParameter(s,this.COMPILE_STATUS)) q.errors.push(this.getShaderInfoLog(s));
    }
    q.checks++;
  };
  window.__THREE_DEVTOOLS__ = new EventTarget();
  __THREE_DEVTOOLS__.addEventListener('observe', ({detail:r}) => {
    if (!r.isWebGLRenderer) return;
    const render = r.render.bind(r);
    r.render = function(scene,camera) {
      const result = render(scene,camera);
      const solids = scene.isScene && scene.children.find(o => o.name === 'player:room-solids');
      if (!solids) return result;
      const rooms = solids.children.filter(o => o.visible && o.name.startsWith('scenery:'));
      const name = rooms.map(o=>o.name.slice(8)).join('+');
      const room = name === 'seaside-terminus' ? 'seasideTerminus' : name;
      q.frames++; Object.assign(q,{room,scene,camera,renderer:r});
      if (!r.xr.isPresenting) return result;
      const frame = r.xr.getFrame(), rig = r.xr.getCamera(), eyes = rig.cameras;
      const pose = frame?.getViewerPose(r.xr.getReferenceSpace()), origin = rig.parent;
      if (!pose || !origin || eyes.length !== 2 || q.lastFrame === frame) return result;
      q.lastFrame = frame; q.xrFrames++;
      const p = eyes.map(e => e.position.clone().setFromMatrixPosition(e.matrixWorld));
      const ipd = p[0].distanceTo(p[1]), eye = p[0].lerp(p[1],.5);
      const m = eyes[0].matrixWorld.elements, om = origin.matrixWorld.elements;
      const local = origin.worldToLocal(eye.clone()), input = pose.transform.position;
      const stick = Array.from(frame.session.inputSources).find(s => s.handedness === 'left')?.gamepad;
      const layer = frame.session.renderState.baseLayer;
      if (!q.layer && layer && pose.views.length === 2) {
        const gl = r.getContext(), info = gl.getExtension('WEBGL_debug_renderer_info');
        q.layer = {device:info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL), width:layer.framebufferWidth, height:layer.framebufferHeight,
          viewports:pose.views.map(v => { const p = layer.getViewport(v); return [v.eye,p.x,p.y,p.width,p.height]; })};
      }
      q.sample = {room, eye:eye.toArray(), yaw:Math.atan2(m[8],m[10]), originYaw:Math.atan2(om[8],om[10]),
        origin:[om[12],om[13],om[14]], local:local.toArray(), tracked:[input.x,input.y,input.z],
        ipd, axes:stick && Array.from(stick.axes).slice(2,4)};
      if (room && q.history.at(-1) !== room) q.history.push(room);
      q.drive?.(q.sample);
      return result;
    };
  });

  // Check the mounted shape and its world transform, not a catalog/save entry.
  q.inventory = () => q.scene.children.flatMap(o => {
    const kind = o.userData.stagePropSolid ? 'object' : o.userData.mmdModelId ? 'actor' : null;
    if (!kind) return [];
    let ready = false;
    o.traverseVisible(m => {
      if ((kind === 'actor' ? m.isSkinnedMesh : m.isMesh && m.name === 'ruby') && m.geometry.attributes.position?.count) ready = true;
    });
    return [{kind, ready, uuid:o.uuid, position:o.getWorldPosition(o.position.clone()).toArray(), matrix:o.matrixWorld.toArray()}];
  });
}

async function inventory(page,room,expected) {
  await page.waitForFunction(({room,expected}) => {
    if (cityQA.room !== room) return false;
    const items = cityQA.inventory();
    return items.length === expected.length && expected.every(([kind,x,z]) => items.some(i =>
      i.kind === kind && i.ready && Math.hypot(i.position[0]-x,i.position[2]-z) < .10 && Math.abs(i.position[1]) < .08));
  }, {room,expected});
  return page.evaluate(() => cityQA.inventory());
}

async function beginDrop(page, name) {
  const bag = page.locator('.screen-corner button[aria-expanded]');
  if (await bag.getAttribute('aria-expanded') !== 'true') await bag.click();
  await page.locator('.screen-item').filter({hasText:name}).click();
  await page.waitForFunction(() => !!cityQA.scene.getObjectByName('backpack:ground'));
}

// Only the observation point is set up; hover, down, up and the preview stamp
// all go through the mounted screen canvas. No confirmPlace or store imports.
async function drop(page, eye, xz, stamp) {
  const [px,py] = await page.evaluate(({eye,xz,stamp}) => {
    cityQA.target={eye,xz,stamp};
    const {camera,renderer} = cityQA;
    const v = camera.position.clone().set(xz[0],.012,xz[1]);
    camera.position.fromArray(eye); camera.lookAt(v); camera.updateMatrixWorld();
    const rect = renderer.domElement.getBoundingClientRect(); v.project(camera);
    const x = rect.x+(1+v.x)*rect.width/2, y = rect.y+(1-v.y)*rect.height/2;
    if (document.elementFromPoint(x,y) !== renderer.domElement) throw Error('Canvas ray covered: '+xz);
    return [x,y];
  }, {eye,xz,stamp});
  // Every framed target lands near screen centre; move off first so the actual
  // pointer re-enters even if two successive rays have the same pixel address.
  await page.mouse.move(0,0); await page.mouse.move(px,py);
  if (stamp !== 'void') await page.waitForFunction(({xz,stamp}) => {
    let found = false;
    cityQA.scene.traverseVisible(o => {
      if (!o.isGroup || o.children.length !== 2 || !o.children.every(c => c.isGroup && c.children[0]?.material?.map?.isCanvasTexture)) return;
      const p = o.getWorldPosition(o.position.clone()), valid = stamp === 'valid' || stamp === 'preview';
      if (Math.hypot(p.x-xz[0],p.z-xz[1]) < .1 && o.children[0].visible === valid && o.children[1].visible !== valid) found = true;
    });
    return found;
  }, {xz,stamp}, {timeout:7000}).catch(e => { throw Error(`Missing ${stamp} stamp at ${xz}: ${e.message}`); });
  if (stamp === 'preview') return;
  const before = await page.evaluate(() => cityQA.inventory().map(v => v.uuid));
  await page.mouse.click(px,py);
  if (stamp !== 'valid') {
    await frames(page,3);
    assert(await page.evaluate(() => !!cityQA.scene.getObjectByName('backpack:ground')), `Rejected ${xz} consumed draft`);
    assert.deepEqual(await page.evaluate(() => cityQA.inventory().map(v => v.uuid)),before);
  }
}

async function frames(page,n,xr=false) {
  const target = await page.evaluate(([n,xr]) => (xr ? cityQA.xrFrames : cityQA.frames)+n,[n,xr]);
  await page.waitForFunction(([target,xr]) => (xr ? cityQA.xrFrames : cityQA.frames) >= target,[target,xr]);
}

// The held key itself traverses the door; the tour only frames its approach.
async function keyboardCross(page, from, to, key) {
  assert.equal(await page.locator('.screen-header select').inputValue(),from);
  const picture = page.locator('.screen-picture'); await picture.focus();
  const start = await page.evaluate(() => ({eye:cityQA.camera.position.toArray(), yaw:cityQA.camera.getWorldDirection(cityQA.camera.position.clone()).toArray()}));
  await page.keyboard.down(key);
  try { await page.waitForFunction(to => cityQA.room === to && document.querySelector('.screen-header select').value === to,to,{timeout:15000}); }
  finally { await page.keyboard.up(key); }
  const end = await page.evaluate(() => ({eye:cityQA.camera.position.toArray(), yaw:cityQA.camera.getWorldDirection(cityQA.camera.position.clone()).toArray()}));
  const [x,y,z] = end.eye, outdoorZ = to === outdoor ? z : z+51;
  assert(Math.abs(x-8.65)<1.25 && Math.abs(outdoorZ-53.8)<.6 && Math.abs(y-start.eye[1])<.13 &&
    Math.hypot(...end.yaw.map((v,i)=>v-start.yaw[i]))<.03, 'Wrong keyboard arrival: '+JSON.stringify({from,to,start,end}));
  return {from,to,key,start,end};
}

async function setupScreen(page,report) {
  const {zh} = require('../src/i18n/zh.ts');
  const rooms = page.locator('.screen-header select');
  await page.locator('.stage-launch-row .stage-btn-secondary').first().click();
  await page.waitForFunction(() => cityQA.room === 'seasideTerminus');
  assert.equal(await rooms.locator('option[value="lawn"]:not([hidden])').count(),0);
  const outdoorLayout = [['actor',...farActor],['object',...farSign]];
  const faces=['city:clinic-front','city:school-front','city:lido-front','city:arcade-front'];
  await page.waitForFunction(names=>names.every(n=>cityQA.scene.getObjectByName(n)),['city:street',...faces]);
  if (process.argv.includes('--shots')) {
    for (const key of ['cityClinicFront','citySchoolFront','cityPoolFront','cityArcadeFront']) {
      await page.locator('.screen-corner select').selectOption({label:zh[key]});
      await frames(page,4); await page.locator('.screen-picture canvas').screenshot({path:path.join(out,key+'.png')});
    }
  }
  await beginDrop(page,'swatch.pmx');
  await drop(page,[17.65,1.6,49.6],[15,48],'invalid');            // kite bench
  await drop(page,[1,1.61,81],[5.2,81],'void');                  // beyond inland street
  // Same clear street target: the school lintel masks it from above, while a
  // standing visitor can aim through the open door. Leave the green preview
  // without releasing there so the one actor can be placed on sports street.
  await drop(page,[39.97,3.8,53.32],[39.97,57.9],'invalid');
  await drop(page,[39.97,1.55,52.7],[39.97,57.9],'preview');
  await drop(page,[24.5,1.61,87.9],farActor,'valid');
  await inventory(page,outdoor,[outdoorLayout[0]]);
  await beginDrop(page,'ruby.glb');
  await drop(page,[25.6,1.61,87.9],farSign,'valid');
  report.screenLayouts[outdoor] = await inventory(page,outdoor,outdoorLayout);
  if (process.argv.includes('--shots')) {
    await page.evaluate(() => {const c=cityQA.camera;c.position.set(24.3,1.60,88.2);c.lookAt(25.7,.66,86.1);c.updateMatrixWorld();});
    await frames(page,3); await page.locator('.screen-picture canvas').screenshot({path:path.join(out,'far-street-layout.png')});
  }
  for (const room of ['pool','arcadeHall','classroom','clinic']) {
    const {sign:[x,z]} = venues[room];
    await rooms.selectOption(room); await inventory(page,room,[]);
    await beginDrop(page,'ruby.glb');
    if (room === 'pool') await drop(page,[6,1.6,-17.8],[4.7,-18.15],'invalid'); // pool water
    const eye = room === 'clinic' ? [4.18,1.6,2.74] : [x+.2,1.61,z+.72];
    await drop(page,eye,[x,z],'valid');
    report.screenLayouts[room] = await inventory(page,room,[['object',x,z]]);
  }
  // The target is in the waiting bay, off the walking line. Restore the actual
  // authored orbit eye AND target before using the native keyboard rig.
  const sheet = page.locator('.screen-actor-sheet:not([hidden])');
  if (await sheet.count()) await sheet.locator('.screen-library-head button').last().click();
  await page.locator('.screen-corner select').selectOption({label:zh.clinicEastExit});
  await frames(page,3);
  for (const [from,to,key] of [['clinic',outdoor,'w'],[outdoor,'clinic','s'],['clinic',outdoor,'w']]) {
    report.keyboard.push(await keyboardCross(page,from,to,key));
    await inventory(page,to,to === outdoor ? outdoorLayout : [['object',...venues.clinic.sign]]);
  }
  await page.locator('.screen-back').click();
  await page.locator('.stage-launch-row .stage-btn-secondary[data-xr-backend="webgl"]').click(); // resume, not restart
}

// Advances from rendered XR samples only. An ordinary step of the 4.8 m/s
// motor is bounded by dt<=.1. Keep both the last old-coordinate eye and the
// first translated one: React can mount the next room one frame after the step.
function driveXR({from, target, crossing}) {
  const q = cityQA, stick = cityDevice.controllers.left;
  const start = q.sample, axis = d => d ? Math.sign(d)*Math.min(1,.16+.84*Math.abs(d)) : 0;
  if (start.room !== from) throw Error('Wrong departure: '+JSON.stringify(start));
  return new Promise((resolve,reject) => {
    let last = start, n = 0, walked = 0, translated, rest = 0, native = false;
    let best = Infinity, advanced = performance.now(), remaining;
    const finish = err => {
      q.drive = undefined; clearTimeout(timer); stick.updateAxes('thumbstick',0,0);
      const result = {from,target,crossing,start,end:last,frames:n,walked,remaining,native,translated};
      if (err) reject(Error(err+': '+JSON.stringify(result))); else resolve(result);
    };
    const timer = setTimeout(()=>finish('No XR progress before deadline'),45000);
    q.drive = s => {
      n++; const prev = last; last = s;
      if (s.room && s.room !== from && s.room !== crossing?.to) return finish('Unexpected room');
      if (!(s.ipd>.04 && s.ipd<.09) || Math.abs(s.eye[1]-s.tracked[1])>.20 ||
          Math.hypot(...s.local.map((v,i)=>v-s.tracked[i]))>.012 || Math.hypot(s.tracked[0],s.tracked[2])<.15 ||
          Math.hypot(...s.tracked.map((v,i)=>v-start.tracked[i]))>.003) return finish('Invalid binocular/tracked offset or ground');
      if (Math.abs(s.originYaw-start.originYaw)>.008 || Math.abs(Math.sin((s.yaw-start.yaw)/2))>.005) return finish('Changed heading');
      let dx = s.eye[0]-prev.eye[0], dz = s.eye[2]-prev.eye[2];
      if (Math.hypot(dx,dz)>1 && crossing && !translated) {
        dx-=crossing.offset[0]; dz-=crossing.offset[1];
        const originDelta = [s.origin[0]-prev.origin[0]-crossing.offset[0],s.origin[2]-prev.origin[2]-crossing.offset[1]];
        const beforeAxis = prev.eye[crossing.axis*2], afterAxis = s.eye[crossing.axis*2]-crossing.offset[crossing.axis];
        if (Math.hypot(dx,dz)>.35 || Math.hypot(originDelta[0]-dx,originDelta[1]-dz)>.015 ||
            Math.abs(prev.eye[2-2*crossing.axis]-crossing.center)>.24 ||
            (beforeAxis-crossing.gate)*crossing.dir>.04 || (afterAxis-crossing.gate)*crossing.dir<-.04 ||
            Math.abs(beforeAxis-crossing.gate)>.38) return finish('Wrong seam translation or gate');
        translated = {before:prev,after:s,residual:Math.hypot(dx,dz)};
      }
      const step = Math.hypot(dx,dz); walked+=step;
      if (step>.51) return finish('Unexplained position jump');
      if (s.axes?.some(v=>Math.abs(v)>.16)) native=true;
      let x,z,power;
      if (crossing) {
        if (s.room === crossing.to && translated) {
          stick.updateAxes('thumbstick',0,0);
          if (++rest>=5) finish(native ? null : 'No native axes during crossing');
          return;
        }
        x = crossing.axis===0 ? crossing.dir : 0; z = crossing.axis===1 ? crossing.dir : 0; power=.50;
      } else {
        x=target[0]-s.eye[0]; z=target[1]-s.eye[2]; remaining=Math.hypot(x,z);
        if (remaining<.11) return finish(null);
        if (remaining<best-.045) {best=remaining; advanced=performance.now();}
        if (performance.now()-advanced>5000) return finish('Walk stalled');
        x/=remaining; z/=remaining; power=Math.min(1,remaining*.9);
      }
      const c=Math.cos(s.yaw), sn=Math.sin(s.yaw);
      stick.updateAxes('thumbstick',axis((c*x-sn*z)*power),axis((sn*x+c*z)*power));
    };
  });
}

async function xrRoute(page,report) {
  await page.waitForFunction(() => cityQA.xrFrames>5 && cityQA.layer && cityQA.sample?.axes?.length===2);
  report.layer = await page.evaluate(() => cityQA.layer);
  const views=report.layer.viewports;
  assert(report.layer.device && !/swiftshader|llvmpipe|basic render|software|warp|softpipe/i.test(report.layer.device));
  assert.deepEqual(views.map(v=>v[0]),['left','right']);
  assert(views.every(([,x,y,w,h])=>w>0 && h>0 && x>=0 && y>=0 && x+w<=report.layer.width && y+h<=report.layer.height) &&
    (views[0][1]+views[0][3]<=views[1][1] || views[0][2]+views[0][4]<=views[1][2]));

  const oldIds = new Set();
  async function restored(room) {
    const items = await inventory(page,room,room===outdoor ? [['actor',...farActor],['object',...farSign]] : [['object',...venues[room].sign]]);
    for (const item of items) {
      assert(!oldIds.has(item.uuid),'Room reused a previous visit’s live mesh'); oldIds.add(item.uuid);
      const saved = report.screenLayouts[room].find(i=>i.kind===item.kind);
      assert(Math.max(...item.matrix.map((v,i)=>Math.abs(v-saved.matrix[i])))<.025,`Changed ${room} ${item.kind} transform`);
    }
    return items;
  }
  await restored(outdoor);
  // A nonzero physical offset PLUS nonzero locomotion yaw discriminate a real
  // translated origin from a reset rig that merely restores the raw head yaw.
  await page.evaluate(()=>cityDevice.controllers.right.updateAxes('thumbstick',1,0));
  try { await page.waitForFunction(()=>Math.abs(cityQA.sample.originYaw)>.1); }
  finally { await page.evaluate(()=>cityDevice.controllers.right.updateAxes('thumbstick',0,0)); }
  const walk = async (room,...points) => {
    for (const target of points) {
      await page.evaluate(([x,z])=>{const s=cityQA.sample;
        const a=Math.atan2(s.eye[0]-x,s.eye[2]-z)-s.originYaw+.14; cityDevice.quaternion.set(0,Math.sin(a/2),0,Math.cos(a/2));
      },target);
      await frames(page,2,true);
      const leg=await page.evaluate(driveXR,{from:room,target});
      report.walk.push({room,target,eye:leg.end.eye,frames:leg.frames,walked:leg.walked,native:leg.native});
    }
  };
  async function cross(room,entering) {
    const v=venues[room], from=entering ? outdoor : room, to=entering ? room : outdoor;
    const crossing={to, axis:v.axis, dir:entering ? -1 : 1, gate:entering ? v.enter : v.leave-v.origin[v.axis],
      center:entering ? v.center : v.center-v.origin[1-v.axis],
      offset:v.origin.map(k=>entering ? -k : k)};
    const result=await page.evaluate(driveXR,{from,crossing});
    const items=await restored(to);
    report.crossings.push({...result,items});
    console.log(`${from} → ${to}: ${items.length} restored, eye residual ${result.translated.residual.toFixed(3)} m`);
  }
  async function visit(room) {
    const v=venues[room];
    await walk(outdoor,along(v,v.enter+.95)); await cross(room,true);
    await walk(room,v.inside);
    const beforeExit=along(v,v.leave-.90).map((n,i)=>n-v.origin[i]);
    await walk(room,beforeExit); await cross(room,false);
  }

  await walk(outdoor,[-1,5],[-1,12],[0,17],[0,28],[4,32],[13,33],[19.75,34.75],
    [21.4,36.95],[21.4,42.36],[21.4,53.8]);
  await visit('clinic');
  await walk(outdoor,[21.4,53.8],[21.4,58.5],[39.97,58.5]); await visit('classroom');
  await walk(outdoor,[39.97,58.5],[1,58.5],[1,87],[-24.25,87]); await visit('pool');
  await walk(outdoor,[-24.25,87],[29.1,87]); await visit('arcadeHall');
  report.rooms = await page.evaluate(()=>cityQA.history);
  assert.deepEqual(report.rooms,[outdoor,'clinic',outdoor,'classroom',outdoor,'pool',outdoor,'arcadeHall',outdoor]);
  await page.evaluate(()=>cityQA.renderer.xr.getSession().end());
  await page.locator('.xr-stage-overlay').waitFor({state:'detached'});
}

async function main() {
  const dev=process.argv.includes('--dev');
  const {chromium}=require(process.env.PLAYWRIGHT_CORE || path.join(smoke,'node_modules/playwright-core'));
  const {createRequire}=require('node:module');
  const xr=createRequire(createRequire(require.resolve('@react-three/xr')).resolve('@pmndrs/xr'));
  const iwer=path.resolve(path.dirname(xr.resolve('iwer')),'../build/iwer.js');
  const {createServer,preview}=await import('vite');
  const report={mode:process.env.CITY_URL?'existing server':dev?'dev':'dist',status:'incomplete',screenLayouts:{},keyboard:[],walk:[],crossings:[],errors:[]};
  const {makeSwatch}=await import('../experiments/gpu-cloth/swatch.js');
  const {writeSigns}=await import('./webgpu-actor/layout-signs.mjs');
  await fs.mkdir(out,{recursive:true});
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'city-marker-'));
  let server,browser,page;
  try {
    await writeSigns(tmp);
    let address=process.env.CITY_URL;
    if (!address) {
      server=dev ? await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}})
        : await preview({configFile:false,build:{outDir:'dist'},preview:{host:'127.0.0.1',port:0}});
      if (dev) await server.listen();
      address=server.resolvedUrls.local[0];
    }
    browser=await chromium.launch({channel:process.env.CHANNEL || 'msedge',headless:true,args:[
      '--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--no-proxy-server','--disable-background-timer-throttling',
    ]});
    page=await browser.newPage({locale:'zh-CN',viewport:{width:1080,height:720},deviceScaleFactor:1});
    page.setDefaultTimeout(30000);
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if (m.type()==='error' && /shader|webgl|program|texture/i.test(m.text())) report.errors.push(m.text());});
    await page.addInitScript({content:await fs.readFile(iwer,'utf8')+`\n;(${install})();`});
    const url=new URL(address); url.searchParams.set('set',outdoor); url.searchParams.set('xrBackend','webgl');
    await page.goto(url.href);
    await page.locator('input[type=file]').nth(1).setInputFiles([
      {name:'swatch.pmx',mimeType:'application/octet-stream',buffer:Buffer.from(await makeSwatch().arrayBuffer())},
      {name:'ruby.glb',mimeType:'model/gltf-binary',buffer:await fs.readFile(path.join(tmp,'ruby.glb'))},
    ]);
    await page.locator('.stage-report-stats').waitFor();
    await setupScreen(page,report);
    await xrRoute(page,report);
    const shaders=await page.evaluate(()=>({checks:cityQA.checks,errors:cityQA.errors}));
    assert(shaders.checks>0); assert.deepEqual(shaders.errors,[]); assert.deepEqual(report.errors,[]);
    report.status='passed'; console.log('PASS: keyboard return, eight tracked crossings and five independent layouts.',out);
  } catch (err) {
    report.failure=err.message;
    if (page) report.lastFrame=await page.evaluate(()=>({room:cityQA.room,dom:document.querySelector('.screen-header select')?.value,
      caption:document.querySelector('.screen-caption')?.textContent, xr:cityQA.sample, items:cityQA.scene && cityQA.inventory(),
      target:cityQA.target,stamp:cityQA.stamp(),clicks:cityQA.clicks})).catch(()=>null);
    throw err;
  } finally {
    try {await browser?.close();} finally {
      try {await server?.close();} finally {
        await fs.rm(tmp,{recursive:true,force:true});
        await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(report,null,2)+'\n');
      }
    }
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;});
