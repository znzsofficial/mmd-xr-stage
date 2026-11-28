import { EAST as E, heightAt, routeSurfaces, timingBoards, type Surface } from './site';

// Vertically extruded profiles: every panel, beam, railing and inclined slab
// has the same top surface in the render mesh, the motor and the sight test.
export type Piece=Surface & {thick:number;ink:string};
export const bodies:Piece[]=[],finishes:Piece[]=[];
const blue='#38686c', iron='#53635e';
function form(list:Piece[],id:string,l:number,r:number,b:number,f:number,y:number,h:number,ink:string,sx=0,sz=0){
  list.push({id,l,r,b,f,y,thick:h,ink,sx,sz});
}
const bridge=(id:string,x:number,lo:number,z:number,w:number,h:number,d:number,ink:string)=>form(bodies,id,x-w/2,x+w/2,z-d/2,z+d/2,lo+h,h,ink);

for(const s of routeSurfaces){
  bodies.push({...s,thick:.21,ink:s.id==='split-landing'||s.id==='turntable'?'#c7ab82':'#bac2b3'});
  function face(l:number,r:number,b:number,f:number,dy:number,t:number,ink:string,hard=false){form(hard?bodies:finishes,s.id+'-trim',l,r,b,f,heightAt(s,l,b)+dy,t,ink,s.sx,s.sz);}
  const alongZ=s.id==='north-flight'||s.id==='gallery-neck',acrossX=s.id.endsWith('flight')&&!alongZ;
  if(alongZ||acrossX){
    for(const edge of (alongZ?[s.l+.055,s.r-.055]:[s.b+.055,s.f-.055])){
      const l=alongZ?edge-.038:s.l,r=alongZ?edge+.038:s.r,b=alongZ?s.b:edge-.038,f=alongZ?s.f:edge+.038;
      face(l,r,b,f,.09,.12,blue,true);face(l,r,b,f,1.01,.066,iron,true);face(l,r,b,f,.49,.032,'#899c91',true);
      const n=Math.ceil((alongZ?s.f-s.b:s.r-s.l)/1.6);
      for(let i=0;i<n;i++){
        const x=alongZ?edge:s.l+(i+.18)*(s.r-s.l)/n,z=alongZ?s.b+(i+.18)*(s.f-s.b)/n:edge;
        bridge('upright',x,heightAt(s,x,z),z,.047,.99,.047,blue);
      }
    }
    for(let at=(alongZ?s.b:s.l)+.62;at<(alongZ?s.f:s.r)-.12;at+=1.04){
      face(alongZ?s.l+.14:at,alongZ?s.r-.14:at+.016,alongZ?at:s.b+.14,alongZ?at+.016:s.f-.14,.005,.014,'#87978b');
    }
    if(s.id!=='gallery-neck'){
      const n=Math.ceil((alongZ?s.f-s.b:s.r-s.l)/4.4);
      for(let i=0;i<n;i++){const x=alongZ?(s.l+s.r)/2:s.l+(i+.60)*(s.r-s.l)/n,z=alongZ?s.b+(i+.60)*(s.f-s.b)/n:(s.b+s.f)/2;
        const top=heightAt(s,x,z)-.18;
        if(top>0){bridge('pier',x,-.25,z,alongZ?1.43:.31,top+.25,alongZ?.31:1.43,'#8d9b92');bridge('pier-cap',x,top-.22,z,alongZ?2.39:.42,.21,alongZ?.42:2.39,'#637d77');}}
    }
  }else if(s.id==='turntable'||s.id==='split-landing'){
    const edge=(l:number,r:number,b:number,f:number)=>{
      if(l>=r||b>=f)return;face(l,r,b,f,1.01,.065,iron,true);face(l,r,b,f,.48,.038,blue,true);
      for(const [x,z] of [[l+.025,b+.025],[r-.025,f-.025],[(l+r)/2,(b+f)/2]])bridge('turn-post',x,s.y,z,.052,1,.052,blue);
    };
    edge(s.l,s.r,s.b,s.b+.07);
    if(s.id==='turntable'){edge(s.r-.07,s.r,s.b+.07,s.f);edge(E.x+E.half,s.r,s.f-.07,s.f);}
    else {edge(s.l,s.r,s.f-.07,s.f);edge(s.l,s.l+.07,s.b,s.b+.84);edge(s.r-.07,s.r,s.b,s.b+.84);}
    for(let x=s.l+.3;x<s.r;x+=.3)face(x,x+.010,s.b+.08,s.f-.08,.005,.012,'#93816a');
  }else if(s.id==='finish-apron'){
    for(let x=s.l+.45;x<s.r;x+=.48){face(x,x+.018,s.b,s.f,.004,.011,'#a8ae9a');face(x+.04,Math.min(s.r,x+.41),s.f-.19,s.f-.08,.006,.012,blue);}
  }
}

// Timing-deck approach: a bank beneath the steel and two lane-split boards
// make the return direction readable against the long, shallow gradient.
for(const [x,y,z] of timingBoards){
  bridge('split-board',x,y+1.04,z,.17,.87,1.20,blue);
  for(const dz of [-.44,.44])bridge('board-leg',x,y,z+dz,.069,1.05,.065,iron);
}
