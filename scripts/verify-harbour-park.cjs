// node scripts/verify-harbour-park.cjs [--dev] [--depth | --sun]
// One hardware WebGL browser. Screen tour, paired material controls, backpack rays,
// then a single uninterrupted IWER normal-mode round trip in the same tab.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const smoke = process.env.XR_SMOKE_DIR || path.join(os.tmpdir(), 'opencode/xr-browser-smoke');
const { chromium } = require(path.join(smoke, 'node_modules/playwright-core'));
const out = path.resolve('local-review/screenshots/harbour-park');

// This function is installed before Three creates either renderer.
function instrument(liveSun) {
  localStorage.setItem('neko-virt-os.mmd-vr-showcase.v2', JSON.stringify({
    scenery: 'seasideTerminus', renderQuality: 'balanced', advancedRenderOverrides: true,
    lightPreset: 'stage', exposure: 1, dprPref: 1, viewDistance: 52, shadowsPref: liveSun?'on':'off',
    normalEyeOffset: 0, walkSpeedPref: 'normal', movementMode: 'normal',
  }));
  const device = window.parkDevice = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: true });
  device.installRuntime({ forceInstall: true, polyfillLayers: false });
  device.position.set(0, 1.6, 0);
  const qa = window.parkQA = { frames: 0, stereoFrames: 0, errors: [] };
  const contexts = new WeakMap();
  function context(gl) {
    if (!contexts.has(gl)) {
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      contexts.set(gl, { device: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL), compiled: 0, linked: 0 });
    }
    return contexts.get(gl);
  }
  const proto = WebGL2RenderingContext.prototype;
  const compile = proto.compileShader, link = proto.linkProgram;
  proto.compileShader = function(shader) {
    compile.call(this, shader);
    if (this.getShaderParameter(shader, this.COMPILE_STATUS)) context(this).compiled++;
    else qa.errors.push('compile: ' + this.getShaderInfoLog(shader));
  };
  proto.linkProgram = function(program) {
    link.call(this, program);
    if (this.getProgramParameter(program, this.LINK_STATUS)) context(this).linked++;
    else qa.errors.push('link: ' + this.getProgramInfoLog(program));
  };

  // Read the actual color-converted canvas while the drawing buffer is still valid.
  // For a control pair, remove only the named part and redraw within the SAME Fiber
  // frame. Sky, exposure, animation phase and view are identical in both images.
  const pixels = document.createElement('canvas');
  const ctx = pixels.getContext('2d', { willReadFrequently: true });
  function read(canvas) {
    if (pixels.width !== canvas.width || pixels.height !== canvas.height) {
      pixels.width = canvas.width;
      pixels.height = canvas.height;
    }
    ctx.drawImage(canvas, 0, 0);
    return ctx.getImageData(0, 0, pixels.width, pixels.height).data;
  }
  function probe(render, renderer, scene, camera, take) {
    const canvas = renderer.domElement;
    const shot = take.view ? camera.clone() : camera;
    if (take.view) {
      shot.position.fromArray(take.view.eye);
      shot.lookAt(...take.view.aim);
      shot.updateMatrixWorld();
    }
    const parts = (take.hide || []).flatMap(name => {
      const objects = scene.getObjectsByProperty('name', name).filter(o => o.visible);
      if (!objects.length) throw Error('Missing visible control part: ' + name);
      return objects;
    });
    if (take.actor) {
      const model = scene.children.find(o => o.visible && o.userData.mmdModelId);
      if (!model) throw Error('No visible PMX root for control');
      parts.push(model);
    }
    try {
      if (take.view) render(scene, shot);
      const photo = canvas.toDataURL('image/png').split(',')[1];
      if (!parts.length) return { photo };
      const on = read(canvas);
      for (const obj of parts) { if(take.shadowOnly)obj.castShadow=false;else obj.visible=false; }
      render(scene, shot);
      const off = read(canvas);
      const control = take.control ? canvas.toDataURL('image/png').split(',')[1] : undefined;
      let changed = 0, darker = 0, moving = 0;
      const baseline = qa.waterBaseline, background = qa.waterBackground;
      const residual = take.motion === 'first' ? new Int16Array(on.length) : null;
      for (let i = 0; i < on.length; i += 4) {
        const r = on[i] - off[i], g = on[i+1] - off[i+1], b = on[i+2] - off[i+2];
        if (Math.max(Math.abs(r), Math.abs(g), Math.abs(b)) >= 5) changed++;
        if (.2126*r + .7152*g + .0722*b < -4) darker++;
        if (residual) { residual[i] = r; residual[i+1] = g; residual[i+2] = b; }
        if (take.motion === 'later' && Math.max(Math.abs(off[i]-background[i]), Math.abs(off[i+1]-background[i+1]), Math.abs(off[i+2]-background[i+2])) <= 3 &&
          Math.max(Math.abs(r-baseline[i]), Math.abs(g-baseline[i+1]), Math.abs(b-baseline[i+2])) >= 8) moving++;
      }
      if (residual) { qa.waterBaseline = residual; qa.waterBackground = off; }
      const patches = {};
      for (const [key,world] of Object.entries(take.samples || {})) {
        const p = shot.position.clone().fromArray(world).project(shot);
        const x = Math.round((.5+.5*p.x)*canvas.width), y = Math.round((.5-.5*p.y)*canvas.height);
        if (p.z < -1 || p.z > 1 || x < 5 || y < 5 || x >= canvas.width-5 || y >= canvas.height-5) throw Error('Off-camera ground sample: ' + key);
        const values = [];
        for (let dy=-4; dy<=4; dy++) for (let dx=-4; dx<=4; dx++) {
          const i = ((y+dy)*canvas.width+x+dx)*4;
          values.push(.2126*(off[i]-on[i])+.7152*(off[i+1]-on[i+1])+.0722*(off[i+2]-on[i+2]));
        }
        patches[key] = values.sort((a,b) => a-b)[40];
      }
      return { photo, control, changed, darker, moving, patches, width: canvas.width, height: canvas.height };
    } finally {
      for (const obj of parts) { if(take.shadowOnly)obj.castShadow=true;else obj.visible=true; }
      if (take.view || parts.length) render(scene, camera);
    }
  }

  window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener('observe', ({ detail: r }) => {
    if (!r.isWebGLRenderer) return;
    const render = r.render.bind(r);
    r.render = function(scene, camera) {
      const result = render(scene, camera);
      if (!scene.isScene || !scene.getObjectByName('scenery:seaside-terminus')) return result;
      qa.frames++;
      qa.scene = scene;
      qa.renderer = r;
      qa.camera = camera;
      if (r.xr.isPresenting) {
        const frame = r.xr.getFrame(), eyes = r.xr.getCamera().cameras;
        const pose = frame?.getViewerPose(r.xr.getReferenceSpace());
        if (!pose || eyes.length !== 2 || qa.lastFrame === frame) return result;
        qa.lastFrame = frame;
        qa.stereoFrames++;
        qa.xrGL = context(r.getContext());
        // Do not call getWorldPosition on unparented eye cameras; the final
        // world matrices include locomotion, whereas position is tracking-local.
        const [left, right] = eyes.map(e => e.position.clone().setFromMatrixPosition(e.matrixWorld));
        qa.ipd = left.distanceTo(right);
        qa.eye = left.lerp(right, .5).toArray();
        qa.soleY = qa.eye[1] - pose.transform.position.y;
        const m = eyes[0].matrixWorld.elements;
        qa.yaw = Math.atan2(m[8], m[10]);
        const sources = Array.from(frame.session.inputSources);
        const leftSource = sources.find(s => s.handedness === 'left' && s.gamepad);
        qa.nativeStick = leftSource?.gamepad.axes.slice(2,4);
        const rightSource = sources.find(s => s.handedness === 'right' && s.gamepad);
        const ray = rightSource && frame.getPose(rightSource.targetRaySpace, r.xr.getReferenceSpace());
        if (ray) {
          const { position: p, orientation: v } = ray.transform, h = pose.transform.position;
          qa.rayOrigin = [p.x + qa.eye[0]-h.x, p.y + qa.eye[1]-h.y, p.z + qa.eye[2]-h.z];
          qa.rayRotation = [v.x, v.y, v.z, v.w];
        }
      } else {
        qa.screenGL = context(r.getContext());
        if (qa.take) {
          const take = qa.take;
          if (take.motion) {
            const mesh = scene.getObjectByName(take.hide[0]);
            const state = mesh?.morphTargetInfluences?.length ? [...mesh.morphTargetInfluences] : mesh?.instanceMatrix?.array.slice(12,15);
            if (!state?.length) { qa.take = null; qa.result = {error:'Missing moving geometry: ' + take.hide[0]}; return result; }
            if (take.motion === 'first') qa.motionState = state;
            else if (Math.hypot(...state.map((v,i) => v-qa.motionState[i])) < (mesh.isInstancedMesh ? .12 : .65)) return result;
          }
          qa.take = null;
          try { qa.result = probe(render, r, scene, camera, take); }
          catch (error) { qa.result = { error: error.message }; }
        }
      }
      return result;
    };
  });
}

async function capture(page, key, take = {}) {
  await page.evaluate(spec => { parkQA.result = null; parkQA.take = spec; }, take);
  await page.waitForFunction(() => !!parkQA.result);
  const { photo, control, error, ...stats } = await page.evaluate(() => {
    const data = parkQA.result;
    parkQA.result = null;
    return data;
  });
  assert(!error, `${key}: ${error}`);
  await fs.writeFile(path.join(out, key + '.png'), Buffer.from(photo, 'base64'));
  if (control) await fs.writeFile(path.join(out, key + '-control.png'), Buffer.from(control, 'base64'));
  return stats;
}

async function frames(page, count = 3) {
  const until = await page.evaluate(n => parkQA.frames + n, count);
  await page.waitForFunction(n => parkQA.frames >= n, until);
}

function verifyGL(gl) {
  assert(gl?.device && !/swiftshader|llvmpipe|basic render|software|warp|softpipe/i.test(gl.device),
    'Hardware WebGL adapter was not verified: ' + JSON.stringify(gl));
  assert(gl.compiled >= 2 && gl.linked > 0, 'No verified shader compile/link: ' + JSON.stringify(gl));
}

// A real mouse event must reach the canvas, move its actual drop marker to the
// target, and expose the appropriate footprint/cross stamp BEFORE release.
async function pointAtDeck(page, x, z, allowed) {
  const point = await page.evaluate(([x,z]) => {
    const q = parkQA, canvas = q.renderer.domElement;
    const v = q.camera.position.clone().set(x,.012,z).project(q.camera);
    const rect = canvas.getBoundingClientRect();
    const px = rect.left + (.5 + .5*v.x)*rect.width, py = rect.top + (.5 - .5*v.y)*rect.height;
    if (v.z < -1 || v.z > 1 || document.elementFromPoint(px,py) !== canvas) throw Error(`Target ${x},${z} not on unobstructed canvas at ${px},${py}`);
    return [px,py];
  }, [x,z]);
  await page.mouse.move(...point);
  await marker(page, x, z, allowed);
  await page.mouse.click(...point);
  if (!allowed) await stillPlacing(page);
}

async function marker(page, x, z, allowed) {
  await page.waitForFunction(({x,z,allowed}) => {
    let found = false;
    parkQA.scene.traverse(o => {
      // DropSurface owns two groups, each with a canvas-textured stamp plane.
      if (!o.isGroup || !o.visible || o.children.length !== 2 || !o.children.every(child => child.isGroup && child.children[0]?.material?.map?.isCanvasTexture)) return;
      const p = o.getWorldPosition(o.position.clone());
      found ||= Math.hypot(x-p.x,z-p.z) < .18 && o.children[0].visible === allowed && o.children[1].visible !== allowed;
    });
    return found;
  }, {x,z,allowed});
}

async function stillPlacing(page) {
  await frames(page);
  assert(await page.evaluate(() => !!parkQA.scene.getObjectByName('backpack:ground') && !parkQA.scene.children.some(o => o.userData.mmdModelId)), 'Illegal ray consumed the draft or placed a model');
}

async function actorPlaced(page, [x,z]) {
  await page.waitForFunction(([x,z]) => {
    const roots = parkQA.scene.children.filter(o => o.userData.mmdModelId && o.visible);
    if (roots.length !== 1) return false;
    const p = roots[0].getWorldPosition(roots[0].position.clone());
    let skinned = false;
    roots[0].traverseVisible(o => { if (o.isSkinnedMesh && o.geometry.attributes.position?.count) skinned = true; });
    return skinned && Math.hypot(x-p.x,z-p.z) < .18 && Math.abs(p.y) < .12;
  }, [x,z], {timeout:90000});
}

// Turn the simulated tracked head toward the destination. Steer in the current
// displayed heading, re-evaluating the thumbstick from each new binocular pair;
// deadlines detect stalls, never decide distance from wall-clock duration.
async function walk(page, waypoint) {
  const result = await page.evaluate(async ([x,z]) => {
    const q = parkQA, stick = parkDevice.controllers.left;
    const start = q.stereoFrames, startedAt = performance.now(), startEye = q.eye.slice();
    const heading = Math.atan2(q.eye[0]-x, q.eye[2]-z);
    parkDevice.quaternion.set(0, Math.sin(heading*.5), 0, Math.cos(heading*.5));
    let last = start, remaining = Infinity, peakSole = 0, validEyes = true;
    let requested = [0,0], lastSampleAt = startedAt, lastEye = startEye;
    const recent = [];
    try {
      while (performance.now()-startedAt < 45000) {
        if (q.stereoFrames !== last) {
          last = q.stereoFrames;
          const dx = x-q.eye[0], dz = z-q.eye[2];
          remaining = Math.hypot(dx,dz);
          peakSole = Math.max(peakSole, Math.abs(q.soleY));
          validEyes = q.ipd > .04 && q.ipd < .09;
          if (!validEyes || remaining < .16) break;
          // After rotating onto the target, |localZ|/remaining can exceed 1
          // by an ulp. IWER rejects BOTH axes of an out-of-range command,
          // leaving the previous (released) stick at zero for the whole leg.
          const speed = Math.min(1, remaining*2);
          const axis = delta => {
            const magnitude = Math.abs(delta)/remaining;
            if (magnitude < 1e-6) return 0;
            return Math.sign(delta)*Math.min(1,.16+.84*speed*magnitude);
          };
          const c = Math.cos(q.yaw), s = Math.sin(q.yaw);
          requested = [axis(c*dx-s*dz), axis(s*dx+c*dz)];
          const now = performance.now();
          if (now-lastSampleAt >= 1000) {
            const mps = Math.hypot(q.eye[0]-lastEye[0],q.eye[2]-lastEye[2])*1000/(now-lastSampleAt);
            recent.push({eye:q.eye.slice(), remaining, mps, yaw:q.yaw, requested, native:q.nativeStick});
            if (recent.length > 4) recent.shift();
            lastSampleAt = now; lastEye = q.eye.slice();
          }
          stick.updateAxes('thumbstick', ...requested);
        }
        await new Promise(ok => setTimeout(ok, 12));
      }
    } finally { stick.updateAxes('thumbstick',0,0); }
    const stalled = !(remaining < .16);
    return { waypoint: [x,z], eye: q.eye, remaining, validEyes, ipd: q.ipd, peakSole, trackedFrames: last-start,
      ...(stalled ? {startEye, elapsedMs:performance.now()-startedAt, heading, requested, recent} : {}) };
  }, waypoint);
  assert(result.validEyes && result.remaining < .16 && result.trackedFrames > 0 && result.peakSole < .22,
    'Walking route did not reach supported ground: ' + JSON.stringify(result));
  return result;
}

// Aim relative to the measured target-ray pose (not the model of the grip).
// The walking origin only translates; head turns and controller rotations are
// in reference-space axes. Recheck the physical ray after every correction.
async function controllerAim(page, world) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const aimed = await page.evaluate(target => {
      const q = parkQA, hand = parkDevice.controllers.right;
      const forward = q.camera.position.clone().set(0,0,-1).applyQuaternion(q.camera.quaternion.clone().fromArray(q.rayRotation));
      const desired = forward.clone().fromArray(target).sub(forward.clone().fromArray(q.rayOrigin)).normalize();
      if (forward.angleTo(desired) < .0015) return true;
      const h = hand.quaternion;
      const turn = q.camera.quaternion.clone().setFromUnitVectors(forward, desired).multiply(q.camera.quaternion.clone().set(h.x,h.y,h.z,h.w));
      hand.quaternion.set(turn.x, turn.y, turn.z, turn.w);
      return false;
    }, world);
    if (aimed) return;
    await frames(page);
  }
  throw Error('Tracked right ray did not converge on ' + world);
}

async function button(page, key) {
  await page.evaluate(k => parkDevice.controllers.right.updateButtonValue(k,1), key);
  try { await frames(page, 4); }
  finally { await page.evaluate(k => parkDevice.controllers.right.updateButtonValue(k,0), key); }
  await frames(page, 4);
}

async function xrPlacement(page, zh, bench, water, legal) {
  await page.evaluate(() => {
    parkDevice.controllers.left.quaternion.set(Math.SQRT1_2,0,0,Math.SQRT1_2);
    parkDevice.controllers.right.position.set(.16,1.33,0);
  });
  const hud = key => 'hud:' + zh[key];
  await button(page, 'b-button');
  for (const key of ['hudBackpack','hudPlace']) {
    const name = hud(key);
    await page.waitForFunction(n => !!parkQA.scene.getObjectByName(n), name);
    const target = await page.evaluate(n => parkQA.scene.getObjectByName(n).getWorldPosition(parkQA.camera.position.clone()).toArray(), name);
    await controllerAim(page, target);
    await button(page, 'trigger');
  }
  await page.waitForFunction(() => !!parkQA.scene.getObjectByName('backpack:ground'));
  for (const [xz,allowed] of [[water,false],[bench,false],[legal,true]]) {
    await page.evaluate(([x,z]) => {
      const heading = Math.atan2(parkQA.eye[0]-x, parkQA.eye[2]-z);
      parkDevice.quaternion.set(0,Math.sin(heading*.5),0,Math.cos(heading*.5));
    }, xz);
    await frames(page);
    await controllerAim(page, [xz[0],.012,xz[1]]);
    await marker(page, ...xz, allowed);
    await button(page, 'trigger');
    if (allowed) await actorPlaced(page, xz);
    else await stillPlacing(page);
  }
}

async function visualControls(page, tour, data) {
  // All material controls keep the real room's exposure and sky fixed. The
  // near tree portraits look at opposite faces of the same tree on its actual
  // sun axis. Other views are the ordinary player-facing camera menu entries.
  const leaves = [0,1,2,3].map(i => 'park:zelkova-leaves-' + i), shade = ['terminus:park-tree-shadows'];
  await page.waitForFunction(names => names.every(name => parkQA.scene.getObjectByName(name)?.material.map?.image?.width > 0), [...leaves,...shade]);
  const pair = async (key, hide, view, samples) => {
    const stats = data[key] = await capture(page, key, {hide,view,samples,control:true});
    assert(stats.changed >= 120, `${key}: no visible contribution: ${JSON.stringify(stats)}`);
    if (hide === shade) assert(stats.darker >= 120, `${key}: no visible darkening of the ground`);
  };
  await pair('entry-far-leaves', leaves);
  await pair('entry-far-shade', shade);
  const sunlit = {eye:[14.8,1.60,18.95],aim:[13,3.95,23]};
  const shaded = {eye:[11.35,1.52,26.8],aim:[13,3.95,23]};
  await pair('near-sunlit-leaves', leaves, sunlit);
  await pair('near-shaded-leaves', leaves, shaded);
  await tour('shoreParkSeats');
  await capture(page, 'seat-tour');
  await pair('shaded-bench-and-sunlit-paving', shade, {eye:[4.8,1.65,29.4],aim:[9.5,.3,30.4]}, {
    sunlit:[8.75,.02,28.1], shaded:[9.4,.02,32],
  });
  const {sunlit:lit, shaded:shadow} = data['shaded-bench-and-sunlit-paving'].patches;
  assert(Math.abs(lit) < 4 && shadow-lit > 5, `Matched ground shade removal: sunny ${lit}, shaded ${shadow}`);
  await tour('shoreParkFountain');
  await page.waitForFunction(() => parkQA.scene.getObjectByName('terminus:fountain-water')?.material.envMap?.isCubeTexture);
  await capture(page, 'fountain-from-square');
  const view = {eye:[1.55,1.34,20.15],aim:[4,.96,23]};
  for (const part of ['water','jets','spray']) {
    const key = 'fountain-close-' + part;
    const spec = {hide:['terminus:fountain-' + part],view};
    const first = await capture(page, key + '-a', {...spec,control:true,motion:'first'});
    // Take at a genuinely different native morph/instance pose. Multiple
    // phases allow a thin jet to line up with a highlight on one frame.
    let later;
    for (let i=0; i<3; i++) {
      later = await capture(page, key + '-b', {...spec,motion:'later'});
      if (later.moving >= 12) break;
      await frames(page, 3+i*4);
    }
    data[key] = {first,later};
    assert(first.changed >= 24 && later.moving >= 12,
      `${key}: no visible motion on stable-background pixels: ${JSON.stringify(data[key])}`);
  }
  await page.evaluate(() => { delete parkQA.waterBackground; delete parkQA.waterBaseline; });
  await tour('shoreParkShops');
  await capture(page, 'far-end-shops');
  await tour('shoreParkReturn');
  await capture(page, 'return-to-station');
}

async function main() {
  const { zh } = require('../src/i18n/zh.ts');
  const { parkShots, parkSeats, fountainCourt } = require('../src/mmdVrShowcase/scenery/terminus/parkLayout.ts');
  const bench = [parkSeats[0].x,parkSeats[0].z], water = [fountainCourt.x,fountainCourt.z], legal = [11.2,35.2];
  const dev = process.argv.includes('--dev');
  const { createServer, preview } = await import('vite');
  const server = dev ? await createServer({logLevel:'error', server:{host:'127.0.0.1',port:0,hmr:false}})
    : await preview({configFile:false, build:{outDir:'dist'}, preview:{host:'127.0.0.1',port:0}});
  let browser;
  const report = { controls: {}, route: [], rayTargets: { water, bench, legal } };
  try {
    if (dev) await server.listen();
    await fs.mkdir(out, {recursive:true});
    browser = await chromium.launch({channel:'msedge', headless:true, args:[
      '--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--no-proxy-server','--disable-background-timer-throttling',
    ]});
    const page = await browser.newPage({locale:'zh-CN', viewport:{width:1250,height:810}, deviceScaleFactor:1});
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /shader|program|webgl|texture/i.test(m.text())) errors.push(m.text()); });
    const liveSun=process.argv.includes('--sun');
    await page.addInitScript({content:(await fs.readFile(path.join(smoke,'iwer.js'),'utf8')) + `\n;(${instrument})(${liveSun});`});
    await page.goto(server.resolvedUrls.local[0] + '?set=seasideTerminus');
    const { makeSwatch } = await import('../experiments/gpu-cloth/swatch.js');
    const file = makeSwatch();
    await page.locator('input[type=file]').nth(1).setInputFiles({name:file.name,mimeType:'application/octet-stream',buffer:Buffer.from(await file.arrayBuffer())});
    await page.locator('.stage-report-stats').waitFor();
    await page.locator('.stage-launch-row .stage-btn-secondary').first().click();
    await page.waitForFunction(() => parkQA.frames > 5);
    report.screenGL = await page.evaluate(() => parkQA.screenGL);
    verifyGL(report.screenGL);
    const tour = async key => {
      const shot = parkShots.find(s => s.key === key);
      assert(shot && zh[key], 'Missing park tour ' + key);
      await page.locator('.screen-corner select').selectOption({label:zh[key]});
      await page.waitForFunction(eye => parkQA.camera.position.distanceTo(parkQA.camera.position.clone().fromArray(eye)) < .02, shot.eye);
      await frames(page);
    };
    await tour('shoreParkEntry');
     await page.waitForLoadState('networkidle');
     if(process.argv.includes('--depth')){
       const results=await page.evaluate(require('./park-depth-take.cjs'));
       await fs.writeFile(path.join(out,'screen-depth.json'),JSON.stringify(results,null,2)+'\n');
       console.log('WebGL park opaque depth ties:',JSON.stringify(results));
       assert.deepEqual(await page.evaluate(()=>parkQA.errors),[]);assert.deepEqual(errors,[]);
       return;
     }
     if(liveSun){
       await tour('shoreParkSeats');await frames(page,6);
       const leaves=[0,1,2,3].map(i=>'park:zelkova-leaves-'+i);
       assert(await page.evaluate(names=>parkQA.renderer.shadowMap.enabled&&!parkQA.scene.getObjectByName('terminus:park-tree-shadows')&&names.every(n=>parkQA.scene.getObjectByName(n)?.castShadow),leaves));
       const sample=await capture(page,'sun-shadow-at-seat',{hide:leaves,shadowOnly:true,control:true});
       assert(sample.darker>300,'Expected the leaf casters to shade the park: '+JSON.stringify(sample));
       assert.deepEqual(await page.evaluate(()=>parkQA.errors),[]);assert.deepEqual(errors,[]);
       console.log('Park real-time leaf shadows without the baked overlay',sample);return;
     }
    await visualControls(page, tour, report.controls);
    await tour('shoreParkFountain');
    await page.locator('.screen-corner button[aria-expanded]').click();
    await page.locator('.screen-item').first().click();
    await page.waitForFunction(() => !!parkQA.scene.getObjectByName('backpack:ground'));
    await frames(page);
    await pointAtDeck(page, ...water, false);
    await tour('shoreParkSeats');
    await pointAtDeck(page, ...bench, false);
    await tour('shoreParkShops');
    await pointAtDeck(page, ...legal, true);
    await actorPlaced(page, legal);
    const actor = await capture(page, 'far-end-screen-pmx', {actor:true,control:true});
    assert(actor.changed > 80, 'Placed PMX did not draw on the far court: ' + JSON.stringify(actor));
    report.controls.actor = actor;
    assert.deepEqual(await page.evaluate(() => parkQA.errors), []);
    console.log('Screen: park tours, same-frame visual controls, red bench/water rays and far-end PMX passed.');

    await page.locator('.screen-back').click();
    await page.locator('.stage-launch-row .stage-btn-primary[data-xr-backend="webgl"]').click();
    await page.waitForFunction(() => parkQA.stereoFrames > 5 && parkQA.rayOrigin);
    verifyGL(await page.evaluate(() => parkQA.xrGL));
    const approach = [[-1,5],[-1,12],[1,16],[0,22],[0,28],[5,32]];
    const seatsToFountain = [[bench[0]-1.5,bench[1]],[8,26.4],[7.5,23]];
    for (const target of approach) report.route.push(await walk(page, target));
    await xrPlacement(page, zh, bench, water, legal);
    for (const target of [...seatsToFountain,...seatsToFountain.slice(0,-1).reverse(),...approach.slice().reverse(),[0,0]]) {
      report.route.push(await walk(page, target));
    }
    await actorPlaced(page, legal);
    report.xrGL = await page.evaluate(() => parkQA.xrGL);
    const shaderErrors = await page.evaluate(() => parkQA.errors);
    assert.deepEqual(shaderErrors, []);
    await page.evaluate(() => parkQA.renderer.xr.getSession().end());
    await page.locator('.stage-launch-row').waitFor();
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(out,'verification.json'), JSON.stringify(report,null,2) + '\n');
    console.log('XR: tracked park round trip and native controller placement passed.', report.xrGL.device, out);
  } finally {
    try { await browser?.close(); } finally { await server.close(); }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
