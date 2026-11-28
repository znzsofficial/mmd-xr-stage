import {schoolBrickEdges} from '../CampusLayout';
import {CITY_ORIGINS} from './site';

type Point=readonly [number,number];
const school=CITY_ORIGINS.classroom;
const courses=schoolBrickEdges.slice(1).map(([r,l],i)=>{
  const [prevR,prevL]=schoolBrickEdges[i];
  const corners=[prevR,prevL,l,r].map(([x,z]):Point=>[x+school.x,z+school.z]);
  const xs=corners.map(p=>p[0]),zs=corners.map(p=>p[1]);
  return {corners,l:Math.min(...xs),r:Math.max(...xs),b:Math.min(...zs),f:Math.max(...zs)};
});

// The brick strips are convex and clockwise in XZ. Cut a convex stone cell
// against their edges, emitting the outside of each half-plane exactly once.
function withoutCourse(input:Point[],course:Point[]){
  const pieces:Point[][]=[];
  let rest=input;
  for(let e=0;e<course.length&&rest.length;e++){
    const a=course[e],b=course[(e+1)%course.length],inside:Point[]=[],outside:Point[]=[];
    const side=(p:Point)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    for(let j=0;j<rest.length;j++){
      const p=rest[j],q=rest[(j+1)%rest.length],sp=side(p),sq=side(q);
      if(sp<=0)inside.push(p);if(sp>=0)outside.push(p);
      if((sp<0&&sq>0)||(sp>0&&sq<0)){
        const t=sp/(sp-sq),join:Point=[p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])];
        inside.push(join);outside.push(join);
      }
    }
    if(outside.length>=3)pieces.push(outside);
    rest=inside.length>=3?inside:[];
  }
  return pieces;
}

export function besideSchoolWalk(l:number,r:number,b:number,f:number,schoolVisible:boolean){
  let cells:Point[][]=[[[l,b],[l,f],[r,f],[r,b]]];
  if(schoolVisible)for(const q of courses){
    if(q.r<=l||q.l>=r||q.f<=b||q.b>=f)continue;
    cells=cells.flatMap(cell=>withoutCourse(cell,q.corners));
  }
  return cells;
}
