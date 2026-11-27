import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape,
} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {bench, booth, posts, sign} from './shoreLayout';

type Point = [number, number, number];
export const stationClockPosition:Point = [-1.63,2.49,-5.72];
const upright = -Math.PI/2;
const postPaint = 9, castPaint = 10, stone = 11, plated = 12, oxidised = 13;
const stripV = (row:number, t:number) => 1-(row*64 + 2 + t*60)/1024;

// One casting at either end of the bench. The top is a continuous bearing
// under all four boards. The open arch runs between two flared mounting lugs.
function seatCasting(){
  const profile = new Shape();
  profile.moveTo(-.275,.418); profile.lineTo(.285,.418); profile.lineTo(.285,.382);
  profile.quadraticCurveTo(.208,.368,.203,.29); profile.lineTo(.217,.074);
  profile.quadraticCurveTo(.219,.047,.24,.037); profile.lineTo(.24,.027); profile.lineTo(.153,.027);
  profile.quadraticCurveTo(.157,.051,.16,.078); profile.lineTo(.136,.228);
  profile.bezierCurveTo(.124,.347,-.116,.345,-.132,.226); profile.lineTo(-.163,.073);
  profile.quadraticCurveTo(-.161,.043,-.152,.027); profile.lineTo(-.239,.027); profile.lineTo(-.239,.037);
  profile.quadraticCurveTo(-.214,.051,-.21,.079); profile.lineTo(-.189,.292);
  profile.quadraticCurveTo(-.18,.365,-.263,.378); profile.closePath();
  return new ExtrudeGeometry(profile,{depth:.054,curveSegments:5,bevelThickness:.004,bevelSize:.0055,bevelSegments:1});
}

function officeBoarding(){
  const pos:number[]=[],uv:number[]=[],index:number[]=[];
  const left=booth.x-(booth.w+.035)/2, near=booth.z-(booth.d+.035)/2;
  const width=booth.w+.035, depth=booth.d+.035;
  function wall(x:number,z:number,dx:number,dz:number){
    const length=Math.hypot(dx,dz), count=Math.round(length/.155), spacing=length/count;
    const nx=-dz/length, nz=dx/length;
    for(let i=0;i<count;i++){
      const start=pos.length/3, row=14+i%2, offset=((i*13)%7)*.086;
      for(const [across,relief] of [[.001,.0008],[.006,.005],[spacing-.006,.005],[spacing-.001,.0008]]){
        const along=(i*spacing+across)/length, px=x+along*dx+nx*relief,pz=z+along*dz+nz*relief;
        for(const [y,u] of [[.052,offset],[.731,offset+.38]]){
          pos.push(px,y,pz);uv.push(u,stripV(row,across/spacing));
        }
      }
      for(let j=start;j<start+6;j+=2)index.push(j,j+2,j+1,j+1,j+2,j+3);
    }
  }
  wall(left,near,0,depth);wall(left,near+depth,width,0);
  wall(left+width,near+depth,0,-depth);wall(left+width,near,-width,0);
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}

export function waitingBayGeometry(){
  const parts:BufferGeometry[] = [];
  function add(g:BufferGeometry, position:Point, tint:string, rx=0, ry=0, rz=0){
    const count=g.attributes.position.count;
    if(!g.index)g.setIndex(Array.from({length:count},(_,i)=>i));
    const colour=new Color(tint), rgb=new Float32Array(count*3);
    for(let i=0;i<count;i++)colour.toArray(rgb,i*3);
    g.setAttribute('color',new Float32BufferAttribute(rgb,3));
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(...position); parts.push(g);
  }
  // The local long axis is +Z, including the uprights. Unwrap by the owning
  // face (before rounding) so a bevel triangle never straddles atlas strips.
  function member(p:Point, w:number,h:number,d:number, radius:number, row:number, tint='white',rx=0,ry=0,rz=0){
    const g=radius ? new RoundedBoxGeometry(w,h,d,1,radius) : new BoxGeometry(w,h,d);
    const pos=g.attributes.position, uv=g.attributes.uv, faceSize=pos.count/6;
    for(let i=0;i<pos.count;i++){
      const face=Math.floor(i/faceSize), x=pos.getX(i)/w+.5, y=pos.getY(i)/h+.5, z=pos.getZ(i)/d+.5;
      if(face>=4 && row<8){
        uv.setXY(i,(row*128+2+(face===4?x:1-x)*124)/1024,stripV(8,1-y));
      }else{
        const u=face>=4?x:z, v=face<2?1-y:face<4?x:1-y;
        uv.setXY(i,(2+u*1020)/1024,stripV(row,v));
      }
    }
    add(g,p,tint,rx,ry,rz);
  }
  function pin(p:Point,r:number,h:number,tint:string,sides=8,rx=0,ry=0){
    const g=new CylinderGeometry(r*.91,r,h,sides), uv=g.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,.5,stripV(plated,.5));
    add(g,p,tint,rx,ry);
  }
  const galvanized='#adb2a6', darkIron='#6e7166';
  const bx=bench.x, boltZ=[bench.z-.94,bench.z+.94];
  for(const z of boltZ){
    const casting=seatCasting(), xyz=casting.attributes.position, uv=casting.attributes.uv;
    for(let i=0;i<xyz.count;i++)uv.setXY(i,(xyz.getY(i)-.016)/.415,stripV(castPaint,(xyz.getX(i)+.29)/.59));
    add(casting,[bx,0,z-.027],'#ecedda');
    for(const side of [-1,1]){
      const x=bx+side*.194;
      member([x,.015,z],.113,.03,.135,.004,castPaint);
      for(const dz of [-.049,.049])pin([x,.034,z+dz],.010,.009,darkIron,6);
    }
    member([bx+.306,.58,z],.046,.065,.52,.006,castPaint,'white',upright);
  }
  // The tie bar meets both castings below the rail; the heads and nuts sit
  // on their outside faces. No geometry bridges the gaps between slats above.
  member([bx,.365,bench.z],.043,.037,1.88,.004,castPaint);
  for(const [i,z] of boltZ.entries())pin([bx,.365,z+(i?.035:-.035)],.019,.009,darkIron,6,Math.PI/2);
  for(let i=0;i<4;i++){
    const x=bx-.24+i*.14;
    member([x,.454,bench.z],.118,.061,bench.d,.007,i);
    for(const z of boltZ)pin([x,.485,z],.009,.003,galvanized,10);
  }
  for(let i=0;i<3;i++){
    const y=.595+i*.11;
    member([bx+.29,y,bench.z],.065,.092,bench.d,.006,4+i);
    for(const z of boltZ)pin([bx+.256,y,z],.009,.003,galvanized,10,Math.PI/2,-Math.PI/2);
  }

  const shelfX=booth.x-booth.w/2-.15;
  member([shelfX,1.016,booth.z],.35,.07,3.5,.008,7);
  for(const dz of [-1.42,0,1.42]){
    member([shelfX,.972,booth.z+dz],.28,.018,.034,0,castPaint);
    // The angle's diagonal bears against the service wall at its lower end.
    member([shelfX+.069,.908,booth.z+dz],.192,.024,.026,0,castPaint,'white',0,0,-.55);
  }

  for(const {x,z} of posts){
    member([x,.16,z],.24,.32,.26,.008,stone);
    member([x,1.62,z],.13,.15,2.64,.005,postPaint,'white',upright);
    member([x,.334,z],.215,.026,.23,0,castPaint);
    for(const dx of [-.084,.084])for(const dz of [-.092,.092])pin([x+dx,.35,z+dz],.010,.011,galvanized,6);
    member([x,1.44,z],.153,.05,.173,0,oxidised,'#928568');
  }
  for(const dx of [-.9,.9]){
    const x=sign.x+dx;
    member([x,.10,sign.z],.20,.20,.20,.006,stone);
    member([x,1.24,sign.z],.072,.072,2.08,.004,postPaint,'white',upright);
    member([x,.21,sign.z],.145,.017,.14,.003,castPaint);
    for(const sx of [-.052,.052])pin([x+sx,.223,sign.z],.009,.009,galvanized,6);
  }
  member([sign.x,1.85,sign.z],.115,.84,2.17,.012,castPaint,'white',0,Math.PI/2);
  for(const side of [-1,1])for(const dx of [-.999,.999])for(const dy of [-.333,.333]){
    pin([sign.x+dx,1.85+dy,sign.z+side*.061],.012,.004,galvanized,10,side*Math.PI/2);
  }
  const [cx,cy,cz]=stationClockPosition;
  member([cx,cy+.4,cz],.047,.051,.37,0,postPaint,'white',upright);
  const housing=new CylinderGeometry(.284,.284,.147,48), housingUv=housing.attributes.uv;
  for(let i=0;i<housingUv.count;i++)housingUv.setY(i,stripV(castPaint,housingUv.getY(i)));
  add(housing,stationClockPosition,'white',Math.PI/2);
  add(officeBoarding(),[0,0,0],'white');
  const joined=mergeGeometries(parts,false), result=mergeVertices(joined);
  joined.dispose();
  for(const p of parts)p.dispose();
  result.computeBoundingSphere();
  return result;
}

// Diffuse contact under the feet when the renderer has no shadow map. One
// feathered batch multiplies the actual tile print; the tiles keep their UVs.
export function waitingBayContact(){
  const positions:number[]=[], colours:number[]=[], indices:number[]=[];
  function patch(x:number,z:number,rx:number,rz:number,opacity:number){
    const start=positions.length/3, sides=16;
    positions.push(x,.004,z); colours.push(1,1,1,opacity);
    for(let ring=0;ring<2;ring++)for(let i=0;i<sides;i++){
      const size=ring===0?.48:1, angle=i*2*Math.PI/sides;
      positions.push(x+rx*size*Math.cos(angle),.004,z+rz*size*Math.sin(angle));
      colours.push(1,1,1,ring===0?opacity*.52:0);
      const a=start+1+i, b=start+1+(i+1)%sides;
      if(ring===0)indices.push(start,b,a);else indices.push(a,b,b+sides,a,b+sides,a+sides);
    }
  }
  patch(bench.x,bench.z,.65,bench.d*.58,.19);
  for(const dz of [-.94,.94])for(const dx of [-.194,.194])patch(bench.x+dx,bench.z+dz,.19,.18,.49);
  for(const {x,z} of posts)patch(x,z,.36,.4,.52);
  for(const dx of [-.9,.9])patch(sign.x+dx,sign.z,.27,.26,.48);
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('color',new Float32BufferAttribute(colours,4));
  g.setIndex(indices);return g;
}
