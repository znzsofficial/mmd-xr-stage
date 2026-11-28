import type {Part} from './SceneryBatch';
import {span} from './detailParts';

// Pool location in the shared arcade-to-pool walkway's coordinate system.
export const POOL_ORIGIN={x:-11.4,z:-20.3};
export const LIDO_ENTRY={x:6.15,z:9.26,w:3.22,d:5.52};
export const LIDO_GATE={in:7.65,out:8.35,half:1.48};
export const POOL_WATER_Y=-.16;
export const LIDO_PIERS=[{x:4.37,z:8.88,w:.75,d:2.95},{x:7.94,z:8.34,w:.54,d:1.72}];
export const TIME_DECK={x:5.72,z:-20.55,w:5.05,d:2.72};
export const GUARD_CHAIR={x:7.05,z:-20.65,w:1.4,d:1.70};
export const PACE_CLOCK={x:4.77,z:-20.94,w:.50,d:.43};
export const PAVILION_POSTS=[-8,-4,0,4,8].map(x=>({x,z:-20.89,w:.12,d:.12}));
// The rendered slabs, activity floor and backpack foot probes read the same geometry.
// Do not move clearance, furniture or traversal policy into this inventory.
export const POOL={
  deck:{x:0,z:1,w:23,d:13.5},water:{x:0,z:-12.4,w:10.1,d:13.35},
  walks:[-6.2,6.2].map(x=>({x,z:-12.4,w:2.35,d:13.4})),farWalk:{x:0,z:-19.48,w:14.7,d:1.1},
  ladder:{x:-4.34,z:-5.75,w:.57,d:.43},blocks:[-3.34,0,3.34].map(lane=>({x:lane-1.65,z:-19.42,w:.65,d:.7})),
  benches:[-8,8].map(x=>({x,z:-12.6,w:1.8,d:.51})),loungers:[-1,1].flatMap(side=>[0,1].map(i=>({x:side*(7.4+i*1.35),z:-2.95,w:.75,d:1.98,yaw:side*.16}))),
  parasols:[-1,1].map(side=>({x:side*8.35,z:-1.35,w:.60,d:.60})),rescue:{x:-5.68,z:-8.95,w:.91,d:.41},
  flagPosts:[-9.5,-16.8].flatMap(z=>[-5.45,5.45].map(x=>({x,z,w:.14,d:.14}))),
};
export const POOL_SUPPORT=[POOL.deck,...POOL.walks,POOL.farWalk,TIME_DECK,LIDO_ENTRY];
export const PAVILION_APRON={x:.8,z:-22,w:19,d:4.5};
// Support is a union: for example the ticket approach runs 1.25 m onto the
// sun deck. Lay a single finished slab across each connected band instead of
// stacking two almost level tops under the same pair of shoes.
function pavingSlabs(){
  const apron=PAVILION_APRON,leftEdge=apron.x-apron.w/2,rightEdge=apron.x+apron.w/2;
  const edges=Array.from(new Set([...POOL_SUPPORT,apron].flatMap(r=>[r.z-r.d/2,r.z+r.d/2]))).sort((a,b)=>a-b);
  const deck:typeof POOL_SUPPORT=[],pavilion:typeof POOL_SUPPORT=[];
  for(let i=1;i<edges.length;i++){
    const d=edges[i]-edges[i-1],z=(edges[i]+edges[i-1])/2;
    const spans=POOL_SUPPORT.filter(r=>Math.abs(z-r.z)<r.d/2)
      .map(r=>({left:r.x-r.w/2,right:r.x+r.w/2})).sort((a,b)=>a.left-b.left);
    let j=0,cursor=leftEdge;
    function apronUntil(end:number){
      const right=Math.min(end,rightEdge);
      if(Math.abs(z-apron.z)<apron.d/2&&right>cursor)pavilion.push({x:(cursor+right)/2,z,w:right-cursor,d});
    }
    while(j<spans.length){
      const {left}=spans[j];let right=spans[j++].right;
      while(j<spans.length&&spans[j].left<=right)right=Math.max(right,spans[j++].right);
      apronUntil(left);cursor=Math.max(cursor,right);
      deck.push({x:(left+right)/2,z,w:right-left,d});
    }
    apronUntil(rightEdge);
  }
  return {deck,pavilion};
}
export const {deck:POOL_SLABS,pavilion:PAVILION_SLABS}=pavingSlabs();
// Keep the eastern two rails, but terminate them at a real opening to the
// timing deck. The other bays and the opposite perimeter remain intact.
export function poolBarrierParts():Part[]{
  const parts:Part[]=[],tint='#8fa9a7';
  for(const x of [-10.5,10.5]){
    const runs=x<0?[[-7,-10.1,-13.2,-16.3,-19.4,-22.5]]:[[-7,-10.1,-13.2,-16.3,-17.75],[-20.75,-22.5]];
    for(const run of runs)for(const [i,z] of run.entries()){
      parts.push({p:[x,.88,z],s:[.09,1.76,.09],color:tint});if(i===0)continue;
      for(const [y,w] of [[1.70,.06],[.50,.035]])parts.push({p:[x,y,(run[i-1]+z)/2],s:[w,w,run[i-1]-z],color:tint});
    }
  }return parts;
}
export const LIDO_ROUTE_SHOTS={
  clock:{key:'lidoClock',eye:[6.14,1.58,-16.49],aim:[5.85,1.30,-20.91]},
  return:{key:'lidoLookBack',eye:[6.85,1.63,3.36],aim:[5.96,1.60,10.05]},
} as const;

// Append to an existing instance batch: no second pool/station running behind a gate.
export function arcadeParts():Part[]{
  const out:Part[]=[];
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string)=>out.push({p:[x,y,z],s:[w,h,d],color});
  const {x,z,w,d}=LIDO_ENTRY,blue='#35777e',cream='#eadcc0',coral='#ce8066';
  for(let j=0;j<9;j++){const zz=z-d/2+(j+.5)*d/9;
    for(const s of [-1,1])box(x+s*(w/2-.21),.016,zz,.13,.006,d/9-.013,j%3?blue:coral);
    box(x,.016,zz,w-2*(.21+.065),.006,.016,'#b3ae9a');}
  // Follow the same ceramic stripe past the entry into the east promenade.
  // The opposite side stays open for the sun beds and the water-play station.
  const start=z-d/2,end=POOL.water.z+POOL.water.d/2;
  for(let i=0;i<20;i++){const zz=start+(i+.5)*(end-start)/20;
    box(x-.72,.019,zz,.105,.006,(start-end)/20-.012,i%5?'#799f99':blue);
    if(i%5===0)box(x-.56,.019,zz,.18,.006,.064,coral);}
  for(const [i,r] of LIDO_PIERS.entries()){
    const h=i?2.60:3.48;box(r.x,h/2,r.z,r.w,h,r.d,cream);box(r.x,.31,r.z,r.w+.05,.62,r.d+.04,blue);
    for(let j=0;j<5;j++)box(r.x,.12+j*.12,r.z,r.w+.056,.013,r.d+.046,'#679a95');
    for(let j=0;j<3;j++)box(r.x,h-.23+j*.11,r.z,r.w+.11,.045,r.d+.09,i?blue:coral);
  }
  // An asymmetric ticket pier carries the projecting blade; a single concrete visor shades its hatch.
  box(4.76,1.48,8.94,.036,.87,1.53,'#486f70');box(4.82,1.02,8.95,.16,.084,1.64,'#b89973');
  for(let j=0;j<7;j++)box(4.79,1.14+j*.10,8.94,.032,.023,1.46,'#8ca99f');
  box(6.10,2.78,8.34,4.43,.19,2.14,cream);box(6.10,2.88,8.34,4.5,.048,2.20,blue);
  box(6.15,2.46,8.34,3.12,.39,.145,blue);
  for(const s of [-1,1])box(6.15+s*.98,2.658,8.34,.48,.033,.22,'#fff1cf');
  return out;
}
export function distantLido():Part[]{const water=POOL.water;
  return [
  {p:[.8,1.44,-23.15],s:[18.5,2.86,1.42],color:'#f2dfb9'}, {p:[.8,3,-22.5],s:[19.2,.30,3.8],color:'#649592'},
  {p:[water.x,POOL_WATER_Y-.05,water.z],s:[water.w,.1,water.d],color:'#76b8bd'},
  ...POOL_SLABS.map(r=>({p:[r.x,-.125,r.z] as Part['p'],s:[r.w,.25,r.d] as Part['s'],color:'#e0d5bf'})),
  ...[-5.45,5.45].map(x=>({p:[x,1.5,-9.5] as Part['p'],s:[.07,3,.07] as Part['s'],color:'#87a4a1'})),
  ...Array.from({length:17},(_,i)=>({p:[(i-8)*.59,2.66+((i-8)/8)**2*.24,-9.5] as Part['p'],s:[.34,.20,.05] as Part['s'],color:i%2?'#dd805d':'#639a9c'})),
];}
export function judgeStand(){
  const out:Part[]=[],{x,z}=GUARD_CHAIR,frame='#d2d8c8',wood='#c4855d';
  const box=(dx:number,y:number,dz:number,w:number,h:number,d:number,color:string)=>out.push({p:[x+dx,y,z+dz],s:[w,h,d],color});
  for(const side of [-1,1]){
    out.push(span([x+side*.55,.06,z+.79],[x+side*.36,1.5,z+.12],.07,frame),span([x+side*.5,.06,z-.56],[x+side*.36,1.53,z-.24],.07,frame));
    box(side*.36,1.79,-.28,.065,.90,.065,frame);box(side*.37,1.70,.01,.076,.074,.62,wood);
    box(side*.47,.04,.78,.22,.08,.19,'#686f68');
    out.push(span([x+side*.47,.27,z-.49],[x+side*.40,1.15,z+.29],.043,frame));
  }
  for(let i=0;i<5;i++){box(0,.24+i*.24,.67-i*.115,.79,.057,.13,wood);box(0,1.44,-.24+i*.10,.80,.073,.09,wood);}
  for(let i=0;i<3;i++)box(0,1.83+i*.15,-.31,.85,.11,.065,wood);
  // Rescue tube with contrasting webbing on the outside of the frame.
  box(.442,1.56,-.02,.15,.17,.89,'#cc6647');for(const f of [-.26,.26])box(.445,1.56,f,.156,.18,.062,'#f2dcae');
  out.push(span([x+.45,1.52,z+.38],[x+.45,1.17,z+.20],.025,'#4f544f'),span([x+.45,1.17,z+.20],[x+.45,1.48,z-.39],.025,'#4f544f'));
  return out;
}
