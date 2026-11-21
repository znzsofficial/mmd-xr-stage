import {useEffect,useMemo} from 'react';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute, type MeshStandardMaterial} from 'three';
import {Batch,type Part} from '../SceneryBatch';
import {span} from '../detailParts';
import {seededRandom} from '../ClassroomLayout';
import {useBakedSurface} from '../useBakedSurface';
import {APRON,BEDS,CANOPY_POSTS,CLINIC_ORIGIN,GLAZING,GUIDE,GARDEN_DOOR,EAST_FACE,TREES,WALK_POINTS,WALK_WIDTH} from './clinicApproach';
import atlasUrl from './clinic-garden.webp';
import turfUrl from '../meadow-walk.webp';
import {LAWN_SIZE,MEADOW_POSTS} from '../meadowLandmarks';
import {LAWN_KNOLLS} from '../meadowPlanting';

type V=Part['p'];
const noPick=()=>null;
const pine='#426763',trim='#92a499',chalk='#e1ddca',stone='#c1bca9',bronze='#aa8b66';
// Sky bounce keeps the shaded entry legible against the lawn's low sun. This
// is material-local: it does not change actor lighting or add an XR light pass.
const skyBounce:MeshStandardMaterial['onBeforeCompile']=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.34,.34,.30);`);
};
const regions=[[8,8,503,247],[520,8,1015,247],[8,264,503,503],[520,264,1015,327],[8,520,503,1015],[520,520,1015,1015],[520,344,1015,503]];
class Prints {
  points:number[]=[];uv:number[]=[];
  quad(a:V,b:V,c:V,d:V,region:number,vFrac=1){
    const [x,y,right,bottom]=regions[region],u0=(x+.5)/1024,u1=(right+.5)/1024,v0=1-(bottom+.5)/1024,v1=v0+(bottom-y)/1024*vFrac;
    const pts=[a,b,c,d],uv=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]];
    for(const i of [0,1,2,0,2,3]){this.points.push(...pts[i]);this.uv.push(...uv[i]);}
  }
  face(x:number,y:number,z:number,w:number,h:number,a:number,region:number){
    const dx=Math.cos(a)*w/2,dz=-Math.sin(a)*w/2;
    this.quad([x-dx,y-h/2,z-dz],[x+dx,y-h/2,z+dz],[x+dx,y+h/2,z+dz],[x-dx,y+h/2,z-dz],region);
  }
  geometry(){const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.points,3));g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));g.computeVertexNormals();return g;}
}

function entrance(lawn:boolean){
  const blocks:Part[]=[],limbs:Part[]=[],foliage:Part[]=[],prints=new Prints(),paving=new Prints();
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,color:string,ry=0)=>blocks.push({p:[x,y,z],s:[w,h,d],color,ry});
  const sign=(x:number,y:number,z:number,w:number,h:number,rot:number,front:number,back?:number)=>{
    box(x,y,z,w+.05,h+.05,.085,pine,rot);
    const dx=Math.sin(rot)*.045,dz=Math.cos(rot)*.045;
    prints.face(x+dx,y,z+dz,w,h,rot,front);
    if(back!==undefined)prints.face(x-dx,y,z-dz,w,h,rot+Math.PI,back);
  };
  const {x:fx,z:fz,head,wallGap}=GARDEN_DOOR;
  // Waiting bay and seats behind a true hole, seen before the scene swaps.
  if(lawn){
    for(const r of EAST_FACE){box(r.x,1.56,r.z,r.w,3.12,r.d,chalk);box(r.x,.47,r.z,.20,.94,r.d,'#a5b9ac');}
    for(const z of [-9,4.8])box(0,1.56,z,17.32,3.12,.16,chalk);
    box(-8.6,1.56,-2.1,.16,3.12,13.8,chalk);box(-2.16,1.56,3.1,.16,3.12,3.3,'#c8d4c7');
    box(5.4,1.56,-.60,6.4,3.12,.16,'#d1d9ca');box(0,3.24,-2.10,17.62,.24,14.13,'#93a297');
    box(0,-.020,-2.10,17.3,.067,13.9,'#c7c7b8');
    for(const [x,z] of [[6.99,1.19],[4.48,4.3]])for(let j=0;j<4;j++){
      box(x-.96+j*.64,.44,z,.56,.08,.48,'#7da298');box(x-.96+j*.64,.65,z+(z>3?.23:-.23),.55,.40,.08,'#98b4a6');}
    for(const z of [-7.7,-5.6,-3.5,-1.4]){prints.face(fx+.103,1.73,z,1.81,1.21,Math.PI/2,6);box(fx+.11,1.09,z,.24,.08,1.88,stone);}
  }
  box(fx,(3.13+head)/2,fz,.21,3.13-head,wallGap,chalk);box(fx,head,fz,.30,.12,wallGap+.09,trim);
  for(const g of GLAZING){
    for(const s of [-1,1])box(fx,1.21,g.z+s*g.d/2,.17,2.41,.05,pine);
    box(fx,.079,g.z,.16,.14,g.d,trim);for(const s of [-1,1])prints.face(fx+s*.081,1.15,g.z,g.d-.04,.17,s*Math.PI/2,3);
  }
  // A fan of three timber ribs rises out of one garden-side column. No sign or
  // column on the walking axis: the quiet garden opens to the returning patient.
  for(const p of CANOPY_POSTS){box(p.x,.15,p.z,p.w,.30,p.d,stone);box(p.x,1.30,p.z,.21,2.48,.19,pine);
    for(const end of [[10.05,.80],[11.56,2.69],[11.58,4.37]])blocks.push(span([p.x,2.04,p.z],[end[0],2.83,end[1]],.13,'#af956f',.095));
  }
  box(10.22,2.95,fz,3.78,.20,4.93,'#b9c7b9');box(10.22,3.065,fz,3.84,.045,4.99,pine);
  for(let j=0;j<17;j++)box(10.22,2.829,.52+j*.285,3.7,.052,.095,'#bca583');
  for(const z of [1.54,4.16])box(10.23,2.792,z,2.48,.024,.078,'#fff0c3');
  box(12.10,2.923,fz,.068,.19,4.97,bronze);
  sign(fx+.155,1.57,.30,1.29,.59,Math.PI/2,0);sign(fx-.16,1.62,4.54,.45,.30,-Math.PI/2,2);
  box(GUIDE.x,.53,GUIDE.z,.17,1.06,.16,pine);sign(GUIDE.x,1.22,GUIDE.z,.79,.39,2.13,1,2);
  // Stone paving modules use individual UV islands, not a stretched ribbon.
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    const x=APRON.x-APRON.w/2+i*APRON.w/4,z=APRON.z-APRON.d/2+j*APRON.d/4,w=APRON.w/4,d=APRON.d/4,y=.012;
    paving.quad([x,y,z+d],[x+w,y,z+d],[x+w,y,z],[x,y,z],4);
  }
  box(APRON.x,-.059,APRON.z,APRON.w+.13,.122,APRON.d+.13,'#b4ac98');
  const edges=WALK_POINTS.map(([x,z],i)=>{
    const prev=WALK_POINTS[Math.max(0,i-1)],next=WALK_POINTS[Math.min(i+1,WALK_POINTS.length-1)],
      dx=next[0]-prev[0],dz=next[1]-prev[1],s=(WALK_WIDTH/2)/Math.hypot(dx,dz);
    return [[x+dz*s,.007,z-dx*s],[x-dz*s,.007,z+dx*s]] as [V,V];
  });
  for(let i=1;i<edges.length;i++){
    const [a,b]=edges[i-1],[d,c]=edges[i],length=Math.hypot(d[0]-a[0],d[2]-a[2]);
    const n=Math.max(1,Math.round(length/1.54)),lerp=(p:V,q:V,t:number):V=>[p[0]+(q[0]-p[0])*t,.007,p[2]+(q[2]-p[2])*t];
    for(let j=0;j<n;j++)paving.quad(lerp(b,c,j/n),lerp(a,d,j/n),lerp(a,d,(j+1)/n),lerp(b,c,(j+1)/n),5);
    for(const [p,q] of [[a,d],[b,c]]){const edge=span(p,q,.085,stone);edge.p[1]=-.036;blocks.push(edge);}
  }
  // Built planters with slab joints, an inboard soil line, switches of sage
  // and warm white daisies. Fold leaves and petals into one opaque mesh.
  const points:number[]=[],colors:number[]=[],tint=new Color(),rand=seededRandom(3381);
  const tri=(a:V,b:V,c:V,color:string)=>{points.push(...a,...b,...c);tint.set(color);for(let i=0;i<3;i++)colors.push(tint.r,tint.g,tint.b);};
  for(const r of BEDS){
    const {x,z,w,d,top:h}=r;box(x,h/2,z,w-.105,h-.06,d-.105,'#b7b3a1');
    box(x,h-.053,z,w-.14,.054,d-.14,'#786e53');
    for(const k of [-1,1]){const n=Math.ceil(w/.83);for(let i=0;i<n;i++)box(x-w/2+(i+.5)*w/n,h-.059,z+k*(d-.13)/2,w/n-.014,.12,.132,i%3?chalk:'#ccc4ad');
      box(x+k*(w-.13)/2,h-.06,z,.13,.12,d-.28,chalk);}
    for(let i=0;i<Math.round(w*d*25);i++){
      const xx=x+(rand()-.5)*(w-.32),zz=z+(rand()-.5)*(d-.32),len=.18+rand()*.26;
      for(let k=0;k<4;k++){
        const a=rand()*6.28,dx=Math.sin(a)*len*.56,dz=Math.cos(a)*len*.56,root:V=[xx,h-.03,zz],tip:V=[xx+dx,h+len,zz+dz],
          mid:V=[xx+dx*.50,h+len*.63,zz+dz*.50];
        tri(root,[mid[0]-dz*.127,mid[1],mid[2]+dx*.127],tip,k%2?'#879b78':'#839873');
        tri(root,tip,[mid[0]+dz*.17,mid[1]-.026,mid[2]-dx*.17],k%2?'#62785d':'#698a66');
      }
      if(i%3===0){const h2=h+len+.025;tri([xx-.006,h-.012,zz],[xx+.006,h-.012,zz],[xx,h2,zz],'#718660');
        for(let k=0;k<7;k++){const a=k*.898;tri([xx,h2-.008,zz],[xx+.052*Math.cos(a-.38),h2+.016,zz+.052*Math.sin(a-.38)],[xx+.052*Math.cos(a+.38),h2+.01,zz+.052*Math.sin(a+.38)],i%4?'#f0ddad':'#c499ac');}
        tri([xx-.014,h2,zz+.015],[xx+.014,h2,zz+.015],[xx,h2+.012,zz-.014],'#bf9962');}
    }
  }
  // Multi-stem flowering serviceberries: small tinted lobes on actual forks,
  // with clusters of creamy blossom on the lit tips rather than a billboard.
  for(const t of TREES){
    for(let i=0;i<9;i++){
      const a=i*2.400,rad=.22+rand()*.86,x=t.x+rad*Math.cos(a),z=t.z+rad*Math.sin(a),y=t.h-.38+rand()*.65-.28*rad;
      const knee:V=[t.x+(x-t.x)*.27,1.49+rand()*.38,t.z+(z-t.z)*.27];
      limbs.push(span([t.x,.36,t.z],knee,.075,'#84735f'),span(knee,[x,y,z],.047,'#917e66'));
      for(let j=0;j<7;j++){
        const phi=j*2.40+a,l=.28+rand()*.32,dx=Math.cos(phi)*l,dz=Math.sin(phi)*l,
          tip:V=[x+dx,y+.12+rand()*.19,z+dz];
        tri([x-.013,y-.09,z],[x+.013,y-.09,z],tip,'#95836a');
        for(let n=0;n<20;n++){
          const u=n/20,b=n%2?1:-1,root:V=[x+dx*u,y-.08+(tip[1]-y+.08)*u,z+dz*u],
            lx=dx*.13-dz*.35*b,lz=dz*.13+dx*.35*b,hh=.09+rand()*.08;
          const end:V=[root[0]+lx,root[1]+hh,root[2]+lz],center:V=[root[0]+lx*.46,root[1]+hh*.72,root[2]+lz*.46];
          tri(root,[center[0]-.20*lz,center[1],center[2]+.20*lx],end,['#8aa16f','#abbc8b','#92a879'][(i+n)%3]);
          tri(root,end,[center[0]+.18*lz,center[1]-.021,center[2]-.18*lx],['#7c946b','#96aa80','#879e71'][(j+n)%3]);
          if(n%6===4){for(let k=0;k<4;k++){const v=k*1.57+phi,xx=end[0]+.035*Math.cos(v),zz=end[2]+.035*Math.sin(v);tri(end,[xx-.014*Math.sin(v),end[1]+.033,zz+.014*Math.cos(v)],[xx+.014*Math.sin(v),end[1]+.029,zz-.014*Math.cos(v)],k%3?'#edddca':'#d5c7ab');}}
        }
      }
    }
  }
  // The east-facing return looks across the split rail to the meadow. Borrow
  // that edge of the garden only, without mounting the meadow scene or actors.
  if(!lawn){
    const rng=seededRandom(419);
    MEADOW_POSTS.forEach((f,i)=>{const x=f.x-CLINIC_ORIGIN.x,z=f.z-CLINIC_ORIGIN.z;box(x,.51,z,.14,1.02,.14,'#aa976f');
      if(i){const last=MEADOW_POSTS[i-1];for(const h of [.38,.76])blocks.push(span([last.x-CLINIC_ORIGIN.x,h,last.z-CLINIC_ORIGIN.z],[x,h,z],.073,'#c4ae85'));}});
    for(const k of LAWN_KNOLLS.filter(k=>k.x>-12&&k.z>0))foliage.push({p:[k.x-CLINIC_ORIGIN.x,-.24,k.z-CLINIC_ORIGIN.z],s:[k.w,k.h,k.d],ry:k.yaw,color:'#91a767'});
    for(let i=0;i<30;i++){const a=i*2*Math.PI/30,z=Math.cos(a)*39,s:V=[17+rng()*6,6+rng()*8,15+rng()*7];
      if(Math.sin(a)>0)foliage.push({p:[Math.sin(a)*39-CLINIC_ORIGIN.x,-1.5,z-CLINIC_ORIGIN.z],s,ry:a,color:i%3?'#819a83':'#91a591'});}
  }
  const herbs=new BufferGeometry();herbs.setAttribute('position',new Float32BufferAttribute(points,3));herbs.setAttribute('color',new Float32BufferAttribute(colors,3));herbs.computeVertexNormals();
  return {blocks,limbs,foliage,herbs,signs:prints.geometry(),pavers:paving.geometry()};
}

function BorrowedLawn(){const turf=useBakedSurface(turfUrl);return <mesh name="clinic:exterior-turf" position={[-CLINIC_ORIGIN.x,-.025,-CLINIC_ORIGIN.z]} rotation-x={-Math.PI/2} raycast={noPick}><planeGeometry args={[LAWN_SIZE,LAWN_SIZE]}/><meshStandardMaterial key={turf?'lawn':'plain'} map={turf} color={turf?'white':'#97ab75'} roughness={1}/></mesh>;}

export function GardenEntrance({lawn=false,shadows}:{lawn?:boolean;shadows:boolean}){
  const p=useMemo(()=>entrance(lawn),[lawn]),atlas=useBakedSurface(atlasUrl);
  useEffect(()=>()=>{p.herbs.dispose();p.signs.dispose();p.pavers.dispose();},[p]);
  return <group name="clinic:east-garden-entrance" position={lawn?[CLINIC_ORIGIN.x,0,CLINIC_ORIGIN.z]:[0,0,0]}>
    <Batch name="clinic:shared-canopy-and-garden-stone" parts={p.blocks} shade={skyBounce} casts={shadows}/>
    <Batch name="clinic:serviceberry-branches" parts={p.limbs} shade={skyBounce} round/>
    {!lawn&&<Batch name="clinic:borrowed-lawn-hills" parts={p.foliage} foliage/>}
    <mesh name="clinic:raised-planting" geometry={p.herbs} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={1} onBeforeCompile={skyBounce}/></mesh>
    <mesh name="clinic:rain-marked-paving" geometry={p.pavers} raycast={noPick} receiveShadow={shadows}><meshStandardMaterial map={atlas} key={atlas?'stone':'loading'} color={atlas?'white':stone} roughness={.91} side={DoubleSide} onBeforeCompile={skyBounce}/></mesh>
    <mesh name="clinic:wayfinding-enamel" geometry={p.signs} raycast={noPick}><meshBasicMaterial map={atlas} key={atlas?'enamel':'loading'} color={atlas?'white':pine}/></mesh>
    {GLAZING.map(r=><mesh key={r.z} name="clinic:parked-glass" position={[r.x,1.20,r.z]} raycast={noPick}><boxGeometry args={[.036,2.30,r.d]}/><meshStandardMaterial color="#80b6ac" transparent opacity={.22} depthWrite={false} roughness={.29}/></mesh>)}
    {!lawn&&<BorrowedLawn/>}
  </group>;
}
