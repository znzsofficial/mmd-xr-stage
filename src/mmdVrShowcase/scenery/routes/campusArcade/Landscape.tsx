import {useEffect,useMemo} from 'react';
import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import type {SceneryId} from '../../catalog';
import {noPick} from '../../sceneryPaint';
import {EAST as E} from './site';

type V=[number,number,number];
// Sections surveyed across the drainage park, not another walking floor.
// The north boundary climbs into the planted railway bank; the south margin
// curls around the old lido basin and sinks below the sunken arcade courtyard.
function grounds(room:SceneryId){
  const xyz:number[]=[],rgb:number[]=[],idx:number[]=[],tint=new Color();
  function face(pts:V[],ink:string){const n=xyz.length/3;tint.set(ink);for(const p of pts){xyz.push(...p);rgb.push(tint.r,tint.g,tint.b);}for(let i=1;i+1<pts.length;i++)idx.push(n,n+i,n+i+1);}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,c:string){
    const a=x-w/2,b=x+w/2,l=z-d/2,r=z+d/2,t=y+h;
    face([[a,t,l],[a,t,r],[b,t,r],[b,t,l]],c);face([[a,y,l],[a,y,r],[a,t,r],[a,t,l]],c);face([[b,t,l],[b,t,r],[b,y,r],[b,y,l]],c);
    face([[a,t,l],[b,t,l],[b,y,l],[a,y,l]],c);face([[a,y,r],[b,y,r],[b,t,r],[a,t,r]],c);
  }
  function tree(x:number,y:number,z:number,h:number,i:number,narrow=false){
    const radius=h*(narrow?.17:.32),seed=i*3.81,trunk=h*.12;
    box(x,y-.32,z,trunk*.48,h*.83,trunk*.56,'#837b63');
    // Shift the crown centres towards the light and taper the smaller top.
    const rings:V[][]=[],count=8;
    for(const [level,scale] of [[.36,.30],[.55,.91],[.77,1],[.94,.70],[1.04,.14]]){
      const cx=x+.12*h*(level-.52),cz=z+.04*h*Math.sin(seed);
      rings.push(Array.from({length:count},(_,j)=>{const a=j*Math.PI/4+seed,r=radius*scale*(.94+.10*Math.sin(j*5+seed));return [cx+r*Math.cos(a),y+level*h+.07*h*Math.sin(a)*scale,cz+r*Math.sin(a)] as V;}));
    }
    const tones=i%3===0?['#768569','#85946e','#94a178','#a2ac85']:i%3===1?['#687e70','#79907b','#88a087','#9bae8c']:['#818355','#93945f','#a2a66c','#b2b47e'];
    for(let k=0;k<4;k++)for(let j=0;j<count;j++){const n=(j+1)%count;face([rings[k][j],rings[k+1][j],rings[k+1][n],rings[k][n]],tones[Math.min(3,k+(j%4===0?1:0))]);}
    face(rings[4].slice().reverse(),tones[3]);
  }
  if(room!=='lawn'){
    const xs=[-57,-38,-26,-18,-7,0,5,12,19,26,33,40,49,61];
    const zs=[-78,-64,-57,-51,-47,-43,-40,-37,-31,-25,-19,-13];
    const colors=['#859178','#8b9b83','#94a482','#91a17e','#9cad87','#91a27e','#8a9c79','#92a780','#99ad86','#93a37f','#909e7d'];
    const row=(i:number,j:number):V=>{
      const x=xs[i],wave=Math.sin(i*1.93),z=zs[j]+(j<3?2.5:j>8?1.8:.52)*wave;
      const h=[4.5,3.85,2.13,.64,.04,-.29,-.43,-.38,-.25,-.53,-.91,-1.24][j];
      const pool=x<2&&z> -47&&z< -22;return [x,pool?Math.min(-.55,h):h+wave*(j<4?.42:.04),z];
    };
    for(let i=0;i+1<xs.length;i++)for(let j=0;j+1<zs.length;j++)face([row(i,j),row(i,j+1),row(i+1,j+1),row(i+1,j)],colors[j]);
    // A long, blue-green polishing pond and gravel reed beds against the
    // north bank announce the swimming club before its real lap pool appears.
    const z=E.z-5.25;
    box(17.1,-.25,z,20.6,.40,4.76,'#9a9982');box(17.1,.143,z,20.0,.045,4.28,'#629a99');
    for(const dz of [-2.36,2.36])box(17.1,.15,z+dz,20.76,.13,.21,'#c3b79c');
    for(const dx of [-10.22,10.22])box(17.1+dx,.15,z,.20,.13,4.63,'#c3b79c');
    for(let i=0;i<6;i++)box(8.45+i*3.42,.188,z-1.61,.055,.014,.76,'#a1beb0');
    for(const [u,v,w] of [[12.2,-.9,6.8],[22.5,-1.05,7.6],[24.8,1.4,2.7]]){
      box(u,.189,z+v,w,.04,.72,'#b5aa88');
      for(let j=0;j<w*8;j++){
        const xx=u-w/2+(j+.4)/8,zz=z+v+.32*Math.sin(j*7.8),h=.32+.29*Math.abs(Math.sin(j*1.68));
        for(let k=0;k<3;k++){
          const a=j*1.7+k*2.09,dx=.11*Math.sin(a),dz=.11*Math.cos(a);
          face([[xx-.028,.225,zz-.012],[xx+dx,.225+h,zz+dz],[xx+.028,.225,zz+.012]],k===0?'#a29159':'#77865e');
        }
      }
    }
    // Low pump house, reading window, bevelled two-pitch roof and one tall
    // steel intake riser, set to the side of the bridge not across its view.
    box(8.65,-.13,z-4.04,4.17,1.77,2.01,'#bfa780');box(8.65,.24,z-3.026,3.70,.16,.05,'#497b78');
    for(let i=0;i<5;i++){box(7.25+i*.70,.77,z-3.018,.57,.63,.08,'#527674');box(7.25+i*.70,1.20,z-2.967,.51,.041,.044,'#afa891');}
    for(const s of [-1,1]){const zz=z-4.04+s*1.22;const plate:V[]=[[6.29,1.65,zz],[6.29,2.14,z-4.04],[11.01,2.14,z-4.04],[11.01,1.65,zz]];face(s===1?plate.slice().reverse():plate,'#6d8883');box(8.65,1.57,zz,4.8,.1,.09,'#70817c');}
    box(11.86,-.1,z-3.68,.20,2.79,.20,'#759087');box(11.86,2.60,z-3.68,.45,.11,.46,'#bec1ad');
    for(let j=0;j<20;j++){const x=-32+j*4.23,zz=-55.6+.97*Math.cos(j*.86);tree(x,1.15,zz,3.6+.69*Math.sin(j*1.35),j,true);}
    for(const [i,x,zz,h] of [[1,5,-49.54,4.6],[2,14.66,-50.98,3.91],[3,20.9,-49.69,3.45],[4,28.7,-50.80,5.4],[5,36.9,-48.5,4.67],[6,21.5,-29.5,4.41],[7,15.8,-32.6,3.84],[8,8.8,-29.75,4.96],[9,29.6,-33.2,3.73]])tree(x,zz< -47?.30:-.40,zz,h,i);
    if(room==='arcadeHall')for(let i=0;i<9;i++)tree(-26.4+1.4*Math.sin(i*2.3),-.59,-49.2+i*3.96,4.0+1.16*Math.cos(i*.86),i);
  }
  if(room==='lawn'){
    // The print courtyards adjoin the old brick forecourt. Carry a low grass
    // berm beyond the end wall, with a corten seat-height edging and trees.
    for(let i=0;i<5;i++){
      const z=-3.65+i*3.43;face([[49.9,-.21,z],[49.9,-.21,z+3.43],[55,.28,z+3.43],[55,.28,z]],'#96a27c');
      face([[55,.28,z],[55,.28,z+3.43],[62,.13,z+3.43],[62,.13,z]],'#94a179');
    }
    for(const [i,x,z,h] of [[3,52.4,4.49,4.3],[1,56.7,.85,5.05],[2,53.8,-3.44,3.85],[4,55.3,9.61,4.57]])tree(x,.19,z,h,i);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(xyz,3));g.setAttribute('color',new Float32BufferAttribute(rgb,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
export function CampusLandscape({room}:{room:SceneryId}){
  const g=useMemo(()=>grounds(room),[room]);useEffect(()=>()=>g.dispose(),[g]);
  return <mesh geometry={g} receiveShadow raycast={noPick} userData={{playerCollision:false}} name="campus:reed-filter-and-planted-banks"><meshStandardMaterial vertexColors roughness={.96}/></mesh>;
}
