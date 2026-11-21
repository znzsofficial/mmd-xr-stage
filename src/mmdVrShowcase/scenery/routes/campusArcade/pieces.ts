import { ARCADE_ORIGIN as A, EAST as E, WEST as W, heightAt, routeSurfaces, type Road, type Surface } from './site';

// Vertically extruded profiles: every panel, beam, railing and inclined slab
// has the same top surface in the render mesh, the motor and the sight test.
export type Piece=Surface & {thick:number;ink:string};
export const bodies:Piece[]=[],finishes:Piece[]=[];
const sand='#cfbd9d', joint='#a69780', brick='#ad775f', cream='#eddcbc', blue='#38686c', iron='#53635e', marigold='#d9a35e', timber='#b68c62';
function form(list:Piece[],road:Road,id:string,l:number,r:number,b:number,f:number,y:number,h:number,ink:string,sx=0,sz=0){
  list.push({road,id,l,r,b,f,y,thick:h,ink,sx,sz});
}
const box=(road:Road,id:string,x:number,lo:number,z:number,w:number,h:number,d:number,ink:string,skin=false)=>form(skin?finishes:bodies,road,id,x-w/2,x+w/2,z-d/2,z+d/2,lo+h,h,ink);
const street=(id:string,x:number,lo:number,z:number,w:number,h:number,d:number,ink:string,skin=false)=>box('street',id,x,lo,z,w,h,d,ink,skin);
const bridge=(id:string,x:number,lo:number,z:number,w:number,h:number,d:number,ink:string,skin=false)=>box('viaduct',id,x,lo,z,w,h,d,ink,skin);

for(const s of routeSurfaces){
  bodies.push({...s,thick:s.road==='street'?.17:.21,ink:s.road==='street'?sand:s.id==='split-landing'||s.id==='turntable'?'#c7ab82':'#bac2b3'});
  function face(l:number,r:number,b:number,f:number,dy:number,t:number,ink:string,hard=false){form(hard?bodies:finishes,s.road,s.id+'-trim',l,r,b,f,heightAt(s,l,b)+dy,t,ink,s.sx,s.sz);}
  if(s.road==='street'){
    // End-grain brick runners with flush stone joints; stay below the real
    // ray sheet (Y=.012), particularly on the section shared with the lawn.
    if(s.id==='garden-walk'){
      for(const edge of [s.b,s.f-.16])for(let x=s.l;x<s.r-.03;x+=.57)face(x,Math.min(x+.556,s.r),edge,edge+.16,.008,.012,((Math.floor(x*2)%5)===0)?marigold:brick);
      for(let x=s.l+.84;x<s.r;x+=1.12)face(x-.009,x+.009,s.b+.16,s.f-.16,.007,.010,joint);
      for(const z of [s.b+1.04,s.f-1.04])face(s.l,s.r,z-.007,z+.007,.006,.010,joint);
    }else {
      for(let z=s.b+.44;z<s.f;z+=.48)face(s.l,s.r,z,z+.014,.007,.010,joint);
      for(let x=s.l+.6;x<s.r-.01;x+=.60)face(x,x+.012,s.b,s.f,.006,.010,joint);
    }continue;
  }
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

// The student print exchange faces the park path. Two letterpress windows
// and a separate drying rack frame the widened court, not the walking lane.
for(const [x,w,h] of [[22,6.3,3.05],[34.1,9.0,3.76],[44,6.4,2.9]]){
  const face=x===34.1?6.66:5.31,z=face+1.84;
  street('print-shop',x,-.18,z,w,h+.18,3.68,x===34.1?'#a96956':'#c4a184');
  street('flashing',x,h-.11,z,w+.23,.20,3.9,blue,true);
  street('coping',x,h+.09,z,w+.31,.063,3.98,cream,true);
  street('plinth',x,.05,face-.06,w+.04,.40,.14,'#9a7967',true);
  const count=x===34.1?4:3;
  for(let i=0;i<count;i++){
    const u=x-w/2+(i+.5)*w/count;
    street('display',u,.58,face-.07,w/count-.19,1.60,.17,blue,true);
    street('display-glass',u,.75,face-.16,w/count-.35,1.30,.035,'#708d89',true);
    street('sill',u,.56,face-.14,w/count-.12,.085,.30,timber,true);
    street('transom',u,1.86,face-.18,w/count-.21,.043,.040,iron,true);
    street('awning',u,2.38,face-.365,w/count-.02,.08,.72,i%3===1?cream:blue,true);
    street('valance',u,2.23,face-.707,w/count-.02,.16,.05,i%3===1?cream:blue,true);
  }
}
// Courtyard furniture belongs to the physical inventory as well as the
// rendering. The same solid rejects a character foot or a ray through a seat.
for(const x of [30.8,37.2]){
  street('rack-seat',x,.40,5.63,1.27,.11,.48,timber);
  street('rack-back',x,.50,5.85,1.29,.34,.073,'#9c7c62');
  for(const s of [-1,1])street('rack-leg',x+.43*s,0,5.63,.07,.4,.38,blue);
}
// Narrow planted verge beyond the end of the meadow mesh. Visible beneath
// the horizon from the arcade turn, without turning the site into a giant pad.
street('street-verge',39.15,-.34,3.045,28.5,.27,10.89,'#8e9e76');
street('shop-back-verge',35,-.38,8.0,33,.26,4.95,'#929b71');
for(const [x,z] of [[15.8,4.83],[25.1,1.04],[40.5,1.04],[49.99,1.13]]){
  street('reading-light',x,-.12,z,.084,2.70,.09,blue);
  street('shade',x,2.48,z,.36,.16,.29,blue);street('opal',x,2.44,z,.30,.042,.23,'#f6e6bc',true);
}
// Timing-deck approach: a bank beneath the steel and two lane-split boards
// make the return direction readable against the long, shallow gradient.
for(const [x,y,z] of [[A.x-22.3,1.08,E.z-1.73],[E.x+1.67,2.05,E.z-.36]]){
  bridge('split-board',x,y+1.04,z,.17,.87,1.20,blue);
  for(const dz of [-.44,.44])bridge('board-leg',x,y,z+dz,.069,1.05,.065,iron);
}
// Low outside border at the turn, away from the west portal's approach.
street('return-wall',W.x+1.87,-.14,1.0,.46,.63,5.62,'#af7964');
street('return-cap',W.x+1.87,.49,1.0,.49,.066,5.69,'#d7b68d');
