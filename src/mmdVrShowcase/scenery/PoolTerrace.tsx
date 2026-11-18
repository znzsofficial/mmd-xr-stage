import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Vector3, type ShaderMaterial } from 'three';
import { POOL } from './placementAreas';
import { Batch, type Part } from './SceneryBatch';
import { noPick, paintedSurface } from './sceneryPaint';

type V = Part['p'];
export const POOL_SUN: V = [-4.5,5.6,-5];

// Sewn umbrella gores with shallow scallops at the outer edge.
function canopy() {
  const positions:number[] = [], colors:number[] = [];
  for(let i=0;i<12;i++) for(let j=0;j<4;j++) {
    const t=(v:number)=>(i+v)*Math.PI/6;
    const edge=(v:number,r:number,h:number):V=>[Math.sin(t(v))*r,h-.08*Math.sin(v*Math.PI)*r,Math.cos(t(v))*r];
    const a=j/4,b=(j+1)/4;
    const p=edge(a,.82,-.16),q=edge(b,.82,-.16),u=edge(a,1.42,-.48),v=edge(b,1.42,-.48);
    const tint=new Color(i%2?'#f4e9cd':'#da805e');
    for(const vertex of [[0,0,0],p,q,p,u,v,p,v,q,u,[u[0],u[1]-.12,u[2]],v,v,[u[0],u[1]-.12,u[2]],[v[0],v[1]-.12,v[2]]]) {
      positions.push(...vertex);colors.push(tint.r,tint.g,tint.b);
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('color',new Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}

function furnishings() {
  const blocks:Part[]=[], drums:Part[]=[], crowns:Part[]=[];
  const box=(p:V,s:V,color:string,ry=0,rx=0)=>blocks.push({p,s,color,ry,rx});
  const tube=(p:V,s:V,color:string,rx=0,rz=0)=>drums.push({p,s,color,rx,rz});
  // The surrounding lawn is below the basin rather than crossing the water.
  for(const side of [-1,1])box([side*22,-.315,-7],[29.8,.25,65],'#98b283');
  box([0,-.315,18],[14.3,.25,30],'#98b283');box([0,-.315,-30],[14.3,.25,21.0],'#98b283');
  for(const r of [POOL.deck,...POOL.walks,POOL.farWalk]) box([r.x,-.125,r.z],[r.w,.25,r.d],'#e7dbc4');
  for(let x=-10;x<=10;x++) box([x,.001,1],[.012,.004,13.45],'#ada999');
  for(let z=-5;z<=7;z++) box([0,.001,z],[22.97,.004,.014],'#b6ad9b');
  for(const x of [-5.13,5.13]) {
    box([x,-.11,-12.4],[.28,.23,13.6],'#fcf5dd'); box([x+Math.sign(x)*.22,-.003,-12.4],[.15,.01,13.42],'#8b9c95');
    for(let j=0;j<86;j++) box([x+Math.sign(x)*.22,.005,-5.83-j*.154],[.15,.01,.092],'#dfdfce');
  }
  for(const z of [-5.72,-19.08])box([0,-.11,z],[10.35,.23,.23],'#fbf1d9');
  for(const x of [-3.33,0,3.33]) for(let j=0;j<56;j++)tube([x,-.14,-5.94-j*.236],[.105,.21,.105],j<6||j>49?'#c94d42':j%4===0?'#f7edcf':'#397eaa',Math.PI/2);
  for(const r of POOL.blocks){box([r.x,.26,r.z],[.36,.52,.43],'#d5ddd4');box([r.x,.55,r.z],[r.w,.08,r.d],'#367895',0,-.07);}
  const steel='#8fa9a7', l=POOL.ladder;
  for(const x of [l.x-.26,l.x+.26]) {
    tube([x,.28,l.z+.19],[.052,.56,.052],steel);tube([x,-.18,l.z-.19],[.052,1.48,.052],steel);
    for(let j=0;j<10;j++){const a=(j+.5)*Math.PI/10;tube([x,.56+.19*Math.sin(a),l.z+.19*Math.cos(a)],[.052,.068,.052],steel,-a);}
  }
  for(let j=0;j<6;j++)box([l.x,.32-j*.23,l.z-.19],[.54,.04,.08],steel);
  for(const r of POOL.loungers) {
    const put=(dx:number,y:number,dz:number,s:V,col:string,rx=0)=>box([r.x+dx*Math.cos(r.yaw)+dz*Math.sin(r.yaw),y,r.z+dz*Math.cos(r.yaw)-dx*Math.sin(r.yaw)],s,col,r.yaw,rx);
    for(const x of [-.32,.32]){put(x,.30,0,[.055,.09,1.8],'#a57c56');for(const z of [-.63,.63])put(x,.16,z,[.07,.32,.075],'#9e7853');}
    for(let j=0;j<9;j++)put(0,.37,-.83+j*.14,[.73,.04,.125],'#d3ae7c');
    for(let j=0;j<5;j++)put(0,.44+j*.094,.38+j*.098,[.73,.05,.13],'#d5b280',-.73);
    put(0,.409,-.44,[.62,.038,.57],'#63a7a5');for(const dz of [-.64,-.57])put(0,.43,dz,[.62,.008,.026],'#e7efe3');
  }
  for(const r of POOL.parasols){tube([r.x,.06,r.z],[.6,.12,.6],'#c2b79d');tube([r.x,1.28,r.z],[.061,2.44,.061],'#bc9369');}
  // A low pool pavilion and its changing-room doors anchor the far end.
  box([.8,-.18,-22],[19,.65,4.5],'#dcceb6');box([.8,1.44,-23.15],[18.5,2.86,1.42],'#f2dfb9');
  box([.8,2.98,-22.5],[19,.18,3.6],'#598c88');box([.8,3.12,-22.5],[19.2,.13,3.8],'#e8dfc5');
  for(let j=0;j<8;j++){const x=-7+j*2.14;box([x,1.17,-22.41],[1.35,2.06,.06],j%2?'#769e97':'#88aaa0');box([x+.44,1.14,-22.36],[.05,.16,.042],'#d4c5a5');for(let k=0;k<4;k++)box([x,1.85+k*.065,-22.36],[1.06,.023,.04],'#587a76');}
  for(const x of [-8,-4,0,4,8])box([x,1.55,-20.89],[.12,2.84,.12],'#e6d6b7');
  for(const x of [-10.5,10.5])for(let j=0;j<6;j++){
    const z=-7-j*3.1;box([x,.88,z],[.09,1.76,.09],steel);if(j<5){box([x,1.7,z-1.55],[.06,.06,3.1],steel);box([x,.5,z-1.55],[.035,.035,3.1],steel);}
  }
  for(const r of POOL.benches){box([r.x,.39,r.z],[r.w,.09,r.d],'#ae8c69');for(const dx of [-.65,.65])box([r.x+dx,.075,r.z],[.09,.54,.43],steel);}
  for(let j=0;j<24;j++) {const a=j*.73,x=(j%2?-1:1)*(14+3*Math.sin(a)),z=-29+(j>>1)*3.7,h=3.2+1.1*Math.cos(a);tube([x,(h-.2)/2,z],[.27,h+.2,.27],'#847663');for(let k=0;k<4;k++)crowns.push({p:[x+.82*Math.sin(k*2),h+.4*Math.cos(k*2),z+.8*Math.cos(k*2)],s:[2.7,2.2,2.3],color:['#769568','#8aab72','#668662','#94ad73'][k]});}
  return {blocks,drums,crowns};
}

// Trace the refracted view vector from the surface to the floor/side tiles.
// No reflection camera or extra render target; cameraPosition is per eye.
function Water() {
  const uniforms=useMemo(()=>({time:{value:0},sun:{value:new Vector3(...POOL_SUN).normalize()}}),[]);
  const w=POOL.water;const ref=useRef<ShaderMaterial>(null);
  useFrame((_,dt)=>{if(ref.current)uniforms.time.value=(uniforms.time.value+Math.min(.05,dt))%1000;});
  return <mesh position={[0,-.16,w.z]} rotation-x={-Math.PI/2} raycast={noPick} name="pool-water"><planeGeometry args={[w.w,w.d]} /><shaderMaterial ref={ref} uniforms={uniforms}
    vertexShader={`varying vec3 wp; void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`}
    fragmentShader={`varying vec3 wp;uniform float time;uniform vec3 sun;
    void main(){vec2 p=wp.xz; vec3 eye=normalize(cameraPosition-wp);float t=time*.68;
      vec3 n=normalize(vec3(.026*sin(3.4*p.x+2.5*p.y+t)+.017*cos(7.*p.y-t),1.,.034*cos(3.35*p.y-1.55*p.x+t)));
      vec3 r=refract(-eye,n,1./1.333);vec2 q=p-vec2(0.,${w.z.toFixed(2)});vec2 ext=vec2(${(w.w/2).toFixed(3)},${(w.d/2).toFixed(3)});
      vec2 wall=(ext-sign(r.xz)*q)/max(abs(r.xz),vec2(.0001));float depth=mix(1.12,2.1,clamp(.5-q.y/(2.*ext.y),0.,1.));float bed=depth/max(.02,-r.y);
      float dist=max(0.,min(bed,min(wall.x,wall.y)));vec3 hit=wp+dist*r;
      vec2 uv=bed<=min(wall.x,wall.y)?hit.xz:(wall.x<wall.y?hit.zy:hit.xy);
      vec2 tile=uv*3.;vec2 gap=abs(fract(tile+.5)-.5)/max(fwidth(tile),vec2(.001));float grout=1.-smoothstep(.2,1.2,min(gap.x,gap.y));
      float stripe=(1.-smoothstep(.075,.13,abs(mod(hit.x+3.34,3.34)-1.67)))*step(bed,min(wall.x,wall.y));
      vec3 c=mix(vec3(.32,.73,.72),vec3(.035,.24,.31),stripe);c=mix(c,vec3(.2,.48,.53),grout*.42);
      float caustic=abs(sin(uv.x*6.1+t+.85*sin(uv.y*4.-t))+cos(uv.y*5.-.61*t+sin(uv.x*3.7)));
      c+=vec3(.18,.24,.19)*(1.-smoothstep(.025,.18,caustic))*exp(-.4*dist);c=mix(c,vec3(.015,.31,.40),1.-exp(-dist*.39));
      float fres=.025+.86*pow(1.-max(dot(n,eye),0.),4.);c=mix(c,vec3(.47,.73,.83),fres);
      c+=vec3(1.,.9,.72)*pow(max(dot(reflect(-sun,n),eye),0.),100.);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`} /></mesh>;
}

export function PoolTerrace({shadows}:{shadows:boolean}) {
  const p=useMemo(furnishings,[]), top=useMemo(canopy,[]);
  const sign=useMemo(()=>paintedSurface(512,96,g=>{g.fillStyle='#216b74';g.fillRect(0,0,512,96);g.fillStyle='#faf2d7';g.textAlign='center';g.font='600 44px system-ui';g.fillText('AQUATICS CLUB',256,63);}),[]);
  useEffect(()=>()=>{top.dispose();sign.dispose();},[top,sign]);
  return <group name="scenery:pool"><Batch name="lido-terrace-and-pavilion" parts={p.blocks} casts={shadows} /><Batch name="pool-metalwork" parts={p.drums} round /><Batch name="pool-gardens" parts={p.crowns} foliage />
    {POOL.parasols.map(r=><mesh key={r.x} position={[r.x,2.51,r.z]} geometry={top} castShadow={shadows} raycast={noPick}><meshStandardMaterial side={DoubleSide} vertexColors roughness={1}/></mesh>)}
    <mesh position={[0,2.93,-20.69]} raycast={noPick}><planeGeometry args={[3.35,.62]} /><meshStandardMaterial map={sign} /></mesh>
    <Water /></group>;
}
