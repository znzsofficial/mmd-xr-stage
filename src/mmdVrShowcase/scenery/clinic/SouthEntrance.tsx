import {useEffect,useMemo} from 'react';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute, type MeshStandardMaterial} from 'three';
import {Batch,type Part} from '../SceneryBatch';
import {span} from '../detailParts';
import {seededRandom} from '../ClassroomLayout';
import {useBakedSurface} from '../useBakedSurface';
import {APRON,BEDS,CANOPY_POSTS,CLINIC_ORIGIN,GLAZING,GUIDE,SOUTH_DOOR,SOUTH_FACE,TREES,WALK_POINTS,WALK_WIDTH} from './clinicApproach';
import atlasUrl from './clinic-garden.webp';
import turfUrl from '../meadow-walk.webp';
import {LAWN_KNOLLS,LAWN_SIZE} from '../placementAreas';

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
  // Shared gutters project 36 cm beyond the return. Wash from the thin lip
  // and a shoe at the drain base distinguish the wet edge from the dry bay.
  const leaderX=-2.83,leaderZ=8.665;
  limbs.push(span([leaderX,2.83,8.991],[leaderX,2.64,leaderZ],.082,trim),span([leaderX,2.66,leaderZ],[leaderX,.16,leaderZ],.074,trim),span([leaderX,.17,leaderZ],[leaderX,.082,8.77],.083,trim));
  for(const y of [.50,1.57,2.54])box(leaderX,y,leaderZ,.092,.033,.089,pine);
  const fz=SOUTH_DOOR.z;
  // A narrow borrowed view of the lit hall, not a second hospital/actor scene.
  if(lawn){
    for(const r of SOUTH_FACE){box(r.x,1.56,r.z,r.w,3.12,.16,chalk);box(r.x,.46,r.z,r.w,.92,.19,'#a5b9ac');}
    for(const s of [-1,1]){
      box(s*8.60,1.56,-2.10,.16,3.12,13.90,chalk);box(s*8.69,1.71,-2.10,.05,1.31,12.89,'#90adaa');
      box(s*8.70,.985,-2.10,.28,.098,13.34,stone);box(s*8.69,2.44,-2.10,.49,.12,13.41,'#d0c8ad');
      for(let j=0;j<10;j++){const z=-7.95+j*1.29;box(s*8.745,1.71,z,.045,1.21,1.18,j%3?'#9cb4b0':'#a3b8b1');
        prints.face(s*8.772,1.71,z,1.17,1.21,s*Math.PI/2,6);
        box(s*8.78,1.71,z-.60,.060,1.43,.073,trim);box(s*8.77,1.46,z,.043,.036,1.20,chalk);}
      box(s*2.17,1.57,.25,.16,3.14,9.0,'#d1d8cb');box(s*2.17,.53,.25,.20,1.06,9.0,'#a5b7a9');
    }
    box(0,1.56,-9.0,17.39,3.12,.16,chalk);box(0,3.19,-2.10,17.39,.14,14.03,'#ced0c2');
    box(0,3.33,-2.1,17.77,.20,14.31,'#899b90');box(0,3.438,-2.1,17.93,.045,14.44,stone);
    box(0,-.034,.24,4.28,.069,9.12,'#cbcbbc');box(0,1.57,-4.13,4.22,3.13,.12,'#b29d82');
    box(0,1.66,-4.055,1.49,.71,.041,pine);box(0,2.99,-.20,.51,.14,2.15,'#eee5cd');
    for(let i=0;i<4;i++)box(-.45,1.82-i*.095,-4.03,.37+(i%2)*.22,.022,.015,'#bed1be');
  }
  for(const side of [-1,1]){
    const x=side*5.78;
    box(x,1.72,fz+.104,4.92,1.37,.058,trim);
    for(let j=0;j<4;j++){
      const xx=x+(j-1.5)*1.19;
      box(xx,1.73,fz+.146,1.13,1.25,.039,'#8ea7a4');
      prints.face(xx,1.73,fz+.168,1.125,1.243,0,6);
      box(xx,1.58,fz+.177,1.14,.032,.029,'#c1c9ba');
      box(xx,2.41,fz+.15,1.19,.066,.32,'#ded7bd');
    }
    box(x,.995,fz+.15,4.99,.093,.27,stone);
  }
  box(0,(3.13+SOUTH_DOOR.head)/2,fz,SOUTH_DOOR.wallGap,3.13-SOUTH_DOOR.head,.21,chalk);
  box(0,2.43,fz,SOUTH_DOOR.wallGap+.12,.14,.30,trim);
  for(const g of GLAZING){
    for(const s of [-1,1])box(g.x+s*g.w/2,1.21,fz,.054,2.41,.17,pine);
    box(g.x,.079,fz,g.w,.14,.16,trim);box(g.x,1.125,fz,g.w,.101,.1,'#81a39a');
    for(const s of [-1,1])prints.face(g.x,1.15,fz+s*.085,g.w-.04,.156,s>0?0:Math.PI,3);
  }
  for(const p of CANOPY_POSTS){
    const {x,z}=p;box(x,.087,z,p.w,.174,p.d,stone);box(x,1.43,z,.173,2.56,.205,pine);
    box(x,.245,z,.211,.15,.241,trim);box(x,2.72,z,.235,.21,.26,trim);
    for(const k of [-1,1])blocks.push(span([x,2.38,z],[x+k*.43,2.80,z],.064,trim,.11));
  }
  // Standing seams, an actual fascia return and a drain to the planting side.
  box(0,2.90,6.72,6.75,.16,4.47,'#c9cfba');box(0,3.025,6.72,6.78,.099,4.5,'#63847f');
  for(let x=-3.09;x<3.36;x+=.458){box(x,3.093,6.72,.032,.046,4.50,'#93a99c');box(x,2.812,6.72,.039,.029,4.36,'#b0ac93');}
  for(const z of [5.26,8.53])box(0,2.775,z,6.61,.17,.12,'#79938a');
  box(0,2.918,8.995,6.81,.228,.12,pine);box(0,2.846,9.064,6.82,.035,.037,bronze);
  for(const x of [-1.69,1.69]){box(x,2.805,6.31,.087,.023,1.35,'#f8edca');box(x,2.788,7.84,.104,.036,.60,chalk);}
  for(const x of [-.83,.83])box(x,2.70,8.51,.024,.37,.028,bronze);
  sign(0,2.42,8.53,1.76,.69,0,0,2);
  // The interior plate greets the returning patient on the garden side. A
  // flush safety stripe on both parked glass leaves leaves the opening clear.
  sign(2.95,1.63,fz-.169,.83,.39,Math.PI,2);
  const gr=-.96;box(GUIDE.x,.088,GUIDE.z,.44,.176,.44,stone);box(GUIDE.x,.714,GUIDE.z,.096,1.12,.096,pine,gr);
  sign(GUIDE.x,1.51,GUIDE.z,1.08,.49,gr+Math.PI,1,2);
  // Stone paving modules use individual UV islands, not a stretched ribbon.
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
    const x=-APRON.w/2+i*APRON.w/4,z=APRON.z-APRON.d/2+j*APRON.d/4,w=APRON.w/4,d=APRON.d/4,y=.012;
    paving.quad([x,y,z+d],[x+w,y,z+d],[x+w,y,z],[x,y,z],4);
  }
  box(0,-.059,APRON.z,APRON.w+.13,.122,APRON.d+.13,'#b4ac98');
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
  // Only borrow the southern lawn landforms for the window view. The inactive
  // meadow's actors, grove, equipment and GPU scene are never mounted here.
  if(!lawn){
    const rng=seededRandom(419);
    for(const k of LAWN_KNOLLS.filter(k=>k.z>10))foliage.push({p:[k.x-CLINIC_ORIGIN.x,-.24,k.z-CLINIC_ORIGIN.z],s:[k.w,k.h,k.d],ry:k.yaw,color:'#91a767'});
    for(let i=0;i<30;i++){const a=i*2*Math.PI/30,z=Math.cos(a)*39,s:V=[17+rng()*6,6+rng()*8,15+rng()*7];
      if(z>8)foliage.push({p:[Math.sin(a)*39-CLINIC_ORIGIN.x,-1.5,z-CLINIC_ORIGIN.z],s,ry:a,color:i%3?'#819a83':'#91a591'});}
  }
  const herbs=new BufferGeometry();herbs.setAttribute('position',new Float32BufferAttribute(points,3));herbs.setAttribute('color',new Float32BufferAttribute(colors,3));herbs.computeVertexNormals();
  return {blocks,limbs,foliage,herbs,signs:prints.geometry(),pavers:paving.geometry()};
}

function BorrowedLawn(){const turf=useBakedSurface(turfUrl);return <mesh name="clinic:exterior-turf" position={[-CLINIC_ORIGIN.x,-.025,-CLINIC_ORIGIN.z]} rotation-x={-Math.PI/2} raycast={noPick}><planeGeometry args={[LAWN_SIZE,LAWN_SIZE]}/><meshStandardMaterial key={turf?'lawn':'plain'} map={turf} color={turf?'white':'#97ab75'} roughness={1}/></mesh>;}

export function SouthEntrance({lawn=false,shadows}:{lawn?:boolean;shadows:boolean}){
  const p=useMemo(()=>entrance(lawn),[lawn]),atlas=useBakedSurface(atlasUrl);
  useEffect(()=>()=>{p.herbs.dispose();p.signs.dispose();p.pavers.dispose();},[p]);
  return <group name="clinic:south-entrance" position={lawn?[CLINIC_ORIGIN.x,0,CLINIC_ORIGIN.z]:[0,0,0]}>
    <Batch name="clinic:shared-canopy-and-garden-stone" parts={p.blocks} shade={skyBounce} casts={shadows}/>
    <Batch name="clinic:serviceberry-branches" parts={p.limbs} shade={skyBounce} round/>
    {!lawn&&<Batch name="clinic:borrowed-lawn-hills" parts={p.foliage} foliage/>}
    <mesh name="clinic:raised-planting" geometry={p.herbs} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={1} onBeforeCompile={skyBounce}/></mesh>
    <mesh name="clinic:rain-marked-paving" geometry={p.pavers} raycast={noPick} receiveShadow={shadows}><meshStandardMaterial map={atlas} key={atlas?'stone':'loading'} color={atlas?'white':stone} roughness={.91} side={DoubleSide} onBeforeCompile={skyBounce}/></mesh>
    <mesh name="clinic:wayfinding-enamel" geometry={p.signs} raycast={noPick}><meshBasicMaterial map={atlas} key={atlas?'enamel':'loading'} color={atlas?'white':pine}/></mesh>
    {GLAZING.map(r=><mesh key={r.x} name="clinic:parked-glass" position={[r.x,1.20,r.z]} raycast={noPick}><boxGeometry args={[r.w,2.30,.036]}/><meshStandardMaterial color="#80b6ac" transparent opacity={.22} depthWrite={false} roughness={.29}/></mesh>)}
    {!lawn&&<BorrowedLawn/>}
  </group>;
}
