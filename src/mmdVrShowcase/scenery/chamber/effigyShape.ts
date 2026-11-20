// One immovable theatrical casting. The plinth, mantle and embossed face use the
// same closed cross-sections in the painter, foot clearance and sight queries.
export const EFFIGY={x:2.72,z:-6.39,yaw:-.82};
export type Point=[number,number,number];
type Ring=readonly [y:number,r:number];
export type Casting={rings:readonly Ring[];depth:number;offset:number};
export const SOLE:Casting={depth:.72,offset:0,rings:[[0,.505],[.06,.505],[.088,.472],[.143,.472],[.17,.435]]};
export const MANTLE:Casting={depth:.67,offset:0,rings:[[.17,.409],[.245,.432],[.31,.424],[.72,.398],[1.06,.387],[1.32,.481],[1.47,.486],[1.57,.432],[1.65,.273],[1.69,.235],[1.85,.228],[1.98,.172],[2.055,.095],[2.070,.053]]};
export const VISAGE:Casting={depth:.40,offset:.149,rings:[[1.593,.033],[1.634,.096],[1.707,.135],[1.797,.153],[1.875,.145],[1.925,.098],[1.950,.045]]};
// Clockwise looking down: broad forehead/front facets, chamfered back and sides.
export const rim:readonly (readonly [number,number])[]=[[0,1],[.71,.88],[1,.42],[1,-.53],[.67,-1],[-.67,-1],[-1,-.53],[-1,.42],[-.71,.88]];
const c=Math.cos(EFFIGY.yaw),s=Math.sin(EFFIGY.yaw);
export const effigyPoint=(u:number,y:number,v:number):Point=>[EFFIGY.x+c*u+s*v,y,EFFIGY.z-s*u+c*v];
export function ringPoint(b:Casting,ring:Ring,index:number){const [u,v]=rim[index];return effigyPoint(u*ring[1],ring[0],b.offset+v*ring[1]*b.depth);}
const planes=rim.map(([a,b],i)=>{const [x,z]=rim[(i+1)%rim.length],u=b-z,v=x-a;return {u,v,k:u*a+v*b};});
function local(x:number,z:number){x-=EFFIGY.x;z-=EFFIGY.z;return [c*x-s*z,s*x+c*z] as const;}
export function nearEffigy(x:number,z:number,pad:number){
  if(Math.abs(x-EFFIGY.x)>.64+pad||Math.abs(z-EFFIGY.z)>.64+pad)return false;
  const [u,v]=local(x,z),r=SOLE.rings[0][1];
  return planes.every(p=>p.u*u+p.v*v/SOLE.depth<=p.k*r+pad*Math.hypot(p.u,p.v/SOLE.depth));
}
type Eye={x:number;y:number;z:number};
export function effigyOccludes(from:Eye,x:number,y:number,z:number){
  if(Math.min(from.x,x)>EFFIGY.x+.65||Math.max(from.x,x)<EFFIGY.x-.65||Math.min(from.z,z)>EFFIGY.z+.65||Math.max(from.z,z)<EFFIGY.z-.65)return false;
  const [x0,z0]=local(from.x,from.z),[x1,z1]=local(x,z);
  for(const body of [SOLE,MANTLE,VISAGE])for(let j=1;j<body.rings.length;j++){
    const [lo,r]=body.rings[j-1],[hi,R]=body.rings[j];if(Math.min(from.y,y)>hi||Math.max(from.y,y)<lo)continue;
    let a=0,b=1;
    function clip(h:number,k:number){if(h>0&&k>0)return false;if(h>0)a=Math.max(a,h/(h-k));if(k>0)b=Math.min(b,h/(h-k));return a<=b;}
    if(!clip(lo-from.y,lo-y)||!clip(from.y-hi,y-hi))continue;
    const slope=(R-r)/(hi-lo),r0=r+(from.y-lo)*slope,r1=r+(y-lo)*slope;
    if(planes.every(p=>clip(p.u*x0+p.v*(z0-body.offset)/body.depth-p.k*r0,p.u*x1+p.v*(z1-body.offset)/body.depth-p.k*r1)))return true;
  }
  return false;
}
