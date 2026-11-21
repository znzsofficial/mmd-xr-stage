import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, OctahedronGeometry, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { Batch, type Part } from './SceneryBatch';
import { seededRandom } from './ClassroomLayout';
import { COURT_PIERS, OLD_COURT_RADIUS as COURT_RADIUS } from './ObservatoryLayout';
import { noPick, paintedSurface } from './sceneryPaint';
import duskUrl from './astral-dusk.webp';
import workshopUrl from './meridian-workshop.webp';
import { useBakedSurface } from './useBakedSurface';
import { Observatory } from './Observatory';
import { CourtPortals } from './CourtPortals';

const TAU = Math.PI * 2;
const stone = ['#747b8d','#9596a2','#858796','#666e84','#8e91a0'];
const brass = '#b69a73';

// A weathered wayfinding pennon hung on the *outside* of each pier. Paint on
// folded, not camera-facing, cloth so its silhouette reads from both eyes.
function meridianFaces(){
  const p:number[]=[],uv:number[]=[];
  const quad=(v:number[][],t:number[][])=>{for(const i of [0,1,2,0,2,3]){p.push(...v[i]);uv.push(t[i][0]/1024,1-t[i][1]/1024);}};
  for(const side of [-1,1]){
    const at=(u:number,v:number)=>[side*(2.86+u*.89),2.36-v*(1.13+.19*Math.sin(Math.PI*u)), -4.31+.072*Math.sin(u*10+v*.54)-.07*v];
    for(let j=0;j<4;j++)for(let i=0;i<16;i++){const pts=[[i/16,j/4],[(i+1)/16,j/4],[(i+1)/16,(j+1)/4],[i/16,(j+1)/4]];
      quad(pts.map(([u,v])=>at(u,v)),pts.map(([u,v])=>[2+507*u,2+773*v]));}
  }
  // Flush enamel/stone facing fits between the existing external flutes. The
  // main shafts are still solid while the room's one atlas is being decoded.
  for(const [i,{x,z,w,d}] of COURT_PIERS.entries()){
    const h=i<2?2.55:[1.32,1.84,1.16,1.52][i-2];
    const at=(a:number,y:number)=>[x+Math.sin(a)*w*.348,y,z+Math.cos(a)*d*.348];
    for(let j=0;j<32;j++){const a=TAU*j/32,b=TAU*(j+1)/32,lo=.385,hi=h-.20,u=514+507*j/32,v=514+507*(j+1)/32;
      quad([at(a,lo),at(b,lo),at(b,hi),at(a,hi)],[[u,773],[v,773],[v,4],[u,4]]);}
  }
  for(let i=0;i<19;i++)if(i!==6&&i!==7){const a=i*Math.PI/19+.012,b=(i+1)*Math.PI/19-.012,z=-4.3+(i===9?.443:.353);
    const radial=(ang:number,r:number)=>[r*Math.cos(ang),2.55+r*Math.sin(ang),z];
    quad([radial(a,2.632),radial(b,2.632),radial(b,3.045),radial(a,3.045)],[[3,1020],[1020,1020],[1020,787],[3,787]]);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

function cliff(){
  const p:number[]=[],colors:number[]=[],t=new Color(),n=9,rnd=seededRandom(434);
  const top=Array.from({length:n},(_,i)=>{const a=i*TAU/n,r=.78+rnd()*.22;return [r*Math.cos(a),.40+rnd()*.09,r*Math.sin(a)];});
  const lip=top.map(([x,y,z])=>[x*1.015,y-.095,z*1.015]);
  const shale=lip.map(([x,y,z])=>[x*.93,y-.07,z*.93]);
  const mid=top.map(([x,,z])=>[x*(.80+rnd()*.16),-.10-rnd()*.24,z*(.80+rnd()*.16)]);
  const toe=mid.map(([x,y,z])=>[x*(.56+rnd()*.22)+.07,y-.24-rnd()*.14,z*.63]);
  const tri=(a:number[],b:number[],c:number[],color:string)=>{t.set(color);for(const v of [a,b,c]){p.push(...v);colors.push(t.r,t.g,t.b);}};
  for(let i=0;i<n;i++) {const j=(i+1)%n;
    tri([0,.50,0],top[j],top[i],'#9caa9f');
    for(const [u,v,base] of [[top,lip,'#b3b5a9'],[lip,shale,'#777d82'],[shale,mid,'#9196a1'],[mid,toe,'#808493']] as const){tri(u[i],u[j],v[j],base);tri(u[i],v[j],v[i],base);}
    tri(toe[i],toe[j],[.17,-.94,.21],i%3?'#73798e':'#858fa0');}
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(p,3));geo.setAttribute('color',new Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

function starChart() {
  return paintedSurface(1024,1024,g=>{
    const rand=seededRandom(772), c=512;
    g.translate(c,c);g.fillStyle='#414958';g.fillRect(-c,-c,1024,1024);
    // The joints follow the survey circles; adjacent courses stagger their seams.
    const radii=[0,76,146,221,308,391,458,490,512];
    for(let k=1;k<radii.length;k++){
      const count=k===1?1:k*4;
      for(let j=0;j<count;j++){
        const a=(j+(k%2)*.5)*TAU/count,b=a+TAU/count;
        g.beginPath();g.arc(0,0,radii[k],a,b);if(k>1)g.arc(0,0,radii[k-1],b,a,true);else g.lineTo(0,0);g.closePath();
        g.fillStyle=['#79828a','#81868e','#7e8490','#838892','#7e8990'][Math.floor(rand()*5)];g.fill();g.strokeStyle='#555d6c';g.lineWidth=1.5;g.stroke();
      }
    }
    for(const tint of ['#a0a3a5','#687482']){g.fillStyle=tint;g.globalAlpha=.5;for(let i=0;i<2400;i++){g.fillRect(rand()*1024-512,rand()*1024-512,rand()*2+1,.9);}}g.globalAlpha=1;
    const circle=(r:number,color:string,w:number)=>{g.beginPath();g.arc(0,0,r,0,TAU);g.strokeStyle=color;g.lineWidth=w;g.stroke();};
    for(const r of [76,143,150,382,390,457,493])circle(r,'#b5a581',2.5);
    for(let i=0;i<96;i++){g.save();g.rotate(i*TAU/96);g.fillStyle=i%4?'#b9b49c':'#e1c995';g.fillRect(-1.1,459,2.2,i%4?6:13);g.restore();}
    for(let i=0;i<8;i++){
      g.save();g.rotate(i*Math.PI/4);const r=i%2?93:129;
      for(const s of [-1,1]){g.beginPath();g.moveTo(0,0);g.lineTo(11*s,22);g.lineTo(0,r);g.closePath();g.fillStyle=s<0?'#c0b090':'#5c7080';g.fill();}
      g.restore();
    }
    for(let i=0;i<8;i++){
      g.save();g.rotate(i*TAU/8);g.beginPath();g.strokeStyle='#d1bc8d';g.lineWidth=1.8;
      const points=Array.from({length:5},(_,j)=>({x:(j-2)*30+rand()*11,y:270+rand()*55}));
      points.forEach(({x,y},j)=>j?g.lineTo(x,y):g.moveTo(x,y));g.stroke();
      for(const {x,y} of points){g.beginPath();g.fillStyle='#c9e1da';g.arc(x,y,2.7,0,TAU);g.fill();}g.restore();
    }
  });
}

/** Individually hewn voussoirs with a bevel on the face of each block. Two
 * missing stones break the arch; its copper inner band follows the same gap. */
function ruinedArch(){
  const pos:number[]=[],colors:number[]=[],c=new Color(),n=19;
  const polar=(r:number,a:number,z:number)=>[r*Math.cos(a),2.55+r*Math.sin(a),-4.3+z];
  function block(a:number,b:number,ri:number,ro:number,z1:number,z2:number,tint:string){
    const corners=(u:number,v:number,lo:number,hi:number,z:number)=>[polar(lo,u,z),polar(hi,u,z),polar(hi,v,z),polar(lo,v,z)];
    const back=corners(a,b,ri,ro,z1),rim=corners(a,b,ri,ro,z2-.035),front=corners(a+.006,b-.006,ri+.022,ro-.022,z2);
    const face=(v:number[][])=>{for(const i of [0,1,2,0,2,3]){pos.push(...v[i]);colors.push(c.r,c.g,c.b);}};
    c.set(tint);face(front);face([...back].reverse());for(let i=0;i<4;i++){const j=(i+1)%4;face([back[i],back[j],rim[j],rim[i]]);face([rim[i],rim[j],front[j],front[i]]);}
  }
  for(let i=0;i<n;i++){
    if(i===6||i===7)continue;
    const a=i*Math.PI/n+.004,b=(i+1)*Math.PI/n-.004;
    block(a,b,2.44,i===9?3.22:3.09,-.33,i===9?.44:.35,stone[(i*3)%5]);
    block(a,b,2.51,2.59,.349,.40,i%3?'#c9aa7b':'#a28b71');
  }
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(pos,3));geo.setAttribute('color',new Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
}

function masonry(){
  const blocks:Part[]=[],columns:Part[]=[],jewels:Part[]=[],islets:Part[]=[];
  const rnd=seededRandom(20172);
  for(const [i,{x,z,w,d}] of COURT_PIERS.entries()){
    const h=i<2?2.55:[1.32,1.84,1.16,1.52][i-2];
    blocks.push({p:[x,.10,z],s:[w,.20,d],color:stone[0]},{p:[x,.24,z],s:[w*.88,.12,d*.88],color:stone[2]});
    columns.push({p:[x,(h+.30)/2,z],s:[w*.69,h-.30,d*.69],color:stone[i%5]});
    for(const y of [.36,h-.19,h-.07])columns.push({p:[x,y,z],s:[w*.82,y===h-.07?.15:.052,d*.82],color:y===h-.07?stone[1]:brass});
    for(let k=0;k<8;k++){
      const a=k*TAU/8;columns.push({p:[x+Math.sin(a)*w*.33,(h+.35)/2,z+Math.cos(a)*w*.33],s:[.077,h-.52,.077],color:'#aaa8ad'});
    }
    if(i<2)columns.push({p:[Math.sign(x)*3.26,2.38,z-.02],s:[.057,1.27,.057],rz:Math.PI/2,color:brass});
    if(i>=2){jewels.push({p:[x,h+.38,z],s:[.16,.39,.16],color:i%2?'#c5bbed':'#9aebdc',ry:i});
      for(let k=0;k<3;k++){const a=k*TAU/3;columns.push({p:[x+.22*Math.sin(a),h+.09,z+.22*Math.cos(a)],s:[.043,.21,.043],color:brass});}}
  }
  // Floating remnants around the horizon give stereo depth outside the court.
  for(let i=0;i<21;i++){
    const a=i*2.399+.34,r=(Math.sin(a)<.2?53:13)+rnd()*10,x=Math.cos(a)*r,z=Math.sin(a)*r,y=rnd()*2.8-1.7,s=.75+rnd()*1.8;
    islets.push({p:[x,y-s*.70,z],s:[s*1.45,s*1.5,s],ry:a,color:'#d7d8df'});
    if(i%3===0){for(const sign of [-1,1])columns.push({p:[x+sign*.44*s,y+s*.48,z],s:[.28,s,.28],color:stone[1]});
      blocks.push({p:[x,y+s*.99,z],s:[s*.88+.34,.20,.41],color:stone[0]});jewels.push({p:[x,y+s*.51,z],s:[.12,.26,.12],color:'#b3e3d7'});}
  }
  return {blocks,columns,jewels,islets};
}

function Orrery(){
  const ring=useRef<Group>(null), ticks=useMemo(()=>Array.from({length:48},(_,i)=>{
    const a=i*TAU/48;return {p:[Math.cos(a)*1.71,Math.sin(a)*1.71,0],rz:a-Math.PI/2,s:[.029,i%4?.068:.146,.04],color:i%4?'#b99471':'#e4c887'} as Part;
  }),[]);
  useFrame((_,delta)=>{if(ring.current)ring.current.rotation.z+=Math.min(delta,.05)*.045;});
  return <group position={[0,4.12,-4.65]} rotation={[.09,-.21,.18]}>
    <group ref={ring}>
      <mesh raycast={noPick}><torusGeometry args={[1.82,.046,8,80]}/><meshStandardMaterial color="#cba975" roughness={.51}/></mesh>
      <Batch parts={ticks} name="court:hours" lit/>
      <mesh position={[1.82,0,0]} scale={[.09,.16,.07]} raycast={noPick}><octahedronGeometry/><meshBasicMaterial color="#ffde99"/></mesh>
    </group>
    <mesh rotation={[.55,-.64,.23]} raycast={noPick}><torusGeometry args={[1.54,.031,8,72]}/><meshBasicMaterial color="#82c4ba"/></mesh>
    <mesh rotation={[-.21,.94,-.47]} raycast={noPick}><torusGeometry args={[1.41,.024,8,72]}/><meshStandardMaterial color="#e0bb83"/></mesh>
    <mesh scale={[.21,.44,.21]} rotation-y={.4} raycast={noPick}><octahedronGeometry/><meshStandardMaterial color="#c0f4e3" emissive="#529e9a" flatShading/></mesh>
  </group>;
}

export function CourtSky(){
  const [map,setMap]=useState<Texture|null>(null);
  useEffect(()=>{let alive=true;const tex=new TextureLoader().load(duskUrl,t=>{if(alive){t.colorSpace=SRGBColorSpace;setMap(t);}});
    return ()=>{alive=false;tex.dispose();};},[]);
  const uniforms=useMemo(()=>({panorama:{value:map}}),[map]);
  if(!map)return null;
  return <mesh name="court:sky" frustumCulled={false} renderOrder={-100} raycast={noPick}><sphereGeometry args={[1,48,24]}/>
    <shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms}
      vertexShader={`varying vec2 skyUv; void main(){skyUv=uv;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=p.xyww;}`}
      fragmentShader={`varying vec2 skyUv; uniform sampler2D panorama;void main(){gl_FragColor=texture2D(panorama,skyUv);
      #include <colorspace_fragment>
      }`}/></mesh>;
}

export function AstralCourt({shadows}:{shadows:boolean}){
  const p=useMemo(masonry,[]),arch=useMemo(ruinedArch,[]),floor=useMemo(starChart,[]),facet=useMemo(()=>new OctahedronGeometry(1),[]);
  const cliffGeo=useMemo(cliff,[]),fabric=useMemo(meridianFaces,[]),workshop=useBakedSurface(workshopUrl);
  useEffect(()=>()=>{arch.dispose();floor.dispose();facet.dispose();cliffGeo.dispose();fabric.dispose();},[arch,floor,facet,cliffGeo,fabric]);
  return <><CourtPortals/><group name="scenery:astralCourt" pointerEvents="none">
    <mesh position-y={-.24} raycast={noPick}><cylinderGeometry args={[COURT_RADIUS,COURT_RADIUS-.26,.476,96]}/><meshStandardMaterial color="#626979"/></mesh>
    <mesh rotation-x={-Math.PI/2} receiveShadow={shadows} raycast={noPick}><circleGeometry args={[COURT_RADIUS,96]}/><meshStandardMaterial map={floor} roughness={.89}/></mesh>
    <mesh position-y={-.95} raycast={noPick}><cylinderGeometry args={[COURT_RADIUS-.27,3.7,1,16]}/><meshStandardMaterial color="#545b6b" flatShading/></mesh>
    <mesh geometry={arch} castShadow={shadows} receiveShadow={shadows} raycast={noPick}><meshStandardMaterial vertexColors side={DoubleSide} roughness={.9}/></mesh>
    {workshop&&<mesh name="court:meridian-atlas" geometry={fabric} raycast={noPick}><meshStandardMaterial map={workshop} side={DoubleSide} roughness={.84}/></mesh>}
    <Batch parts={p.blocks} name="court:bases" casts={shadows}/><Batch parts={p.columns} name="court:columns" round casts={shadows}/>
    <Batch parts={p.islets} name="court:sky-islands" geometry={cliffGeo}/><Batch parts={p.jewels} name="court:waystones" geometry={facet}/>
    <Orrery/><Observatory floor={floor} shadows={shadows}/>
  </group></>;
}
