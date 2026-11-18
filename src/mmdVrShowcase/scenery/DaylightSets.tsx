import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, Color, Vector3, type ShaderMaterial } from "three";
import { Batch, type Part } from "./SceneryBatch";
import type { SceneryId } from "./catalog";
import { Classroom } from "./Classroom";
import { CLASS_SUN } from "./ClassroomLayout";
import { POOL, LAWN_KNOLLS, LAWN_SIZE, LAWN_TREES } from "./placementAreas";

type DaySet = Exclude<SceneryId, "floor" | "liveHouse">;
type V = Part["p"];
export const SUN_POSITIONS: Record<DaySet, V> = { classroom: CLASS_SUN, pool: [-4.5, 5.6, -5], lawn: [-4.8, 3.6, -5.5] };

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

function buildSet(id: 'pool' | 'lawn') {
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
  if (id === "pool") {
    box([0,-.52,-4],[58,.38,58],"#97a878");
    for(const r of [POOL.deck,...POOL.walks,POOL.farWalk])box([r.x,-.10,r.z],[r.w,.20,r.d],"#dbd7c6");
    for(const x of [-5.06,5.06])trim([x,-.14,-12.4],[.17,.32,13.55],"#c9e5df");
    for(const z of [-5.76,-19.04])trim([0,-.14,z],[10.18,.32,.17],"#e2e7df");
    for(const x of [-3.34,0,3.34]){
      for(let i=0;i<44;i++) add(round,[x,-.15,-5.98-i*.29],[.086,.086,.27],i<5||i>38?"#d85747":i%3===0?"#f0e7c2":"#6199ae");
    }
    for(const r of POOL.blocks){box([r.x,.26,r.z],[.48,.52,.5],"#eceadc");trim([r.x,.55,r.z],[r.w,.07,r.d],"#367998");}
    for(let i=-10;i<11;i++)trim([i,.001,.9],[.014,.004,13.1],"#bfbdb0");
    for(let i=-5;i<=7;i++)trim([0,.002,i],[22.8,.004,.014],"#bfbdb0");
    for(const b of POOL.benches){box([b.x,1.2,b.z+.1],[.09,2.4,.09],"#8f9d9b");box([b.x,2.36,b.z+.1],[2.7,.13,2],"#e2bf7e");box([b.x,.44,b.z],[b.w,.09,b.d],"#939b94");}
    const l=POOL.ladder;
    for(const x of [l.x-.26,l.x+.26]){add(round,[x,.29,l.z+.19],[.046,.61,.046],"#a0b8ba");add(round,[x,.23,l.z-.19],[.046,.77,.046],"#92afb0");box([x,.60,l.z],[.047,.055,.4],"#a0b8ba");}
    for(let i=0;i<4;i++)trim([l.x,.30-.15*i,l.z-.19],[.53,.045,.06],"#819c9e");
    for(let i=0;i<9;i++)tree(-14+3.5*i,-23-random()*2,3.3+random());
  } else {
    box([0,-.105,0],[LAWN_SIZE,.21,LAWN_SIZE],"#809a57");
    for(const k of LAWN_KNOLLS)add(leaves,[k.x,-.24,k.z],[k.w,k.h,k.d],"#819959",k.yaw);
    for(const t of LAWN_TREES)tree(t.x,t.z,t.h);
    for(let i=0;i<460;i++){const x=random()*26-13,z=random()*26-13;if (x*x+z*z<1.1)continue;const h=.07+random()*.15;
      add(details,[x,h/2,z],[.026,h,.023],random()<.5?"#687f43":"#99ac64",random()*3,.16);
      if(i%5===0)add(leaves,[x,h,z],[.063,.032,.061],i%3?"#f0e4c1":"#d6b75f");}
  }
  return {blocks,details,round,leaves};
}

function PoolWater() {
  const ref=useRef<ShaderMaterial>(null);
  const uniforms=useMemo(()=>({uTime:{value:0}}),[]);
  useFrame((_,dt)=>{if(ref.current)ref.current.uniforms.uTime.value=(ref.current.uniforms.uTime.value+Math.min(dt,.05))%6000;});
  const w=POOL.water;
  return <mesh name="pool-water" position={[w.x,-.19,w.z]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
    <planeGeometry args={[w.w,w.d]} /><shaderMaterial ref={ref} uniforms={uniforms} vertexShader={`varying vec3 wp;void main(){wp=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`}
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

function OutdoorSet({ id, shadows }: { id: 'pool' | 'lawn'; shadows: boolean }) {
  const p=useMemo(()=>buildSet(id),[id]);
  return <group name={`scenery:${id}`}>
    <Batch name="architecture" parts={p.blocks} casts={shadows} />
    <Batch name="details" parts={p.details} />
    {!!p.round.length && <Batch name="posts" parts={p.round} round />}
    {!!p.leaves.length && <Batch name="landscape" parts={p.leaves} foliage />}
    {id==="pool" && <PoolWater />}
  </group>;
}

export function DaylightSet({ id, shadows }: { id: DaySet; shadows: boolean }) {
  return id === 'classroom' ? <Classroom shadows={shadows} /> : <OutdoorSet id={id} shadows={shadows} />;
}
