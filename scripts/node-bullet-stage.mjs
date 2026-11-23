// Load the actual stage with Node's module hooks, replacing only the browser
// <script> bootstrap. No server, Canvas or renderer. One call per process.
import {readFileSync} from 'node:fs';
import {createRequire,registerHooks} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createCustomBulletMmdPhysicsBackend} from '@yohawing/three-mmd-loader/physics';

export async function loadNodeBulletStage(buildBackend = createCustomBulletMmdPhysicsBackend) {
  const app = new URL('../src/',import.meta.url).href, dir = new URL('../public/mmd/0.8.6/',import.meta.url);
  const {transformSync} = createRequire(import.meta.resolve('vite'))('rolldown/utils');
  const factory = runInNewContext(`${readFileSync(new URL('mmd_bullet.js',dir),'utf8')}; MmdBullet`,{console});
  const bullet = await factory({wasmBinary:readFileSync(new URL('mmd_bullet.wasm',dir))});
  globalThis.__benchBullet = async () => ({module:bullet, createCustomBulletMmdPhysicsBackend:buildBackend});
  const hooks = registerHooks({
    resolve(s,ctx,next) {
      if(ctx.parentURL?.startsWith(app) && s.startsWith('.')) {
        if(s==='./bulletModule')return {url:'data:text/javascript,export const getBulletModule=globalThis.__benchBullet;',shortCircuit:true};
        if(!/\.\w+$/.test(s))s+='.ts';
      }
      return next(s,ctx);
    },
    load(url,ctx,next) {
      if(url.startsWith(app) && url.endsWith('.ts'))return {
        format:'module',shortCircuit:true,source:transformSync(url,readFileSync(new URL(url),'utf8')).code,
      };
      return next(url,ctx);
    },
  });
  const {createMmdRuntimeHandle} = await import('../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts');
  return {bullet,createMmdRuntimeHandle,close(){delete globalThis.__benchBullet;hooks.deregister();}};
}
