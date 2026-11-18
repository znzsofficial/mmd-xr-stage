import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Vector3, type ShaderMaterial } from "three";
import { Batch, type Part } from "./SceneryBatch";
import type { SceneryId } from "./catalog";

type DaySet = Exclude<SceneryId, "floor" | "liveHouse">;
type V = Part["p"];
export const SUN_POSITIONS: Record<DaySet, V> = { classroom: [-6, 3.5, -2], pool: [-4.5, 5.6, -5], lawn: [-4.8, 3.6, -5.5] };

export function DaySky({ sun, warm }: { sun: V; warm: boolean }) {
  const uniforms = useMemo(() => ({ sun: { value: new Vector3(...sun).normalize() },
    zenith: { value: new Color(warm ? "#6486ac" : "#417fba") }, horizon: { value: new Color(warm ? "#f3d9b5" : "#c9e3ec") } }), [sun, warm]);
  return <mesh name="day-sky" renderOrder={-100} frustumCulled={false} raycast={() => null}>
    <sphereGeometry args={[1, 36, 18]} />
    <shaderMaterial side={BackSide} depthWrite={false} uniforms={uniforms} vertexShader={`varying vec3 dir;
      void main(){dir=position; vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);gl_Position=clip.xyww;}`}
      fragmentShader={`varying vec3 dir; uniform vec3 sun, zenith, horizon;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.7,78.31)))*13758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(dir);float h=max(d.y,0.);vec3 c=mix(horizon,zenith,pow(h,.48));
        vec2 plane=d.xz/max(.12,h+.04);vec2 p=plane*vec2(2.4,4.1);float n=noise(p)*.6+noise(2.03*p)*.28+noise(4.23*p)*.12;
        float cloud=smoothstep(.56,.75,n)*smoothstep(.015,.22,h);c=mix(c,vec3(.92,.94,.94),.78*cloud);
        float a=clamp(dot(d,sun),0.,1.);float disk=1.-smoothstep(.007,.013,length(d-sun));
        c+=vec3(1.,.78,.48)*(.23*pow(a,30.)+.45*pow(a,330.)+1.8*disk)*(1.-.72*cloud);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`} />
  </mesh>;
}

function buildSet(id: DaySet) {
  const blocks: Part[] = [], details: Part[] = [], round: Part[] = [], leaves: Part[] = [];
  const add = (list: Part[], p: V, s: V, color: string, ry = 0, rz = 0) => list.push({p,s,color,ry,rz});
  const box = (p: V, s: V, c: string) => add(blocks,p,s,c);
  const trim = (p: V,s: V,c: string) => add(details,p,s,c);
  let seed = 11281; const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function tree(x:number,z:number,height:number) {
    add(round,[x,height*.30,z],[height*.084,height*.6,height*.084],"#6c5843");
    for(let i=0;i<6;i++) {const a=i*2.4; const r=i===0?0:height*.19;
      add(leaves,[x+r*Math.cos(a),height*(i===0?.9:.70+random()*.12),z+r*Math.sin(a)],
        [height*.68,height*(.54+random()*.15),height*.59],["#668253","#79905f","#526f4b"][i%3],a);}
  }
  if (id === "classroom") {
    const wood="#ab845e", edge="#685847", frame="#63726c", plaster="#d8d5c4";
    box([0,-.105,0],[12.5,.2,12.5],"#ba966c"); box([0,3.62,0],[12.5,.14,12.5],"#e8e7dc");
    box([0,1.80,-6.18],[12.5,3.6,.14],plaster);box([6.18,1.80,0],[.14,3.6,12.5],plaster);box([0,1.8,6.18],[12.5,3.6,.14],plaster);
    box([-6.18,.46,0],[.14,.92,12.5],plaster);box([-6.18,3.37,0],[.14,.46,12.5],plaster);
    box([-6.05,.94,0],[.38,.08,12.4],wood);
    for(let i=0;i<=6;i++){const z=-6.15+2.05*i;box([-6.18,2.03,z],[.19,2.22,.12],frame);
      if(i<6){box([-6.18,2.65,z+1.025],[.12,.055,2],frame);box([-6.18,1.82,z+1.02],[.08,1.71,.04],frame);}}
    box([0,1.85,-6.03],[6.9,1.55,.12],edge);box([0,1.85,-5.95],[6.76,1.42,.04],"#375953");box([0,1.05,-5.86],[7,.08,.24],wood);
    for(const x of [-2.7,-2.3])trim([x,1.105,-5.82],[.15,.025,.028],"#e7dfc4");
    for(const x of [-4.35,4.35])for(const z of [-3.8,-1.4,1.1,3.5]){
      box([x,.74,z],[1.12,.065,.64],wood);box([x,.60,z-.20],[.96,.20,.05],edge);
      for(const dx of [-.43,.43])for(const dz of [-.24,.24])trim([x+dx,.36,z+dz],[.035,.72,.035],frame);
      box([x,.43,z+.68],[.46,.06,.44],wood);box([x,.66,z+.91],[.46,.31,.05],wood);
      for(const dx of [-.18,.18])for(const dz of [.5,.86])trim([x+dx,.21,z+dz],[.035,.42,.035],frame);
    }
    for(const x of [-3,0,3])for(const z of [-3,1.8])trim([x,3.47,z],[1.35,.07,.16],"#f2f0db");
    // Wainscot, bulletin board and clock frame the board without blocking the model.
    box([0,.46,-6.06],[12.25,.94,.055],"#92a69c");box([0,.95,-6.02],[12.25,.046,.08],edge);
    box([4.69,1.86,-6.04],[1.82,1.13,.10],edge);box([4.69,1.86,-5.98],[1.73,1.04,.04],"#b1956e");
    for(let i=0;i<4;i++)trim([4.19+(i%2)*.62,1.61+Math.floor(i/2)*.42,-5.95],[.38,.30,.016],i%3?"#ebe4cb":"#afcec4");
    round.push({p:[0,3.07,-6.00],s:[.39,.06,.39],rx:Math.PI/2,color:edge},{p:[0,3.07,-5.96],s:[.34,.02,.34],rx:Math.PI/2,color:"#e7e4d9"});
    add(details,[.04,3.11,-5.94],[.012,.13,.016],frame,0,-.80);add(details,[-.046,3.09,-5.93],[.017,.11,.016],frame,0,1.09);
    for(let i=0;i<6;i++)tree(-9-random()*2,-8+i*3,3+random());
  } else if (id === "pool") {
    box([0,-.52,-4],[58,.38,58],"#97a878");
    box([0,-.104,1],[23,.2,13.5],"#dbd7c6");
    for(const x of [-6.2,6.2])box([x,-.095,-12.4],[2.35,.18,13.4],"#dcd9ce");
    box([0,-.095,-19.48],[14.7,.18,1.1],"#dad5c8");
    for(const x of [-5.06,5.06])trim([x,-.14,-12.4],[.17,.32,13.55],"#c9e5df");
    for(const z of [-5.76,-19.04])trim([0,-.14,z],[10.18,.32,.17],"#e2e7df");
    for(const x of [-3.34,0,3.34]){
      for(let i=0;i<44;i++) add(round,[x,-.15,-5.98-i*.29],[.086,.086,.27],i<5||i>38?"#d85747":i%3===0?"#f0e7c2":"#6199ae");
      box([x-1.65,.26,-19.42],[.48,.52,.5],"#eceadc");trim([x-1.65,.55,-19.42],[.65,.07,.7],"#367998");
    }
    for(let i=-10;i<11;i++)trim([i,.001,.9],[.014,.004,13.1],"#bfbdb0");
    for(let i=-5;i<=7;i++)trim([0,.002,i],[22.8,.004,.014],"#bfbdb0");
    for(const x of [-8,8]){box([x,1.2,-12.5],[.09,2.4,.09],"#8f9d9b");box([x,2.36,-12.5],[2.7,.13,2],"#e2bf7e");box([x,.44,-12.6],[1.8,.09,.51],"#939b94");}
    for(const x of [-4.6,-4.08]){add(round,[x,.29,-5.56],[.046,.61,.046],"#a0b8ba");add(round,[x,.23,-5.94],[.046,.77,.046],"#92afb0");box([x,.60,-5.75],[.047,.055,.4],"#a0b8ba");}
    for(let i=0;i<4;i++)trim([-4.34,.30-.15*i,-5.94],[.53,.045,.06],"#819c9e");
    for(let i=0;i<9;i++)tree(-14+3.5*i,-23-random()*2,3.3+random());
  } else {
    box([0,-.11,0],[58,.21,58],"#809a57");
    for(let i=0;i<58;i++){const x=random()*54-27,z=random()*54-27;if(Math.hypot(x,z)<9)continue;
      add(leaves,[x,-.24,z],[3+random()*6,.6+random()*1.4,2+random()*4],"#819959",random()*3);}
    for(let i=0;i<19;i++){const a=i*2.399,r=11+random()*12;tree(Math.cos(a)*r, Math.sin(a)*r,3.3+2.2*random());}
    for(let i=0;i<460;i++){const x=random()*26-13,z=random()*26-13;if (x*x+z*z<1.1)continue;const h=.07+random()*.15;
      add(details,[x,h/2,z],[.026,h,.023],random()<.5?"#687f43":"#99ac64",random()*3,.16);
      if(i%5===0)add(leaves,[x,h,z],[.063,.032,.061],i%3?"#f0e4c1":"#d6b75f");}
  }
  return {blocks,details,round,leaves};
}

// Project the clear openings onto y=0 along the same directional sun used on
// the character. This replaces shadow maps only for the static patch accents.
function WindowSun() {
  const vertices=useMemo(()=>{
    const [sx,sy,sz]=SUN_POSITIONS.classroom, points:number[]=[];
    const project=(height:number,z:number)=>[-6.18-height*sx/sy,.001,z-height*sz/sy];
    for(let i=0;i<6;i++) for(const [y0,y1] of [[.99,2.62],[2.68,3.13]]) for(let j=0;j<2;j++) {
      const z=-6.15+2.05*i+1.025*j+.07;
      const a=project(y0,z), b=project(y1,z), c=project(y1,z+.90), d=project(y0,z+.90);
      points.push(...a,...c,...b,...a,...d,...c);
    }
    return new Float32Array(points);
  },[]);
  return <mesh name="window-sun-patches" raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[vertices,3]} /></bufferGeometry>
    <meshBasicMaterial color="#ffe6b0" transparent opacity={.42} depthWrite={false} polygonOffset polygonOffsetFactor={-1} /></mesh>;
}

function PoolWater() {
  const ref=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  useFrame((_,dt)=>{if(ref.current)ref.current.uniforms.uTime.value=(ref.current.uniforms.uTime.value+Math.min(dt,.05))%6000;});
  return <mesh name="pool-water" position={[0,-.19,-12.4]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
    <planeGeometry args={[10.1,13.35]} /><shaderMaterial ref={ref} uniforms={uniforms} vertexShader={`varying vec3 wp;void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`}
      fragmentShader={`varying vec3 wp;uniform float uTime;void main(){vec2 p=wp.xz; float t=uTime*.7;
        vec2 r=vec2(sin(p.y*3.8+p.x+t)+sin(p.x*4.4-t),cos(p.x*3.+p.y*2.4+t));vec3 n=normalize(vec3(r.x*.055,1.,r.y*.055));
        vec3 eye=normalize(cameraPosition-wp);float fr=pow(1.-max(dot(n,eye),0.),3.);vec2 tile=(p+.025*r)*2.;
        vec2 line=abs(fract(tile+.5)-.5)/max(fwidth(tile),vec2(.0001));float grout=1.-clamp(min(line.x,line.y),0.,1.);
        float lane=1.-smoothstep(.07,.13,abs(mod(p.x+1.67,3.34)-1.67));
        vec3 c=mix(vec3(.045,.43,.48),vec3(.035,.21,.28),lane*.9+grout*.09);c+=.028*cos(r.x+r.y);
        c=mix(c,vec3(.56,.77,.83),fr*.8);c+=vec3(1.,.88,.65)*pow(max(dot(reflect(-normalize(vec3(-4.5,5.6,-5.)),n),eye),0.),100.);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`} />
  </mesh>;
}

export function DaylightSet({ id, shadows }: { id: DaySet; shadows: boolean }) {
  const p=useMemo(()=>buildSet(id),[id]);
  return <group name={`scenery:${id}`}>
    <Batch name="architecture" parts={p.blocks} casts={shadows} />
    <Batch name="details" parts={p.details} />
    {!!p.round.length && <Batch name="posts" parts={p.round} round />}
    {!!p.leaves.length && <Batch name="landscape" parts={p.leaves} foliage />}
    {id==="classroom" && !shadows && <WindowSun />}
    {id==="pool" && <PoolWater />}
  </group>;
}
