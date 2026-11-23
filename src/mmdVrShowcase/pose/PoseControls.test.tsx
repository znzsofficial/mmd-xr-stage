// @vitest-environment jsdom
import { DefaultMmdRuntime, ThreeMmdLoader, disposeMmdModel } from '@yohawing/three-mmd-loader';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Texture } from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { useLanguageStore } from '../../languageStore';
import { useBackpack } from '../backpack';
import { useHudWorldInput } from '../components/hudWorldInput';
import { useMmdVrStore } from '../mmdVrStore';
import { PoseHudControls, PoseScreenControls } from './PoseControls';
import { poseFixture } from './poseFixture.testSupport';
import { mountPoseRoom } from './poseSession';
import { createPoseSolver, type PoseSolver } from './poseSolver';
import { posePresets } from './presetCatalog';

// Mount the real keys and dispatch their React events without opening a renderer.
vi.mock('../../shared/panelTexture', () => ({ createPanelTexture: () => ({ dispose() {} }), roundRectPath: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function editor(surface: 'screen' | 'xr', partial = false) {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  if (surface === 'xr') vi.spyOn(console, 'error').mockImplementation(() => {}); // R3F intrinsic elements in jsdom
  const loader = new ThreeMmdLoader({ runtimeFactory: () => new DefaultMmdRuntime(),
    textureLoader: { load: (_url, done) => { const texture = new Texture(); done?.(texture); return texture; } } });
  const fixture = poseFixture(partial), model = await loader.loadModel(fixture.pmx, { outline: false });
  const vmd = await loader.loadAnimation(fixture.vmd), seconds = .7;
  model.setAnimation(vmd); model.update(seconds, { physics: false });
  const stage = useMmdVrStore.getState(), bag = useBackpack.getState(), language = useLanguageStore.getState();
  useLanguageStore.setState({ language: 'zh' });
  const file = new File([], 'actor.pmx');
  useBackpack.setState({ entries: [{ id: 'a', kind: 'model', path: file.name, file }], selected: 'a',
    live: { a: { runtimeId: 'r', visible: true, position: [0,0,0] } } });
  useMmdVrStore.setState({ overlayOpen: true, presentation: surface, playing: true, duration: 2 });
  let solver: PoseSolver | null = null;
  const room = mountPoseRoom({ open: id => id === 'r' ? (solver = createPoseSolver(model, vmd, seconds)) : null,
    close: () => { solver?.dispose(); solver = null; }, dirty: () => model.update(seconds, { physics: false, ik: !solver }) });
  const host = document.createElement('div'), root = createRoot(host), onBack = vi.fn();
  const Controls = surface === 'xr' ? PoseHudControls : PoseScreenControls;
  const mount = () => act(() => root.render(<Controls assetId="a" runtimeId="r" onBack={onBack}/>));
  const key = (name: string) => surface === 'xr' ? host.querySelector<HTMLElement>(`[name="hud:${name}"]`) :
    [...host.querySelectorAll('button')].find(el => el.textContent === name);
  const press = async (name: string) => {
    const el = key(name); expect(el, name).toBeTruthy();
    await act(() => {
      if (surface === 'xr') for (const type of ['pointerdown','pointerup']) el!.dispatchEvent(new PointerEvent(type, { pointerId: 2, bubbles: true }));
      el!.click();
    });
  };
  const status = () => surface === 'xr' ? [...host.querySelectorAll('[name^="hud-label:"]')].map(el => el.getAttribute('name')).join('\n') : host.querySelector('[role=status]')?.textContent;
  const sample = () => { model.mesh.updateWorldMatrix(true, true); return model.mesh.skeleton.bones.flatMap(b => b.matrixWorld.toArray()); };
  const dispose = async () => { await act(() => root.unmount()); room.dispose(); disposeMmdModel(model);
    useBackpack.setState(bag); useMmdVrStore.setState(stage); useLanguageStore.setState(language); useHudWorldInput.setState({ blocked: false }); };
  return { mount, key, press, status, sample, dispose, onBack };
}
const delta = (a: number[], b: number[]) => Math.max(...a.map((n,i) => Math.abs(n-b[i])));

it.each(['screen','xr'] as const)('applies six poses with one press each on %s and edits, saves, undoes and restores the animated actor', async surface => {
  const ui = await editor(surface);
  try {
    const original = ui.sample(); await ui.mount();
    expect(ui.key('仰卧屈膝')).toBeFalsy(); expect(ui.key(surface === 'xr' ? 'Y +5°' : '+5°')).toBeTruthy();
    await ui.press('快速体位');
    expect(posePresets.map(p => p.zh)).toEqual(['仰卧屈膝','仰卧抬腿','四点跪撑','骑乘跪坐','侧卧屈腿','站姿前倾']);
    let before = original, last = original;
    for (const preset of posePresets) {
      await ui.press(preset.zh); expect(ui.status()).toContain(`已应用 · ${preset.zh}`);
      before = last; last = ui.sample(); expect(delta(last, before)).toBeGreaterThan(.04);
    }
    await ui.press('撤销'); expect(ui.status()).toContain('已撤销'); expect(delta(ui.sample(), before)).toBeLessThan(.001);
    await ui.press('调关节'); await ui.press(surface === 'xr' ? 'Y +5°' : '+5°'); const edited = ui.sample();
    expect(delta(edited, before)).toBeGreaterThan(.005);
    await ui.press('已存姿势'); await ui.press('保存新姿势');
    await ui.press('快速体位'); await ui.press('四点跪撑');
    await ui.press('已存姿势'); await ui.press('应用姿势'); expect(delta(ui.sample(), edited)).toBeLessThan(.001);
    await ui.press('恢复原动作'); expect(delta(ui.sample(), original)).toBeLessThan(.001);
    expect(ui.onBack).toHaveBeenCalledOnce(); expect(useMmdVrStore.getState().playing).toBe(true);
  } finally { await ui.dispose(); }
});

it('keeps unsupported poses inert and lets a capable joint still be edited on a partial rig', async () => {
  const ui = await editor('screen', true);
  try {
    await ui.mount(); await ui.press('快速体位'); const before = ui.sample();
    expect((ui.key('四点跪撑') as HTMLButtonElement).disabled).toBe(true); await ui.press('四点跪撑');
    expect(ui.status()).toContain('骨架不支持'); expect(delta(ui.sample(), before)).toBe(0);
    await ui.press('调关节'); await ui.press('+5°'); expect(delta(ui.sample(), before)).toBeGreaterThan(.005);
  } finally { await ui.dispose(); }
});

it.each(['deselect','recall'] as const)('rejects a late XR release following %s before React repaints', async interrupt => {
  const ui = await editor('xr');
  try {
    await ui.mount(); await ui.press('快速体位');
    await act(() => useLanguageStore.setState({ language: 'en' }));
    const key = ui.key(posePresets[0].en)!; expect(key).toBeTruthy(); const before = ui.sample();
    await act(() => {
      key.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
      if (interrupt === 'recall') useHudWorldInput.setState({ blocked: true }); else useBackpack.getState().select(null);
      key.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true })); key.click();
    });
    expect(ui.status()).not.toContain('Applied'); expect(delta(ui.sample(), before)).toBe(0);
    // A retained panel's retry cannot reopen the editor behind the public sheet or for a stale selection.
    await ui.press('Continue posing'); expect(ui.key('Quick poses')).toBeFalsy();
  } finally { await ui.dispose(); }
});
