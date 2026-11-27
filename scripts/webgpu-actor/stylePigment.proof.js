// Opt-in browser fixture. Run from Vite, without private PMX assets or XR.
import { DataTexture, Mesh, MeshToonMaterial, OrthographicCamera, PlaneGeometry, Scene, SRGBColorSpace, WebGPURenderer } from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { createMmdTslMaterialFromSource } from '@yohawing/three-mmd-loader/webgpu';
import { mmdStylePigment } from './mmdStylePigment.js';

export async function verifyMmdStylePigment() {
  const renderer = new WebGPURenderer({antialias:false}), errors = [], rows = [];
  renderer.onError = e => errors.push(e.message);
  const map = new DataTexture(new Uint8Array([194,131,87,255]),1,1);
  map.colorSpace = SRGBColorSpace; map.needsUpdate = true;
  const geo = new PlaneGeometry(2,2), camera = new OrthographicCamera(-1,1,1,-1,.1,10), scene = new Scene();
  camera.position.z = 1;
  const copy = document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  function pixel(mat,node) {
    mat.colorNode = node; mat.needsUpdate = true; renderer.render(scene,camera);
    copy.drawImage(renderer.domElement,0,0); return [...copy.getImageData(8,8,1,1).data].slice(0,3);
  }
  function check(actual,expected,label) {
    if (actual.some((c,i)=>Math.abs(c-expected[i])>1)) throw Error(`${label}: ${actual} vs ${expected}`);
  }
  try {
    await renderer.init(); if (!renderer.backend.isWebGPUBackend) throw Error('WebGPU required');
    renderer.setPixelRatio(1); renderer.setSize(16,16,false);
    for (const textured of [true,false]) {
      const src = new MeshToonMaterial({map:textured ? map : null}), mat = createMmdTslMaterialFromSource(src);
      const mesh = new Mesh(geo,mat); scene.add(mesh);
      try {
        const fork = mat.colorNode, pigment = mmdStylePigment(mat), share = pigment.resolve(vec3(1),vec3(0));
        const u = mat.userData.mmdTslMaterialUniforms; u.lightDirection.set(0,0,1); u.lightColor.setScalar(1);
        // Same authored neutral under unit white, different ability to relight.
        // The coloured case has an ambient-only channel, a direct-only one and
        // one with no pigment. Vary the live factor without rebuilding inputs.
        for (const [d,a,f,expectedShare] of [
          [[1,1,1],[0,0,0],[1,1,1,1],[255,255,255]],
          [[.5,.5,.5],[.5,.5,.5],[1,1,1,1],[188,188,188]],
          [[0,.3,0],[.8,0,0],[.3,1.3,0,.5],[0,255,0]],
        ]) {
          u.diffuse.fromArray(d); u.ambient.fromArray(a); u.textureFactor.fromArray(f);
          const original = pixel(mat,fork), neutral = pixel(mat,pigment.paint);
          check(neutral,original,'unit-white fork'); check(pixel(mat,share),expectedShare,'relight share');
          const texel = textured ? [194,131,87] : [255,255,255];
          check(neutral,texel.map((c,i)=>Math.min(255,c*Math.min(1,d[i]+a[i])*(1+(f[i]-1)*f[3]))),'authored RGB');
          u.lightColor.setScalar(0); check(pixel(mat,pigment.paint),neutral,'room light entered pigment'); u.lightColor.setScalar(1);
          rows.push({textured,d,a,f,neutral,original});
        }
      } finally { scene.remove(mesh); mat.dispose(); src.dispose(); }
    }
    await renderer.backend.device.queue.onSubmittedWorkDone(); await new Promise(r=>requestAnimationFrame(r));
    if (errors.length) throw Error(errors.join('\n')); return rows;
  } finally { geo.dispose(); map.dispose(); await renderer.dispose(); }
}
