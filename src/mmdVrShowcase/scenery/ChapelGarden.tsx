import {useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import {Color,DoubleSide,Float32BufferAttribute,LatheGeometry,Vector2,type Texture} from 'three';
import {BEDS,CISTERN,CYPRESSES,GARDEN,LOGGIA} from './ChapelLayout';
import {Batch,type Part} from './SceneryBatch';
import {span} from './detailParts';
import {seededRandom} from './ClassroomLayout';
import {noPick} from './sceneryPaint';
import {useBakedSurface} from './useBakedSurface';
import paving from './chapel-garden.webp';

type V=Part['p'];const stone='#d7c9af',gold='#ba965f',slate='#607675',shade='#b4a68f';
function lathe(profile:number[][],segments:number){return new LatheGeometry(profile.map(([r,h])=>new Vector2(r,h)),segments);}
function gardenParts(){const blocks:Part[]=[],round:Part[]=[],trees:Part[]=[],hedges:Part[]=[],hills:Part[]=[],rnd=seededRandom(8483);
  const box=(p:V,s:V,color:string,rz=0,ry=0)=>blocks.push({p,s,color,rz,ry});
  const column=(p:V,s:V,color:string)=>round.push({p,s,color});
  // Slate roof above the stone vault, and a pierced bellcote on the entrance gable.
  for(const k of [-1,1]){const slope=.47;box([k*3.05,8.31,0],[6.10*Math.sqrt(1+slope*slope),.20,18.65],slate,-k*Math.atan(slope));
    for(const z of [-9.23,9.23])blocks.push(span([0,9.82,z],[k*6.17,6.91,z],.21,stone));
    box([k*5.82,5.89,0],[.20,1.91,18.20],stone);box([k*5.95,6.92,0],[.37,.14,18.58],shade);
    for(const z of [-9,9])for(let i=0;i<18;i++){
      const x=(i+.5)*5.8/18,height=9.69-slope*x;
      const t=Math.acos(1-(1-x/5.8)*(1-Math.cos(Math.PI*.415)))/(Math.PI*.415);
      const bottom=4.95+3.6*Math.sin(t*Math.PI*.415)/Math.sin(Math.PI*.415);
      box([k*x,(height+bottom)/2,z-.018*Math.sign(z)],[5.8/18+.003,Math.max(.02,height-bottom+.06),.09],stone);
    }
    for(const z of [-9,-6,-3,0,3,6,9]){box([k*6,.43,z],[.78,.86,.64],shade);box([k*5.98,2.02,z],[.51,2.49,.49],stone);box([k*5.94,3.40,z],[.53,.25,.53],shade);}
    box([k*.86,10.16,9.08],[.44,1.93,.52],stone);box([k*.86,10.91,9.08],[.50,.14,.61],shade);
    blocks.push(span([k*1.21,11.13,9.08],[0,12.08,9.08],.22,stone,.61));}
  box([0,9.35,9.08],[2.25,.23,.72],stone);box([0,10.92,9.06],[1.84,.13,.23],'#69554a');
  box([0,12.38,9.08],[.063,.66,.064],gold);box([0,12.45,9.08],[.37,.065,.065],gold);
  // Portal stone bands and bronze nailheads are readable on the return walk.
  for(const sign of [-1,1]){box([sign*1.76,1.43,9.10],[.23,2.86,.33],shade);for(let i=0;i<13;i++){
    const a=i*Math.PI/26,b=(i+1)*Math.PI/26;blocks.push(span([sign*1.76*Math.cos(a),2.78+1.76*Math.sin(a),9.13],[sign*1.76*Math.cos(b),2.78+1.76*Math.sin(b),9.13],.19,i%3?stone:'#c6b494',.33));}
    for(const z of [9.22,10.09])for(const y of [.37,1.21,2.6])box([sign*1.446,y,z],[.052,.043,.043],gold);}
  // Formal parterres: stone coping, lavender mounds and scattered pale flowers.
  for(const b of BEDS){box([b.x,.095,b.z],[b.w,.19,b.d],shade);box([b.x,.18,b.z],[b.w-.16,.10,b.d-.16],'#797757');
    for(const k of [-1,1]){box([b.x+k*(b.w/2-.08),.23,b.z],[.17,.14,b.d],stone);box([b.x,.23,b.z+k*(b.d/2-.08)],[b.w,.14,.16],stone);}
    for(let j=0;j<44;j++){const x=b.x+(rnd()-.5)*(b.w-.75),z=b.z+(rnd()-.5)*(b.d-.73);hedges.push({p:[x,.34,z],s:[.52+rnd()*.49,.44+rnd()*.32,.56+rnd()*.37],ry:rnd()*3,color:['#829776','#839488','#98a77b'][j%3]});
      for(let k=0;k<4;k++){const a=k*1.55+rnd();hedges.push({p:[x+.15*Math.sin(a),.58+rnd()*.12,z+.16*Math.cos(a)],s:[.071,.19+rnd()*.11,.073],rz:.22*Math.sin(a),color:['#b2a7c1','#9b95b1','#c8bdc9','#dbcaad'][j%4]});}}
  }
  for(const {x,z} of LOGGIA){box([x,.09,z],[.58,.18,.58],shade);column([x,1.16,z],[.30,2.02,.30],stone);box([x,2.22,z],[.49,.16,.49],stone);}
  for(const x of [-12.65,-9.9]){for(let j=0;j<4;j++){const z=18.5+j*3;for(let i=0;i<12;i++){
    const pt=(k:number):V=>[x,2.24+1.12*Math.sin(k*Math.PI/12),z+1.50*Math.cos(k*Math.PI/12)];blocks.push(span(pt(i),pt(i+1),.20,stone,.22));}}
    box([x,3.46,23],[.36,.19,12.53],stone);}
  for(let z=16.85;z<29.3;z+=.55)box([-11.28,3.65,z],[3.39,.19,.126],'#826e58');
  // Enclose the paved ground, leaving the skyline visible above these low walls.
  for(const s of [-1,1]){box([s*(GARDEN.half-.09),.36,10.6],[.20,.72,44.8],stone);box([s*(GARDEN.half-.09),.75,10.6],[.28,.09,44.8],shade);}
  for(const z of [GARDEN.back+.1,GARDEN.front-.1]){box([0,.34,z],[27.6,.68,.22],stone);box([0,.70,z],[27.6,.08,.32],shade);}
  for(const {x,z,h} of CYPRESSES){column([x,.58,z],[.29,1.16,.29],'#73624e');trees.push({p:[x,.76,z],s:[1.05,h,1.08],ry:rnd()*6,color:'#829779'});
    for(let j=0;j<14;j++){const a=j*2.399,t=j/15,r=.47*(1-t*.69);trees.push({p:[x+Math.sin(a)*r,.8+t*h*.72,z+Math.cos(a)*r],s:[.53*(1-t*.56),h*(.27+.10*rnd()),.55*(1-t*.46)],rx:.08*Math.cos(a),rz:-.09*Math.sin(a),color:j%2?'#809373':'#6e876e'});}}
  // A Tuscan ridge with a few terracotta farmhouses seen through the doorway.
  for(let i=0;i<32;i++){const a=i*2.399;hills.push({p:[Math.sin(a)*(34+rnd()*19),-1.6,10+Math.cos(a)*(32+rnd()*14)],s:[14+rnd()*14,5+rnd()*7,9+rnd()*10],ry:a,color:i%2?'#92aaa0':'#acb79c'});}
  for(let i=0;i<8;i++){const x=-22+i*6.3,z=39+3*Math.sin(i*2),h=2.9+rnd()*1.35,w=2.6+rnd()*1.3;
    hills.push({p:[x,-1.95,z],s:[8,5.8,6],ry:i,color:'#a8b89c'});
    box([x,h*.5-1,z],[w,h+2,2.1],i%2?'#e1caa5':'#d6bda7');for(const k of [-1,1])box([x+k*w*.27,h+.17,z],[w*.57,.13,2.38],'#b38068',-k*.29);
    for(const k of [-1,0,1]){box([x+k*w*.31,h-.63,z-1.063],[.30,.53,.045],'#6a766d');box([x+k*w*.31,h-.93,z-1.07],[.37,.07,.07],'#b6a58d');}box([x+w*.31,h+.41,z+.45],[.25,.57,.24],'#c69e86');}
  return {blocks,round,trees,hedges,hills};
}

// A low-cost rippled reflection of the dawn sky over a patterned basin; no
// stereo reflection buffers. A radial wave starts beneath the stone finial.
function BasinWater(){const uniforms=useMemo(()=>({t:{value:0}}),[]);useFrame((_,dt)=>{uniforms.t.value=(uniforms.t.value+Math.min(dt,.1))%240});
  return <mesh rotation-x={-Math.PI/2} position-y={.48} raycast={noPick}><circleGeometry args={[1.78,56]}/><shaderMaterial uniforms={uniforms}
    vertexShader={`varying vec2 p;varying vec3 eye;void main(){p=position.xy;vec4 w=modelMatrix*vec4(position,1.);eye=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`}
    fragmentShader={`uniform float t;varying vec2 p;varying vec3 eye;void main(){float r=length(p);float w=sin(r*28.-t*2.)*.5+.5;vec2 d=normalize(p+.00001)*(.035*cos(r*28.-t*2.))+.021*vec2(sin(p.y*12.+t),cos(p.x*15.-t));vec3 n=normalize(vec3(d.x,1.,-d.y)),v=normalize(eye);
    float fr=pow(1.-max(dot(v,n),0.),3.);vec3 refl=reflect(-v,n);float sky=smoothstep(-.06,.65,refl.y);vec3 water=mix(vec3(.074,.258,.244),vec3(.22,.48,.41),smoothstep(.3,1.7,r));
    vec2 tile=fract((p+d*.43)*8.);float grout=smoothstep(.015,.08,min(tile.x,tile.y));water*=.86+.14*grout;vec3 col=mix(water,mix(vec3(.78,.63,.42),vec3(.50,.72,.81),sky),.14+.66*fr);col+=vec3(.15,.19,.14)*pow(w,12.)*exp(-r*.7);gl_FragColor=vec4(col,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`}/></mesh>;}

export function ChapelGarden({shadows,rose}:{shadows:boolean;rose?:Texture}){
  const p=useMemo(gardenParts,[]),map=useBakedSurface(paving);
  const g=useMemo(()=>{
    const tree=lathe([[.08,0],[.46,.08],[.64,.20],[.59,.38],[.48,.55],[.39,.72],[.24,.86],[.05,.98],[.008,1]],16),pos=tree.getAttribute('position'),rgb=[];const c=new Color();
    for(let i=0;i<pos.count;i++){const y=pos.getY(i),x=pos.getX(i),z=pos.getZ(i),s=1+.119*Math.sin(x*21+z*11+y*23);pos.setXYZ(i,x*s+.06*y*y,y,z*s);const n=.62+.26*y+.14*Math.sin(x*19-z*13+y*23);c.setRGB(n,n*1.05,n*.93);rgb.push(c.r,c.g,c.b);}tree.setAttribute('color',new Float32BufferAttribute(rgb,3));tree.computeVertexNormals();
    return {tree,bell:lathe([[.03,0],[.43,0],[.44,.05],[.37,.12],[.29,.24],[.22,.49],[.13,.60],[.05,.63]],24),
      curb:lathe([[1.67,.05],[2.04,.05],[2.04,.18],[1.96,.24],[1.96,.48],[2.025,.50],[2.025,.58],[1.78,.58],[1.75,.49],[1.72,.28]],48),
      font:lathe([[.44,0],[.37,.15],[.17,.34],[.14,.51],[.58,.69],[.63,.77],[.54,.79],[.18,.68],[.12,1.06],[.06,1.16]],40)};},[]);
  useEffect(()=>()=>Object.values(g).forEach(o=>o.dispose()),[g]);
  return <group name="chapel:garden">
    <mesh rotation-x={-Math.PI/2} position={[0,-.015,(GARDEN.front+GARDEN.back)/2]} receiveShadow={shadows} raycast={noPick}><planeGeometry args={[GARDEN.half*2,GARDEN.front-GARDEN.back]}/><meshStandardMaterial key={map?'paved':'plain'} color={map?'white':'#d8cfbd'} map={map} roughness={.92}/></mesh>
    <Batch parts={p.blocks} name="chapel:cloister" casts={shadows}/><Batch parts={p.round} round name="chapel:cloister-shafts" casts={shadows}/>
    <Batch parts={p.trees} geometry={g.tree} name="chapel:cypresses" casts={shadows}/><Batch parts={p.hedges} foliage name="chapel:lavender"/><Batch parts={p.hills} foliage name="chapel:ridge"/>
    <mesh geometry={g.bell} position={[0,10.28,9.08]} raycast={noPick}><meshStandardMaterial color="#8c8163" roughness={.56} side={DoubleSide}/></mesh>
    <group position={[0,6.10,9.07]}>
      {rose&&<mesh raycast={noPick}><circleGeometry args={[.96,48]}/><meshStandardMaterial map={rose} roughness={.70} color="#e2d5c6"/></mesh>}
      {[[.98,.075],[1.12,.056]].map(([r,t])=><mesh key={r} raycast={noPick}><torusGeometry args={[r,t,8,56]}/><meshStandardMaterial color={stone}/></mesh>)}
    </group>
    <group name="chapel:lily-cistern" position={[CISTERN.x,0,CISTERN.z]}>
      <mesh geometry={g.curb} raycast={noPick}><meshStandardMaterial color="#d2be9c" side={DoubleSide}/></mesh>
      <BasinWater/>
      <mesh geometry={g.font} position-y={.46} raycast={noPick}><meshStandardMaterial color="#a89e81" side={DoubleSide}/></mesh>
    </group>
  </group>;
}
