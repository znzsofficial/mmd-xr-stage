import { useEffect, useMemo, useState } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, IcosahedronGeometry, SRGBColorSpace, TextureLoader, Vector3, type Texture } from 'three';
import { LAWN_KNOLLS, LAWN_SIZE, LAWN_TREES, MEADOW_POSTS, MEADOW_SEAT, meadowPathX as pathX } from './placementAreas';
import groundUrl from './meadow-ground.webp';
import { seededRandom } from './ClassroomLayout';
import { Batch, type Part } from './SceneryBatch';
import { noPick } from './sceneryPaint';

type V = Part['p'];

// Blade ribbons, stems, flower heads: one opaque vertex-coloured draw, no
// alpha-cutout leaf cards crossing each other in stereo.
function flowers() {
  const pos:number[]=[],col:number[]=[],random=seededRandom(12209), c=new Color();
  const tri=(a:V,b:V,d:V,color:string)=>{pos.push(...a,...b,...d);c.set(color);for(let i=0;i<3;i++)col.push(c.r,c.g,c.b);};
  for(let patch=0;patch<165;patch++) {
    const z=(random()-.5)*28,x=patch<90?pathX(z)+(patch%2?1:-1)*(.9+random()*.8):(random()-.5)*29;
    if(Math.abs(x-pathX(z))<.88||Math.hypot(x,z)<1.55)continue;
    for(let j=0;j<9;j++){const xx=x+(random()-.5)*.8,zz=z+(random()-.5)*.8,h=.1+random()*.22,ox=.11*(random()-.5),oz=.13*(random()-.5);
      tri([xx-.017,0,zz],[xx+.017,0,zz],[xx+ox,h,zz+oz],j%2?'#788e44':'#a1ad56');
      if(j<4){const rad=.035+random()*.02;const color=patch%6===0?'#ba85ac':patch%4?'#fff1cb':'#e2b55c';
        for(let k=0;k<5;k++){const a=k*1.256;tri([xx+ox,h,zz+oz],[xx+ox+rad*Math.cos(a-.38),h+.026,zz+oz+rad*Math.sin(a-.38)],[xx+ox+rad*Math.cos(a+.38),h+.032,zz+oz+rad*Math.sin(a+.38)],color);}}
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}

// Irregular sprays of leaves instead of a smooth green sphere. A small solid
// core shades the interior; the perimeter breaks into individual leaf tips.
function crownSpray() {
  const pos:number[]=[],rgb:number[]=[],norm:number[]=[],rng=seededRandom(8189),core=new IcosahedronGeometry(.32,0),v=new Vector3();
  const face=(a:Vector3,b:Vector3,c:Vector3,tint:number)=>{for(const p of [a,b,c]){pos.push(...p.toArray());norm.push(...p.clone().normalize().toArray());rgb.push(tint*.94,tint,tint*.84);}};
  const verts=core.getAttribute('position');for(let i=0;i<verts.count;i+=3)face(new Vector3().fromBufferAttribute(verts,i),new Vector3().fromBufferAttribute(verts,i+1),new Vector3().fromBufferAttribute(verts,i+2),.64);core.dispose();
  for(let i=0;i<78;i++){
    const az=i*2.4,y=2*(i+.5)/78-1,r=Math.sqrt(1-y*y);v.set(Math.cos(az)*r,y,Math.sin(az)*r);
    const center=v.clone().multiplyScalar(.30+rng()*.075),side=new Vector3(-Math.sin(az),0,Math.cos(az)), up=v.clone().cross(side).normalize();
    const tip=center.clone().addScaledVector(v,.055+rng()*.07).addScaledVector(up,.035);
    const left=center.clone().addScaledVector(side,-.132),right=center.clone().addScaledVector(side,.132),bottom=center.clone().addScaledVector(up,-.14);
    const high=center.clone().addScaledVector(up,.14),tint=.68+rng()*.34+Math.max(0,y)*.24;
    face(left,tip,high,tint);face(high,tip,right,tint*1.06);face(right,tip,bottom,tint*.83);face(bottom,tip,left,tint*.79);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.setAttribute('normal',new Float32BufferAttribute(norm,3));return g;
}

function grove() {
  const wood:Part[]=[],branches:Part[]=[],leaves:Part[]=[], hills:Part[]=[];
  const rng=seededRandom(419),box=(p:V,s:V,color:string,ry=0)=>wood.push({p,s,color,ry});
  const beam=(a:V,b:V,r:number,color:string)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);
    // Euler XYZ with z applied first: send local up to the branch direction.
    branches.push({p:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],s:[r,l,r],rx:Math.atan2(dz,dy),rz:-Math.asin(dx/l),color});};
  for(const k of LAWN_KNOLLS)hills.push({p:[k.x,-.24,k.z],s:[k.w,k.h,k.d],ry:k.yaw,color:'#91a767'});
  // Distant ridges hide the board edge and give parallax as the viewer walks.
  for(let i=0;i<30;i++){const a=i*2*Math.PI/30;hills.push({p:[Math.sin(a)*39,-1.5,Math.cos(a)*39],s:[17+rng()*6,6+rng()*8,15+rng()*7],ry:a,color:i%3?'#819a83':'#91a591'});}
  for(let i=0;i<LAWN_TREES.length;i++){const tree=LAWN_TREES[i],{x,z,h}=tree,birch=i%3===1;const bark=birch?'#c4c1a9':'#806d53';
    const fork:V=[x+.12,h*.44,z-.10];beam([x,0,z],fork,h*(birch?.064:.11),bark);
    for(let j=0;j<6;j++) {const a=j*2.4+i*.61,r=j===0?0:h*(.19+rng()*.09),end:V=[x+Math.sin(a)*r,h*(j===0?.96:.66+rng()*.17),z+Math.cos(a)*r];
      beam(fork,end,h*.041,bark);
      leaves.push({p:end,s:[h*(birch?.49:.64),h*(birch?.58:.47),h*.55],ry:a,color:['#a5c672','#88ab5a','#bdd286','#7c9f60'][(i+j)%4]});
    }
  }
  for(const [i,f] of MEADOW_POSTS.entries()){box([f.x,.51,f.z],[.14,1.02,.14],'#aa976f');box([f.x,1.03,f.z],[.16,.05,.16],'#cfc29b');const b=MEADOW_POSTS[i+1];if(!b)continue;for(const y of [.38,.76])box([(f.x+b.x)/2,y,(f.z+b.z)/2],[.067,.092,Math.hypot(f.x-b.x,f.z-b.z)+.06],'#c4ae85',Math.atan2(f.x-b.x,f.z-b.z));}
  const seat=MEADOW_SEAT;const put=(dx:number,y:number,dz:number,s:V,color:string)=>box([seat.x+dx*Math.cos(seat.yaw)+dz*Math.sin(seat.yaw),y,seat.z+dz*Math.cos(seat.yaw)-dx*Math.sin(seat.yaw)],s,color,seat.yaw);
  for(const dx of [-.67,.67])for(const dz of [-.19,.19])put(dx,.21,dz,[.075,.42,.075],'#555d50');
  for(let i=0;i<4;i++)put(0,.43,-.23+i*.133,[1.82,.052,.113],'#bb966a');
  for(const dx of [-.67,.67])put(dx,.65,.23,[.065,.53,.055],'#586557');
  for(const y of [.66,.82])put(0,y,.25,[1.85,.135,.048],'#c5a277');
  return {wood,branches,leaves,hills};
}

export function Meadow({shadows}:{shadows:boolean}) {
  const [map,setMap]=useState<Texture|null>(null);
  const grass=useMemo(flowers,[]),foliage=useMemo(crownSpray,[]),p=useMemo(grove,[]);
  useEffect(()=>{let active=true;const texture=new TextureLoader().load(groundUrl,ready=>{if(active){ready.colorSpace=SRGBColorSpace;ready.anisotropy=4;setMap(ready);}});return ()=>{active=false;texture.dispose();};},[]);
  useEffect(()=>()=>{grass.dispose();foliage.dispose();},[grass,foliage]);
  return <group name="scenery:lawn"><mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><planeGeometry args={[LAWN_SIZE,LAWN_SIZE]} /><meshStandardMaterial map={map} color={map?'white':'#98ae6c'} roughness={1} /></mesh>
    <Batch name="meadow-seat-and-split-rail" parts={p.wood} casts={shadows} /><Batch name="oak-and-birch-branches" parts={p.branches} round casts={shadows} />
    <Batch name="grove-canopies" parts={p.leaves} geometry={foliage} /><Batch name="distant-ridges" parts={p.hills} foliage />
    <mesh geometry={grass} raycast={noPick}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide} /></mesh></group>;
}
