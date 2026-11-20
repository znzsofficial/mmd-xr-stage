// Metres. The elevated decks have closed plinths: there is only one
// supported playing level at each (x,z). The stairs are travel, not actor slots.
export const rect=(x:number,z:number,w:number,d:number)=>({x,z,w,d});
export type Rect=ReturnType<typeof rect>;
export const solid=(r:Rect,bottom:number,top:number)=>({...r,bottom,top});
export const HALL=rect(0,-1.75,11.4,12.5), QUAY=rect(-.65,7.65,16.3,6.3);
export const STAGE=rect(0,-5.7,11.4,4.6), GALLERY=rect(-7.25,-2.6,3.1,10.4);
export const PIER=rect(4.96,13.04,2.56,4.8);
export const GALLERY_Y=2.72, STAGE_Y=.42;
// The gallery's far end opens into an annex west of the stage. Nothing
// overlaps the playable floor downstairs. Both sides of the sill are flush.
export const QUARTERS=rect(-8.75,-11.04,6.10,6.48), DOOR_X=GALLERY.x, DOOR_Z=-7.80, DOOR_WIDTH=1.96;
const west=QUARTERS.x-QUARTERS.w/2,east=QUARTERS.x+QUARTERS.w/2,back=QUARTERS.z-QUARTERS.d/2;
export const PRIVATE_TOP=5.68;
export const PRIVATE_WALLS=[
  rect(west+.08,QUARTERS.z,.16,QUARTERS.d),rect(east-.08,QUARTERS.z,.16,QUARTERS.d),rect(QUARTERS.x,back+.08,QUARTERS.w,.16),
  ...[[west,DOOR_X-DOOR_WIDTH/2],[DOOR_X+DOOR_WIDTH/2,east]].map(([a,b])=>rect((a+b)/2,DOOR_Z,b-a,.18)),
].map(r=>solid(r,GALLERY_Y,PRIVATE_TOP));
export const PRIVATE_HEADER=solid(rect(DOOR_X,DOOR_Z,DOOR_WIDTH,.20),GALLERY_Y+2.16,PRIVATE_TOP);
export const BED=rect(-7.59,-12.94,2.72,1.92), BED_STEP=rect(BED.x,-11.80,1.72,.36);
export const DRESSER=rect(-10.36,-13.42,1.82,.76), DRESSING_STOOL=rect(DRESSER.x+.04,-12.56,.53,.46);
export const PRIVATE_SPOTS=[[-7.61,-10.06],[-10.13,-10.77]] as const;
const upperSolid=(r:Rect,lo:number,hi:number)=>solid(r,GALLERY_Y+lo,GALLERY_Y+hi);
const privateSolids=[...PRIVATE_WALLS,PRIVATE_HEADER,upperSolid(BED,0,.78),upperSolid(BED_STEP,0,.21),
  upperSolid(rect(BED.x,BED.z-.87,2.68,.16),.76,1.65),upperSolid(BED,1.94,2.23),
  ...[-1,1].flatMap(k=>[
    upperSolid(rect(BED.x+k*1.27,BED.z-.87,.09,.09),1.65,1.94),
    upperSolid(rect(BED.x+k*1.06,BED.z+.925,.50,.12),.69,1.94),
    upperSolid(rect(BED.x+k*1.28,BED.z,.12,1.88),.73,1.24),
  ]),
  upperSolid(DRESSER,0,.97),upperSolid(rect(DRESSER.x,DRESSER.z-.08,.83,.16),.97,1.83),
  upperSolid(rect(DRESSER.x-.55,DRESSER.z+.05,.30,.20),.97,1.12),upperSolid(rect(DRESSER.x+.62,DRESSER.z+.05,.18,.18),.97,1.11),
  upperSolid(DRESSING_STOOL,0,.48),
  ...[-1,1].map(k=>upperSolid(rect(DOOR_X+k*1.14,DOOR_Z+.44,.36,.36),1.52,2.30)),
];
export const STAIRS=rect(-7.25,5.32,3.1,5.44), DAIS_STEPS=rect(0,-2.92,2.6,.96);
export const XR_ENTRY={x:.20,z:9.1};
export const SCREEN_ENTRY=[[4.75,1.68,14.83],[-1.1,2.0,.56]] as const;
export const SHOTS=[
  {key:'qinQuay',eye:[2.72,1.64,7.8],aim:[-1.54,1.16,14.12]},
  {key:'qinSeats',eye:[1.4,1.42,2.74],aim:[-.95,1.54,-5.7]},
  {key:'qinGallery',eye:[-6.38,4.36,-1.71],aim:[.10,1.52,-5.38]},
  {key:'qinhuaiPrivate',eye:[-6.28,4.29,-8.24],aim:[-8.78,3.42,-12.18]},
  {key:'qinMusic',eye:[2.32,1.98,-4.22],aim:[4.13,1.57,-6.78]},
  {key:'qinLanding',eye:SCREEN_ENTRY[0],aim:SCREEN_ENTRY[1]},
] as const;
export const TABLES=[rect(-3.56,-.15,1.38,.79),rect(3.56,-.15,1.38,.79),rect(-3.56,2.3,1.38,.79),rect(3.56,2.3,1.38,.79)];
export const STOOLS=TABLES.flatMap(t=>[-1,1].map(k=>rect(t.x+k*.48,t.z+.82,.43,.43)));
export const MUSIC=rect(4.04,-6.70,2.05,.63), VANITY=rect(-4.2,-6.8,1.55,.71), MIRROR=rect(-4.2,-7.03,.88,.18);
export const UPPER_SEAT=rect(-8.18,-2.4,.54,1.85);
export const POSTS=[...[-5.57,5.57].flatMap(x=>[-7.8,-3.4,.22,4.42].map(z=>rect(x,z,.32,.32))),...[-3.23,3.23].map(x=>rect(x,4.42,.31,.31)),...[-8.63,-5.85].flatMap(x=>[-7.62,-4.3,-1.04,2.46].map(z=>rect(x,z,.24,.24)))];
export const WALLS=[solid(rect(0,-7.94,11.44,.15),-.1,5.53),solid(rect(5.64,-1.75,.15,12.5),-.1,4.98),
  solid(rect(-5.7,-1.75,.16,12.5),-.1,GALLERY_Y),solid(rect(-8.75,-2.54,.13,10.58),GALLERY_Y,5.12),
  ...[-4.43,4.43].map(x=>solid(rect(x,4.42,2.19,.15),0,3.05))];
export const GALLERY_RAIL=solid(rect(-5.84,-2.6,.12,10.35),GALLERY_Y,GALLERY_Y+.93);
export const RIVER_RAILS=[rect(-2.52,10.71,12.56,.13),rect(6.85,10.71,1.3,.13),rect(7.41,7.65,.13,6.16),rect(-8.71,9.41,.13,2.67)].map(r=>solid(r,0,.83));
// The ties leave the west edge for the boat. Include the standing turns,
// tucked end and pile in the footprint, not just the inner timber core.
export const MOORING_POSTS=[3.85,6.06].flatMap(x=>[12.18,15.22].map(z=>({...rect(x,z,x<5?.28:.19,x<5?.28:.19),tied:x<5})));
export const stageDrapes=[-1,1].map(k=>solid(rect(k*4.04,-5.24,1.15,.22),.42,3.51));
export const HEADER=solid(rect(0,4.42,11.45,.27),3.06,3.64);
export const BACKDROP=solid(rect(0,-7.62,6.88,.18),STAGE_Y,3.9);
export const CEILINGS=[solid(rect(0,.94,11.4,7.14),5.04,5.10),solid(rect(0,-5.32,11.4,5.41),5.49,5.55),solid(GALLERY,5.53,5.60),solid(QUARTERS,PRIVATE_TOP,PRIVATE_TOP+.08)];
const fixed=[...WALLS,...privateSolids,GALLERY_RAIL,...RIVER_RAILS,...MOORING_POSTS.map(p=>solid(p,0,.68)),BACKDROP,...POSTS.map(p=>solid(p,0,5)),...stageDrapes,
  ...TABLES.map(r=>solid(r,0,.79)),...STOOLS.map(r=>solid(r,0,.46)),solid(MUSIC,STAGE_Y,1.45),solid(rect(4.53,-6.86,.42,.17),1.44,2.53),solid(VANITY,STAGE_Y,1.28),solid(MIRROR,1.28,2.12),solid(UPPER_SEAT,GALLERY_Y,GALLERY_Y+.5)];
const inside=(r:Rect,x:number,z:number)=>Math.abs(r.x-x)<=r.w/2+1e-6&&Math.abs(r.z-z)<=r.d/2+1e-6;
const near=(r:Rect,x:number,z:number,c:number)=>{const u=Math.max(0,Math.abs(x-r.x)-r.w/2),v=Math.max(0,Math.abs(z-r.z)-r.d/2);return u*u+v*v<=c*c;};
function surface(x:number,z:number){
  if(inside(GALLERY,x,z)||inside(QUARTERS,x,z))return GALLERY_Y;
  if(inside(STAIRS,x,z))return Math.max(0,Math.min(GALLERY_Y,(8.04-z)*.5));
  if(inside(STAGE,x,z))return STAGE_Y;
  if(inside(DAIS_STEPS,x,z))return Math.max(0,Math.min(STAGE_Y,(-2.44-z)*STAGE_Y/.96));
  return inside(QUAY,x,z)||inside(HALL,x,z)||inside(PIER,x,z)?0:null;
}
export function songhouseHeight(x:number,z:number){return surface(x,z)??0;}
// The stair cheeks, gallery edge and stage apron are real drops; walking
// across them sideways is not a shortcut to the next level.
const stairCheeks=[rect(-8.74,5.32,.13,5.4),rect(-5.76,5.32,.13,5.4)];
const apronSides=[rect(-3.5,-3.4,4.4,.07),rect(3.5,-3.4,4.4,.07)];
export function songhouseClear(x:number,z:number,placing=false){
  const h=surface(x,z);if(h===null)return false;
  const c=placing?.25:.18;
  if(placing&&(near(STAIRS,x,z,c)||near(DAIS_STEPS,x,z,c)))return false;
  if(surface(x-c,z)===null||surface(x+c,z)===null||surface(x,z+c)===null||surface(x,z-c)===null)return false;
  if(stairCheeks.some(r=>near(r,x,z,c))||apronSides.some(r=>near(r,x,z,c)))return false;
  return !fixed.some(r=>r.top>h+.024&&r.bottom<h+1.7&&near(r,x,z,c));
}
export function moveInSonghouse(x:number,z:number,dx:number,dz:number){
  const length=Math.hypot(dx,dz);if(!Number.isFinite(length)||length>32||!songhouseClear(x,z))return {x,z};
  const steps=Math.ceil(length/.09);
  for(let i=0;i<steps;i++){
    const nx=x+dx/steps,nz=z+dz/steps,h=songhouseHeight(x,z);
    const pass=(a:number,b:number)=>songhouseClear(a,b)&&Math.abs(songhouseHeight(a,b)-h)<.075;
    if(pass(nx,nz)){x=nx;z=nz;}else if(dx&&pass(nx,z))x=nx;else if(dz&&pass(x,nz))z=nz;else break;
  }
  return {x,z};
}
export const STAIR_COUNT=16, DAIS_COUNT=3;
export function treads(r:Rect,height:number,n:number){return Array.from({length:n},(_,i)=>solid(rect(r.x,r.z+r.d/2-(i+.5)*r.d/n,r.w,r.d/n),-.01,(i+1)*height/n));}
export const STAIR_TREADS=treads(STAIRS,GALLERY_Y,STAIR_COUNT),DAIS_TREADS=treads(DAIS_STEPS,STAGE_Y,DAIS_COUNT);
export const PICK_DECKS=[{...STAGE,y:STAGE_Y},{...GALLERY,y:GALLERY_Y},{...QUARTERS,y:GALLERY_Y}];
const occluders=[...fixed,...CEILINGS,solid(HEADER,HEADER.bottom,5.03),...PICK_DECKS.map(r=>solid(r,-.08,r.y)),...STAIR_TREADS,...DAIS_TREADS,
  ...stairCheeks.flatMap(r=>STAIR_TREADS.map(t=>({...t,x:r.x,w:r.w,top:t.top+.88}))),
  solid(rect(0,-5.24,9.2,.25),3.51,3.96)];
export function songhousePlacementVisible(from:{x:number;y:number;z:number},x:number,y:number,z:number){
  if(![from.x,from.y,from.z,x,y,z].every(Number.isFinite)||Math.abs(y-songhouseHeight(x,z))>.025||from.y<=y)return false;
  // Clip the segment, not its ground projection: a ray may pass over a tea
  // table, but not through the stage fascia, a folded screen or gallery rail.
  return !occluders.some(r=>{
    let lo=0,hi=1;
    const slab=(p:number,d:number,min:number,max:number)=>{
      if(Math.abs(d)<1e-8)return p>=min&&p<=max;
      const a=(min-p)/d,b=(max-p)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));return lo<=hi;
    };
    return slab(from.x,x-from.x,r.x-r.w/2,r.x+r.w/2)&&slab(from.z,z-from.z,r.z-r.d/2,r.z+r.d/2)&&slab(from.y,y+.012-from.y,r.bottom,r.top);
  });
}
