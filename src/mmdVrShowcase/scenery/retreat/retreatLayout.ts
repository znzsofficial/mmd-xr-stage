// Two separate room lifetimes. Metres; Y=0 is the finished floor, not the waterline.
export type Retreat = 'lanternSuite'|'moonSpa';
export type Slab = {x:number;z:number;w:number;d:number;top:number;base:number};
const slab=(x:number,z:number,w:number,d:number,top:number,base=0):Slab=>({x,z,w,d,top,base});
const perimeter=(x:number,z:number,w:number,d:number,h:number)=>[
  slab(x-w/2,z,.14,d,h),slab(x+w/2,z,.14,d,h),slab(x,z-d/2,w,.14,h),slab(x,z+d/2,w,.14,h),
];
export const SUITE={
  floor:slab(.55,.05,10,7.5,0), h:3.18, entry:{x:-.85,z:2.92},
  divider:[slab(1.15,-1.93,.16,3.54,3.18),slab(1.15,2.95,.16,1.70,3.18)],
  lintel:slab(1.15,.97,.16,2.26,3.18,2.54),
  bed:slab(-1.63,-2.21,2.34,2.53,.61),head:slab(-1.63,-3.45,2.94,.33,1.72),
  tables:[slab(-3.41,-3.03,.66,.69,.61),slab(.15,-3.03,.66,.69,.61)],
  sofa:slab(4.99,-.15,.95,2.44,.96), tea:slab(4.71,-2.05,.58,.58,.56),
  cabinet:slab(-3.99,.54,.73,1.74,1.04),
  pair:[[-2.24,.18],[-1.03,.18]], windowPair:[[2.55,-1.23],[3.73,-1.23]],
};
export const SPA={
  floor:slab(0,-1.60,7.2,11.2,0),h:3.30, entry:{x:1.58,z:3.00},
  divider:[slab(-1.38,.92,4.44,.16,3.30),slab(3.10,.92,1,.16,3.30)],
  lintel:slab(1.72,.92,1.76,.18,3.30,2.36),
  basin:slab(-.78,-3.37,3.20,3.96,.095,-.74),
  locker:slab(-3.22,2.46,.61,2.58,2.21),bench:slab(-1.94,2.50,.65,1.64,.43),
  spout:slab(-1.72,-5.64,.42,.51,.93),towels:slab(3.23,-2.38,.52,1.34,.98),
  dryPair:[[-.82,2.09],[.42,2.09]],poolPair:[[-.60,-6.08],[.67,-6.08]],
};
const obstructions={
  lanternSuite:[...SUITE.divider,SUITE.bed,SUITE.head,...SUITE.tables,SUITE.sofa,SUITE.tea,SUITE.cabinet],
  moonSpa:[...SPA.divider,SPA.basin,SPA.locker,SPA.bench,SPA.spout,SPA.towels],
};
const outline=(r:typeof SUITE|typeof SPA)=>perimeter(r.floor.x,r.floor.z,r.floor.w,r.floor.d,r.h);
const blockers={lanternSuite:[...obstructions.lanternSuite,...outline(SUITE),SUITE.lintel],moonSpa:[...obstructions.moonSpa,...outline(SPA),SPA.lintel]};
export const retreatPlan=(id:Retreat)=>id==='lanternSuite'?SUITE:SPA;
const near=(b:Slab,x:number,z:number,p:number)=>Math.abs(x-b.x)<=b.w/2+p&&Math.abs(z-b.z)<=b.d/2+p;
export function retreatGround(id:Retreat,x:number,z:number){
  const {floor:r}=retreatPlan(id);
  // Ground support stays independent of furniture. Normal movement queries the
  // actual model triangles for walls, seats, jump landings and overhead clearance.
  return near(r,x,z,-.22)&&!(id==='moonSpa'&&near(SPA.basin,x,z,.06))?0:-Infinity;
}
export const retreatPlace=(id:Retreat,x:number,z:number)=>near(retreatPlan(id).floor,x,z,-.32)&&!obstructions[id].some(b=>near(b,x,z,.23));
export function retreatVisible(id:Retreat,from:{x:number;y:number;z:number},x:number,y:number,z:number){
  if(![x,y,z,from.x,from.y,from.z].every(Number.isFinite)||from.y<=y)return false;
  return !blockers[id].some(b=>{
    let a=0,h=1;
    const axis=(p:number,q:number,l:number,r:number)=>{
      if(Math.abs(q)<1e-8)return p>=l&&p<=r;
      const t=(l-p)/q,u=(r-p)/q;a=Math.max(a,Math.min(t,u));h=Math.min(h,Math.max(t,u));return a<=h;
    };
    return axis(from.x,x-from.x,b.x-b.w/2,b.x+b.w/2)&&axis(from.z,z-from.z,b.z-b.d/2,b.z+b.d/2)&&axis(from.y,y-from.y,b.base,b.top);
  });
}
export const RETREAT_VIEWS={
  lanternSuite:{entry:[[-.35,1.57,2.99],[-1.62,1.03,-2.43]],shots:[
    {key:'suiteBed',eye:[-.42,1.39,2.24],aim:[-1.65,.87,-2.12]},
    {key:'suiteWindow',eye:[2.35,1.50,2.11],aim:[3.49,1.05,-2.04]},
    {key:'suiteTextiles',eye:[-2.92,.96,-.37],aim:[-1.71,.63,-1.81]},
  ]},
  moonSpa:{entry:[[2.13,1.59,3.42],[.46,1.00,-1.43]],shots:[
    {key:'spaChange',eye:[1.82,1.46,3.53],aim:[-1.61,.88,2.06]},
    {key:'spaWater',eye:[1.90,1.52,-.67],aim:[-.73,.72,-5.99]},
    {key:'spaSpout',eye:[-.99,1.16,-6.46],aim:[-1.36,.45,-4.95]},
  ]},
} as const;
