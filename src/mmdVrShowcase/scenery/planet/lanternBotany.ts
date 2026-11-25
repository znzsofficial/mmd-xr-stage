import {Box3,BufferAttribute,BufferGeometry,Color,Float32BufferAttribute,Quaternion,Vector3} from 'three';
import {capRadius,capRoof,gillDepth,lanternCanPlant,lanternFlushes,lanternLocal,lanternRadius,lanternStation,lanternTrees,stemShape,type LanternTree} from './lanternBiosphere';
import {lanternGroveBatch,type GroveRange} from './lanternGroveRange';

// One set of indices per material for the entire moon. The veil is the only
// alpha batch; its ribs, pellicle spots and the actual sawtooth gills write depth.
const tau=Math.PI*2,up=new Vector3(0,1,0);
const inks=new Map<string,Color>();
const ink=(name:string)=>{let c=inks.get(name);if(!c){c=new Color(name);inks.set(name,c);}return c;};
type P=[number,number,number];
class Surface {
  protected xyz:number[]=[];private rgb:number[]=[];protected ix:number[]=[];
  protected bounds?:Box3;
  private q=new Quaternion();private o=new Vector3();private v=new Vector3();
  place(p:Vector3,q:Quaternion){this.o.copy(p);this.q.copy(q);}
  point(x:number,y:number,z:number,color:string,k=1){const p=this.v.set(x,y,z).applyQuaternion(this.q).add(this.o),i=this.xyz.length/3,c=ink(color);
    this.bounds?.expandByPoint(p);this.xyz.push(p.x,p.y,p.z);this.rgb.push(c.r*k,c.g*k,c.b*k);return i;}
  tri(a:number,b:number,c:number){this.ix.push(a,b,c);}
  quad(a:number,b:number,c:number,d:number){this.ix.push(a,b,d,b,c,d);}
  /** Continuous ring grid, no duplicate seam or cross-shape material splits. */
  rings(n:number,rows:number,at:(row:number,j:number)=>number){let previous:number[]=[];
    for(let i=0;i<rows;i++){const row=Array.from({length:n},(_,j)=>at(i,j));
      if(i)for(let j=0;j<n;j++){const k=(j+1)%n;this.quad(previous[j],previous[k],row[k],row[j]);}previous=row;}}
  finish(ix:number[]|BufferAttribute=this.ix){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.xyz,3));
    g.setAttribute('color',new Float32BufferAttribute(this.rgb,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;}
}

class GroveSurface extends Surface {
  private readonly plots=new Map<Vector3,{bounds:Box3;indices:number[]}>();
  grove(root:Vector3){
    let plot=this.plots.get(root);
    if(!plot){plot={bounds:new Box3(),indices:[]};this.plots.set(root,plot);}
    this.bounds=plot.bounds;this.ix=plot.indices;
  }
  finishGroves(){
    // The working garden is on the nursery side. Keep neighbouring latitudes
    // adjacent so a tangent view can drop whole groves with a single interval.
    const plots=[...this.plots].sort(([a],[b])=>a.dot(lanternStation)-b.dot(lanternStation));
    const length=plots.reduce((n,[,p])=>n+p.indices.length,0);
    const packed=this.xyz.length/3>=65535?new Uint32Array(length):new Uint16Array(length);
    const groves:GroveRange[]=[];let start=0;
    for(const [,p] of plots){const end=start+p.indices.length;packed.set(p.indices,start);
      // Authored in doubles, uploaded as float32; keep boundary vertices inside.
      groves.push({bounds:p.bounds.expandByScalar(.00001),start,end});start=end;}
    return lanternGroveBatch(this.finish(new BufferAttribute(packed,1)),groves);
  }
}

function mushroom(s:LanternTree,flesh:Surface,light:Surface,veil:Surface){
  for(const b of [flesh,light,veil])b.place(s.base,s.q);
  const levels=[-.045,0,.075,.21,.49,.77,.94,1],trunkTop=s.h-.14*s.r;
  const flutes=9,stalkSides=27;
  flesh.rings(stalkSides,levels.length,(i,j)=>{
    const t=levels[i],a=-tau*j/stalkSides,p=stemShape(Math.max(0,t),s);
    const flute=Math.cos(flutes*a+1.6*t+s.phase),rad=p.r*(1+.082*flute);
    return flesh.point(p.x+rad*Math.cos(a),t*trunkTop,p.z+rad*Math.sin(a),
      t<.20?'#876866':t>.76?'#9d7d87':'#bc9a93',.70+.17*Math.cos(a-.7)+.13*flute);
  });
  // Feet flare out into buttresses; their concave sides meet the fluted stalk.
  for(let i=0;i<7;i++){
    const a=i*tau/7+s.phase,u=Math.cos(a),v=Math.sin(a),w=s.r;
    const base=flesh.point(w*.39*u,-.038,w*.39*v,'#805e64');
    const crest=flesh.point(w*.23*u,w*.15,w*.23*v,'#b38b84');
    const join=flesh.point(w*.115*u,w*.58,w*.115*v,'#c5a297');
    for(const side of [-1,1]){const foot=flesh.point(w*(.16*u-side*.10*v),-.045,w*(.16*v+side*.10*u),'#715963');
      flesh.tri(base,crest,foot);flesh.tri(crest,join,foot);}
  }
  // Polar samples follow one wavy edge. Veins continue across the part where
  // the underlying flesh gives way to skin thin enough to see the sky through.
  const bands=s.lobes*4,angles=bands*2;
  const top=(b:Surface,a:number,t:number,y:number,color:string,k:number)=>{
    const r=capRadius(s,a)*t;return b.point(s.dx+Math.cos(a)*r,capRoof(s,a,t)+y,s.dz+Math.sin(a)*r,color,k);};
  const day=(a:number)=>.77+.20*Math.cos(a-1.1)+.03*Math.cos(3*a+s.phase);
  const crown=[.001,.12,.32,.56,.715],tints=['#ffe2af','#e0a794','#c98485','#c46779','#d67a83'];
  flesh.rings(angles,crown.length,(i,j)=>{const a=tau*j/angles,t=crown[i];
    return top(flesh,a,t,0,tints[i],day(a)*(.89+.11*Math.cos(a*bands+s.phase)));});
  const fringe=[.715,.86,.965,1],milk=['#e88d95','#f9adb0','#ffc39e','#ffdbb4'];
  veil.rings(angles,fringe.length,(i,j)=>{const a=tau*j/angles;return top(veil,a,fringe[i],0,milk[i],day(a));});
  // A rolled hem connects the thin gill ends at the skyline; from across
  // the slope it reads as the edge of an umbrella rather than a spray of sticks.
  flesh.rings(angles,3,(i,j)=>{const a=tau*j/angles,t=i===1?1.003:.989;
    return top(flesh,a,t,i===0?.004*s.r:-(i===1?.012:.032)*s.r,i===1?'#ffc39c':'#ce827e',day(a));});
  for(let j=0;j<bands;j++){
    const a=tau*j/bands+.004*Math.sin(j+s.phase);
    const lamella=(bearing:number,partial:boolean)=>{
      const spans=partial?[.565,.72,.86,.97]:[.074,.22,.42,.62,.81,.965,.994];
      let last:number[]=[];
      for(const t of spans){const r=s.r;
        const b=bearing+.038*(1-t)*Math.sin(3*bearing+s.phase)+.035*(1-t)**2;
        const d=gillDepth(s,t)*(partial?.65:1),w=(partial?.014:.023)*(1-.29*t);
        const points=[top(light,b-w,t,-.014*r,'#7b3e5b',day(b)),top(light,b,t,-d,'#ffa076',day(b)),
          top(light,b+w,t,-d*.69,'#ef7665',day(b)),top(light,b+2*w,t,-.016*r,'#ba535d',day(b))];
        if(last.length)for(let k=0;k<3;k++)light.quad(last[k],points[k],points[k+1],last[k+1]);
        last=points;
      }
    };
    lamella(a,false);lamella(a+Math.PI/bands,true);
    if(j%2===0){let l=-1,r=-1;
      for(const t of [.17,.4,.65,.82,.99]){const b=a+.038*(1-t)*Math.sin(3*a+s.phase);
        const k=top(flesh,b-.009,t,.004*s.r,'#f6b29c',.81),m=top(flesh,b+.009,t,.004*s.r,'#cf7784',.89);
        if(l>=0)flesh.quad(l,k,m,r);l=k;r=m;}}
  }
  // Detached pieces of the juvenile veil leave irregular creamy islands on
  // the opaque crown, not a repetitive wraparound dotted texture.
  for(let i=0;i<24;i++){
    const a=i*2.39996+s.phase,t=.22+.43*Math.sqrt((i*17%25)/25),w=.012+.025*(i%5)/5;
    const c=top(flesh,a,t,s.r*.009,'#ffe4bd',day(a));let last=-1,first=-1;
    for(let j=0;j<6;j++){const f=tau*j/6;
      const k=top(flesh,a+Math.cos(f)*w/t,t+Math.sin(f)*w*.69,s.r*.006,'#fbd0ae',day(a));
      if(last>=0)flesh.tri(c,last,k);else first=k;last=k;}flesh.tri(c,last,first);
  }
}

// The younger fruit are stockier than the canopy trees. The underside is one
// corrugated surface; big pleats and a rolled margin survive a middle-distance
// view. No little wires, translucent layers or separate meshes per fruit.
function youngCap(s:LanternTree,variant:number,matter:Surface,lit:Surface){
  matter.place(s.base,s.q);lit.place(s.base,s.q);
  const w=s.r,h=s.h,n=w>.37?20:14;
  const neck=[[.22,-.04],[.25,.16],[.14,.52],[.20,.84],[.23,1]];
  matter.rings(9,neck.length,(i,j)=>{const a=-j*tau/9,[r,y]=neck[i];
    return matter.point(s.dx*y*y+w*r*Math.cos(a),y*(h-.14*w),s.dz*y*y+w*r*Math.sin(a),i<2?'#846c77':'#d0b2a2',.85+.12*Math.cos(a));});
  const top=(b:Surface,a:number,t:number,dy:number,ink:string,k:number)=>{const r=capRadius(s,a)*t;
    return b.point(s.dx+r*Math.cos(a),capRoof(s,a,t)+w*dy,s.dz+r*Math.sin(a),ink,k);};
  const band=[.001,.32,.72,.965,1,.979],palettes=[['#ffd6ae','#e5ac81','#d08d70','#ecb18a','#f4c69e','#bd7d69'],
    ['#fbd6b5','#e5ae9b','#ce8688','#f0b39f','#f9cda5','#c47e7b']];
  const inks=palettes[variant%2];
  matter.rings(n,band.length,(i,j)=>{const a=tau*j/n,t=band[i];
    return top(matter,a,t,i===5?-.061:0,inks[i],.87+.13*Math.cos(a-.7)+.03*Math.cos(5*a+s.phase));});
  const rows=[.17,.62,.98];
  lit.rings(n,rows.length,(i,j)=>{const t=rows[i],a=tau*j/n,ridge=j%2===0;
    return top(lit,a,t,ridge?-gillDepth(s,t)/w:-.038,ridge?'#ebb081':'#a76674',.87+.13*Math.cos(a));});
}

/** A curled tip is a real spiral in profile. Ribbed, staggered pinnae stop
 * short of it, keeping daylight between the leaflets at a standing eye. */
function fiddle(f:Surface,root:P,yaw:number,h:number,juvenile:boolean){
  const u=Math.cos(yaw),v=Math.sin(yaw);
  const at=(d:number,y:number,w:number,ink:string,k=1)=>f.point(root[0]+h*(u*d-v*w),root[1]+h*y,root[2]+h*(v*d+u*w),ink,k);
  const path:P[]=[];
  for(let i=0;i<=5;i++){const t=i/5;path.push([.18*t*t,.69*t,.035-.018*t]);}
  // Enter the left of a clockwise crozier with a vertical tangent.
  for(let i=1;i<=12;i++){const t=i/12,a=Math.PI-1.83*Math.PI*t,r=.14*(1-.72*t);
    path.push([.32+r*Math.cos(a),.69+r*Math.sin(a),.020+.015*t]);}
  let last:number[]=[];for(let i=0;i<path.length;i++){
    const [d,y,w]=path[i],before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)];
    const dx=after[0]-before[0],dy=after[1]-before[1],l=Math.hypot(dx,dy)||1;
    const row=[at(d+w*dy/l,y-w*dx/l,0,'#91b9a4'),at(d,y,w*.78,'#b5ccb0'),at(d-w*dy/l,y+w*dx/l,0,'#549b99'),at(d,y,-w*.78,'#397b80')];
    if(last.length)for(let k=0;k<4;k++)f.quad(last[k],row[k],row[(k+1)%4],last[(k+1)%4]);last=row;
  }
  for(let i=1;i<=(juvenile?3:5);i++)for(const side of [-1,1]){
    const t=.13+i*.125+(side>0?.043:0),y=.69*t,d=.18*t*t,w=(.12+.16*Math.sin(Math.PI*t))*(juvenile?.65:1);
    const base=at(d,y,0,'#407e84'),spine=at(d+.09,y+.106,w*.51*side,'#b4c79f');
    const tip=at(d+.13,y+.093,w*side,'#a7c9ac'),lo=at(d+.053,y+.039,w*.51*side,'#679e9e'),hi=at(d+.12,y+.135,w*.51*side,'#91b8a7');
    f.tri(base,lo,spine);f.tri(lo,tip,spine);f.tri(base,spine,hi);f.tri(hi,spine,tip);
  }
}

function nursery(f:Surface,light:Surface){
  const p=lanternLocal(lanternStation),q=new Quaternion().setFromUnitVectors(up,lanternStation);f.place(p,q);light.place(p,q);
  // A single seed-catching ascocarp with five unequal petals. Profile goes
  // up on the outside and back INTO the bowl; no solid lid across the mouth.
  const profile=[[.22,-.075],[.18,.10],[.15,.28],[.24,.42],[.36,.55],[.42,.78],[.387,.785],[.325,.56],[.16,.47],[.006,.464]];
  const tints=['#735b66','#735465','#986477','#b67279','#d77378','#ed9985','#ffbe96','#cd756c','#955668','#704657'];
  f.rings(40,profile.length,(i,j)=>{const a=-j*tau/40,[r,y]=profile[i],lobe=Math.cos(5*a+.21),lip=i===5||i===6;
    const rr=r*(1+.05*lobe+.028*Math.cos(2*a));return f.point(rr*Math.cos(a),y+(lip?.107:.015)*lobe,rr*Math.sin(a),tints[i],.83+.15*Math.cos(a));});
  for(let j=0;j<20;j++){
    const a=tau*j/20,hi=.78+.107*Math.cos(5*a+.21);
    let last:number[]=[];for(const [r,y] of [[.20,.34],[.285,.45],[.37,.56],[.424,hi-.017]]){
      const rr=r*(1+.05*Math.cos(5*a+.21)+.028*Math.cos(2*a));
      const row=[-.035,0,.035].map((w,k)=>light.point(rr*Math.cos(a+w),y-(k===1?.023:0),rr*Math.sin(a+w),k===1?'#ffbd8d':'#b75b6c'));
      if(last.length){light.quad(last[0],row[0],row[1],last[1]);light.quad(last[1],row[1],row[2],last[2]);}last=row;}
  }
  // Germinated siblings at the foot, not generic gauge hardware.
  for(let i=0;i<5;i++){const a=tau*i/5;fiddle(f,[.31*Math.cos(a),-.01,.31*Math.sin(a)],a,.26+.065*(i%3),true);}
}

export function lanternBotany(){
  const matter=new GroveSurface(),lit=new GroveSurface(),skin=new Surface();
  const grove=(root:Vector3)=>{matter.grove(root);lit.grove(root);};
  for(const s of lanternTrees){grove(s.base);mushroom(s,matter,lit,skin);}
  grove(lanternLocal(lanternStation));nursery(matter,lit);
  lanternFlushes.forEach((f,i)=>{grove(f.centre);f.caps.forEach((s,j)=>youngCap(s,i+Math.floor(j/3),matter,lit));});
  // Colonies grow near feet and along the edges of the walk, with patches of
  // bare soil between them. No uniform scatter of identical full-size trees.
  const east=new Vector3(),cross=new Vector3(),n=new Vector3(),q=new Quaternion();
  for(const [i,s] of lanternTrees.entries()){
    matter.grove(s.base);
    east.set(1,0,0).projectOnPlane(s.up).normalize();cross.crossVectors(east,s.up);
    for(let j=0;j<(i<5?6:3);j++){
      const a=j*2.39996+.67*i,r=.8+.85*Math.sin(j*7.1+i)**2;
      n.copy(s.up).addScaledVector(east,Math.cos(a)*r/lanternRadius).addScaledVector(cross,Math.sin(a)*r/lanternRadius).normalize();
      if(!lanternCanPlant(n,.38))continue;
      matter.place(lanternLocal(n,-.028),q.setFromUnitVectors(up,n));
      for(let k=0;k<2;k++)fiddle(matter,[.04*Math.cos(k),0,.04*Math.sin(k)],a+2.1*k,.23+.21*(.5+.5*Math.cos(2.6*j+k+i)),k>0);
    }
  }
  return {matter:matter.finishGroves(),light:lit.finishGroves(),veil:skin.finish()};
}

/** A copper samara: asymmetric scooped wing, ivory leading edge and a loaded
 * nut at one end. Remains legible in stereo without a camera-facing billboard. */
export function lanternSeedMesh(){
  const s=new Surface();const rows:[[number,number,number],string][]=[[[0,-.049,.009],'#c78668'],[[.019,-.028,.029],'#ffe2a8'],
    [[.024,.019,.026],'#f8c191'],[[.042,.062,.043],'#ffdbab'],[[.062,.098,.047],'#ffcf89'],[[.084,.127,.023],'#ffe7b0'],[[.097,.13,.002],'#f3be8a']];
  let last:number[]=[];for(const [[d,y,r],color] of rows){const row=[s.point(d-r,y,-r*.16,color,.84),s.point(d-r*.40,y,r*.61,'#ffe3b4'),s.point(d+r*.34,y,-r*.09,color,.92)];
    if(last.length){s.quad(last[0],row[0],row[1],last[1]);s.quad(last[1],row[1],row[2],last[2]);}last=row;}
  return s.finish();
}

/** A fingertip-sized grazer enlarged to about 18 cm across the foot. Its shell
 * has a raised spiral on BOTH flanks; paired clubbed feelers lead the motion. */
export function lanternGrazerMesh(){
  const s=new Surface();
  const oval=(x:number,y:number,z:number,rx:number,ry:number,rz:number,color:string)=>{
    s.rings(12,8,(i,j)=>{const phi=Math.PI*(i+.001)/7.002,a=-j*tau/12,sp=Math.sin(phi);
      return s.point(x+rx*sp*Math.cos(a),y-ry*Math.cos(phi),z+rz*sp*Math.sin(a),color,.81+.16*Math.sin(phi)+.04*Math.cos(a));});};
  const foot=[[-.135,.002,.006],[-.093,.007,.030],[-.058,.018,.048],[.002,.021,.049],[.051,.029,.036],[.087,.041,.031],[.102,.037,.014]];
  s.rings(10,foot.length,(i,j)=>{const [z,y,r]=foot[i],a=tau*j/10;return s.point(r*Math.cos(a),y+r*.49*Math.sin(a),z,
    j<5?'#71b7a7':'#cdca9c',.83+.13*Math.cos(a));});
  oval(0,.068,-.027,.043,.057,.056,'#685b6d');
  for(const side of [-1,1]){
    let lo=-1,hi=-1;
    for(let i=0;i<=36;i++){
      const t=i/36,a=t*tau*1.75,r=.055*(.04+.96*t),d=.002+.003*t;
      const v=(w:number,c:string)=>{const rz=r+w,z=rz*Math.cos(a),y=rz*Math.sin(a),x=.044*Math.sqrt(Math.max(0,1-z*z/.056**2-y*y/.057**2));
        return s.point(side*(x+.0012),.068+y,-.027+z,c);};
      const p=v(-d,'#f6c88c'),q=v(d,'#de9a78');if(i)s.quad(lo,p,q,hi);lo=p;hi=q;
    }
    let row:number[]=[];
    for(const [x,y,z,r] of [[.018,.049,.076,.007],[.031,.071,.090,.005],[.038,.080,.108,.0045]]){
      const next=[];for(let j=0;j<5;j++){const a=j*tau/5;next.push(s.point(x*side+r*Math.cos(a),y,z+r*Math.sin(a),'#9ad0ad'));}
      if(row.length)for(let j=0;j<5;j++)s.quad(row[j],next[j],next[(j+1)%5],row[(j+1)%5]);row=next;
    }
    oval(.038*side,.081,.108,.008,.008,.008,'#513f53');
  }
  return s.finish();
}
