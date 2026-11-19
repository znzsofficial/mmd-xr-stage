import { useEffect, useMemo } from 'react';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three';
import { ARBOR, ARBOR_POSTS, LAWN_KNOLLS, LAWN_SIZE, LAWN_TREES, MEADOW_POSTS, MEADOW_SEAT, MEADOW_SUN, meadowPathX as pathX } from './placementAreas';
import { span } from './detailParts';
import groundUrl from './meadow-walk.webp';
import benchURL from './garden-joinery.webp';
import { useBakedSurface } from './useBakedSurface';
import { seededRandom } from './ClassroomLayout';
import { Batch, type Part } from './SceneryBatch';
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
      tri([xx-.017,0,zz],[xx+.017,0,zz],[xx+ox,h,zz+oz],j%2?'#788e44':'#a1ad56');
      if(j<4){const rad=.035+random()*.02;const color=patch%6===0?'#ba85ac':patch%4?'#fff1cb':'#e2b55c';
        for(let k=0;k<5;k++){const a=k*1.256;tri([xx+ox,h,zz+oz],[xx+ox+rad*Math.cos(a-.38),h+.026,zz+oz+rad*Math.sin(a-.38)],[xx+ox+rad*Math.cos(a+.38),h+.032,zz+oz+rad*Math.sin(a+.38)],color);}}
    }
  }
  // Compound leaves and tapering racemes of a wisteria trained along the arbor.
  // Grow mostly over one side; gaps let sky and the far bend of the path show through.
  for(let i=0;i<230;i++){
    const side=i%4===0?-1:1, x=ARBOR.x+side*(.48+random()*1.22),z=ARBOR.z+(random()-.5)*3.16;
    const y=2.77+.09*Math.sin(z*7)+random()*.13, a=random()*6.28;
    for(let j=-2;j<=2;j++)for(const k of [-1,1]){
      const xx=x+j*.063*Math.cos(a),zz=z+j*.063*Math.sin(a),dx=k*.107*Math.sin(a)+.064*Math.cos(a),dz=-k*.107*Math.cos(a)+.064*Math.sin(a);
      const root:V=[xx,y,zz],tip:V=[xx+dx,y-.06,zz+dz],l:V=[xx+dx*.48-dz*.31,y+.014,zz+dz*.48+dx*.31],r:V=[xx+dx*.48+dz*.31,y,zz+dz*.48-dx*.31];
      tri(root,l,tip,i%3?'#859953':'#a3ac63');tri(root,tip,r,'#647f48');
    }
    if(i%2===0){const length=.25+random()*.38;
      for(let j=0;j<15;j++){
        const t=j/15,theta=j*2.4+a,r=(1-t*.86)*.069,xx=x+r*Math.cos(theta),zz=z+r*Math.sin(theta),yy=y-t*length;
        tri([xx-r*.88,yy,zz],[xx+r*.98,yy+.017,zz+.026],[xx,yy-.068,zz+.02],['#c6a4dd','#9c78b5','#e7cde8'][j%3]);
      }
    }
  }
  // Taller lupine spires bordering the path: individual tiers of folded petals
  // have silhouettes on both eyes. Leave the walking ribbon itself open.
  const violets=['#7c659d','#a08cbb','#b9a8c9','#d0c2da'];
  for(let tuft=0;tuft<38;tuft++){
    const z=-10+random()*13,x=pathX(z)+(tuft%2?1:-1)*(1.08+random()*.55);
    for(let stalk=0;stalk<3;stalk++){
      const xx=x+(random()-.5)*.31,zz=z+(random()-.5)*.30,h=.30+random()*.31,lean=(random()-.5)*.094;
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

// Irregular sprays of leaves instead of a smooth green sphere. A small solid
// core shades the interior; the perimeter breaks into individual leaf tips.
function crownSpray() {
  const pos:number[]=[],rgb:number[]=[],norm:number[]=[],rng=seededRandom(8189),core=new IcosahedronGeometry(.32,0),v=new Vector3();
  const face=(a:Vector3,b:Vector3,c:Vector3,tint:number)=>{for(const p of [a,b,c]){pos.push(...p.toArray());norm.push(...p.clone().normalize().toArray());rgb.push(tint*.94,tint,tint*.84);}};
  const verts=core.getAttribute('position');for(let i=0;i<verts.count;i+=3)face(new Vector3().fromBufferAttribute(verts,i),new Vector3().fromBufferAttribute(verts,i+1),new Vector3().fromBufferAttribute(verts,i+2),.64);core.dispose();
  for(let i=0;i<62;i++){
    const az=i*2.4,y=2*(i+.5)/62-1,r=Math.sqrt(1-y*y);v.set(Math.cos(az)*r,y,Math.sin(az)*r);
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
    wood.push(span([x,2.05,z],[x-side*.54,2.66,z],.092,'#ae9369'));
    for(let j=0;j<6;j++){const a=j*1.37;branches.push(span([x+.104*Math.cos(a),.27+j*.38,z+.104*Math.sin(a)],
      [x+.104*Math.cos(a+1.37),.65+j*.38,z+.104*Math.sin(a+1.37)],.052,'#807353'));}
  }
  for(const side of [-1,1])box([ARBOR.x+side*1.53,2.65,ARBOR.z],[.16,.23,3.22],'#b3926a');
  for(let j=0;j<9;j++)box([ARBOR.x,2.81,ARBOR.z+(j-4)*.37],[3.74,.16,.09],'#ba9e71');
  return {wood,branches,leaves,hills};
}

export function Meadow({shadows}:{shadows:boolean}) {
  const map=useBakedSurface(groundUrl);
  const grass=useMemo(flowers,[]),foliage=useMemo(crownSpray,[]),p=useMemo(grove,[]);
  useEffect(()=>()=>{grass.dispose();foliage.dispose();},[grass,foliage]);
  return <group name="scenery:lawn"><mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><planeGeometry args={[LAWN_SIZE,LAWN_SIZE]} /><meshStandardMaterial key={map?'painted':'loading'} map={map} color={map?'white':'#98ae6c'} roughness={1} /></mesh>
    {!shadows&&<LatticeShade/>}
    <SeatFaces/>
    <Batch name="meadow-seat-and-split-rail" parts={p.wood} casts={shadows} /><Batch name="oak-and-birch-branches" parts={p.branches} round casts={shadows} />
    <Batch name="grove-canopies" parts={p.leaves} geometry={foliage} /><Batch name="distant-ridges" parts={p.hills} foliage />
    <mesh geometry={grass} raycast={noPick}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide} /></mesh></group>;
}
