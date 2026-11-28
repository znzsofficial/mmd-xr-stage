import {BufferGeometry,Color,Float32BufferAttribute} from 'three';
import {ROOM} from '../ClassroomLayout';
import {LIDO_ENTRY,POOL} from '../LidoLayout';
import {cityGreenDeck} from './green';
import {arcadeVestibule,CITY_ORIGINS,cityPavements,type CityVenue} from './site';
import {besideSchoolWalk} from './brickMargin';

export type StreetRoom=CityVenue|'seasideTerminus';
export function venueOnStreet(room:StreetRoom,venue:CityVenue){
  return room==='seasideTerminus'||room===venue||room==='clinic'&&venue==='classroom'||room==='classroom'&&(venue==='arcadeHall'||venue==='clinic');
}
type Bounds={l:number;r:number;b:number;f:number};
const area=(l:number,r:number,b:number,f:number):Bounds=>({l,r,b,f});
const contains=(r:Bounds,x:number,z:number)=>x>=r.l&&x<=r.r&&z>=r.b&&z<=r.f;
function bounds({x,z,w,d}:{x:number;z:number;w:number;d:number},ox=0,oz=0){
  return area(ox+x-w/2,ox+x+w/2,oz+z-d/2,oz+z+d/2);
}

// A doorway sees just its city block. Do not build a second distant basin,
// rail cutting or west gallery behind the active room.
export const returnViews:Record<StreetRoom,Bounds>={
  seasideTerminus:area(-65,76,38,120),clinic:area(7.5,60,38.8,79),
  classroom:area(-56,61,32,100),pool:area(-55,3,70,106),arcadeHall:area(-3,60,80,106),
};
export const inReturnView=(room:StreetRoom,x:number,z:number,pad=0)=>{
  const r=returnViews[room];return x>=r.l-pad&&x<=r.r+pad&&z>=r.b-pad&&z<=r.f+pad;
};

class Surface {
  private positions:number[]=[];
  private colors:number[]=[];
  private uv:number[]=[];
  private index:number[]=[];
  private ink=new Color();
  face(points:number[][],color:string){
    const first=this.positions.length/3;this.ink.set(color);
    for(const [x,y,z] of points){
      this.positions.push(x,y,z);this.uv.push(x/3.68,z/3.68);
      this.colors.push(this.ink.r,this.ink.g,this.ink.b);
    }
    for(let i=1;i<points.length-1;i++)this.index.push(first,first+i,first+i+1);
  }
  finish(){
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(this.positions,3));
    g.setAttribute('color',new Float32BufferAttribute(this.colors,3));g.setAttribute('uv',new Float32BufferAttribute(this.uv,2));
    g.setIndex(this.index);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
}

export function buildStreetGround(room:StreetRoom){
  const view=returnViews[room],paving=new Surface(),earth=new Surface();
  const {clinic:c,classroom:s,pool:p,arcadeHall:a}=CITY_ORIGINS;
  const street=[...cityPavements,arcadeVestibule].map(q=>({...bounds(q),id:q.id,y:q.y}));
  // Original threshold/deck tops stay in their owning facades and full rooms.
  // Terminate the new stone precisely where the original finished floor begins.
  const schoolVisible=venueOnStreet(room,'classroom');
  const cut=[bounds(cityGreenDeck)];
  if(venueOnStreet(room,'clinic'))cut.push(room==='clinic'?area(c.x-8.6,c.x+8.6,c.z-9,c.z+4.8):area(c.x-8.65,c.x+8.65,c.z-9.05,c.z+4.85));
  if(schoolVisible)cut.push(area(s.x-ROOM.w/2,s.x+ROOM.w/2,s.z-ROOM.d/2,s.z+ROOM.d/2));
  if(venueOnStreet(room,'pool'))cut.push(bounds(POOL.deck,p.x,p.z),bounds(LIDO_ENTRY,p.x,p.z));
  if(venueOnStreet(room,'arcadeHall'))cut.push(area(a.x-15,a.x+13,a.z-6,a.z+13));
  // Carts use the narrower dark carriageway; the stone walks meet its flush
  // gutter. The lanes terminate at the goods depot and the far loading court.
  const lanes=[area(23.96,27.02,46.6,56.6),area(-11.5,53.5,60.42,63.02),
    area(-4.42,-1.19,60.42,88.65),area(-47.4,54.1,89.02,92.32),area(-45.65,-42.2,40.1,96.6),
    area(52.0,55.15,41.1,94),area(-50.2,55.15,99.1,102.3)];
  // One top triangle pair per cell, regardless of how many routes meet there.
  // Only exposed outer boundaries get a kerb; no stripes bisect a T junction.
  const grid=(axis:'x'|'z')=>{
    const lo=axis==='x'?'l':'b',hi=axis==='x'?'r':'f';
    const points=[view[lo],view[hi]];
    for(const item of [...cut,...lanes,...street])points.push(item[lo],item[hi]);
    for(const item of street)points.push(item[lo]+.14,item[hi]-.14);
    return [...new Set(points.map(v=>Math.round(v*1e5)/1e5))].filter(v=>v>=view[lo]&&v<=view[hi]).sort((a,b)=>a-b);
  };
  const xs=grid('x'),zs=grid('z');
  const pavedAt=(x:number,z:number)=>street.some(q=>contains(q,x,z));
  for(let j=1;j<zs.length;j++)for(let i=1;i<xs.length;i++){
    const l=xs[i-1],r=xs[i],b=zs[j-1],f=zs[j],x=(l+r)/2,z=(b+f)/2;
    if(cut.some(q=>contains(q,x,z)))continue;
    const st=street.find(q=>contains(q,x,z));
    const patch=(surface:Surface,y:number,tint:string)=>{
      for(const poly of besideSchoolWalk(l,r,b,f,schoolVisible))surface.face(poly.map(([x,z])=>[x,y,z]),tint);
    };
    if(st){
      const edge=(x<st.l+.14&&!pavedAt(st.l-.002,z))||(x>st.r-.14&&!pavedAt(st.r+.002,z))||
        (z<st.b+.14&&!pavedAt(x,st.b-.002))||(z>st.f-.14&&!pavedAt(x,st.f+.002));
      const tint=edge?'#aab6a9':st.id==='sports-street'?'#e8dac4':st.id==='inland-street'?'#e0ddd0':'#faf4df';
      patch(paving,st.y,tint);
    }else{
      const road=lanes.some(q=>contains(q,x,z));
      // The raised fill meets the original park embankment (top -.015) and
      // stays dry at the highest tide (-.06). No grass platform under the pit.
      patch(earth,road?-.009:-.026,road?'#8a938d':'#aab19a');
    }
  }
  if(room==='seasideTerminus'){
    // Exposed retaining faces below the reclaimed city plots.
    const h=-.026,low=-2.16,{l,r,b,f}=view;
    for(const [x,z,xx,zz] of [[l,b,l,f],[l,f,r,f],[r,f,r,b],[r,b,l,b]])
      earth.face([[x,h,z],[x,low,z],[xx,low,zz],[xx,h,zz]],'#969c90');
  }
  return {paving:paving.finish(),earth:earth.finish()};
}
