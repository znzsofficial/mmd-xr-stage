// Read-only measurements of the two displayed calves. Device poses, UI presses
// and renderer readback are owned by the take that calls this module.
import { _roots } from '@react-three/fiber';
import { Ray, Vector3 } from 'three';
import { useBackpack } from '../../src/mmdVrShowcase/backpack/store';
import { readStockingState, useStockings } from '../../src/mmdVrShowcase/wardrobe/stockingState';
import { pickStockingSurface, stockingFitStatus } from '../../src/mmdVrShowcase/wardrobe/stockingSurface';

const sides = ['left', 'right'];
const vec = () => new Vector3();

export function observe(asset) {
  const { runtimeId } = useBackpack.getState().live[asset];
  const floor = [..._roots.values()].map(r => r.store.getState()).find(s => s.scene.children.some(o => o.userData.mmdModelId === runtimeId));
  if (!floor) throw Error('No mounted room for the selected PMX');
  const root = floor.scene.children.find(o => o.userData.mmdModelId === runtimeId);
  let mesh;
  root.traverse(o => { if (o.isSkinnedMesh && o.userData.mmdMorphs) mesh ??= o; });
  if (!mesh) throw Error('No rendered PMX skeleton');
  const original = [mesh.material].flat().map(m => ({ m, map:m.map, visible:m.visible, opacity:m.opacity }));
  const {gl, camera} = floor, xr = gl.xr.isPresenting, canvas = gl.domElement;
  const origin = xr && gl.xr.getCamera().parent;
  const images = new Map();
  const bones = sides.map((side,i) => {
    const prefix = ['左','右'][i];
    return [[prefix+'足首',side+'ankle',side+'foot'],[prefix+'ひざ',prefix+'膝',side+'knee',side+'leg']].map(names => {
      const bones = mesh.skeleton.bones;
      for (const name of names) {
        const b = bones.find(b => [b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n => n?.toLowerCase().replace(/[\s_.-]/g,'') === name));
        if (b) return b;
      }
      throw Error('Use a PMX with independently articulated ankles and knees');
    });
  });
  function legs() { return bones.map(pair => pair.map(b => b.getWorldPosition(vec()))); }
  function status() {
    const {worn,tears} = readStockingState(asset), armed = useStockings.getState().armed;
    return {worn,tears,armed:armed?.assetId===asset && armed.runtimeId===runtimeId, fit:stockingFitStatus(runtimeId),
      original:original.every(({m,map,visible,opacity},i) => [mesh.material].flat()[i]===m && m.map===map && m.visible===visible && m.opacity===opacity),
      selected:useBackpack.getState().selected===asset, live:useBackpack.getState().live[asset]?.runtimeId===runtimeId};
  }
  function project(p) {
    const r = canvas.getBoundingClientRect(), q = p.clone().project(camera);
    return [r.x+(1+q.x)*r.width/2, r.y+(1-q.y)*r.height/2];
  }
  function screenFrame() {
    const [a,k] = legs()[0].map(project), [b] = legs()[1].map(project);
    const box = canvas.getBoundingClientRect();
    return {center:[(a[0]+b[0])/2,(a[1]+k[1])/2], target:[box.x+box.width/2,box.y+box.height/2], length:Math.hypot(a[0]-k[0],a[1]-k[1])};
  }
  function plan(side) {
    const [ankle,knee] = legs()[sides.indexOf(side)], length = ankle.distanceTo(knee);
    const front = xr ? vec().set(0,0,1).transformDirection(origin.matrixWorld) : null;
    for (const fraction of [.36,.5,.25,.62]) {
      const start = ankle.clone().lerp(knee,fraction), end = start.clone().addScaledVector(knee.clone().sub(ankle).normalize(),.068);
      if (fraction+.068/length>.96) continue;
      const route = [];
      for (let i=0;i<=8;i++) {
        const target = start.clone().lerp(end,i/8);
        // Start OUTSIDE the actor's coarse XR selection volume. A synthetic
        // ray from inside it would bypass the player's normal targeting route.
        const from = xr ? target.clone().addScaledVector(front,Math.max(1.75,useBackpack.getState().live[asset].bounds?.size[1] ?? 0)) : camera.getWorldPosition(vec());
        const hit = pickStockingSurface(runtimeId,new Ray(from,target.clone().sub(from).normalize()));
        if (!hit || hit.side!==side) break;
        const [x,y] = project(hit.point);
        if (!xr && document.elementFromPoint(x,y)!==canvas) break;
        route.push(xr ? {from:origin.worldToLocal(from).toArray(),to:origin.worldToLocal(hit.point.clone()).toArray()} : [x,y]);
      }
      if (route.length===9) return {route,fraction};
    }
    throw Error('No continuous 6.8 cm player-visible stocking stroke; inspect calf exposure, shoes and framing');
  }

  function storeImage(tag, frames, cameras) {
    const rows = frames.map((image,i) => {
      const {width:w,height:h} = image;
      // The mock display in xr-room-shim reports an inset subimage viewport.
      const insetX = xr ? 4 : 0, insetY = xr ? 5 : 0;
      const lines = legs().map(pair => pair.map(v => {
        const p = v.project(cameras[i]);
        return [insetX+(1+p.x)*(w-2*insetX)/2, insetY+(1-p.y)*(h-2*insetY)/2];
      }));
      const xy = lines.flat(), pad = Math.ceil(Math.max(...lines.map(([a,b])=>Math.hypot(a[0]-b[0],a[1]-b[1])))*.29);
      const lo = [0,1].map(k=>Math.floor(Math.min(...xy.map(p=>p[k])))-pad), hi=[0,1].map(k=>Math.ceil(Math.max(...xy.map(p=>p[k])))+pad);
      if (xy.some(([x,y])=>x<=0||x>=w||y<=0||y>=h)) throw Error('Calf landmarks outside the displayed image');
      const crop=document.createElement('canvas'); crop.width=hi[0]-lo[0]; crop.height=hi[1]-lo[1];
      crop.getContext('2d').putImageData(image,-lo[0],-lo[1]);
      return {image,lines,png:crop.toDataURL().split(',')[1]};
    });
    images.set(tag,rows);
    return rows.map(r=>r.png);
  }
  async function screen(tag,png) {
    const img=new Image(); img.src='data:image/png;base64,'+png; await img.decode();
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const ctx=c.getContext('2d'); ctx.drawImage(img,0,0);
    return storeImage(tag,[ctx.getImageData(0,0,img.width,img.height)],[camera]);
  }
  async function eyes(tag) {
    const cfg=window.labFixture;
    if (cfg.take) throw Error('Overlapping XR readback');
    const at=vec(); for (const v of legs().flat()) at.add(v); origin.worldToLocal(at.multiplyScalar(.25));
    const oldX=cfg.headX; cfg.headX=at.x;
    let timer;
    try {
      return await new Promise((resolve,reject)=>{
        timer=setTimeout(()=>reject(Error('No submitted WebGPU stocking frames')),15000);
        let n=0;
        cfg.take={eyeY:at.y,eyeZ:at.z+.49,inputs(){this.time=performance.now();},afterDraw(session){
          if (++n!==4) return;
          // Preserve these exact submitted eye matrices until mapping completes.
          const cameras=gl.xr.getCamera().cameras.map(c=>{const copy=c.clone(false);copy.matrixWorldInverse.copy(c.matrixWorldInverse);return copy;});
          session.copyEyes().then(pair=>storeImage(tag,pair,cameras)).then(resolve,reject);
        }};
      });
    } finally { clearTimeout(timer);cfg.take=null;cfg.headX=oldX; }
  }
  // Only pixels of the worn layer (changed from the OFF view) are evidence of
  // a hole. Compare them to the author's own skin/print and to the other calf.
  function compare(off,intact,torn,fraction=.36) {
    return images.get(off).map(({image:base,lines},eye)=>{
      const wear=images.get(intact)[eye], test=images.get(torn)[eye];
      for (const row of [wear,test]) {
        if (row.image.width!==base.width || row.image.height!==base.height || row.lines.flat(2).some((n,i)=>Math.abs(n-lines.flat(2)[i])>.65)) throw Error('Pose, projection or viewport moved between matched frames');
      }
      const reports=sides.map(()=>({samples:0,garment:0,changed:0,revealed:0,nearStroke:0}));
      const delta=(a,b,k)=>Math.max(...[0,1,2].map(c=>Math.abs(a.data[k+c]-b.data[k+c])));
      const lengths=lines.map(([a,b])=>Math.hypot(b[0]-a[0],b[1]-a[1]));
      const bounds=lines.flat(),pad=Math.ceil(.27*Math.max(...lengths));
      const lo=[0,1].map(i=>Math.max(0,Math.floor(Math.min(...bounds.map(p=>p[i])))-pad));
      const hi=[base.width,base.height].map((n,i)=>Math.min(n,Math.ceil(Math.max(...bounds.map(p=>p[i])))+pad));
      for (let y=lo[1];y<hi[1];y++) for(let x=lo[0];x<hi[0];x++) {
        const spans=lines.map(([a,b],i)=>{
          const dx=b[0]-a[0],dy=b[1]-a[1],t=((x-a[0])*dx+(y-a[1])*dy)/lengths[i]**2;
          return {t,dist:Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)/lengths[i]};
        });
        const side=spans[0].dist<spans[1].dist?0:1,{t,dist}=spans[side];
        if (dist>.24 || t<.04 || t>.96) continue;
        const k=4*(y*base.width+x), r=reports[side], covered=delta(base,wear.image,k), changed=delta(wear.image,test.image,k);
        r.samples++; if (covered>12) r.garment++; if (changed<=8) continue;
        r.changed++;
        if (covered>12 && delta(test.image,base,k)<covered*.65) {
          r.revealed++; if (t>fraction-.15 && t<fraction+.36) r.nearStroke++;
        }
      }
      return reports;
    });
  }
  return {status, screenFrame, plan, screen, eyes, compare,
    feet:()=>legs().flat().map(p=>p.toArray()), project:p=>project(vec().fromArray(p))};
}
