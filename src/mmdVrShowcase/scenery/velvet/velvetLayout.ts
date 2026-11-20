// Finished floor is y=0 throughout the shoot, changing and lounge bays.
type Box={x:number;z:number;w:number;d:number;base:number;top:number};
const box=(x:number,z:number,w:number,d:number,top:number,base=0):Box=>({x,z,w,d,base,top});
export const velvetPlan={
  floor:box(1.2,0,10.8,8,0,-.12),
  walls:[box(-4.2,0,.14,8,3.75),box(6.6,0,.14,8,3.75),box(1.2,-4,10.8,.14,3.75),box(1.2,4,10.8,.14,3.75)],
  divider:[box(2.55,-1.99,.18,4.02,3.75),box(2.55,3.22,.18,1.56,3.75)],
  lintel:box(2.55,1.23,.22,2.42,3.75,2.68),
  // Keep the boudoir chaise and the open wardrobe behind the actor marks.
  sofa:box(-1.25,-2.91,3.08,1.14,1.04), wardrobe:box(4.55,-3.39,3.30,.91,2.56),
  bench:box(5.85,-.26,.75,1.61,.57), vanity:box(6.27,1.98,.49,1.49,2.25),
  console:box(-1.37,1.03,.96,.43,1.38),
  backdrop:box(-.80,-3.72,6.49,.42,3.6),
  mainMarks:[[-1.25,-1.37],[.38,-1.32]], wardrobeMarks:[[3.75,-1.63],[5.04,-1.64]],
} as const;
const p=velvetPlan;
const objects=[...p.divider,p.sofa,p.wardrobe,p.bench,p.vanity,p.console,p.backdrop];
const blockers=[...objects,...p.walls,p.lintel];
const inside=(r:Box,x:number,z:number,margin:number)=>Math.abs(x-r.x)<=r.w/2+margin&&Math.abs(z-r.z)<=r.d/2+margin;
export const velvetEntry={x:.32,z:3.37};
export const velvetGround=(x:number,z:number)=>inside(p.floor,x,z,-.15)?0:-Infinity;
export const velvetPlace=(x:number,z:number)=>inside(p.floor,x,z,-.34)&&!objects.some(r=>inside(r,x,z,.22));

/** Clip the ray segment, including its height: the open door has a solid soffit,
 * and the low bench blocks a shallow ray but not one passing over the cushion. */
type Point={x:number;y:number;z:number};
function clearSegment(from:Point,x:number,y:number,z:number,except?:Box){
  if(![from.x,from.y,from.z,x,y,z].every(Number.isFinite))return false;
  return !blockers.some(b=>{
    if(b===except)return false;
    let near=0,far=1;
    function clip(o:number,delta:number,lo:number,hi:number){
      if(Math.abs(delta)<1e-9)return o>=lo&&o<=hi;
      const a=(lo-o)/delta,e=(hi-o)/delta;
      near=Math.max(near,Math.min(a,e));far=Math.min(far,Math.max(a,e));return near<=far;
    }
    return clip(from.x,x-from.x,b.x-b.w/2,b.x+b.w/2)&&clip(from.z,z-from.z,b.z-b.d/2,b.z+b.d/2)&&clip(from.y,y-from.y,b.base,b.top);
  });
}
export const velvetSight=(from:Point,x:number,y:number,z:number)=>from.y>y&&clearSegment(from,x,y,z);
export const velvetDeskSight=(from:Point,hit:Point)=>clearSegment(from,hit.x,hit.y,hit.z,p.console);
export const velvetView={entry:[[.40,1.56,3.47],[-.57,1.35,-2.23]],shots:[
  {key:'velvetPortrait',eye:[.66,1.28,1.73],aim:[-1.27,.95,-2.48]},
  {key:'velvetLounge',eye:[3.56,1.52,1.08],aim:[4.58,1.28,-2.86]},
]} as const;
