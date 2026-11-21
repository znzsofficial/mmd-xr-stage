import {
  BufferGeometry, Color, CubicBezierCurve3, Float32BufferAttribute,
  InstancedBufferAttribute, InstancedBufferGeometry, Line3, Sphere, Vector3,
} from 'three';
import {terrainAltitude} from './opalTerrain';
import {lanes,allMoons,windPoint} from './windAtlas';
import {leapRoutes} from './leapAtlas';

// Three local wakes, not a shell around the viewer. The long one passes
// *behind* the binary; the middle one passes below the wind approaches and
// short of the twins. The last is a loose pocket on the return sightline.
const V = (x:number,y:number,z:number) => new Vector3(x,y,z);
const courses = [
  // Keep the eastern limb below the existing pulsar and both jets when
  // sighting from the north pad, including the offset screen entrance.
  new CubicBezierCurve3(V(-30,7.4,-43), V(-10,-10.5,-39), V(5,-1.8,-36), V(28,9,-40)),
  new CubicBezierCurve3(V(-8.7,-2.7,-18.7), V(-3.5,-2.8,-17.2), V(3,1.6,-15.8), V(8.4,1.5,-17)),
  new CubicBezierCurve3(V(-21,-6,6), V(-19,-5,14), V(-15,2,17), V(-9,3.3,23)),
];

// Bake the same control points into the vertex program instead of uploading
// positions or matrices for hundreds of moving grains on every XR frame.
const glslPoint = (v:Vector3) => `vec3(${v.toArray().map(n=>n.toFixed(2)).join(',')})`;
export const dustSpines = `void spine(float lane, float t, out vec3 p, out vec3 d) {
  vec3 a,b,c,e;
  ${courses.map((s,i)=>`${i===0?'if (lane<0.5)':i===1?'else if (lane<1.5)':'else'} {
    a=${glslPoint(s.v0)}; b=${glslPoint(s.v1)}; c=${glslPoint(s.v2)}; e=${glslPoint(s.v3)};
  }`).join('\n')}
  float u=1.-t;
  p=u*u*u*a + 3.*u*u*t*b + 3.*u*t*t*c + t*t*t*e;
  d=normalize(u*u*(b-a) + 2.*u*t*(c-b) + t*t*(e-c));
}`;

function generator(seed:number) {
  return () => ((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

const clasts = ['#a38675','#748698','#c49d81','#86788c','#a5acad'];

type OpenAir=(p:Vector3,sweptRadius:number)=>boolean;
function atlasClearance():OpenAir {
  const flights=lanes.flatMap(l=>Array.from({length:65},(_,i)=>windPoint(l,i/64,new Vector3())));
  const straits=leapRoutes.filter(r=>r.pad.id<r.target.id).map(r=>new Line3(r.pad.foot,r.target.foot)),nearest=new Vector3();
  return (p,r)=>{
    if(terrainAltitude(p)<r+2.6)return false;
    // Walkers, local relief and station equipment stay inside these envelopes.
    if(allMoons.some(m=>p.distanceToSquared(m.centre)<(m.radius+3+r)**2))return false;
    if(straits.some(line=>line.closestPointToPoint(p,true,nearest).distanceToSquared(p)<(4.5+r)**2))return false;
    // Allow for the off-centre takeoff, standing eye and sample spacing.
    return !flights.some(f=>p.distanceToSquared(f)<(3.5+r)**2);
  };
}

function driftRocks(clear:OpenAir) {
  const random=generator(0x5ea113), pos:number[]=[], tint:number[]=[], body:number[]=[], grain:number[]=[];
  const color=new Color(), sphere=new Sphere(V(0,0,0),-1), taken:Sphere[]=[];
  function chip(at:Vector3,size:number) {
    // A long fresh fracture, a spalled rind and a sheared-off cap. Each
    // boulder has its own contour; neighbouring facets share real edges.
    const count=5+Math.floor(4*random()), long=.92+.48*random(), deep=.42+.48*random();
    const h=.32+.55*random(), dx=(random()-.5)*.65, dz=(random()-.5)*.4, seed=random();
    const base:Vector3[]=[], rind:Vector3[]=[], cap:Vector3[]=[];
    for(let i=0;i<count;i++) {
      const a=(i+.38*random())*2*Math.PI/count, r=.75+.25*random();
      const x=long*r*Math.cos(a), z=deep*r*Math.sin(a), taper=.57+.29*random();
      base.push(V(x*taper-dx*.44,-h*(.38+.46*random()),z*taper));
      rind.push(V(x,h*(random()*.42-.13),z));
      cap.push(V(x*taper+dx,h*(.63+.29*random())+.15*x,z*taper+dz));
    }
    color.set(clasts[Math.floor(random()*clasts.length)]);
    const bottom=V(-dx*.44,-h,0), top=V(dx,h*.94,dz);
    function face(a:Vector3,b:Vector3,c:Vector3,brightness:number) {
      const k=brightness*(.86+.23*random());
      for(const v of [a,b,c]) {
        pos.push(v.x*size,v.y*size,v.z*size); tint.push(color.r*k,color.g*k,color.b*k);
        body.push(at.x,at.y,at.z,size); grain.push(seed);
      }
    }
    for(let i=0;i<count;i++) {
      const j=(i+1)%count;
      face(bottom,base[i],base[j],.68); face(top,cap[j],cap[i],1.14);
      face(base[i],rind[i],base[j],.73); face(base[j],rind[i],rind[j],.83);
      face(rind[i],cap[i],rind[j],1.04); face(rind[j],cap[i],cap[j],1.02);
    }
    const bounds=new Sphere(at,size*1.85+.30); taken.push(bounds); sphere.union(bounds);
  }
  // Families of diminishing chips with open space between them. The largest
  // members are hand-sited; reject intersecting siblings once, at creation.
  for(const [lane,t,radius,spread,quantity] of [
    [0,.14,.98,3.3,12],[0,.51,1.12,3.6,17],[0,.78,.83,3.0,12],
    [1,.23,.68,1.7,11],[1,.67,.98,2.1,16],[1,.90,.33,1.0,6],
    [2,.36,1.04,2.6,15],[2,.79,.50,1.45,9],
  ]) {
    const path=courses[lane], hub=path.getPoint(t); hub.y+=lane===1?.42:.85;
    if(clear(hub,radius*1.85+.30))chip(hub,radius);
    for(let i=1;i<quantity;i++) {
      const size=radius*(.10+.52*(1-i/quantity)**2)*(.72+.50*random());
      for(let k=0;k<16;k++) {
        const p=path.getPoint(Math.max(.015,Math.min(.985,t+(random()-.5)*.23)));
        p.x+=(random()-.5)*spread; p.y+=(random()-.30)*spread; p.z+=(random()-.5)*spread*1.45;
        if(!clear(p,size*1.85+.30)||taken.some(b=>b.center.distanceTo(p)<b.radius+size*1.45))continue;
        chip(p,size); break;
      }
    }
  }
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(pos,3)); g.computeVertexNormals();
  g.setAttribute('colour',new Float32BufferAttribute(tint,3));
  g.setAttribute('body',new Float32BufferAttribute(body,4));
  g.setAttribute('grain',new Float32BufferAttribute(grain,1)); g.boundingSphere=sphere;
  return g;
}

function wakeInterval(lane:number,clear:OpenAir) {
  // Find the longest uninterrupted reach for the complete braided cross-section,
  // including the largest soft glow. Never teleport a particle over a wind lane.
  const path=courses[lane],n=96,p=new Vector3(),radius=(lane===0?1.48:.85)*5.12+.5;
  let begin=0,lo=0,hi=0;
  for(let i=0;i<=n;i++) {
    if(!clear(path.getPoint(i/n,p),radius)){begin=i+1;continue;}
    if(i-begin>hi-lo){lo=begin;hi=i;}
  }
  return [lo/n,hi/n] as const;
}

function ionGrains(clear:OpenAir) {
  const random=generator(0x510ef), track:number[]=[], mote:number[]=[],interval:number[]=[];
  const g=new InstancedBufferGeometry();
  g.setIndex([0,1,2,2,1,3]);
  g.setAttribute('position',new Float32BufferAttribute([-1,-1,0,1,-1,0,-1,1,0,1,1,0],3));
  for(const [lane,count] of [[0,298],[1,202],[2,108]]) {
    const [lo,hi]=wakeInterval(lane,clear); if(hi-lo<.1)continue;
    for(let i=0;i<count;i++) {
      const n=random(), kind=n<.12?2:n<.36?1:0;
      track.push(lane,(i+random())/count,i%2,random()); interval.push(lo,hi);
      // Specks, tapered ion needles, and diffuse wisps are one quad batch.
      mote.push(random(),(random()-.5)*(random()+.08),kind,random());
    }
    // Short contiguous panels carry the tenuous luminous gas between grains.
    // Neighbouring endpoints share their position, width and emission phase.
    const steps=lane===0?64:48;
    for(let strand=0;strand<2;strand++)for(let i=0;i<steps;i++) {
      track.push(lane,i/steps,strand,.5); mote.push(1/steps,0,3,.5); interval.push(lo,hi);
    }
  }
  g.setAttribute('track',new InstancedBufferAttribute(new Float32Array(track),4));
  g.setAttribute('mote',new InstancedBufferAttribute(new Float32Array(mote),4));
  g.setAttribute('span',new InstancedBufferAttribute(new Float32Array(interval),2));
  g.instanceCount=track.length/4;
  const sphere=new Sphere(V(0,0,0),-1);
  for(const s of courses)for(const p of [s.v0,s.v1,s.v2,s.v3])sphere.expandByPoint(p);
  sphere.radius+=8; g.boundingSphere=sphere; return g;
}

export function makeDriftField(){
  const clear=atlasClearance();
  return {rocks:driftRocks(clear),ions:ionGrains(clear)};
}
