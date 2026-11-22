/** Per XR session, reset alongside the callback cadence. Measures only the
 * visible figure's main-thread tick, not worker compute or GPU texture time. */
export type FigureWork={ticks:number;textureUpdates:number;mainMs:number;maxMainMs:number};
const windows=new WeakMap<XRSession,FigureWork>();
export function recordFigureTick(session:XRSession,ms:number,changed:boolean){
  let w=windows.get(session);if(!w){w={ticks:0,textureUpdates:0,mainMs:0,maxMainMs:0};windows.set(session,w);}
  w.ticks++;w.textureUpdates+=Number(changed);w.mainMs+=ms;w.maxMainMs=Math.max(w.maxMainMs,ms);
}
export function takeFigureWork(session:XRSession){const w=windows.get(session);windows.delete(session);return w;}
