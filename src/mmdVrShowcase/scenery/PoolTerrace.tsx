import {RoomShader} from './daylightMaterials';
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Color, CylinderGeometry, DoubleSide, Float32BufferAttribute, IcosahedronGeometry, TorusGeometry, Vector3, type Mesh,type ShaderMaterial } from 'three';
import {arcadeParts,judgeStand,PACE_CLOCK,POOL,POOL_SLABS,POOL_ORIGIN,POOL_WATER_Y,PAVILION_POSTS,PAVILION_SLABS,poolBarrierParts} from './LidoLayout';
import {reserveArcadeSite} from './routes/campusArcade/site';
import {LidoPlates} from './LidoPlates';
import { span } from './detailParts';
import { useBakedSurface } from './useBakedSurface';
import pavementURL from './lido-pavement.webp';
import { Batch, type Part } from './SceneryBatch';
import { noPick, paintedSurface } from './sceneryPaint';
import { indexPoolSurface, poolInstanceStrips } from './poolInstanceStrips';
import {SHORE_SUN} from './shoreDaylight';
import {copingTiles,deckFinish} from './lidoFinish';

type V = Part['p'];

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

export function poolFurnishings() {
  const blocks:Part[]=[], drums:Part[]=[], trunks:Part[]=[], crowns:Part[]=[];
  const box=(p:V,s:V,color:string,ry=0,rx=0)=>blocks.push({p,s,color,ry,rx});
  const tube=(p:V,s:V,color:string,rx=0,rz=0)=>drums.push({p,s,color,rx,rz});
  // The surrounding lawn is below the basin rather than crossing the water.
  for(const side of [-1,1])box([side*11.3,-.315,-11.2],[8.4,.25,37.9],'#98b283');
  box([0,-.315,3.37],[14.2,.25,8.76],'#98b283');box([0,-.315,-24.82],[14.2,.25,10.66],'#98b283');
  for(const r of POOL_SLABS)box([r.x,-.125,r.z],[r.w,.25,r.d],'#e7dbc4');
  blocks.push(...arcadeParts(),...judgeStand());
  const clock=PACE_CLOCK;
  tube([clock.x,.70,clock.z],[.084,1.40,.084],'#63867f');tube([clock.x,.055,clock.z],[.43,.11,.43],'#8c9990');
  tube([clock.x,1.83,clock.z],[.76,.12,.76],'#416d6b',Math.PI/2);
  box([clock.x,.98,clock.z],[.89,.26,.12],'#657f75');
  tube([clock.x,1.83,clock.z+.089],[.046,.017,.046],'#805e43',Math.PI/2);
  for(const x of [-5.13,5.13]) {
    box([x,-.11,-12.4],[.28,.23,13.6],'#829b96'); box([x+Math.sign(x)*.22,-.003,-12.4],[.15,.01,13.42],'#8b9c95');
  }
  for(const z of [-5.72,-19.08])box([0,-.11,z],[10.0,.23,.23],'#829b96');
  for(const x of [-3.33,0,3.33]) for(let j=0;j<56;j++)tube([x,POOL_WATER_Y+.02,-5.94-j*.236],[.105,.21,.105],j<6||j>49?'#c94d42':j%4===0?'#f7edcf':'#397eaa',Math.PI/2);
  for(const r of POOL.blocks){box([r.x,.26,r.z],[.36,.52,.43],'#d5ddd4');box([r.x,.55,r.z],[r.w,.08,r.d],'#367895',0,-.07);
    for(let k=0;k<6;k++)box([r.x,.593+k*.005,r.z-.20+k*.071],[.56,.015,.024],'#70999e',0,-.07);
    for(const s of [-1,1])tube([r.x+s*.133,.30,r.z+.263],[.027,.18,.027],'#91a8a5');tube([r.x,.211,r.z+.263],[.027,.293,.027],'#91a8a5',0,Math.PI/2);}
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
    // Folded striped towelling with the hem turned over the side rail and fringe.
    put(0,.409,-.44,[.72,.044,.57],'#63a7a5');put(-.344,.337,-.44,[.036,.151,.57],'#568d90');
    for(const dz of [-.665,-.622,-.579,-.322,-.279,-.236]){
      put(0,.433,dz,[.72,.006,.018],'#efddae');put(-.365,.336,dz,[.006,.15,.018],'#dacda3');}
    for(let j=0;j<15;j++)put(-.345,.247,-.704+j*.037,[.014,.044+(j%3)*.007,.012],'#e3d5b6');
    for(const dx of [-.32,.32])for(const dz of [-.62,.63])put(dx,.048,dz,[.086,.067,.091],'#686e69');
  }
  for(const r of POOL.parasols){tube([r.x,.06,r.z],[.6,.12,.6],'#c2b79d');tube([r.x,1.28,r.z],[.061,2.44,.061],'#bc9369');
    tube([r.x,.16,r.z],[.11,.12,.11],'#828d86');tube([r.x,1.80,r.z],[.11,.09,.11],'#8f9181');
    for(let j=0;j<12;j++){const a=j*Math.PI/6,s=Math.sin(a),c=Math.cos(a);
      blocks.push(span([r.x,2.455,r.z],[r.x+.82*s,2.32,r.z+.82*c],.019,'#dfc293'),span([r.x+.82*s,2.32,r.z+.82*c],[r.x+1.41*s,2.016,r.z+1.41*c],.018,'#c4ad86'),span([r.x,1.82,r.z],[r.x+.75*s,2.32,r.z+.75*c],.018,'#c9b28d'));
    }
  }
  // A low pool pavilion and its changing-room doors anchor the far end.
  for(const r of PAVILION_SLABS)box([r.x,-.33,r.z],[r.w,.65,r.d],'#dcceb6');
  box([.8,1.44,-23.15],[18.5,2.86,1.42],'#f2dfb9');
  box([.8,2.98,-22.5],[19,.18,3.6],'#598c88');box([.8,3.12,-22.5],[19.2,.13,3.8],'#e8dfc5');
  for(let j=0;j<8;j++){const x=-7+j*2.14;box([x,1.17,-22.41],[1.35,2.06,.06],j%2?'#769e97':'#88aaa0');box([x+.44,1.14,-22.36],[.05,.16,.042],'#d4c5a5');for(let k=0;k<4;k++)box([x,1.85+k*.065,-22.36],[1.06,.023,.04],'#587a76');}
  for(const {x,z,w,d} of PAVILION_POSTS){box([x,1.43,z],[w,2.86,d],'#e6d6b7');box([x,.17,z],[.21,.34,.21],'#849f93');}
  for(let i=0;i<8;i++){const x=-7+i*2.14;box([x,.045,-22.22],[1.44,.082,.38],'#b3b6a8');box([x,1.04,-22.354],[.18,.31,.028],'#587871');box([x,1.09,-22.322],[.13,.024,.043],'#d1c9b0');}
  blocks.push(...poolBarrierParts());
  for(const r of POOL.benches){box([r.x,.39,r.z],[r.w,.09,r.d],'#ae8c69');for(const dx of [-.65,.65])box([r.x+dx,.075,r.z],[.09,.54,.43],steel);}
  // Backstroke flags sag between capped uprights. The sockets are outside the water.
  for(const f of POOL.flagPosts){tube([f.x,1.54,f.z],[.056,3.08,.056],steel);tube([f.x,.038,f.z],[.14,.074,.14],'#839e99');}
  for(const z of [-9.5,-16.8])for(let i=0;i<16;i++){
    const x=-5.45+i*10.9/16;drums.push(span([x,lineY(x),z],[x+10.9/16,lineY(x+10.9/16),z],.017,'#767c70'));
  }
  const rescue=POOL.rescue;
  for(const dx of [-.32,.32]){box([rescue.x+dx,.76,rescue.z],[.065,1.52,.07],'#547d78');box([rescue.x+dx,.035,rescue.z],[.17,.07,.40],steel);}
  box([rescue.x,1.34,rescue.z],[.89,.50,.07],'#dae5d4');box([rescue.x,1.59,rescue.z],[.91,.05,.10],'#4f807a');
  // Narrow ceramic kickplates and glazed transoms catch sky light across the pool.
  for(let j=0;j<8;j++){const x=-7+j*2.14;box([x,.22,-22.366],[1.22,.24,.018],'#88a29a');box([x,2.48,-22.425],[1.44,.35,.05],'#a0bec0');
    for(const dx of [-.64,0,.64])box([x+dx,2.48,-22.39],[.055,.37,.042],'#e6d7b7');}
  for(let j=0;j<24;j++) {const a=j*.73,x=(j%2?-1:1)*(14+3*Math.sin(a)),z=-29+(j>>1)*3.7,h=3.2+1.1*Math.cos(a);
    if(reserveArcadeSite(x+POOL_ORIGIN.x,z+POOL_ORIGIN.z,2.2))continue;
    trunks.push({p:[x,(h-.2)/2,z],s:[.27,h+.2,.27],color:'#847663'});for(let k=0;k<4;k++)crowns.push({p:[x+.82*Math.sin(k*2),h+.4*Math.cos(k*2),z+.8*Math.cos(k*2)],s:[2.7,2.2,2.3],color:['#769568','#8aab72','#668662','#94ad73'][k]});}
  return {blocks,drums:poolInstanceStrips(drums,trunks),crowns:poolInstanceStrips(crowns)};
}

const lineY=(x:number)=>2.64+.37*(x/5.45)**2;
function flagCloth(){
  const p:number[]=[],c:number[]=[],color=new Color();
  for(const z of [-9.5,-16.8])for(let i=-10;i<=10;i++){
    const x=i*.49,y=lineY(x),w=.211;
    // Two slightly folded faces catch different light in stereo, with a piped top edge.
    const a=[x-w,lineY(x-w),z],b=[x+w,lineY(x+w),z],m=[x,y-.055,z+.035],tip=[x+.09,y-.37,z+.10];
    function tri(v:number[][],t:string){color.set(t);for(const pt of v){p.push(...pt);c.push(color.r,color.g,color.b);}}
    const red=(i+10)%4<2;tri([a,tip,m],red?'#dd7353':'#3b8795');tri([m,tip,b],red?'#f79162':'#65a9b0');tri([a,m,b],'#f1e3bd');
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}
function lifeRing(){
  const g=new TorusGeometry(.275,.076,8,48).toNonIndexed(),t=new Color(),c:number[]=[];
  const uv=g.getAttribute('uv');for(let i=0;i<uv.count;i+=3){const u=(uv.getX(i)+uv.getX(i+1)+uv.getX(i+2))/3;
    t.set((u*4+.15)%1<.3?'#fff0ca':'#e76838');for(let j=0;j<3;j++)c.push(t.r,t.g,t.b);}
  g.setAttribute('color',new Float32BufferAttribute(c,3));return indexPoolSurface(g);
}

// Trace the refracted view vector from the surface to the floor/side tiles.
// No reflection camera or extra render target; cameraPosition is per eye.
function Water() {
  const uniforms=useMemo(()=>({time:{value:0},sun:{value:new Vector3(...SHORE_SUN).normalize()}}),[]);
  const w=POOL.water;const ref=useRef<ShaderMaterial>(null);
  useFrame((_,dt)=>{if(ref.current)uniforms.time.value=(uniforms.time.value+Math.min(.05,dt))%1000;});
  return <mesh position={[w.x,POOL_WATER_Y,w.z]} rotation-x={-Math.PI/2} raycast={noPick} name="pool-water"><planeGeometry args={[w.w,w.d]} /><RoomShader effect="pool" ref={ref} uniforms={uniforms}
    vertexShader={`varying vec3 wp; void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`}
    fragmentShader={`varying vec3 wp;uniform float time;uniform vec3 sun;
    void main(){vec2 p=wp.xz; vec3 eye=normalize(cameraPosition-wp);float t=time*.68;
      vec3 n=normalize(vec3(.026*sin(3.4*p.x+2.5*p.y+t)+.017*cos(7.*p.y-t),1.,.034*cos(3.35*p.y-1.55*p.x+t)));
      vec3 r=refract(-eye,n,1./1.333);vec2 q=p-vec2(${w.x.toFixed(2)},${w.z.toFixed(2)});vec2 ext=vec2(${(w.w/2).toFixed(3)},${(w.d/2).toFixed(3)});
      vec2 wall=(ext-sign(r.xz)*q)/max(abs(r.xz),vec2(.0001));float depth=mix(1.12,2.1,clamp(.5-q.y/(2.*ext.y),0.,1.));float bed=depth/max(.02,-r.y);
      float dist=max(0.,min(bed,min(wall.x,wall.y)));vec3 hit=wp+dist*r;
      vec2 uv=bed<=min(wall.x,wall.y)?hit.xz:(wall.x<wall.y?hit.zy:hit.xy);
      vec2 tile=uv*3.;vec2 gap=abs(fract(tile+.5)-.5)/max(fwidth(tile),vec2(.001));float grout=1.-smoothstep(.2,1.2,min(gap.x,gap.y));
      float laneX=abs(mod(hit.x+3.34,3.34)-1.67),endDist=ext.y-abs(hit.z-(${w.z.toFixed(2)}));
      float stripe=max((1.-smoothstep(.075,.13,laneX))*smoothstep(.78,.83,endDist),(1.-smoothstep(.060,.11,abs(endDist-.87)))*(1.-smoothstep(.46,.51,laneX)))*step(bed,min(wall.x,wall.y));
      vec3 c=mix(vec3(.32,.73,.72),vec3(.035,.24,.31),stripe);c=mix(c,vec3(.2,.48,.53),grout*.42);
      // A glazed ribbon just below the coping. Pattern lives on the refracted
      // wall, not on the surface, so it moves correctly against the floating boat.
      if(bed>min(wall.x,wall.y)){
        float border=smoothstep(-.64,-.62,hit.y)*(1.-smoothstep(-.27,-.25,hit.y));
        float wave=abs(hit.y+.449+.073*sin(uv.x*6.30));
        vec3 enamel=mix(vec3(.047,.32,.43),vec3(.64,.79,.66),1.-smoothstep(.018,.036,wave));
        c=mix(c,mix(enamel,vec3(.44,.67,.64),grout*.55),border*.9);
      }
      float caustic=abs(sin(uv.x*6.1+t+.85*sin(uv.y*4.-t))+cos(uv.y*5.-.61*t+sin(uv.x*3.7)));
      c+=vec3(.18,.24,.19)*(1.-smoothstep(.025,.18,caustic))*exp(-.4*dist);c=mix(c,vec3(.015,.31,.40),1.-exp(-dist*.39));
      float fres=.025+.86*pow(1.-max(dot(n,eye),0.),4.);c=mix(c,vec3(.47,.73,.83),fres);
      c+=vec3(1.,.9,.72)*pow(max(dot(reflect(-sun,n),eye),0.),100.);gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`} /></mesh>;
}

export function PoolTerrace({shadows}:{shadows:boolean}) {
  const hand=useRef<Mesh>(null);useFrame(({clock})=>{if(hand.current)hand.current.rotation.z=-clock.elapsedTime*Math.PI/30;});
  const metal=useMemo(()=>indexPoolSurface(new CylinderGeometry(.5,.5,1,10)),[]);
  const garden=useMemo(()=>indexPoolSurface(new IcosahedronGeometry(.5,1)),[]),needles=useMemo(()=>{
    const g=new BufferGeometry(),p:number[]=[],c:number[]=[];
    for(const [length,tint] of [[.319,'#bb4d36'],[-.286,'#407f83']] as const){const color=new Color(tint);for(const [x,y] of [[-.009,0],[.009,0],[.005,length],[-.009,0],[.005,length],[-.005,length]]){p.push(x,y,0);c.push(color.r,color.g,color.b);}}
    g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(c,3));return g;
  },[]);useEffect(()=>()=>{metal.dispose();garden.dispose();needles.dispose();},[metal,garden,needles]);
  const p=useMemo(poolFurnishings,[]), top=useMemo(canopy,[]),flags=useMemo(flagCloth,[]),ring=useMemo(lifeRing,[]),stone=useBakedSurface(pavementURL);
  const tiles=useMemo(copingTiles,[]),finish=useMemo(()=>deckFinish(shadows),[shadows]);
  useEffect(()=>()=>finish.dispose(),[finish]);
  const sign=useMemo(()=>paintedSurface(512,96,g=>{g.fillStyle='#216b74';g.fillRect(0,0,512,96);g.fillStyle='#faf2d7';g.textAlign='center';g.font='600 44px system-ui';g.fillText('AQUATICS CLUB',256,63);}),[]);
  useEffect(()=>()=>{top.dispose();sign.dispose();flags.dispose();ring.dispose();},[top,sign,flags,ring]);
  return <group name="scenery:pool"><Batch name="lido-terrace-and-pavilion" parts={p.blocks} casts={shadows} /><Batch name="pool-metalwork" {...p.drums} geometry={metal} /><Batch name="pool-gardens" {...p.crowns} geometry={garden} />
    <Batch name="pool:wet-glazed-coping" parts={tiles} roughness={.25}/>
    {POOL.parasols.map(r=><mesh key={r.x} position={[r.x,2.51,r.z]} geometry={top} castShadow={shadows} raycast={noPick}><meshStandardMaterial side={DoubleSide} vertexColors roughness={1}/></mesh>)}
    <mesh position={[0,2.93,-20.69]} raycast={noPick}><planeGeometry args={[3.35,.62]} /><meshStandardMaterial map={sign} /></mesh>
    <mesh geometry={flags} raycast={noPick}><meshStandardMaterial vertexColors roughness={1} side={DoubleSide}/></mesh>
    <mesh geometry={ring} position={[POOL.rescue.x,1.18,POOL.rescue.z+.11]} raycast={noPick}><meshStandardMaterial vertexColors roughness={.76}/></mesh>
    <mesh rotation-x={-Math.PI/2} position={[POOL.deck.x,.002,POOL.deck.z]} receiveShadow={shadows} raycast={noPick}><planeGeometry args={[POOL.deck.w,POOL.deck.d]}/><meshStandardMaterial key={stone?'tiles':'loading'} map={stone} color={stone?'white':'#e4d6bd'} roughnessMap={finish} aoMap={shadows?null:finish} polygonOffset polygonOffsetFactor={-1}/></mesh>
    <mesh ref={hand} geometry={needles} position={[PACE_CLOCK.x,1.83,PACE_CLOCK.z+.081]} raycast={noPick}><meshBasicMaterial vertexColors side={DoubleSide}/></mesh><LidoPlates/><Water /></group>;
}
