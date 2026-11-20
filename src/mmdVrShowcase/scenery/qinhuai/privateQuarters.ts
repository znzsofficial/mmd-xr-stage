import type {Part} from '../SceneryBatch';
import {BED,BED_STEP,DOOR_WIDTH,DOOR_X,DOOR_Z,DRESSER,DRESSING_STOOL,GALLERY_Y as floor,PRIVATE_HEADER,PRIVATE_TOP,PRIVATE_WALLS,QUARTERS as room} from './songhouseLayout';
import type {Skin} from './songhouseGeometry';

type V=Part['p'];
type Makers={
  box:(x:number,y:number,z:number,w:number,h:number,d:number,c:string,ry?:number)=>void;
  tube:(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx?:number,rz?:number)=>void;
  bead:(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>void;
  line:(a:V,b:V,w:number,c:string,d?:number)=>void;
  lantern:(x:number,z:number,hook:number,size:number,peach?:boolean)=>void;
  fabric:Skin; art:Skin;
};
const lacquer='#643e39',edge='#a67450',gilt='#c4a078',jade='#5b7271',paper='#e5d3ba',silk='#a7656b';
const tiles={board:[8,8,504,222],quilt:[8,242,504,504],plum:[526,8,1016,375],border:[526,397,824,504],mat:[844,397,1016,504],bronze:[533,15,600,66]};
type Tile=keyof typeof tiles;
export function furnishQuarters(m:Makers){
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,ry=0)=>m.box(x,floor+y,z,w,h,d,c,ry);
  const tube=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,rx=0,rz=0)=>m.tube(x,floor+y,z,w,h,d,c,rx,rz);
  const pearl=(x:number,y:number,z:number,w:number,h:number,d:number,c:string)=>m.bead(x,floor+y,z,w,h,d,c);
  const at=(x:number,y:number,z:number):V=>[x,floor+y,z];
  function art(tile:Tile,pts:[V,V,V,V],uv:[number,number][]=[[0,1],[1,1],[1,0],[0,0]]){
    const [l,t,r,b]=tiles[tile];m.art.quad(...pts,'#ffffff',uv.map(([u,v])=>[(l+.5+(r-l)*u)/1024,1-(t+.5+(b-t)*v)/512]));
  }
  function print(tile:Tile,x:number,y:number,z:number,w:number,h:number){art(tile,[at(x-w/2,y,z),at(x+w/2,y,z),at(x+w/2,y+h,z),at(x-w/2,y+h,z)]);}
  function disk(tile:Tile,cx:number,cy:number,cz:number,rad:number,trim:boolean){
    for(let i=0;i<28;i++){
      const a=i*Math.PI/14,b=(i+1)*Math.PI/14,c=Math.cos(a),s=Math.sin(a),u=Math.cos(b),v=Math.sin(b);
      const A=at(cx+rad*c,cy+rad*s,cz),B=at(cx+rad*u,cy+rad*v,cz),center=at(cx,cy,cz);
      art(tile,[center,A,B,center],[[.5,.5],[.5+.46*c,.5-.49*s],[.5+.46*u,.5-.49*v],[.5,.5]]);if(trim)m.line(A,B,.045,edge,.06);
    }
  }

  // The north wall used to close off the gallery. Keep its last two columns:
  // they frame the approach, with the brass-edged tablet between them.
  for(const wall of PRIVATE_WALLS)m.box(wall.x,(wall.top+wall.bottom)/2,wall.z,wall.w,wall.top-wall.bottom,wall.d,'#c9b49d');
  const head=PRIVATE_HEADER;m.box(head.x,(head.top+head.bottom)/2,head.z,head.w,head.top-head.bottom,head.d,lacquer);
  for(const s of [-1,1]){
    const x=DOOR_X+s*(DOOR_WIDTH/2+.045);
    box(x,1.10,DOOR_Z,.12,2.20,.28,lacquer);box(x,1.10,DOOR_Z+.15,.025,2.20,.024,gilt);
    // The sliding leaves are visibly parked OUTSIDE the opening.
    const leaf=x+s*.22;box(leaf,1.04,DOOR_Z+.12,.35,2.07,.065,jade);
    for(const d of [-.14,.14])box(leaf+d,1.05,DOOR_Z+.162,.032,2.04,.033,lacquer);
    for(const h of [.16,.61,.84,1.7,1.91])box(leaf,h,DOOR_Z+.17,.31,.031,.038,edge);
    for(const d of [-.064,.064])box(leaf+d,1.34,DOOR_Z+.17,.021,1.1,.024,edge);
    m.lantern(DOOR_X+s*1.14,DOOR_Z+.44,floor+2.37,.40,true);
    m.line(at(x,2.09,DOOR_Z+.05),at(x-s*.19,2.26,DOOR_Z+.05),.095,edge,.13);
  }
  box(DOOR_X,.012,DOOR_Z,DOOR_WIDTH,.024,.24,edge);
  box(DOOR_X,2.20,DOOR_Z,2.27,.11,.29,lacquer);box(DOOR_X,2.24,DOOR_Z+.15,2.24,.027,.028,gilt);
  box(DOOR_X,2.49,DOOR_Z+.16,1.56,.56,.10,lacquer);print('board',DOOR_X,2.24,DOOR_Z+.212,1.50,.50);

  // Rich lower dado with quiet plaster above. Only the panels facing the
  // stage lamps are papered; rails and the round painted silk are in relief.
  const left=room.x-room.w/2+.15,right=room.x+room.w/2-.15,back=room.z-room.d/2+.15;
  for(const x of [left,right]){
    box(x,.42,room.z,.081,.84,room.d-.18,'#8f6555');
    for(const y of [.11,.79,.88,2.54])box(x,y,room.z,.13,.057,room.d-.18,edge);
    for(let i=0;i<5;i++)box(x,.45,back+.39+i*1.41,.10,.66,.045,lacquer);
    for(const z of [back+.12,room.z,DOOR_Z-.18])box(x,1.46,z,.14,PRIVATE_TOP-floor,.14,lacquer);
    // Pairs of tall ice-ray windows. Give the opening a paper reveal and
    // stepped muntins rather than crossing straight grid bars over it.
    const side=x===left?1:-1,face=x+side*.071;
    for(const z of [-11.22,-9.31]){
      box(x,1.72,z,.10,1.43,1.56,paper);
      for(const k of [-1,1]){box(face,1.72,z+k*.78,.067,1.53,.062,lacquer);box(face,1.72+k*.72,z,.067,.062,1.60,lacquer);}
      for(const k of [-1,1]){
        box(face,1.72,z+k*.43,.045,1.42,.035,edge);
        for(const u of [-1,1]){box(face,1.72+u*.41,z+k*.58,.048,.035,.30,edge);box(face,1.72+u*.54,z+k*.22,.049,.032,.43,edge);}
      }
      m.line(at(face,1.72,z-.4),at(face,2.03,z),.029,edge);m.line(at(face,2.03,z),at(face,1.72,z+.4),.029,edge);
      m.line(at(face,1.72,z+.4),at(face,1.41,z),.029,edge);m.line(at(face,1.41,z),at(face,1.72,z-.4),.029,edge);
    }
  }
  box(room.x,.45,back,room.w-.22,.90,.09,'#8f6555');
  for(const y of [.14,.87,2.59])box(room.x,y,back+.052,room.w-.22,.048,.061,edge);
  // A circular silk panel behind the dressing table; trim follows its edge.
  // This is not a live reflection or another light source.
  disk('plum',DRESSER.x,1.83,back+.072,.77,true);
  m.lantern(left+.49,-12.42,floor+2.75,.40,true);

  // A room-sized rush mat connects the two clear actor marks. Its top stays
  // below the real deck ray, like a floor inlay; no new collision surface.
  const mx=-8.81,mz=-10.4,mw=4.13,md=1.73;
  box(mx,.002,mz,mw,.004,md,'#626e69');
  const mat=(x:number,z:number)=>at(mx+x,.005,mz+z);
  for(let i=0;i<6;i++)for(let j=0;j<4;j++){
    const X=(i/6-.5)*(mw-.14),Z=(j/4-.5)*(md-.14),W=(mw-.14)/6,D=(md-.14)/4;
    art('mat',[mat(X,Z+D),mat(X+W,Z+D),mat(X+W,Z),mat(X,Z)]);
  }

  // A six-post canopy: low footstool, exposed front mattress edge, cloth
  // draped OVER it, timber back rail and posts supporting the overhead frame.
  const {x,z,w,d}=BED,front=z+d/2;
  for(const k of [-1,1])for(const j of [-1,1]){
    const px=x+k*(w/2-.09),pz=z+j*(d/2-.09);
    box(px,.31,pz,.16,.62,.16,lacquer);tube(px,1.35,pz,.085,1.63,.085,lacquer);
    for(const y of [.71,1.94,2.13])tube(px,y,pz,.115,.054,.115,gilt);
  }
  for(const k of [-1,1])tube(x+k*.91,1.36,front-.08,.065,1.66,.065,lacquer);
  box(x,.48,z,w-.07,.24,d-.07,lacquer);box(x,.59,z,w,.085,d,edge);box(x,.675,z,w-.09,.12,d-.08,'#e4d3b8');
  for(const s of [-1,1]){
    box(x+s*(w/2-.08),.99,z,.09,.42,d-.13,lacquer);box(x+s*(w/2-.08),1.21,z,.12,.061,d-.10,edge);
    box(x+s*(w/2-.06),2.06,z,.13,.22,d,jade);
  }
  box(x,1.17,z-d/2+.09,w-.08,.91,.12,jade);box(x,1.62,z-d/2+.09,w-.04,.065,.16,edge);
  print('border',x,1.17,z-d/2+.154,w-.20,.39);
  for(const s of [-1,1]){
    box(x,2.05,z+s*(d/2-.06),w,.23,.13,jade);
    for(const y of [1.94,2.17])box(x,y,z+s*(d/2-.06),w+.045,.046,.17,edge);
  }
  box(x,2.195,z,w+.08,.07,d+.04,'#955f60');print('border',x,1.96,front+.011,w-.12,.18);
  // Brocade coverlet, including the rounded fall over the near edge. Two
  // roll pillows rest at the head; the folded jade throw crosses the foot.
  const ql=x-1.13,qr=x+1.26,qb=z-.77,qf=front-.08;
  art('quilt',[at(ql,.741,qf),at(qr,.741,qf),at(qr,.741,qb),at(ql,.741,qb)]);
  art('quilt',[at(ql,.53,qf+.048),at(qr,.53,qf+.048),at(qr,.741,qf),at(ql,.741,qf)],[[0,1],[1,1],[1,.88],[0,.88]]);
  for(const j of [-1,1]){
    tube(x-.99,.81,z+j*.40,.21,.62,.22,'#cfb7a1',Math.PI/2);
    for(const k of [-1,1])tube(x-.99,.81,z+j*.40+k*.284,.218,.034,.224,jade,Math.PI/2);
  }
  box(x+.78,.758,z,.44,.035,1.78,jade);
  art('border',[at(x+.56,.778,z+.89),at(x+1,.778,z+.89),at(x+1,.778,z-.89),at(x+.56,.778,z-.89)]);
  for(const k of [-1,1]){
    // Drawn curtain panels narrow where knotted, flare again at the hem.
    const cloth=(u:number,t:number):V=>{const pinch=Math.exp(-((t-.37)**2)/.032),width=.39+.18*t-.26*pinch,pleat=Math.cos(u*7*Math.PI);
      return at(x+k*(1.3-u*width),.69+1.25*t+.032*pleat*(1-t),front-.018+.039*pleat);};
    for(let i=0;i<15;i++)for(let j=0;j<8;j++){
      const a=i/15,b=(i+1)/15,t=j/8,h=(j+1)/8;m.fabric.quad(cloth(a,t),cloth(b,t),cloth(b,h),cloth(a,h),j===3?gilt:i%4<2?silk:'#c88886');
    }
    const knot=cloth(.45,.4);m.line(knot,[knot[0]+k*.035,knot[1]-.18,knot[2]+.025],.019,gilt);pearl(knot[0]+k*.035,knot[1]-floor-.20,knot[2]+.025,.047,.087,.047,gilt);
  }
  for(let i=0;i<7;i++){
    const a=x-1.31+i*.374,b=a+.374,mid=(a+b)/2;
    m.fabric.quad(at(a,1.945,front+.005),at(mid,1.83,front+.046),at(b,1.945,front+.005),at(mid,1.975,front+.008),'#ba8181');
    tube(mid,1.80,front+.046,.022,.066,.022,gilt);
  }
  const step=BED_STEP;box(step.x,.17,step.z,step.w,.079,step.d,edge);for(const k of [-1,1])box(step.x+k*.63,.07,step.z,.13,.14,.29,lacquer);

  const table=DRESSER,tx=table.x,tz=table.z;
  box(tx,.83,tz,table.w-.09,.18,table.d-.04,lacquer);box(tx,.94,tz,table.w,.055,table.d,edge);
  for(const k of [-1,1]){
    for(const j of [-1,1])box(tx+k*.79,.38,tz+j*.29,.072,.76,.073,lacquer);
    box(tx+k*.43,.83,tz+.366,.76,.13,.036,'#956b56');pearl(tx+k*.43,.83,tz+.393,.057,.05,.023,gilt);
    tube(tx+k*.34,1.24,tz-.09,.044,.52,.044,lacquer);pearl(tx+k*.34,1.55,tz-.09,.072,.086,.072,gilt);
  }
  box(tx,1.00,tz-.09,.79,.063,.32,lacquer);box(tx,1.07,tz-.09,.49,.088,.21,edge);
  tube(tx,1.46,tz-.09,.714,.081,.73,edge,Math.PI/2);tube(tx,1.46,tz-.041,.646,.037,.663,'#b6b69d',Math.PI/2);tube(tx,1.46,tz-.019,.603,.013,.622,'#c6c6ac',Math.PI/2);
  disk('bronze',tx,1.46,tz-.008,.30,false);
  // Stacked powder boxes, a jade-handled comb and lacquer pin case.
  for(const [off,r,h] of [[-.60,.20,.11],[-.47,.137,.085],[.62,.16,.10]]){
    tube(tx+off,.971+h/2,tz+.047,r,h,r,off<0?silk:jade);tube(tx+off,.98+h,tz+.047,r+.011,.025,r+.011,gilt);
  }
  box(tx+.34,1.002,tz+.22,.23,.060,.073,jade,-.15);for(let i=0;i<8;i++)box(tx+.25+i*.025,.987,tz+.273+i*.003,.014,.022,.08,edge,-.15);
  const st=DRESSING_STOOL;box(st.x,.395,st.z,st.w,.13,st.d,lacquer);box(st.x,.454,st.z,st.w-.06,.038,st.d-.055,jade);
  for(const k of [-1,1])for(const j of [-1,1])box(st.x+k*.185,.17,st.z+j*.143,.054,.34,.055,lacquer);
}
