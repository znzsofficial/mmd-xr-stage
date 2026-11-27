import { type Camera, type Ray, Raycaster, Vector2 } from 'three';

/** Native capture runs before OrbitControls (canvas) and stage picking (parent).
 * In tear mode a missed primary press is a miss, not a camera gesture. */
export function bindStockingPointer(canvas: HTMLCanvasElement, camera: Camera, input: {
  enabled(): boolean;
  begin(ray: Ray, e: PointerEvent): void;
  release(ray: Ray, e: PointerEvent): void;
  cancel(id: number): void;
}) {
  const caster = new Raycaster(), ndc = new Vector2(), pressed = new Set<number>();
  const ray = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    caster.setFromCamera(ndc.set(2*(e.clientX-r.left)/r.width-1, 1-2*(e.clientY-r.top)/r.height), camera);
    return caster.ray;
  };
  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
  const down = (e: PointerEvent) => {
    if (!input.enabled() || e.button !== 0) return;
    stop(e); pressed.add(e.pointerId);
    if (e.pointerType !== 'touch' || e.isPrimary) input.begin(ray(e), e);
  };
  const move = (e: PointerEvent) => {
    if (!pressed.has(e.pointerId)) return;
    stop(e);
    if (!(e.buttons & 1)) { pressed.delete(e.pointerId); input.cancel(e.pointerId); }
  };
  const up = (e: PointerEvent) => {
    if (e.button !== 0 || !pressed.delete(e.pointerId)) return;
    stop(e); input.release(ray(e), e);
  };
  const cancel = (e: PointerEvent) => { if (pressed.delete(e.pointerId)) input.cancel(e.pointerId); };
  const leave = (e: PointerEvent) => { if (!canvas.hasPointerCapture(e.pointerId)) cancel(e); };
  const click = (e: MouseEvent) => { if (input.enabled() && e.button === 0) stop(e); };
  const wheel = (e: WheelEvent) => { if (pressed.size) stop(e); };
  canvas.addEventListener('pointerdown', down, true); canvas.addEventListener('pointermove', move, true);
  canvas.addEventListener('pointerup', up, true); canvas.addEventListener('pointercancel', cancel, true);
  canvas.addEventListener('pointerleave', leave, true);
  canvas.addEventListener('lostpointercapture', cancel, true); canvas.addEventListener('click', click, true);
  canvas.addEventListener('wheel', wheel, { capture: true, passive: false });
  return () => {
    canvas.removeEventListener('pointerdown', down, true); canvas.removeEventListener('pointermove', move, true);
    canvas.removeEventListener('pointerup', up, true); canvas.removeEventListener('pointercancel', cancel, true);
    canvas.removeEventListener('pointerleave', leave, true);
    canvas.removeEventListener('lostpointercapture', cancel, true); canvas.removeEventListener('click', click, true);
    canvas.removeEventListener('wheel', wheel, true);
    for (const id of pressed) input.cancel(id);
  };
}
