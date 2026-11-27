import {useMemo,useEffect} from 'react';
import {BufferGeometry,Color,DoubleSide,Float32BufferAttribute} from 'three';
import {noPick} from '../sceneryPaint';

// Three headlands rise out of the sea in bands of dark footing, fractured
// ochre cliffs and swept turf. All headlands share one vertex-coloured mesh.
function shoreRocks(){const p:number[]=[],col:number[]=[],ink=new Color();let seed=103;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  type V=[number,number,number];const tri=(a:V,b:V,c:V,tint:string,shade:number)=>{p.push(...a,...b,...c);ink.set(tint).multiplyScalar(shade);for(let i=0;i<3;i++)col.push(ink.r,ink.g,ink.b);};
  for(const [x,z,rx,rz,h] of [[-22,-24,10,5,3.8],[6,-37,6,.98,1.9],[20,-35,4.8,1.65,2.5],[30,-27,3.4,1.45,1.3]]){
    const n=32,rings:V[][]=[[],[],[],[],[]];for(let i=0;i<n;i++){const a=i/n*2*Math.PI,r=.89+.15*Math.sin(3*a+.3)+.06*Math.sin(7*a)+.08*rand();const relief=.72+.18*Math.sin(2*a)+rand()*.17;
      for(const [k,s,y] of [[0,1.23,-1.05],[1,1.04,-.15+rand()*.18],[2,.94,h*.61*relief],[3,.84,h*relief],[4,.53,h*(relief+.11)]])rings[k].push([x+rx*s*r*Math.cos(a),y,z+rz*s*r*Math.sin(a)]);}
    for(let k=0;k<4;k++)for(let i=0;i<n;i++){const j=(i+1)%n,roof=k===3,clr=['#536c69','#9c9782','#b5ac8b','#7e977d'][k],lit=.78+.18*Math.sin(i/n*2*Math.PI-1)+.09*rand();
      tri(rings[k][i],rings[k+1][i],rings[k][j],clr,lit);tri(rings[k+1][i],rings[k+1][j],rings[k][j],clr,roof?lit:lit*.96);}
    for(let i=0;i<n;i++)tri(rings[4][(i+1)%n],rings[4][i],[x,h*1.095,z],'#859b7b',.87+rand()*.09);
  }const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(p,3));g.setAttribute('color',new Float32BufferAttribute(col,3));g.computeVertexNormals();return g;}
export function Headlands(){const g=useMemo(shoreRocks,[]);useEffect(()=>()=>g.dispose(),[g]);return <mesh geometry={g} name="terminus:headlands" raycast={noPick} userData={{playerCollision:false}}><meshStandardMaterial vertexColors flatShading side={DoubleSide} roughness={.95}/></mesh>;}
