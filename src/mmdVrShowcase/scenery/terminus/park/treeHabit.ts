import {Matrix4, Vector3} from 'three';

// A vase-shaped zelkova: a short clear bole, several rising leaders and fans
// of fine lateral growth. The offline shadow bake uses these same branches,
// spray matrices and folded leaf surfaces, not a proxy crown.
export type ParkTree = {x:number; z:number; variant?:number; scale?:number};
type Ring = {p:Vector3; r:number};
type Limb = {rings:Ring[]; sides:number};
type Spray = {matrix:Matrix4; tile:number; exposure:number};
export const habitCount = 4;
export const sprayTiles = 4;
export const habitOf = (tree:ParkTree, i:number) => ((Math.trunc(tree.variant ?? i) % habitCount) + habitCount) % habitCount;

// Rows run from the petiole to the growing tip. Slight camber keeps the
// petiole oriented with its branch while opposite blade edges catch light.
export const sprayPoints:number[] = [];
export const sprayUV:number[] = [];
export const sprayFaces:number[] = [];
for(let row=0; row<4; row++){
  const t=row/3;
  for(let col=0; col<3; col++){
    const x=(col-1)*.5;
    sprayPoints.push(x,t, .07*Math.sin(t*Math.PI)-.115*t*t-.10*x*x*4);
    sprayUV.push(col*.5,t);
    if(row<3 && col<2){const k=row*3+col; sprayFaces.push(k,k+1,k+3,k+1,k+4,k+3);}
  }
}

// The print spans this rectangle in tree-local X/Z at ground level. Higher
// receivers sample it by continuing the same sun ray down to this plane.
export const shadowPrint={left:-9, top:-1, width:12, depth:17};

export function growTree(variant:number,sunDirection:readonly [number,number,number]){
  let seed = (9821 + variant*7919) >>> 0;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const between=(a:number,b:number)=>a+(b-a)*rand();
  const limbs:Limb[]=[], shoots:Spray[]=[];
  const phase=between(0,Math.PI*2);
  const advance=(p:Vector3,a:number,run:number,rise:number)=>p.clone().add(new Vector3(Math.cos(a)*run,rise,Math.sin(a)*run));
  function limb(points:Vector3[],radii:number[],sides:number){
    limbs.push({rings:points.map((p,i)=>({p,r:radii[i]})),sides});
  }
  function branch(start:Vector3,a:number,run:number,rise:number,r:number,endR:number,sides:number){
    const knee=advance(start,a+between(-.22,.22),run*.43,rise*between(.30,.56));
    const head=advance(start,a,run,rise);
    limb([start,knee,head],[r,.54*r+.46*endR,endR],sides);
    return {knee,head};
  }
  const axis=new Vector3(), across=new Vector3(), normal=new Vector3();
  const sun=new Vector3(...sunDirection).normalize();
  function spray(p:Vector3,a:number,tilt:number,size:number){
    axis.set(Math.cos(a)*Math.cos(tilt),Math.sin(tilt),Math.sin(a)*Math.cos(tilt));
    across.set(-Math.sin(a),0,Math.cos(a)).applyAxisAngle(axis,between(-1.05,1.05));
    normal.crossVectors(across,axis);
    const matrix=new Matrix4().makeBasis(across,axis,normal).scale(new Vector3(size*between(.77,1.05),size,size)).setPosition(p);
    const facing=Math.abs(normal.dot(sun)), rim=(p.x*sun.x+p.z*sun.z)*.12;
    const exposure=Math.max(.25,Math.min(1,.40+(p.y-3)*.16+rim+.12*facing+between(-.12,.12)));
    shoots.push({matrix,tile:Math.floor(rand()*sprayTiles),exposure});
  }
  const base=new Vector3(0,-.025,0);
  const neck=advance(base,phase,.045,.34), shoulder=advance(neck,phase+.23,.084,1.69);
  const fork=advance(shoulder,phase+.68,.10,.56);
  limb([base,advance(base,phase,.012,.11),neck,shoulder,fork],[.295,.234,.182,.147,.095],13);
  // Narrow root flares merge into the bole instead of round posts.
  for(let i=0;i<6;i++){
    const a=phase+i*1.047+between(-.14,.14);
    limb([advance(neck,a,.075,-.02),advance(base,a,.205,.095),advance(base,a,between(.32,.48),.008)],[.082,.063,.014],7);
  }
  for(let i=0;i<8;i++){
    const a=phase+i*2.39996+between(-.23,.23), upper=i%3===0;
    const start=shoulder.clone().lerp(fork, i===0?1:between(0,1));
    const leader=branch(start,a,upper?between(.22,.48):between(.53,.89),upper?between(1.23,1.58):between(.63,.99),between(.087,.121),.052,9);
    for(let j=0;j<4;j++){
      const b=a+[-.97,.74,-.41,.24][j]+between(-.22,.22);
      const joint=leader.knee.clone().lerp(leader.head,j===3?1:between(.06,.88));
      const secondary=branch(joint,b,between(.47,.82),between(.32,.86)+(upper?.15:0),between(.035,.055),.022,7);
      for(let k=0;k<3;k++){
        const c=b+(k-1)*between(.57,1.04)+between(-.18,.18);
        const origin=secondary.knee.clone().lerp(secondary.head,k===1?1:between(.16,.75));
        const twig=branch(origin,c,between(.33,.61),between(-.09,.42),.020,.007,5);
        for(let n=0;n<5;n++){
          const u=n===4?1:between(.04,.91);
          const leafJoint=twig.knee.clone().lerp(twig.head,u);
          const yaw=c+(n===4?0:(n%2?1:-1)*between(.43,1.37));
          spray(leafJoint,yaw,between(-.52,.79)+(upper?.13:0),between(.58,.89));
        }
      }
    }
  }
  return {limbs,shoots};
}
