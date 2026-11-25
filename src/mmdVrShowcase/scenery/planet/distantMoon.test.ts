import {ArrayCamera,Group,PerspectiveCamera,Vector3,type SphereGeometry} from 'three';
import {expect,it} from 'vitest';
import {moonLodEye,prepareDistantMoon} from './distantMoon';
import {moonShell} from './moonSurface';
import {lanes,windPoint} from './windAtlas';

const routes=lanes.filter(l=>l.moon.id==='ember'||l.moon.id==='frost');
const entry=new Vector3(0,2.18,3.45);

// Map each triangle back to the original longitude/latitude grid. All edges
// of the source stay within their coarse triangle; its only new interior
// edge can be a median crossing a source edge at its midpoint. Every vertex
// of their overlay is on this half-grid. Comparing there bounds the entire
// piecewise-linear surface, including the interiors of stitched cells.
function chart(g:SphereGeometry){
  const {widthSegments:w,heightSegments:h}=g.parameters,cols=2*w+1,index=g.index!,{start,count}=g.drawRange;
  const p=g.attributes.position,n=g.attributes.normal,xyz=new Float64Array(cols*(2*h+1)*6).fill(NaN);
  const edges=new Set<number>(),ids=p.count;
  function weld(i:number){const row=Math.floor(i/(w+1));return row===0?0:row===h?h*(w+1):row*(w+1)+i%(w+1)%w;}
  function edge(a:number,b:number){const reverse=b*ids+a;if(!edges.delete(reverse))edges.add(a*ids+b);}
  for(let i=start;i<start+count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
    edge(weld(a),weld(b));edge(weld(b),weld(c));edge(weld(c),weld(a));
    const x=a%(w+1)*2,y=Math.floor(a/(w+1))*2,bx=b%(w+1)*2-x,by=Math.floor(b/(w+1))*2-y,cx=c%(w+1)*2-x,cy=Math.floor(c/(w+1))*2-y;
    const det=bx*cy-by*cx;if(det>=0)throw Error('inverted chart triangle');
    for(let j=Math.min(0,by,cy);j<=Math.max(0,by,cy);j++)for(let k=Math.min(0,bx,cx);k<=Math.max(0,bx,cx);k++){
      const t=(k*cy-j*cx)/det,u=(bx*j-by*k)/det;if(t<0||u<0||t+u>1)continue;
      let off=((y+j)*cols+x+k)*6;
      for(const attr of [p,n])for(let axis=0;axis<3;axis++)xyz[off++]=(1-t-u)*attr.getComponent(a,axis)+t*attr.getComponent(b,axis)+u*attr.getComponent(c,axis);
    }
  }
  expect(edges.size).toBe(0);return xyz;
}

function uvBorder(g:SphereGeometry){
  const {widthSegments:w,heightSegments:h}=g.parameters,{start,count}=g.drawRange,faces:string[]=[];
  for(let i=start;i<start+count;i+=3){
    const ids=[g.index!.getX(i),g.index!.getX(i+1),g.index!.getX(i+2)];
    if(ids.some(id=>id%(w+1)<2||id%(w+1)>w-2||Math.floor(id/(w+1))<2||Math.floor(id/(w+1))>h-2))faces.push(ids.join('/'));
  }
  return faces.sort();
}

it.each(routes)('keeps $moon.id watertight, its UV cuts and its relief and lighting within the distant error budget',({moon})=>{
  const g=moonShell(moon),original=g.index!,attrs={...g.attributes},select=prepareDistantMoon(g);
  try{
    expect(g.index!.array.subarray(0,original.count)).toEqual(original.array);
    for(const key of ['position','normal','uv'])expect(g.attributes[key]).toBe(attrs[key]);
    const near=chart(g),border=uvBorder(g);select(entry.distanceToSquared(moon.centre));
    const far=chart(g),triangles=g.drawRange.count/3;
    expect(uvBorder(g)).toEqual(border);
    expect(g.drawRange.start).toBe(original.count);expect(triangles).toBeLessThan(12_000);
    let delta=0,normal=0;
    for(let i=0;i<near.length;i+=6){
      if(Number.isNaN(near[i])&&Number.isNaN(far[i]))continue; // outside the original UV polar fan
      delta=Math.max(delta,Math.hypot(near[i]-far[i],near[i+1]-far[i+1],near[i+2]-far[i+2]));
      normal=Math.max(normal,Math.hypot(near[i+3]-far[i+3],near[i+4]-far[i+4],near[i+5]-far[i+5]));
    }
    console.info(moon.id,{triangles,full:original.count/3,maximumMetres:delta,maximumNormalDelta:normal});
    expect(delta).toBeLessThanOrEqual(.016);expect(normal).toBeLessThanOrEqual(.085);
  }finally{g.dispose();}
});

it.each(routes)('restores $moon.id before the midpoint, keeps the original on landing, and holds through a turning stereo pair',lane=>{
  const {moon}=lane,g=moonShell(moon),select=prepareDistantMoon(g);
  const views=[new PerspectiveCamera(),new PerspectiveCamera()],rig=new ArrayCamera(views),origin=new Group(),eye=new Vector3();
  origin.add(rig);views[0].position.set(-.032,0,0);views[1].position.set(.032,0,0);rig.position.copy(views[0].position);
  function frame(){select(moonLodEye(rig,eye).distanceToSquared(moon.centre));return g.drawRange.start!==0;}
  try{
    origin.position.copy(entry);expect(frame()).toBe(true);
    const tiers:boolean[]=[];
    for(let i=0;i<=80;i++){
      windPoint(lane,i/80,origin.position).y+=1.65;tiers.push(frame());
    }
    expect(tiers[0]).toBe(true);expect(tiers[40]).toBe(false);expect(tiers.filter((t,i)=>i&&t!==tiers[i-1])).toHaveLength(1);
    for(const distance of [18.01,19,20.49,20.6,20.49,19,18.01,17.9]){
      origin.position.copy(moon.centre).x+=distance;
      for(let turn=0;turn<8;turn++){
        origin.rotation.y=turn*.79;const far=frame();
        if(turn===0)tiers.push(far);else expect(far).toBe(tiers.at(-1));
      }
    }
    expect(tiers.slice(-8)).toEqual([false,false,false,true,true,true,true,false]);
    const back:boolean[]=[];
    for(let i=80;i>=0;i--){windPoint(lane,i/80,origin.position).y+=1.65;back.push(frame());}
    expect(back[0]).toBe(false);expect(back.at(-1)).toBe(true);expect(back.filter((v,i)=>i&&v!==back[i-1])).toHaveLength(1);
    // A physical lean and eye height stay in the rotated tracking origin,
    // not in the first eye's frame or the previous render's world matrices.
    const tracked=new Vector3(.38,1.66,-.29);
    for(const view of views)view.position.add(tracked);rig.position.copy(views[0].position);origin.rotation.set(.48,.74,-.63);
    expect(moonLodEye(rig,eye).distanceTo(origin.localToWorld(tracked))).toBeLessThan(1e-8);
    const camera=new PerspectiveCamera();camera.position.copy(entry);expect(moonLodEye(camera,eye).toArray()).toEqual(entry.toArray());
  }finally{g.dispose();}
});
