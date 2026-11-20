import {useEffect,useMemo} from 'react';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import url from './lido-signs.webp';
import {useBakedSurface} from './useBakedSurface';
import {GUARD_CHAIR,PACE_CLOCK,POOL_ORIGIN,POOL,LIDO_ENTRY} from './LidoLayout';
import {noPick} from './sceneryPaint';

export function LidoPlates({pool}:{pool:boolean}){
  const map=useBakedSurface(url),geo=useMemo(()=>{
    const verts:number[]=[],uv:number[]=[];
    function face(x:number,y:number,z:number,w:number,h:number,crop:number[],front=true){
      const [u,v,a,b]=crop;
      for(const [s,t] of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]){
        verts.push(x+s*(front?1:-1)*w*.5,y+t*h*.5,z);uv.push((s<0?u:a)/1024,1-(t<0?b:v)/512);
      }
    }
    const gate=8.34+(pool?0:POOL_ORIGIN.z),x=LIDO_ENTRY.x+(pool?0:POOL_ORIGIN.x);
    face(x,2.46,gate+.074,3.11,.38,[1,1,765,110]);face(x,2.46,gate-.074,3.11,.38,[1,115,765,224],false);
    if(pool){
      for(let i=0;i<48;i++)for(const a of [null,i*Math.PI/24,(i+1)*Math.PI/24]){
        const dx=a===null?0:Math.cos(a),dy=a===null?0:Math.sin(a);
        verts.push(PACE_CLOCK.x+dx*.356,1.83+dy*.356,PACE_CLOCK.z+.07);uv.push((820+dx*114)/1024,1-(373-dy*114)/512);
      }
      face(PACE_CLOCK.x,.98,PACE_CLOCK.z+.062,.84,.21,[3,371,549,506]);
      POOL.blocks.forEach((r,i)=>face(r.x,.31,r.z+.217,.33,.28,[i*152+1,232,i*152+147,357]));
      for(let i=0;i<8;i++)face(-7+i*2.14,1.71,-22.375+.023,.16,.22,[769+32*i,3,797+32*i,60]);
      for(let i=0;i<3;i++)face(GUARD_CHAIR.x,1.83+i*.15,GUARD_CHAIR.z-.276,.844,.107,[461,233,697,356]);
      for(const side of [-1,1])for(let i=0;i<18;i++){
        const x=5.35*side,z=-5.72-(i+.5)*13.42/18;
        for(const [s,t] of [[-1,1],[1,1],[1,-1],[-1,1],[1,-1],[-1,-1]]){
          verts.push(x+s*.075,.004,z+t*(13.42/36));uv.push((s<0?774:1017)/1024,1-(t<0?71:219)/512);
        }
      }
    }
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(verts,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
  },[pool]);useEffect(()=>()=>geo.dispose(),[geo]);
  return map&&<mesh name="lido:wayfinding" geometry={geo} raycast={noPick}><meshStandardMaterial map={map} roughness={.65}/></mesh>;
}
