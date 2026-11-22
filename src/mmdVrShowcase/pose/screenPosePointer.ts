import { type Camera, type Mesh, Raycaster, Vector2, type Ray, type Vector3 } from 'three';

/** Intercept native events only on the acquired gizmo. OrbitControls runs on the
 * canvas, R3F dispatches on its containing div, so stopping only R3F is too late. */
export function bindScreenPosePointer(canvas: HTMLCanvasElement, camera: Camera, input: {
  enabled(): boolean;
  targets(): Mesh[];
  begin(mesh: Mesh, ray: Ray, point: Vector3, e: PointerEvent): boolean;
  owner(): number | undefined;
  move(ray: Ray): void;
  release(cancel: boolean): void;
}) {
  const rc = new Raycaster(), ndc = new Vector2();
  const rayAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height);
    rc.setFromCamera(ndc,camera); return rc.ray;
  };
  const stop = (e: Event) => { if (e.cancelable) e.preventDefault(); e.stopImmediatePropagation(); };
  let preventClick = false;
  function down(e: PointerEvent) {
    if (input.owner() !== undefined) { stop(e); return; }
    preventClick = false;
    if (e.button !== 0 || (e.pointerType === 'touch' && !e.isPrimary) || !input.enabled()) return;
    const ray = rayAt(e), hit = rc.intersectObjects(input.targets(),false)[0];
    if (hit && input.begin(hit.object as Mesh,ray,hit.point,e)) { preventClick = true; stop(e); }
  }
  const move = (e: PointerEvent) => {
    if (input.owner() !== e.pointerId) return;
    stop(e); if (!input.enabled() || !(e.buttons & 1)) input.release(true); else input.move(rayAt(e));
  };
  const up = (e: PointerEvent) => {
    if (input.owner() !== e.pointerId) return;
    stop(e); const valid = input.enabled(); if (valid) input.move(rayAt(e)); input.release(!valid);
  };
  const cancel = (e: PointerEvent) => { if (input.owner() === e.pointerId) input.release(true); };
  const click = (e: Event) => { if (preventClick) { stop(e); preventClick = false; } };
  const wheel = (e: WheelEvent) => { if (input.owner() !== undefined) stop(e); };
  canvas.addEventListener('pointerdown',down,true); canvas.addEventListener('pointermove',move,true); canvas.addEventListener('pointerup',up,true);
  canvas.addEventListener('pointercancel',cancel,true); canvas.addEventListener('lostpointercapture',cancel,true);
  canvas.addEventListener('click',click,true); canvas.addEventListener('wheel',wheel,{capture:true,passive:false});
  return () => {
    canvas.removeEventListener('pointerdown',down,true); canvas.removeEventListener('pointermove',move,true); canvas.removeEventListener('pointerup',up,true);
    canvas.removeEventListener('pointercancel',cancel,true); canvas.removeEventListener('lostpointercapture',cancel,true);
    canvas.removeEventListener('click',click,true); canvas.removeEventListener('wheel',wheel,true);
    if (input.owner() !== undefined) input.release(true);
  };
}
