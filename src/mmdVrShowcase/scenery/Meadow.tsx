import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from 'three';
import { ARBOR, ARBOR_POSTS, LAWN_SIZE, MEADOW_POSTS, MEADOW_SEAT, MEADOW_SUN, meadowPathX as pathX } from './meadowLandmarks';
import { LAWN_KNOLLS, LAWN_TREES } from './meadowPlanting';
import { span } from './detailParts';
import groundUrl from './meadow-walk.webp';
import benchURL from './garden-joinery.webp';
import botanicalURL from './garden-botanicals.webp';
import { useBakedSurface } from './useBakedSurface';
import {campusPassageParts,lawnPaving,schoolExterior} from './CampusLayout';
import {arcadeParts,distantLido,inLidoApproach} from './LidoLayout';
import {LidoPlates} from './LidoPlates';
import { seededRandom } from './ClassroomLayout';
import { Batch, type Part } from './SceneryBatch';
import {GardenEntrance} from './clinic/GardenEntrance';
import {SchoolBrickWalk} from './SchoolBrickWalk';
import {reserveLawnClinic} from './clinic/clinicApproach';
import {reserveArcadeSite} from './routes/campusArcade/site';
import { noPick, paintedSurface } from './sceneryPaint';

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
      if(lawnPaving(xx,zz)||inLidoApproach(xx,zz)||reserveLawnClinic(xx,zz,.06)||reserveArcadeSite(xx,zz,.06)){if(j<4)random();continue;}
      tri([xx-.017,0,zz],[xx+.017,0,zz],[xx+ox,h,zz+oz],j%2?'#788e44':'#a1ad56');
      if(j<4){const rad=.035+random()*.02;const color=patch%6===0?'#ba85ac':patch%4?'#fff1cb':'#e2b55c';
        for(let k=0;k<5;k++){const a=k*1.256;tri([xx+ox,h,zz+oz],[xx+ox+rad*Math.cos(a-.38),h+.026,zz+oz+rad*Math.sin(a-.38)],[xx+ox+rad*Math.cos(a+.38),h+.032,zz+oz+rad*Math.sin(a+.38)],color);}}
    }
  }
  // Taller lupine spires bordering the path: individual tiers of folded petals
  // have silhouettes on both eyes. Leave the walking ribbon itself open.
  const violets=['#7c659d','#a08cbb','#b9a8c9','#d0c2da'];
  for(let tuft=0;tuft<38;tuft++){
    const z=-10+random()*13,x=pathX(z)+(tuft%2?1:-1)*(1.08+random()*.55);
    for(let stalk=0;stalk<3;stalk++){
      const xx=x+(random()-.5)*.31,zz=z+(random()-.5)*.30,h=.30+random()*.31,lean=(random()-.5)*.094;
      if(reserveArcadeSite(xx,zz,.11)){for(let k=0;k<5;k++)random();continue;}
      tri([xx-.011,0,zz],[xx+.011,0,zz],[xx+lean,h,zz],'#7d8e63');
      for(let j=0;j<9;j++){
        const a=j*2.4+tuft,r=(1-j*.083)*.035,y=h*(.48+.057*j),dx=r*Math.cos(a),dz=r*Math.sin(a),stem=xx+lean*y/h;
        tri([stem-dz*.50,y-.014,zz+dx*.50],[stem+dx*1.52,y+.034,zz+dz*1.52],[stem+dz*.6,y+.014,zz-dx*.6],violets[(tuft+j)%4]);
      }
      for(let k=0;k<5;k++){
        const a=k*1.256+random(),dx=.105*Math.cos(a),dz=.105*Math.sin(a);
        tri([xx,.06,zz],[xx+dx*.64-dz*.22,.14,zz+dz*.64+dx*.22],[xx+dx,.115,zz+dz],k%2?'#92a578':'#778a65');
      }
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(pos,3));g.setAttribute('color',new Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}

// Static projection for the shadowless profile: the posts' shadows start at
// their feet, the lattice and foliage land further along the same sun vector.
function arborShade(){return paintedSurface(256,256,g=>{
  const scale=256/11,rand=seededRandom(99);g.translate(128,128);g.scale(scale,scale);
  const at=(x:number,y:number,z:number)=>[x-y*MEADOW_SUN[0]/MEADOW_SUN[1]-2,z-y*MEADOW_SUN[2]/MEADOW_SUN[1]-2] as const;
  g.strokeStyle='#373c46';g.fillStyle='#373c46';g.lineCap='round';g.lineWidth=.14;
  for(const {x,z} of ARBOR_POSTS){g.beginPath();g.moveTo(...at(x-ARBOR.x,0,z-ARBOR.z));g.lineTo(...at(x-ARBOR.x,2.7,z-ARBOR.z));g.stroke();}
  for(let j=-4;j<=4;j++){g.beginPath();g.moveTo(...at(-1.86,2.8,j*.37));g.lineTo(...at(1.86,2.8,j*.37));g.stroke();}
  for(let i=0;i<260;i++){const [x,z]=at((i%4?1:-1)*(.48+rand()*1.22),2.8,(rand()-.5)*3.16);g.beginPath();g.ellipse(x,z,.12+rand()*.15,.07+rand()*.1,rand()*3,0,Math.PI*2);g.fill();}
});}

function LatticeShade(){const map=useMemo(arborShade,[]);useEffect(()=>()=>map.dispose(),[map]);return <mesh position={[ARBOR.x+2,.008,ARBOR.z+2]} rotation-x={-Math.PI/2} raycast={noPick}>
  <planeGeometry args={[11,11]}/><meshBasicMaterial map={map} transparent opacity={.27} depthWrite={false} polygonOffset polygonOffsetFactor={-1}/></mesh>;}

function SeatFaces(){
  const map=useBakedSurface(benchURL),geo=useMemo(()=>{
    const p:number[]=[],uv:number[]=[];
    const face=(a:V,b:V,c:V,d:V,top:number,bottom:number)=>{
      const verts=[a,b,c,d],corners=[[.006,1-bottom/512],[.994,1-bottom/512],[.994,1-top/512],[.006,1-top/512]];
      for(const i of [0,1,2,0,2,3]){p.push(...verts[i]);uv.push(...corners[i]);}
    };
    for(let i=0;i<4;i++){const z=-.23+i*.133;face([-.91,.457,z+.056],[.91,.457,z+.056],[.91,.457,z-.056],[-.91,.457,z-.056],i*70+2,(i+1)*70-2);}
    for(const [i,y] of [.66,.82].entries())face([.923,y-.066,.225],[-.923,y-.066,.225],[-.923,y+.066,.225],[.923,y+.066,.225],282+70*i,348+70*i);
    face([.214,.789,.202],[-.214,.789,.202],[-.214,.849,.202],[.214,.849,.202],422,510);
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  },[]);useEffect(()=>()=>geo.dispose(),[geo]);return map&&<mesh name="garden-bench-grain" position={[MEADOW_SEAT.x,0,MEADOW_SEAT.z]} rotation-y={MEADOW_SEAT.yaw} geometry={geo} raycast={noPick}><meshStandardMaterial map={map} roughness={.81} polygonOffset polygonOffsetFactor={-1}/></mesh>;
}

// Fold each spray in world space: the two eyes see the same branches. Crop the
// texture to the printed silhouette to avoid large empty quads around flowers.
function botanicalSprays(crowns:Part[]) {
  const p:number[]=[],uv:number[]=[],rgb:number[]=[],rng=seededRandom(7615);
  function sprig(x:number,y:number,z:number,w:number,h:number,a:number,lean:number,tone:number,flower=false){
    const c=Math.cos(a),s=Math.sin(a),points:V[]=[],tex:number[][]=[];
    const [u0,u1,v0,v1]=flower?[299,459,8,380]:[0,252,83,354];
    for(const v of [0,1])for(const u of [0,.48,1]){const across=(u-.5)*w,bow=(u===.48?.11:0)*w+v*lean;
      points.push([x+c*across-s*bow,y+h*v,z+s*across+c*bow]);tex.push([(u0+(u1-u0)*u)/512,1-(v0+(v1-v0)*(flower?v:1-v))/384]);}
    for(const i of [0,3,4,0,4,1,1,4,5,1,5,2]){p.push(...points[i]);uv.push(...tex[i]);const t=tone*(i>=3?(flower?.93:1.13):1);rgb.push(t,t,t);}
  }
  for(const crown of crowns){const [x,y,z]=crown.p,[w,h,d]=crown.s;
    for(let i=0;i<25;i++){const a=2.399*i+(crown.ry??0),t=(i+.5)/25,rad=Math.sin(t*Math.PI)*.25,sw=w*(.45+rng()*.16);
      sprig(x+Math.sin(a)*w*rad,y+(t-.61)*h*.68,z+Math.cos(a)*d*rad,sw,h*(.23+.18*rng()),-a,(.21+rng()*.2)*w,.25+t*.54+rng()*.08);}}
  for(let i=0;i<98;i++){
    const side=i%4?-1:1,z=ARBOR.z+(rng()-.5)*3.11,x=ARBOR.x+side*(.32+rng()*1.36),a=rng()*6.28,y=2.81+.08*Math.sin(z*5);
    sprig(x,y-.10,z,.34+rng()*.29,.22+rng()*.13,a,.28,.62+rng()*.32);
    if(i%5!==0){const len=.26+rng()*.40,w=len*.42,tone=.74+rng()*.37;
      for(const off of [0,1.52])sprig(x,y-.013,z,w,-len,a+off,.026,tone,true);}
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.computeVertexNormals();return g;
}

function grove() {
  const wood:Part[]=[],branches:Part[]=[],leaves:Part[]=[], hills:Part[]=[];
  const rng=seededRandom(419),box=(p:V,s:V,color:string,ry=0)=>wood.push({p,s,color,ry});
  const beam=(a:V,b:V,r:number,color:string)=>{const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],l=Math.hypot(dx,dy,dz);
    // Euler XYZ with z applied first: send local up to the branch direction.
    branches.push({p:[(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2],s:[r,l,r],rx:Math.atan2(dz,dy),rz:-Math.asin(dx/l),color});};
  for(const k of LAWN_KNOLLS)hills.push({p:[k.x,-.24,k.z],s:[k.w,k.h,k.d],ry:k.yaw,color:'#91a767'});
  // Distant ridges hide the board edge and give parallax as the viewer walks.
  for(let i=0;i<30;i++){const a=i*2*Math.PI/30,x=Math.sin(a)*39,z=Math.cos(a)*39;
    // The borrowed lido pavilion extends beyond the original circular horizon.
    // Carry the north ridge behind its roof instead of through the lane flags.
    const atEast=reserveArcadeSite(x,z,13);
    hills.push({p:[atEast&&x>14?x+32:x,-1.5,z< -24&&x> -34&&(x<12||atEast)?z-25:z],s:[17+rng()*6,6+rng()*8,15+rng()*7],ry:a,color:i%3?'#819a83':'#91a591'});}
  for(let i=0;i<LAWN_TREES.length;i++){const tree=LAWN_TREES[i],{x,z,h}=tree,birch=i%3===1;const bark=birch?'#c4c1a9':'#806d53';
    const fork:V=[x+.12,h*.44,z-.10],knee:V=[x-.037,h*.18,z+.05];beam([x,-.08,z],knee,h*(birch?.062:.086),bark);beam(knee,fork,h*(birch?.052:.069),bark);
    for(let j=0;j<6;j++) {const a=j*2.4+i*.61,r=j===0?0:h*(.19+rng()*.09),end:V=[x+Math.sin(a)*r,h*(j===0?.96:.66+rng()*.17),z+Math.cos(a)*r];
      const elbow:V=[fork[0]+(end[0]-fork[0])*.61,fork[1]+(end[1]-fork[1])*.39,fork[2]+(end[2]-fork[2])*.61];beam(fork,elbow,h*.037,bark);beam(elbow,end,h*.022,bark);
      leaves.push({p:end,s:[h*(birch?.49:.64),h*(birch?.58:.47),h*.55],ry:a,color:['#a5c672','#88ab5a','#bdd286','#7c9f60'][(i+j)%4]});
    }
  }
  for(const [i,f] of MEADOW_POSTS.entries()){box([f.x,.51,f.z],[.14,1.02,.14],'#aa976f');box([f.x,1.03,f.z],[.16,.05,.16],'#cfc29b');const b=MEADOW_POSTS[i+1];if(!b)continue;for(const y of [.38,.76])box([(f.x+b.x)/2,y,(f.z+b.z)/2],[.067,.092,Math.hypot(f.x-b.x,f.z-b.z)+.06],'#c4ae85',Math.atan2(f.x-b.x,f.z-b.z));}
  const seat=MEADOW_SEAT;const put=(dx:number,y:number,dz:number,s:V,color:string)=>box([seat.x+dx*Math.cos(seat.yaw)+dz*Math.sin(seat.yaw),y,seat.z+dz*Math.cos(seat.yaw)-dx*Math.sin(seat.yaw)],s,color,seat.yaw);
  for(const dx of [-.67,.67])for(const dz of [-.19,.19]){put(dx,.21,dz,[.075,.42,.075],'#555d50');put(dx,.035,dz,[.13,.07,.118],'#424e45');}
  for(let i=0;i<4;i++){put(0,.43,-.23+i*.133,[1.82,.052,.113],['#bd9a72','#b28f67','#c4a078','#b59269'][i]);
    for(const xx of [-.67,.67])put(xx,.457,-.23+i*.133,[.030,.006,.03],'#777869');}
  for(const dx of [-.67,.67])put(dx,.65,.23,[.065,.53,.055],'#586557');
  for(const y of [.66,.82])put(0,y,.25,[1.85,.135,.048],'#c5a277');
  put(0,.819,.218,[.47,.09,.016],'#a38359');put(0,.819,.207,[.43,.064,.007],'#d5b987');
  // Curved iron armrests and a stretcher on the bench already occupied by the reel.
  const world=(x:number,y:number,z:number):V=>[seat.x+x*Math.cos(seat.yaw)+z*Math.sin(seat.yaw),y,seat.z+z*Math.cos(seat.yaw)-x*Math.sin(seat.yaw)];
  for(const x of [-.80,.80]){
    const rest:V[]=[[x,.43,-.18],[x,.57,-.20],[x,.643,-.145],[x,.665,-.07],[x,.665,.13],[x,.635,.19],[x,.46,.20]];
    for(let j=1;j<rest.length;j++)branches.push(span(world(...rest[j-1]),world(...rest[j]),.044,'#617165'));
    put(x,.673,.025,[.069,.036,.26],'#b69166');
  }
  put(0,.23,.03,[1.4,.055,.05],'#657367');
  for(const post of ARBOR_POSTS){const {x,z}=post,side=Math.sign(x-ARBOR.x);
    box([x,.14,z],[.37,.28,.37],'#b2ac90');box([x,1.45,z],[.17,2.46,.17],'#967c54');
    box([x,.29,z],[.22,.05,.22],'#697465');box([x,2.50,z],[.20,.082,.20],'#777a65');
    wood.push(span([x,2.05,z],[x-side*.54,2.66,z],.092,'#ae9369'));
    for(let j=0;j<6;j++){const a=j*1.37;branches.push(span([x+.104*Math.cos(a),.27+j*.38,z+.104*Math.sin(a)],
      [x+.104*Math.cos(a+1.37),.65+j*.38,z+.104*Math.sin(a+1.37)],.052,'#807353'));}
  }
  for(const side of [-1,1]){box([ARBOR.x+side*1.53,2.65,ARBOR.z],[.16,.23,3.22],'#b3926a');
    for(const end of [-1,1])box([ARBOR.x+side*1.53,2.70,ARBOR.z+end*1.51],[.19,.18,.13],'#7e826e');}
  for(let j=0;j<9;j++){const z=ARBOR.z+(j-4)*.37;box([ARBOR.x,2.81,z],[3.74,.16,.09],'#ba9e71');
    // A trained runner weaves beneath each rafter; from below the bunches now
    // grow along actual branches rather than terminating in empty sky.
    let p0:V=[ARBOR.x-1.72,2.76,z];for(let k=1;k<=7;k++){const p1:V=[ARBOR.x-1.72+k*.49,2.79+.033*Math.sin(k*1.8+j),z+.083*Math.sin(k*1.9+j)];branches.push(span(p0,p1,.039,'#72694b'));p0=p1;}}
  wood.push(...campusPassageParts('lawn'),...schoolExterior(),...arcadeParts('lawn'),...distantLido());return {wood,branches,leaves,hills};
}

export function Meadow({shadows}:{shadows:boolean}) {
  const map=useBakedSurface(groundUrl);
  const botanicals=useBakedSurface(botanicalURL),grass=useMemo(flowers,[]),p=useMemo(grove,[]),foliage=useMemo(()=>botanicalSprays(p.leaves),[p]);
  useEffect(()=>()=>{grass.dispose();foliage.dispose();},[grass,foliage]);
  return <group name="scenery:lawn"><mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><planeGeometry args={[LAWN_SIZE,LAWN_SIZE]} /><meshStandardMaterial key={map?'painted':'loading'} map={map} color={map?'white':'#98ae6c'} roughness={1} /></mesh>
    {!shadows&&<LatticeShade/>}
    <SeatFaces/>
    <LidoPlates pool={false}/>
    <GardenEntrance lawn shadows={shadows}/><SchoolBrickWalk lawn shadows={shadows}/>
    <Batch name="meadow-seat-and-split-rail" parts={p.wood} casts={shadows} /><Batch name="oak-and-birch-branches" parts={p.branches} round casts={shadows} />
    {botanicals&&<mesh name="grove-canopies" geometry={foliage} raycast={noPick}><meshBasicMaterial map={botanicals} alphaTest={.36} vertexColors side={DoubleSide}/></mesh>}<Batch name="distant-ridges" parts={p.hills} foliage />
    <mesh geometry={grass} raycast={noPick} userData={{playerCollision:false}}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide} /></mesh></group>;
}
