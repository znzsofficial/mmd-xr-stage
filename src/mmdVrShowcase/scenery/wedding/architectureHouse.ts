import {A,COUPLET_LEFT,COUPLET_RIGHT,Skin,type V} from './architectureMesh';
import {Frame,paperWindow,ringPull} from './architectureJoinery';
import {fireGable,tiledRoof} from './architectureRoofs';
import {surroundingLane} from './architectureLane';
import {BED,CUP_TABLE,TRUNK} from './bridalLayout';
import {WEDDING_ANCHORS,WEDDING_COLUMNS,WEDDING_DOORS,WEDDING_FLOORS,WEDDING_HALL_FRONT,WEDDING_HEADERS,WEDDING_LEAVES,WEDDING_SCREENS,WEDDING_WALLS,type WeddingRect} from './weddingLayout';

const gate=WEDDING_DOORS.gate,room=WEDDING_FLOORS.dressing,court=WEDDING_FLOORS.court,front=WEDDING_HALL_FRONT;
const north=court.z-court.d/2, south=court.z+court.d/2, hallMid=(north+front)/2;
type Solid=typeof WEDDING_WALLS[number];
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
// Sky loss is symmetric about a recess: no sun direction or projected shadow.
const gateTop=WEDDING_HEADERS.find(r=>r.id==='gateHead')!.top;
function gateReveal([x,y,z]:V,slot:number):[number,number]{
  const dx=Math.abs(x-gate.x),dz=Math.abs(z-gate.z);
  const inBay=1-smooth((dx-gate.width/2-.27)/.34);
  const soffit=(1-smooth((dz-.19)/.68))*inBay;
  const upper=smooth((y-gate.head+.46)/.71)*(1-smooth((y-gateTop-.16)/.21));
  const jamb=(1-smooth((Math.abs(dx-gate.width/2)-.10)/.28))*(1-smooth(dz/1.58));
  const coping=(1-inBay)*(1-smooth(dz/.35))*smooth((y-2.31)/.28)*(1-smooth((y-2.61)/.12));
  const collar=(1-smooth(Math.abs(y-.619)/.16))*(1-inBay)*(1-smooth(dz/.3));
  const shade=Math.max(.57*soffit*upper,.39*jamb*(.39+.61*upper),.47*coping,.20*collar);
  return [1,1-shade*(slot===A.gate?.4:1)];
}
function gateFloorReveal([x,,z]:V,_slot:number,k:number):[number,number]{
  const dx=Math.abs(x-gate.x),dz=Math.abs(z-gate.z);
  const span=(1-smooth((dx-gate.width/2-.3)/.52))*(1-smooth((dz-.55)/1.05));
  // Transfer the existing vertex contact OUT of base colour around the jambs.
  return [k+(1-k)*span,1-span*(1-k+.25*(1-smooth(dz/1.05)))];
}
const vanityBack=WEDDING_WALLS.find(r=>r.id==='dressingBack')!;
const vanityLight={u:-1.05,w:1.00,b:1.25,h:1.08};
/** Centre of the dressing-room paper, 1.5 mm in front of its +Z surface.
 * The paper is recessed; the window's real projecting muntins stay in front. */
export const WEDDING_WINDOW_PAPER={x:vanityBack.x+vanityLight.u,y:vanityLight.b+vanityLight.h/2,z:vanityBack.z+.012+.0015};

function paving(g:Skin,r:WeddingRect,slot:number,sx:number,sz:number,c:string,shade:(p:V)=>number){
  const nx=Math.max(1,Math.round(r.w/sx)),nz=Math.max(1,Math.round(r.d/sz));
  const n=4,point=(u:number,v:number):V=>[r.x+r.w*(u-.5),0,r.z+r.d*(.5-v)];
  for(let row=0;row<nz;row++)for(let col=0;col<nx;col++)for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const a=i/n,b=(i+1)/n,k=j/n,l=(j+1)/n;
    const p=(s:number,t:number)=>point((col+s)/nx,(row+t)/nz);
    g.face([p(a,k),p(b,k),p(b,l),p(a,l)],slot,c,[[a,k],[b,k],[b,l],[a,l]],shade);
  }
}

function floors(g:Skin){
  // Low-frequency, daylight-independent occlusion (also available on Quest
  // with shadow maps off). Cast shadows and the directional sun stay separate.
  const boxes=[...WEDDING_COLUMNS,...WEDDING_LEAVES,...WEDDING_SCREENS,...WEDDING_WALLS];
  const objects=[WEDDING_ANCHORS.altar,...WEDDING_ANCHORS.chairs,WEDDING_ANCHORS.vanity,...WEDDING_ANCHORS.feasts,WEDDING_ANCHORS.sedan];
  const shade=([x,,z]:V)=>{
    let dark=0;for(const r of boxes){const a=Math.max(0,Math.abs(x-r.x)-r.w/2),b=Math.max(0,Math.abs(z-r.z)-r.d/2);dark=Math.max(dark,.37*Math.exp(-Math.hypot(a,b)*5));}
    for(const r of objects){const a=(x-r.x)/(r.w*.49),b=(z-r.z)/(r.d*.49);dark=Math.max(dark,.31*Math.exp(-(a*a+b*b)*1.55));}
    const house=clamp((front+.48-z)/1.0)*clamp((5.84-Math.abs(x))/.2);
    const gallery=clamp((Math.abs(x)-4.55)/.94)*clamp((south+.18-z)/.54)*clamp((5.91-Math.abs(x))/.14);
    return 1-Math.min(.49,dark+Math.max(.12*house,.14*gallery));
  };
  paving(g,WEDDING_FLOORS.lane,A.paving,2.0,1.7,'#dedac9',shade);
  paving(g,{x:court.x,z:(front+south)/2,w:court.w,d:south-front},A.paving,1.75,1.5,'#ece5d5',shade);
  paving(g,{x:court.x,z:hallMid,w:court.w,d:front-north},A.hallFloor,1.62,1.60,'#f7ece2',shade);
  paving(g,room,A.boards,2.6,1.15,'#f1ded0',shade);
  // Level threshold stone and narrow drainage courses emphasize the walk, with
  // no sill crossing the lane or height change through either open doorway.
  g.block(gate.x,-.014,gate.z,gate.width,.044,.34,A.granite,'#c9c5b2');
  const side=WEDDING_DOORS.dressing;g.block(side.x,-.014,side.z,.30,.044,side.width,A.granite,'#c4b9a7');
  for(const x of [-4.57,4.57])g.block(x,-.016,(front+south)/2,.13,.045,south-front,A.brick,'#b5b2a8',1,1);
  g.block(0,-.018,front,court.w,.044,.20,A.granite,'#c3c0b3');
}

type Opening={u:number;w:number;b:number;h:number};
function wall(g:Skin,r:Solid){
  const side=r.d>r.w,f=new Frame(g,r.x,r.z,side),len=Math.max(r.w,r.d),d=Math.min(r.w,r.d),lo=r.bottom,hi=r.top;
  const panels:Opening[]=[];
  const add=(u:number,w:number,b:number,h:number)=>panels.push({u,w,b,h});
  if(r.id==='hallBack')for(const sign of [-1,1])add(sign*len*.325,1.72,1.04,1.38);
  if(r.id==='hallWest')add(0,2.27,.91,1.52);
  if(r.id==='courtWest'||r.id==='courtEast')for(const s of [-1,0,1])add(s*len*.315,1.42,1.02,1.03);
  if(r.id==='dressingEast')add(0,1.20,1.07,1.20);
  if(r.id==='bridalEast'||r.id==='bridalSouth')for(const s of [-1,1]) add(s*len*.24,1.65,1.01,1.37);
  if(r.id==='bridalNorth')for(const s of [-1,1]) add(s*2.67,1.14,1.22,1.17);
  if(r.id==='dressingSouth')add(0,1.66,1.10,1.24);
  if(r.id==='dressingBack')panels.push(vanityLight);
  if(r.id==='gateEast'||r.id==='gateWest')add((r.id==='gateEast'?1:-1)*.47,1.04,1.24,.81);
  const piece=(u:number,y:number,w:number,h:number,slot:number,c:string,depth=d)=>{if(w>.001&&h>.001)f.box(u,y+h/2,0,w,h,depth,slot,c,slot===A.brick?1.11:1.62,slot===A.brick?.81:1.4);};
  piece(0,lo,len,.19,A.granite,'#a7a69b',d+.047);piece(0,lo+.19,len,.37,A.brick,'#d6dacd',d+.026);
  piece(0,lo+.56,len,.061,A.granite,'#d8d7c5',d+.048);
  const base=lo+.621;let l=-len/2;
  for(const p of panels.sort((a,b)=>a.u-b.u)){
    const left=p.u-p.w/2;
    piece((l+left)/2,base,left-l,hi-base,A.lime,'#ffffff');piece(p.u,base,p.w,p.b-base,A.lime,'#ffffff');
    piece(p.u,p.b+p.h,p.w,hi-p.b-p.h,A.lime,'#ffffff');paperWindow(f,p.u,p.b,p.w,p.h,d,r.id!=='courtWest'&&r.id!=='courtEast');l=p.u+p.w/2;
  }
  piece((l+len/2)/2,base,len/2-l,hi-base,A.lime,'#ffffff');
  // Tiled coping on the low walls beside the gate; the central lintel sits
  // higher and gets its own projecting, four-slope roof.
  if(r.id==='gateWest'||r.id==='gateEast')tiledRoof(g,{x:r.x,z:r.z,hw:len/2+.02,hd:.257,eave:hi+.035,rise:.13,lift:.032,detail:false});
}

function openings(gateSkin:Skin,dressingSkin:Skin){
  for(const h of WEDDING_HEADERS){
    const isGate=h.id==='gateHead',f=new Frame(isGate?gateSkin:dressingSkin,h.x,h.z,!isGate),w=Math.max(h.w,h.d),d=Math.min(h.w,h.d);
    f.box(0,(h.bottom+h.top)/2,0,w,h.top-h.bottom,d,isGate?A.brick:A.wood,'#eee9d9',1.1,.84);
    for(const s of [-1,1]){
      f.box(0,h.bottom+.041,s*(d/2+.013),w+.26,.082,.087,isGate?A.granite:A.wood,'#c5bcab');
      f.box(0,h.top-.038,s*(d/2+.012),w+.30,.074,.081,A.granite,'#d3cebc');
      if(isGate){
        f.panel(0,h.bottom+.105,s*(d/2+.032),1.90,.40,s,A.gate);
        for(const t of [-1,1])f.panel(t*(w*.422),h.bottom+.12,s*(d/2+.030),.66,.37,s,A.frieze);
      }
    }
  }
  for(const r of WEDDING_LEAVES){
    const side=r.d>r.w, f=new Frame(side?gateSkin:dressingSkin,r.x,r.z,side),w=Math.max(r.w,r.d),d=Math.min(r.w,r.d),isGate=side;
    const y=r.bottom+.025,h=r.top-y;
    f.box(0,y+h/2,0,w,h,isGate?d-.017:d,A.wood,isGate?'#976f5b':'#bba285');
    for(const s of [-1,1]){
      if(isGate){
        // Three profiles turn the red film over a real rounded arris. Keep
        // the fitted front at its witness plane beside the ring and hinges.
        const ring=(inset:number,depth:number)=>([[0,0],[1,0],[1,1],[0,1]] as const).map(([u,v])=>f.at(s*(2*u-1)*(w/2-inset),y+inset+v*(h-2*inset),s*depth));
        const profiles=[[0,d/2-.0085],[.0035,d/2-.002],[.009,d/2+.0015]];
        for(let k=1;k<profiles.length;k++){
          const a=ring(profiles[k-1][0],profiles[k-1][1]),b=ring(profiles[k][0],profiles[k][1]);
          const uv=(p:V):[number,number]=>[.5-s*(p[2]-r.z)/w,(p[1]-y)/h];
          for(let i=0;i<4;i++){const j=(i+1)%4;f.g.face([a[i],a[j],b[j],b[i]],A.lacquer,'#ffffff',[uv(a[i]),uv(a[j]),uv(b[j]),uv(b[i])]);}
        }
        f.panel(0,y+.009,s*(d/2+.0015),w-.018,h-.018,s,A.lacquer);
      }
      else{
        f.panel(0,y+.064,s*(d/2+.002),w-.10,h*.38,s,A.wood,'#c5a382');
        f.panel(0,y+h*.43,s*(d/2+.002),w-.10,h*.53,s,A.paper,'#e2d0ae');
        for(let j=-2;j<=2;j++)f.line(j*w*.15,y+h*.414,j*w*.15,y+h*.966,s*(d/2+.011),.027,.025,'#a58f75');
        for(const t of [.43,.54,.83,.96])f.line(-w*.48,y+t*h,w*.48,y+t*h,s*(d/2+.010),.025,.025,'#aa947a');
      }
      ringPull(f,w*.30,y+h*.41,s*(d/2+.012),s);
      for(const y0 of [.32,h-.34])f.box(-w*.42,y+y0,s*(d/2+.006),.17,.054,.020,A.granite,'#797260');
    }
  }
}

function screens(gateSkin:Skin,dressingSkin:Skin){
  for(const r of WEDDING_SCREENS){const g=r.id==='spiritWall'?gateSkin:dressingSkin,f=new Frame(g,r.x,r.z),w=r.w,h=r.top-r.bottom;
    if(r.id==='spiritWall'){
      f.box(0,r.bottom+.115,0,w,.23,r.d,A.granite,'#beb9a8');f.box(0,r.bottom+.285,0,w-.034,.11,r.d-.012,A.brick,'#c5cbbe');
      f.box(0,r.bottom+(h+.23)/2,0,w-.06,h-.33,r.d-.06,A.brick,'#d2d4c7',1.0,.82);
      for(const s of [-1,1]){
        const d=s*(r.d/2-.016);
        f.rim(0,r.bottom+.46,d,w-.26,h-.79,.068,.036,'#c4c5b4',A.granite);
        f.panel(0,r.bottom+.51,d+s*.022,w-.37,h-.89,s,A.swallows);
        f.panel(0,r.top-.288,d+s*.003,w-.23,.14,s,A.frieze);
      }
      tiledRoof(g,{x:r.x,z:r.z,hw:w/2+.073,hd:r.d/2+.065,eave:r.top-.136,rise:.089,lift:.044,detail:false});
    }else{ // Pierced upper crest and three recessed panels, each mounted in its stile.
      const n=3,base=r.bottom+.13,top=r.top-.09;
      for(const s of [-1,1]){f.box(s*(w/2-.07),base/2,0,.14,base,r.d,A.wood,'#b8a089');}
      f.box(0,(top+base)/2,0,w-.035,top-base,r.d*.72,A.wood,'#977c68');
      for(let i=0;i<n;i++)for(const s of [-1,1]){
        const u=w*((i+.5)/n-.5),nw=w/n-.037,d=s*r.d*.37;
        f.panel(u,base+.15,d,nw,top-base-.30,s,A.paper,'#c6bb9d');
        // A continuous stone-coloured flowering branch across all three silk leaves.
        const x0=i/n,x1=(i+1)/n;
        g.face([f.at(u-s*nw/2,base+.21,d+s*.002),f.at(u+s*nw/2,base+.21,d+s*.002),f.at(u+s*nw/2,top-.20,d+s*.002),f.at(u-s*nw/2,top-.20,d+s*.002)],A.swallows,'#e2dac2',[[x0,.14],[x1,.14],[x1,.85],[x0,.85]]);
        f.rim(u,base+.112,d+s*.009,nw+.013,top-base-.226,.034,.023,'#bda589');
      }
      f.box(0,top+.033,0,w,.066,r.d*.81,A.wood,'#b6a08a');f.box(0,r.top-.018,0,w*.68,.036,r.d*.66,A.wood,'#bba58b');
    }
  }
}

function posts(hall:Skin,west:Skin,east:Skin){
  for(const r of WEDDING_COLUMNS){
    const {x,z,w,top:h,bottom:y}=r,rad=w/2,g=r.id.startsWith('hallPost')?hall:x<0?west:east;
    g.block(x,y+.047,z,w,.094,r.d,A.granite,'#beb9a8');
    g.lathe(x,z,[[y+.085,rad*.95],[y+.128,rad],[y+.17,rad*.83],[y+.214,rad*.91],[y+.26,rad*.72]],A.granite,'#d8d4c1');
    g.lathe(x,z,[[y+.25,rad*.72],[h-.26,rad*.68],[h-.12,rad*.79],[h-.07,rad*.75]],A.wood,'#c6a58c',12);
    g.block(x,h-.064,z,w*1.05,.14,w*.99,A.wood,'#c6a88d');
    const f=new Frame(g,x,z,r.id.startsWith('gallery'));
    for(const s of [-1,1]){
      // Curved sparrow-brace beneath the purlin, wider at its top than at the post.
      const path=[[.069,h-.405],[.18,h-.34],[.248,h-.218],[.351,h-.178],[.47,h-.086],[.58,h-.055]];
      for(let j=0;j<path.length-1;j++){
        const [u,a]=path[j],[v,b]=path[j+1];f.box(s*(u+v)/2,(h+a)/2,0,v-u,h-a,.097,A.wood,'#c2a58d');
        f.line(s*u,a,s*v,b,0,.097,.045,'#d0b89c');
      }
    }
  }
}

function gateTower(g:Skin){
  const w=gate.width,dh=gate.head,cx=gate.x,cz=gate.z,head=WEDDING_HEADERS.find(r=>r.id==='gateHead')!,f=new Frame(g,cx,cz);
  for(const s of [-1,1]){
    const u=s*(w/2+.20);
    f.box(u,.21,0,.40,.42,.42,A.granite,'#c1bfb2');f.box(u,(.42+dh)/2,0,.385,dh-.42,.36,A.brick,'#ebeee0',1.03,.81);
    f.box(u,dh+.13,0,.45,.26,.47,A.granite,'#c7c9bd');f.box(u,dh+.40,0,.42,.28,.44,A.brick,'#d7dacc');
    for(const n of [-1,1]){
      f.panel(u,.6,n*.188,.257,1.96,n,A.granite,'#e3e0ce');
      f.box(u,dh+.38,n*.16,.48,.13,.27,A.granite,'#bdc1b7');f.panel(u,dh+.328,n*.301,.40,.093,n,A.frieze);
    }
  }
  const top=head.top;
  for(const [y,ww,dd,hh] of [[top+.027,w+.98,.51,.074],[top+.086,w+1.14,.62,.065],[top+.15,w+1.27,.73,.082]]){
    f.box(0,y,0,ww,hh,dd,A.granite,'#c2c5b9');
  }
  tiledRoof(g,{x:cx,z:cz,hw:w/2+.83,hd:.85,eave:top+.25,rise:.68,hip:.62,lift:.23,gateEnds:true});
  // Projecting rafter tails carry the soffit back to the wall plate. Their
  // cut ends sit behind the drip tiles, with daylight between the timbers.
  for(const dir of [-1,1])for(let i=-7;i<=7;i++){
    const u=i*.292,up=.23*(Math.abs(u)/(w/2+.83))**5.5;
    g.beam(f.at(u,top+.17+up,dir*.814),f.at(u,top+.298+up*.25,dir*.363),.077,.092,A.wood,'#bdab95');
  }
  // Paired looped silks flank (rather than cover) the inscribed stone tablet.
  for(const k of [-1,1])for(const side of [-1,1]){
    const silk=(t:number,v:number):V=>f.at(side*(.99+t*.94),top+.16-.19*Math.sin(t*Math.PI)+v*.102,k*(.341+.026*Math.cos(t*17+v*3)));
    for(let i=0;i<14;i++){
      const q:[V,V,V,V]=[silk(i/14,0),silk((i+1)/14,0),silk((i+1)/14,1),silk(i/14,1)];if(side*k<0)q.reverse();g.face(q,A.plain,i%4<2?'#a64234':'#a03d32');
    }
    f.box(side*1.89,top+.14,k*.35,.12,.14,.10,A.plain,'#b44837');
    for(const a of [-1,1])f.line(side*1.89,top+.13,side*(1.90+a*.065),top-.14+(a+1)*.038,k*.34,.020,.076,'#ac4334',A.plain);
  }
}

function pavilions(hall:Skin,galleryWest:Skin,galleryEast:Skin,dressing:Skin){
  let g=hall;
  const west=court.x-court.w/2,east=court.x+court.w/2;
  const maxH=WEDDING_WALLS.find(w=>w.id==='hallBack')!.top;
  const eave=maxH+.32,hRise=1.36,hw=court.w/2+.56,hd=(front-north)/2+.76;
  tiledRoof(g,{x:court.x,z:hallMid,hw,hd,eave,rise:hRise,lift:.28});
  // The hall has a finished upper enclosure behind the projected rafters:
  // the closed rear cannot be seen through from an elevated screen camera.
  const tWall=1-(hallMid-north+.10)/hd;
  const bearing=eave+hRise*(.35*tWall+.65*tWall*tWall)-.052;
  g.block(court.x,(maxH+bearing)/2,north,court.w,bearing-maxH,.20,A.lime);
  const sideDoor=WEDDING_DOORS.dressing;
  // The shorter east vestibule wall and door header need their own spandrel,
  // up to the gable base. Starting it at the back wall would overlap the taller
  // hall-to-dressing segment and make its interior faces z-fight.
  const eastPieces=[...WEDDING_WALLS.filter(w=>w.id==='dressingCourt'),...WEDDING_HEADERS.filter(h=>h.id==='dressingHead')];
  for(const p of eastPieces){const end=Math.min(front,p.z+p.d/2),start=p.z-p.d/2;if(end>start)g.block(sideDoor.x,(p.top+maxH)/2,(start+end)/2,p.w,maxH-p.top,end-start,A.lime);}
  for(const x of [west,east])fireGable(g,x,hallMid,(front-north)/2+.10,maxH-.01,eave,hRise,.27);
  // Front bents: central bay remains completely clear below the hanging board.
  const f=new Frame(g,court.x,front);
  f.box(0,maxH+.03,0,court.w,.25,.25,A.wood,'#c1a58f',1.8,.8);
  f.box(0,maxH+.268,0,court.w,.25,.205,A.boards,'#bda691',1.74,.70);
  f.box(0,bearing-.032,0,court.w+.09,.070,.246,A.wood,'#c4ae92');
  for(let i=-3;i<=3;i++)for(const k of [-1,1])f.panel(i*1.61,maxH+.196,k*.107,1.46,.14,k,A.frieze,'#d6c5a5');
  f.box(0,maxH-.051,.172,2.04,.49,.135,A.wood,'#a48970');f.panel(0,maxH-.266,.242,1.96,.43,1,A.hall);
  const backWall=WEDDING_WALLS.find(r=>r.id==='hallBack')!;
  g.block(backWall.x,maxH-.17,backWall.z,backWall.w,.21,backWall.d+.065,A.wood,'#cbb49a',1.83,.8);
  // An inset wall panel, in the same quiet lime as the surrounding plaster.
  // Its mitred key corners frame the furniture without a full red photo wall.
  const rear=new Frame(g,backWall.x,backWall.z),dep=backWall.d/2+.012,pw=4.77,py=.62,ph=2.53;
  rear.panel(0,py,dep,pw,ph,1,A.lime,'#d9d6be');rear.rim(0,py,dep+.017,pw,ph,.044,.030,'#bba98c');
  // A palm-width of breathing space above each chair crest; the central two
  // metres remain plain behind the actors. Sewn scroll ends wrap round wood.
  for(const s of [-1,1]){
    const x=s*1.96,y=1.32,w=.33,h=1.46,n=dep+.043,slot=s>0?COUPLET_RIGHT:COUPLET_LEFT;
    const point=(u:number,v:number)=>rear.at(x+(u-.5)*w,y+h*v,n+.009*Math.sin(Math.PI*u)*Math.sin(Math.PI*v));
    for(let j=0;j<3;j++)for(let i=0;i<4;i++){
      const a=i/4,b=(i+1)/4,c=j/3,d=(j+1)/3;g.face([point(a,c),point(b,c),point(b,d),point(a,d)],slot,'#ffffff',[[a,c],[b,c],[b,d],[a,d]]);
    }
    for(const v of [y,y+h])rear.line(x-w*.57,v,x+w*.57,v,n,.023,.025,'#b89b77');
    // Small two-loop silk knot above the upper rod. Lit folds, bound centre
    // and one tassel on the outer side, with relief against the plaster.
    const cy=y+h+.104;
    for(const k of [-1,1]){
      const loop=(t:number,v:number)=>rear.at(x+k*(.012+.125*Math.sin(Math.PI*t)),cy+.044*Math.sin(2*Math.PI*t)+.029*v,n+.035+.042*Math.sin(Math.PI*t));
      for(let j=0;j<10;j++){
        const a=j/10,b=(j+1)/10;const q:[V,V,V,V]=[loop(a,0),loop(b,0),loop(b,1),loop(a,1)];
        if(k*Math.cos((a+b)*.5*Math.PI)<0)q.reverse();g.face(q,A.plain,j<5?'#b14738':'#872f29');
      }
      rear.line(x,cy-.003,x+k*.052,y+h+.014,n+.048,.015,.021,'#a64132',A.plain);
    }
    rear.box(x,cy+.012,n+.067,.045,.047,.039,A.plain,'#ad4433');
    rear.line(x+s*.106,cy,x+s*.151,cy-.104,n+.056,.009,.009,'#bd8051',A.plain);
    const [tx,,tz]=rear.at(x+s*.151,0,n+.056);
    g.lathe(tx,tz,[[cy-.191,.014],[cy-.183,.018],[cy-.116,.009],[cy-.105,.012],[cy-.100,.007]],A.plain,'#ae4938',8);
  }
  for(const s of [-1,1])for(const t of [-1,1]){
    const x=s*(pw/2-.10),y=py+(t<0?.112:ph-.112),line=(a:number,b:number,c:number,d:number)=>rear.line(x-s*a,y-t*b,x-s*c,y-t*d,dep+.025,.018,.019,'#c8bc9f');
    line(0,0,.40,0);line(0,0,0,.42);line(0,.17,.17,.17);line(.17,0,.17,.17);line(.17,.091,.258,.091);line(.09,.17,.09,.26);
  }
  for(const {x} of WEDDING_COLUMNS.filter(r=>r.id.startsWith('hallPost'))){
    // Truss ties and king posts stay above all usable circulation.
    g.beam([x,maxH+.05,north],[x,maxH+.05,front],.16,.19,A.wood,'#c7ae93');
    g.beam([x,maxH+.11,hallMid],[x,eave+hRise-.12,hallMid],.125,.13,A.wood,'#c5ae95');
    for(const s of [-1,1])g.beam([x,maxH+.16,hallMid+s*1.79],[x,maxH+.98,hallMid+s*.21],.10,.12,A.wood,'#ccb49a');
  }
  for(const z of [hallMid-1.5,hallMid,hallMid+1.5]){
    const t=1-Math.abs(z-hallMid)/hd;g.beam([west,eave+hRise*(.35*t+.65*t*t)-.23,z],[east,eave+hRise*(.35*t+.65*t*t)-.23,z],.14,.16,A.wood,'#bfa68e');
  }
  for(const s of [-1,1]){
    g=s<0?galleryWest:galleryEast;
    const col=WEDDING_COLUMNS.find(r=>r.id.startsWith('gallery')&&Math.sign(r.x)===s)!;
    const x=(col.x+s*court.w/2)/2,cz=(front+south)/2;
    g.block(col.x,col.top-.015,cz,.19,.18,south-front,A.wood,'#c5ad97',1.82,.82);
    g.block(s*court.w/2,col.top-.075,cz,.17,.25,south-front,A.wood,'#c6b19b');
    tiledRoof(g,{x,z:cz,hw:(south-front)/2+.18,hd:.90,eave:col.top+.16,rise:.41,lift:.12,turn:true,hip:.43});
    for(let j=0;j<23;j++){
      const z=front+.12+j*(south-front-.27)/22;g.beam([x-s*.84,col.top+.043,z],[x,col.top+.49,z],.062,.072,A.wood,'#c8ab91');
      g.beam([x,col.top+.49,z],[x+s*.78,col.top+.08,z],.062,.072,A.wood,'#c8ab91');
    }
  }
  g=dressing;const y=WEDDING_WALLS.find(w=>w.id==='dressingEast')!.top;
  g.block(room.x,y+.085,room.z,room.w+.10,.17,room.d+.08,A.boards,'#cbb9a1',1.55,1.20);
  tiledRoof(g,{x:room.x,z:room.z,hw:room.d/2+.44,hd:room.w/2+.34,eave:y+.19,rise:1.06,lift:.17,turn:true});
  for(const s of [-1,1]){
    const z=room.z+s*room.d/2;
    // Exterior gable faces are fully closed; the eaves still project beyond them.
    const f=new Frame(g,room.x,z),hh=room.w/2+.34;
    for(let i=0;i<12;i++){
      const a=room.w*(i/12-.5),b=room.w*((i+1)/12-.5);
      const high=(t:number)=>{const k=1-Math.abs(t)/hh;return y+.19+1.06*(.35*k+.65*k*k)-.094;};
      const q:[V,V,V,V]=[f.at(a,y+.13,s*.10),f.at(b,y+.13,s*.10),f.at(b,high(b),s*.10),f.at(a,high(a),s*.10)];if(s<0)q.reverse();g.face(q,A.lime);
    }
  }
}

export function makeWeddingArchitecture(){
  const groups={ground:new Skin(false,gateFloorReveal),hall:new Skin(),gate:new Skin(false,gateReveal,[.74,2.30,2.46]),west:new Skin(),east:new Skin(),dressing:new Skin(),bridal:new Skin(),
    horizon:new Skin(),laneSouth:new Skin(),laneWest:new Skin(),laneEast:new Skin(),laneNorth:new Skin(),leafWest:new Skin(true),leafSouth:new Skin(true)};
  const {ground,hall,gate,west,east,dressing}=groups;
  floors(ground);for(const r of WEDDING_WALLS){
    const g=r.id.startsWith('gate')?gate:r.id.startsWith('bridal')?groups.bridal:r.id.startsWith('dressing')?dressing:r.id==='courtWest'?west:r.id==='courtEast'?east:hall;wall(g,r);
  }
  bridalPavilion(groups.bridal);
  openings(gate,dressing);screens(gate,dressing);posts(hall,west,east);gateTower(gate);pavilions(hall,west,east,dressing);surroundingLane(groups);
  // One bound per sightline, shared by its walls, tiny roof ends and window
  // frames. A view of the bronze mirror drops the whole opposite gate/eaves.
  return Object.entries(groups).map(([name,skin])=>({name,geometry:skin.finish(),foliage:name.startsWith('leaf'),casts:['hall','gate','west','east','dressing','bridal'].includes(name)}));
}

function bridalPavilion(g:Skin){
  const r=WEDDING_FLOORS.bridal,door=WEDDING_DOORS.bridal,y=3.12;
  paving(g,r,A.boards,2.26,1.12,'#f5d6b9',([x,,z])=>{
    let shade=0;for(const f of [BED,TRUNK,CUP_TABLE]){const u=Math.max(0,Math.abs(x-f.x)-f.w/2),v=Math.max(0,Math.abs(z-f.z)-f.d/2);shade=Math.max(shade,.24*Math.exp(-3*Math.hypot(u,v)));}
    return .97-shade;
  });
  g.block(door.x,-.014,door.z,.31,.043,door.width,A.granite,'#d9c8a8');
  const frame=new Frame(g,door.x,door.z,true);
  for(const s of [-1,1]){
    for(const t of [-1,1])frame.box(t*(door.width/2+.025),door.head/2,s*.114,.065,door.head,.072,A.wood,'#c89873');
    frame.panel(0,door.head+.15,s*.118,.59,.26,s,A.swallows,'#e7cfaf');
  }
  g.block(r.x,y+.06,r.z,r.w+.09,.12,r.d+.09,A.boards,'#c7a384',1.65,1.45);
  for(const x of [r.x-2.62,r.x,r.x+2.62])g.block(x,y-.10,r.z,.12,.20,r.d,A.wood,'#c69d7a',1.45,.74);
  // Hip ends close every elevation; the lower roof meets the makeup wing at the eave.
  tiledRoof(g,{x:r.x,z:r.z,hw:r.w/2+.28,hd:r.d/2+.40,eave:y+.14,rise:1.10,hip:1.23,lift:.11,detail:false});
}
