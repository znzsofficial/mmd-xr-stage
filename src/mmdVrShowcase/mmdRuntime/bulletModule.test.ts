import { afterEach, expect, it, vi } from 'vitest';
import type { PhysicsSwitchWork } from '../diagnostics/physicsSwitchWork';

const api = vi.hoisted(() => ({loadCustomBulletMmdModule: vi.fn(), createCustomBulletMmdPhysicsBackend: vi.fn()}));
vi.mock('@yohawing/three-mmd-loader/physics', () => api);
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

async function page(hasIdle = true) {
  vi.resetModules();
  let idle: (() => void) | undefined, timer: (() => void) | undefined;
  vi.stubGlobal('window', { location: {origin:'https://stage.test'}, requestIdleCallback: hasIdle ? (cb: () => void) => { idle=cb;return 1; } : undefined, cancelIdleCallback: () => { idle=undefined; },
    setTimeout: (cb: () => void) => { timer=cb;return 2; }, clearTimeout: () => { timer=undefined; } });
  api.createCustomBulletMmdPhysicsBackend.mockReturnValue({name:'bullet',step: vi.fn()});
  const {scheduleBulletModuleWarm} = await import('./bulletModule');
  const {createBulletPhysicsBackend} = await import('./mmdPhysics');
  return {scheduleBulletModuleWarm, createBulletPhysicsBackend, runIdle: () => {const cb=idle;idle=undefined;cb?.();}, runTimer: () => {const cb=timer;timer=undefined;cb?.();}};
}

it.each([true, false])('loads without an idle turn (idle API: %s), waits out asset work, cancels on retirement', async hasIdle => {
  const {scheduleBulletModuleWarm:warm, createBulletPhysicsBackend:enable, runTimer, runIdle} = await page(hasIdle);
  api.loadCustomBulletMmdModule.mockResolvedValue({});
  let busy = true;
  const eligible = () => busy ? 'busy' as const : true;
  const cancel = warm(eligible);
  runTimer();cancel?.();busy=false;runTimer();runIdle();
  expect(api.loadCustomBulletMmdModule).not.toHaveBeenCalled();
  busy=true;warm(eligible);runTimer();busy=false;
  expect(api.loadCustomBulletMmdModule).not.toHaveBeenCalled();runTimer();runIdle();
  await vi.waitFor(() => expect(api.loadCustomBulletMmdModule).toHaveBeenCalledOnce());
  expect(api.createCustomBulletMmdPhysicsBackend).not.toHaveBeenCalled();
  const work:PhysicsSwitchWork = {};await enable({switchWork:work});expect(work.moduleAtFirstRequest).toBe('warmed');
});

it('loads only module code in idle time, and a real toggle shares the pending request', async () => {
  const {scheduleBulletModuleWarm:warm,createBulletPhysicsBackend:enable,runIdle} = await page();
  let ready!: () => void;
  api.loadCustomBulletMmdModule.mockImplementation(() => new Promise(resolve => {ready=()=>resolve({});}));
  warm(() => false);runIdle();warm(() => true)?.();runIdle();
  warm(() => true);expect(api.loadCustomBulletMmdModule).not.toHaveBeenCalled();runIdle();
  await vi.waitFor(() => expect(api.loadCustomBulletMmdModule).toHaveBeenCalledOnce());
  expect(api.createCustomBulletMmdPhysicsBackend).not.toHaveBeenCalled();
  const first:PhysicsSwitchWork={}, pending=enable({switchWork:first});ready();await pending;
  const later:PhysicsSwitchWork={};await enable({switchWork:later});
  expect([first.moduleAtFirstRequest,later.moduleAtFirstRequest]).toEqual(['warming','warmed']);
  expect(api.loadCustomBulletMmdModule).toHaveBeenCalledOnce();expect(api.createCustomBulletMmdPhysicsBackend).toHaveBeenCalledTimes(2);
});

it('silently drops speculative failures, retrying once on explicit demand even if it joined mid-flight', async () => {
  const {scheduleBulletModuleWarm:warm,createBulletPhysicsBackend:enable,runIdle} = await page();
  let fail!: (e:Error)=>void;
  api.loadCustomBulletMmdModule.mockImplementationOnce(()=>new Promise((_,r)=>{fail=r;})).mockResolvedValueOnce({});
  warm(()=>true);runIdle();await vi.waitFor(()=>expect(api.loadCustomBulletMmdModule).toHaveBeenCalledOnce());
  const pending=enable();fail(new Error('offline during warm'));await pending;
  expect(api.loadCustomBulletMmdModule).toHaveBeenCalledTimes(2);expect(api.createCustomBulletMmdPhysicsBackend).toHaveBeenCalledOnce();
});

it('an earlier failed warm does not prevent normal enable errors or later explicit retry', async () => {
  const {scheduleBulletModuleWarm:warm,createBulletPhysicsBackend:enable,runIdle} = await page();
  api.loadCustomBulletMmdModule.mockRejectedValueOnce(Error('offline')).mockRejectedValueOnce(Error('still offline')).mockResolvedValueOnce({});
  warm(()=>true);runIdle();await vi.waitFor(()=>expect(api.loadCustomBulletMmdModule).toHaveBeenCalledOnce());
  warm(()=>true);runIdle();const work:PhysicsSwitchWork={};await expect(enable({switchWork:work})).rejects.toThrow('still offline');
  expect(work.moduleAtFirstRequest).toBe('warm-failed');expect(api.createCustomBulletMmdPhysicsBackend).not.toHaveBeenCalled();
  await enable();expect(api.loadCustomBulletMmdModule).toHaveBeenCalledTimes(3);expect(api.createCustomBulletMmdPhysicsBackend).toHaveBeenCalledOnce();
});
