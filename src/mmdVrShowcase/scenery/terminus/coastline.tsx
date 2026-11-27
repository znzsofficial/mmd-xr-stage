import {useEffect,useLayoutEffect,useMemo} from 'react';
import {BufferGeometry,Color,Float32BufferAttribute,RepeatWrapping} from 'three';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';

type Point=[number,number,number];

// Lengthwise outcrops. The bedding tips inland, while the wave-cut notch and
// its splash line stay nearly horizontal. Silhouettes work without a normal map.
function shoreRocks(){
  const positions:number[]=[],uv:number[]=[],colors:number[]=[],indices:number[]=[];
  const ink=new Color();let seed=103;
  function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
  function vertex(p:Point,tint:string,shade:number,u:number,v:number){
    const i=positions.length/3;positions.push(...p);uv.push(u,v);
    ink.set(tint).multiplyScalar(shade);colors.push(ink.r,ink.g,ink.b);return i;
  }
  function crag(x:number,z:number,rx:number,rz:number,h:number,phase:number){
    const n=36,rings:Point[][]=Array.from({length:8},()=>[]);
    for(let i=0;i<n;i++){
      const a=i*2*Math.PI/n,dx=Math.cos(a),dz=Math.sin(a);
      const ledge=.95+.10*Math.sin(3*a+phase)+.05*Math.sin(7*a-phase)+.04*random();
      // Two separate shoulders with a narrow notch between them; the toe
      // on the eastern end runs out into the water rather than forming a dome.
      const crest=h*(.55-.24*dx+.20*Math.sin(3*a+phase)+.12*Math.sin(6*a)+.10*random());
      const dip=.16*h*dx+.13*Math.sin(2*a+phase);
      const lip=.05+.02*random();
      const sections=[
        [1.21,-1.12],[1.10,-.28+.05*Math.sin(3*a)],[.96,-.11+lip],
        [1.02,.10+lip],[.94,.20+crest*.22+dip*.24],[.96,.27+crest*.22+dip*.24],
        [.88,.17+crest],[.73,.24+crest],
      ];
      sections.forEach(([r,y],k)=>rings[k].push([x+rx*dx*r*ledge,y,z+rz*dz*r*ledge]));
    }
    // Project the photographed strata continuously around each outcrop.
    const seam=[phase];for(let i=0;i<n;i++){
      const a=rings[5][i],b=rings[5][(i+1)%n];seam.push(seam[i]+Math.hypot(a[0]-b[0],a[2]-b[2])/5.2);
    }
    const palette=['#71918b','#95a49a','#b1b9aa','#fff8e5','#fffaf0','#f4eee3','#a7b193'];
    for(let k=0;k<palette.length;k++)for(let i=0;i<n;i++){
      const j=(i+1)%n,u=seam[i],v=seam[i+1];
      const l=rings[k][i],r=rings[k][j],topL=rings[k+1][i],topR=rings[k+1][j];
      const shade=.88+.085*Math.sin(i*1.7+phase)+random()*.075;
      const a=vertex(l,palette[k],shade,u,l[1]/5.2+phase),b=vertex(topL,palette[k],shade,u,topL[1]/5.2+phase);
      const c=vertex(r,palette[k],shade,v,r[1]/5.2+phase),d=vertex(topR,palette[k],shade,v,topR[1]/5.2+phase);
      indices.push(a,b,c,c,b,d);
    }
    const turf=rings.at(-1)!,centre:Point=[x-rx*.24,h*1.03,z+rz*.08];
    for(let i=0;i<n;i++){
      const pts=[turf[(i+1)%n],turf[i],centre],shade=.80+.13*random();
      indices.push(...pts.map(p=>vertex(p,'#a2b394',shade,p[0]/5.2,p[2]/5.2)));
    }
  }
  for(const [x,z,rx,rz,h,phase] of [[-22,-24,10,4.9,4.3,.2],[6,-37,6.6,1.8,2.15,1.7],[20,-35,4.8,2.4,3.35,3.1],[30,-27,3.4,1.45,1.8,4.2]]){
    crag(x,z,rx,rz,h,phase);
    for(const side of [-1,1])crag(x+side*rx*.95,z+rz*.42,rx*.32,rz*.54,h*.30,phase+side);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('uv',new Float32BufferAttribute(uv,2));
  g.setAttribute('color',new Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

export function Headlands(){const geometry=useMemo(shoreRocks,[]);
  const stone=useBakedSurface('/scenery/terminus/harbour-cliff.webp'),normal=useBakedSurface('/scenery/terminus/harbour-cliff-normal.webp','data');
  useLayoutEffect(()=>{for(const tex of [stone,normal])if(tex){tex.wrapS=tex.wrapT=RepeatWrapping;tex.needsUpdate=true;}},[stone,normal]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry} name="terminus:headlands" raycast={noPick} userData={{playerCollision:false}}>
    <meshStandardMaterial key={stone&&normal?'rock':'base'} map={stone&&normal?stone:null} normalMap={stone&&normal?normal:null} normalScale={[.8,.8]} vertexColors roughness={.91}/></mesh>;
}
