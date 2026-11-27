import {BoxGeometry,BufferGeometry,Color,CylinderGeometry,Float32BufferAttribute,Matrix4,Shape,ExtrudeGeometry} from 'three';
import {PaintedParts,ball,box,ring,rod,turn} from '../../play/modelParts';
import {parkShops,windowDisplays} from './parkLayout';

const zinc='#687875', plaster='#ede5d4', shadow='#545f5c', brass='#bd9363';
type Shop=typeof parkShops[number];

// Local +Z is the pavement. Keep a deep sill in front of the painted stock,
// real projecting fascias, door jambs and inhabitable floor-to-floor heights.
export function parkArchitecture(){
  const solids=new PaintedParts(), p:number[]=[],uv:number[]=[],rgb:number[]=[],index:number[]=[],ink=new Color();
  const frame=new Matrix4();let origin={x:0,z:0,yaw:0};
  function local(x:number,z:number,yaw=0){origin={x,z,yaw};frame.makeRotationY(yaw).setPosition(x,0,z);}
  const add=(g:BufferGeometry,tint:string)=>solids.add(g.applyMatrix4(frame),tint);
  const wall=(x:number,y:number,z:number,w:number,h:number,d:number,tint:string)=>add(box(x,y,z,w,h,d),tint);
  function pitched(x:number,y:number,z:number,w:number,h:number,d:number,tint:string,rx:number,rz=0){
    add(new BoxGeometry(w,h,d).rotateX(rx).rotateZ(rz).translate(x,y,z),tint);
  }
  // Window elevations share a single resident print. Take a two-pixel inset
  // so adjacent shop signs don't leak into a frame in lower mip levels.
  function picture(x:number,y:number,z:number,w:number,h:number,tile:number,section:'sign'|'stock'|'pane',yaw=0,tint='white'){
    const base=p.length/3,u=tile%3/3,v=1-Math.floor(tile/3)/4;
    const u0=u+2/2304,u1=u+1/3-2/2304;
    const v0=v-(section==='stock'?114:2)/2048,v1=v-(section==='sign'?110:510)/2048;
    const c=Math.cos(origin.yaw+yaw),s=Math.sin(origin.yaw+yaw),cx=origin.x+x*Math.cos(origin.yaw)+z*Math.sin(origin.yaw),cz=origin.z-x*Math.sin(origin.yaw)+z*Math.cos(origin.yaw);
    ink.set(tint);
    for(const [dx,dy] of [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]){p.push(cx+dx*c,y+dy,cz-dx*s);rgb.push(ink.r,ink.g,ink.b);}
    uv.push(u0,v1,u1,v1,u1,v0,u0,v0);index.push(base,base+1,base+2,base,base+2,base+3);
  }
  // A sawn stone ledge has a draining top fall, eased front edge and a drip
  // groove. The recessed joint remains legible in diffuse coastal daylight.
  function sill(x:number,y:number,z:number,w:number,depth:number){
    const section=new Shape();section.moveTo(0,-depth/2);section.lineTo(0,depth/2-.016);section.lineTo(.013,depth/2);
    section.lineTo(.06,depth/2);section.lineTo(.075,depth/2-.025);section.lineTo(.09,-depth/2);section.closePath();
    // Map profile X to height and profile Y to depth; extrusion goes along X.
    const trim=new ExtrudeGeometry(section,{depth:w,bevelEnabled:false});trim.rotateZ(Math.PI/2);trim.rotateY(Math.PI/2);
    add(trim.translate(x-w/2,y,z),'#ded4bd');wall(x,y-.021,z-.024,w-.055,.041,depth-.087,'#9d998b');
  }
  function pane(x:number,y:number,z:number,w:number,h:number,tile:number,trim=zinc){
    wall(x,y,z,w+.13,h+.14,.12,trim);picture(x,y,z+.062,w,h,tile,'pane');
    wall(x,y,z+.08,.052,h,.045,trim);wall(x,y-h*.24,z+.08,w,.045,.045,trim);
    sill(x,y-h/2-.115,z+.09,w+.24,.23);
  }
  function awning(w:number,y:number,tint:string,striped=false){
    const count=striped?Math.round(w/.29):1;
    for(let i=0;i<count;i++){
      const width=w/count,x=-w/2+(i+.5)*width,paint=striped&&i%2===1?'#f3e4c7':tint;
      pitched(x,y,.49,width,.064,1.16,paint,.18);
      wall(x,y-.158,1.04,width,.102,.055,paint);
    }
    for(const x of [-w*.40,w*.40])add(rod([x,y-.36,.02],[x,y-.10,1.00],.023),zinc);
  }
  function balcony(x:number,y:number,w:number,trim:string){
    wall(x,y,.48,w,.16,1.04,plaster);wall(x,y+.52,.95,w,.82,.095,trim);
    wall(x,y+.98,.95,w+.08,.065,.12,zinc);
    for(const dx of [-1,1])wall(x+dx*(w/2-.05),y+.47,.49,.11,.82,.92,plaster);
    for(let i=0;i<Math.floor(w/.42);i++)wall(x-w/2+.25+i*.42,y+.52,1.007,.025,.76,.012,plaster);
  }
  function shopfront(s:Shop,i:number){
    const {w,trim,color}=s,doorW=1.06,doorX=w/2-1.01,displayW=w-2.1,displayX=-.65;
    wall(0,1.52,-s.d/2-.16,w,3.04,s.d-.32,color);
    wall(0,.20,-.13,w,.4,.49,trim);
    wall(displayX,1.42,-.16,displayW+.16,2.10,.29,shadow);
    picture(displayX,1.42,-.012,displayW,1.92,i,'stock');
    sill(displayX,.35,.075,displayW+.30,.29);
    for(const x of [displayX-displayW/2,displayX,displayX+displayW/2])wall(x,1.44,.08,.066,2.04,.19,trim);
    wall(displayX,2.20,.08,displayW,.047,.19,trim);
    // The doorway is recessed behind a lintel and a pair of full-height jambs.
    wall(doorX,1.22,-.17,doorW+.13,2.44,.17,shadow);
    picture(doorX,1.52,-.079,doorW-.18,1.48,6+i%3,'pane');
    for(const dx of [-1,1])wall(doorX+dx*(doorW/2+.05),1.22,-.018,.12,2.45,.40,trim);
    wall(doorX,.39,-.055,doorW-.09,.70,.12,trim);wall(doorX+.33,1.08,.053,.034,.34,.050,brass);
    for(const dx of [-1,1])wall(dx*(w/2-.11),1.48,-.02,.22,2.96,.55,color);
    wall(0,2.78,.035,w,.58,.44,color);wall(0,2.82,.29,w*.62,.48,.085,trim);
    picture(0,2.82,.335,w*.62-.035,.43,i,'sign');
  }
  function monitorRoof(w:number,y:number,d:number){
    for(let j=0;j<3;j++){
      const width=w/3,x=-w/2+width*(j+.5),rise=.83,angle=Math.atan2(rise,width);
      wall(x,y+.09,-d/2,width,.18,d,zinc);
      pitched(x,y+rise/2,-d/2,Math.hypot(width,rise),.11,d+.26,'#899c95',0,angle);
      wall(x+width/2-.045,y+rise/2,-d/2,.09,rise,d,'#98b8b8');
      const side=new Shape();side.moveTo(-width/2,0);side.lineTo(width/2,0);side.lineTo(width/2,rise);side.closePath();
      add(new ExtrudeGeometry(side,{depth:.07,bevelEnabled:false}).translate(x,y,.038),'#a9c5c3');
      wall(x,y+.045,.11,width,.09,.075,zinc);
    }
  }
  function gable(w:number,y:number,d:number){
    const rise=1.47,slope=Math.atan2(rise,w/2);
    for(const side of [-1,1]){
      pitched(side*w/4,y+rise/2,-d/2,Math.hypot(w/2,rise)+.29,.14,d+.62,'#727e79',0,-side*slope);
    }
    const triangle=new Shape();triangle.moveTo(-w/2,0);triangle.lineTo(w/2,0);triangle.lineTo(0,rise);triangle.closePath();
    add(new ExtrudeGeometry(triangle,{depth:d,bevelEnabled:false}).translate(0,y,-d),'#d6c5a6');
    wall(0,y+rise*.49,.09,.14,rise,.13,zinc);
    for(const x of [-1.15,1.15])wall(x,y+.40,.06,.57,.53,.13,'#6d7b75');
  }

  function sidewalkDisplay(s:Shop){
    const {offset:x,out:z,w}=windowDisplays[s.kind];
    // A real parked city cycle with thin rims, a step-through frame, guards,
    // a kickstand and wire basket; there is no billboard across the spokes.
    if(s.kind==='cycles'){
      const y=.318,r=.308;
      for(const axle of [-.53,.53]){
        add(ring(r,.020,42).translate(x+axle,y,z),'#424d49');add(ring(r-.027,.009,40).translate(x+axle,y,z),'#adb5aa');
        for(let j=0;j<12;j++){const a=j*Math.PI/6;add(rod([x+axle,y,z],[x+axle+(r-.032)*Math.cos(a),y+(r-.032)*Math.sin(a),z],.003,.003,4),'#a8b5b0');}
      }
      const tube=(ax:number,ay:number,bx:number,by:number,t=.021,c='#719d92')=>add(rod([x+ax,ay,z],[x+bx,by,z],t),c);
      tube(-.53,y,-.09,.30);tube(-.53,y,-.22,.78,.016);tube(-.09,.30,-.22,.78);
      tube(-.09,.30,.32,.77);tube(-.20,.63,-.03,.46);tube(-.03,.46,.32,.82);
      tube(.53,y,.32,.80,.017,'#869c8c');tube(.32,.77,.27,.96,.016,'#c0c6ba');
      add(rod([x+.29,.96,z-.20],[x+.27,.96,z+.20],.012),'#bac1b7');add(ball(x-.24,.818,z,.116,.034,.073,12),'#936a4e');
      add(ring(.087,.010,20).translate(x-.09,.302,z+.032),'#a7ac9f');tube(-.09,.30,.00,.23,.012,'#958f80');
      add(rod([x-.17,.31,z],[x-.26,.018,z+.20],.009),'#74817a');
      for(const dy of [0,.085,.18]){
        const width=.27+dy*.24;wall(x+.49,.744+dy,z-.115,width,.010,.010,brass);wall(x+.49,.744+dy,z+.115,width,.010,.010,brass);
        for(const side of [-1,1])wall(x+.49+side*width/2,.744+dy,z,.010,.010,.23,brass);
      }
      for(let i=0;i<6;i++)for(const side of [-1,1])wall(x+.355+i*.053,.837,z+side*.115,.009,.19,.009,brass);
      wall(x+.49,.748,z,.28,.021,.23,'#a6885c');return;
    }
    if(s.kind==='coffee'){
      add(turn([[.22,0],[.22,.025],[.042,.063],[.033,.67],[.305,.70],[.32,.725],[.31,.75],[.001,.75]],28).translate(x,0,z),'#957253');
      for(const side of [-1,1]){
        const cx=x+.62*side;
        add(new CylinderGeometry(.17,.16,.041,24).translate(cx,.435,z),'#bc9b72');
        for(const a of [0,2.094,4.189])add(rod([cx+.17*Math.sin(a),.012,z+.17*Math.cos(a)],[cx+.105*Math.sin(a),.425,z+.105*Math.cos(a)],.015),zinc);
        add(rod([cx+side*.14,.425,z-.09],[cx+side*.19,.76,z-.09],.012),zinc);
        add(rod([cx+side*.14,.425,z+.09],[cx+side*.19,.76,z+.09],.012),zinc);wall(cx+side*.19,.755,z,.047,.11,.26,'#b79771');
      }
      add(turn([[.042,.75],[.052,.833],[.044,.836],[.037,.778],[.001,.778]],18).translate(x+.1,0,z),'#e6dfc6');return;
    }
    if(s.kind==='flowers'){
      const colors=['#d78a71','#d9ba70','#9f9ab0','#dddcc6'];
      for(let j=0;j<5;j++){
        const cx=x+((j%3)-1)*.49,cz=z+Math.floor(j/3)*.29-.12;
        add(turn([[.117,0],[.164,.33],[.175,.34],[.175,.365],[.148,.365],[.126,.29]],20).translate(cx,0,cz),j%2?'#929f96':'#b48a6b');
        for(let k=0;k<9;k++){
          const t=k*2.399+j,r=.06+.079*(k%3),ex=cx+r*Math.cos(t),ez=cz+r*Math.sin(t),y=.59+.068*((k+j)%6);
          add(rod([cx,.285,cz],[ex,y,ez],.004,.004,4),'#748c65');
          add(ball((cx+ex)/2+.039,.28+y*.38,(cz+ez)/2,.059,.016,.032,7),'#839881');
          for(let m=0;m<4;m++)add(ball(ex+.024*Math.cos(m*1.571),y,ez+.024*Math.sin(m*1.571),.035,.020,.035,6),colors[(j+k%2)%4]);
        }
      }return;
    }
    // A timber trestle sits under the bakery and ceramics windows. At the
    // bookshop it supports a sloping box of sleeves rather than a flat table.
    for(const a of [-1,1])for(const b of [-1,1]){
      const dx=(w/2-.12)*a;
      add(rod([x+dx,.018,z+b*.26],[x+dx,.73,z-b*.16],.025,.025,6),'#89775b');
    }
    wall(x,.736,z,w,.064,.58,'#ae8c68');
    if(s.kind==='books'){
      wall(x,.822,z-.25,w,.17,.048,'#a88c6b');wall(x,.822,z+.25,w,.17,.048,'#b39370');
      for(let j=0;j<8;j++){
        const cx=x-w*.32+(j%3)*w*.31,cz=z-.12+.12*Math.floor(j/3),tints=['#a96854','#656f75','#a4a079','#91776c'];
        pitched(cx,.961,cz,.29,.38,.025,tints[j%4],-.15);
        pitched(cx,.985,cz+.014,.23,.12,.008,'#c5b69c',-.15);
      }
    }else if(s.kind==='bakery'){
      for(const a of [-1,1]){
        const cx=x+a*.275;wall(cx,.788,z,.50,.04,.40,'#9d7750');
        for(let j=0;j<4;j++){
          const cz=z-.137+j*.091;add(ball(cx,.856,cz,.177,.067,.045,10),j%2?'#cb9964':'#d1a26b');
        }
      }
    }else{
      for(let j=0;j<5;j++){
        const cx=x+(j-2)*.23,r=.073+j%2*.033,h=.105+.019*(j%3);
        add(turn([[.045,0],[r*.78,h*.24],[r,h],[r-.008,h+.003],[r*.68,h*.33],[.001,h*.26]],24).translate(cx,.77,z+.09*(j%2)),j%2?'#8ba3a7':'#c5aa87');
      }
    }
  }
  function shop(s:Shop,i:number){
    local(s.x,s.z,s.yaw);shopfront(s,i);
    const {w,h,d,color,trim,kind}=s;
    const upper=h-3.08;
    wall(0,3.08+upper/2,-d/2,w,upper,d,color);
    const masonry=kind==='books'?10:9;
    picture(0,3.08+upper/2,.002,w,upper,masonry,'pane',0,color);
    for(const dir of [-1,1])picture(dir*(w/2+.002),3.08+upper/2,-d/2,d,upper,masonry,'pane',dir*Math.PI/2,color);
    wall(0,3.10,-d/2,w+.17,.16,d+.17,trim);
    const rows=upper>4.7?2:1;
    for(let j=0;j<rows;j++){
      const y=3.08+upper*(j+.52)/rows;
      for(let k=0;k<3;k++)pane((k-1)*w*.31,y,.004,w*(kind==='books'?.225:.245),Math.min(1.79,upper/rows*.65),6+(k+i+j)%3,kind==='books'?'#825d4e':trim);
      for(const dir of [-1,1])for(let k=0;k<2;k++){
        const z=-(k+.55)*d/2;picture(dir*(w/2+.015),y,z,1.55,1.5,7+(k+j)%2,'pane',dir*Math.PI/2);
      }
      if(kind==='coffee'||(kind==='books'&&j===1))balcony(kind==='coffee'?-w*.12:w*.16,y-1.14,w*.67,kind==='coffee'?'#a4bcb2':'#b48169');
    }
    if(kind==='bakery'){
      awning(w-.32,2.50,trim,true);gable(w,h,d);
      wall(-w*.3,h+1.05,-d*.7,.49,1.82,.61,'#ad7c63');wall(-w*.3,h+2.0,-d*.7,.62,.14,.72,plaster);
    }else if(kind==='flowers'){
      awning(w-.32,2.48,'#93a77d');monitorRoof(w,h,d);
      // Narrow trellis under the greenhouse monitor ends.
      for(let j=0;j<14;j++)wall(-w/2+.23+j*.56,h-.17,.12,.055,.35,.24,trim);
    }else if(kind==='cycles'){
      wall(0,2.47,.41,w+.12,.13,1.16,'#9ba7a2');
      // Rolled metal, segmental arch and its two filled ends.
      const roof=new Shape(),rx=w/2+.16,ry=1.45;roof.moveTo(-rx,0);
      for(let j=0;j<=32;j++){const a=Math.PI-Math.PI*j/32;roof.lineTo(rx*Math.cos(a),ry*Math.sin(a));}
      roof.closePath();add(new ExtrudeGeometry(roof,{depth:d+.36,bevelEnabled:false,curveSegments:16}).translate(0,h,-d-.18),trim);
      for(let j=0;j<=18;j++){
        const a=Math.PI*j/18,x=rx*Math.cos(a),y=h+ry*Math.sin(a);add(rod([x,y,-d-.23],[x,y,.23],.028), '#e2cab1');
      }
    }else if(kind==='books'){
      wall(0,h+.13,-d/2,w+.31,.26,d+.34,plaster);
      for(const x of [-w*.47,-w*.16,w*.16,w*.47])wall(x,(h+3)/2,.085,.16,h-3,.28,'#d4a183');
      wall(w*.20,h+.94,-d*.64,w*.52,1.74,d*.46,'#ba9580');
      wall(w*.20,h+1.87,-d*.64,w*.52+.22,.17,d*.46+.20,'#788783');
    }else if(kind==='coffee'){
      // A stepped terrazzo crown with a glazed stair tower and projecting fins.
      wall(0,h+.12,-d/2,w+.32,.24,d+.33,plaster);wall(-w*.28,h+1.0,-d*.61,2.3,2,d*.63,trim);
      for(let k=0;k<5;k++)wall(-w*.4+k*.47,h+1.12,-d*.29,.24,1.15,.09,'#b8d0c6');
      wall(-w*.28,h+2.12,-d*.61,2.66,.18,d*.68,plaster);
      for(let j=0;j<3;j++)wall(w*.43+j*.12,(h+3.15)/2,.18,.061,h-2.7,.39,plaster);
    }else{
      awning(w-.38,2.5,'#718693');
      for(let n=0;n<20;n++)wall(-w/2+.12+n*w/20,4.68,.20,.065,2.65,.29,'#b08261');
      pitched(0,h+.32,-d/2,w+.40,.18,d+.48,'#708282',-.12);
      wall(0,h+.12,-.02,w,.3,.18,trim);
    }
    // Downpipe and gooseneck under the projecting shop fascia.
    const drain=w/2-.18;
    add(rod([drain,.10,.125],[drain,h-.08,.125],.036),'#8c9181');
    sidewalkDisplay(s);
  }
  parkShops.forEach(shop);

  // Neighbouring blocks climb behind both streets in three depths. Model the
  // set-backs, stair cores, wraparound balconies and roof plant in silhouette.
  const skyline=[[-11,48,8.5,9,13],[-.7,55,9,9,17],[11.9,52.5,8.6,7,12],[23.6,50,9,8,19],
    [37.6,38,9,8,12],[37.3,20.8,9,8,16],[39,7.5,8,9,10],[50,29,7,11,18]];
  skyline.forEach(([x,z,w,d,h],i)=>{
    local(x,z,i>3?-.99:Math.PI);const tones=['#c5c8bc','#c4b9a1','#c1c9c4','#bdad9c'];
    const levels=Math.floor(h/2.85),floor=h/levels;
    wall(0,h/2,-d/2,w,h,d,tones[i%4]);wall(-w*.33,h+.65,-d*.64,w*.27,1.3,d*.38,tones[(i+1)%4]);
    for(let j=0;j<levels;j++){
      const y=(j+.58)*floor;
      for(let k=0;k<4;k++){
        const cx=(k-1.5)*w*.224;wall(cx,y,.018,w*.166,1.43,.10,'#789298');wall(cx,y,.085,.07,1.43,.06,tones[i%4]);
      }
      wall(w*.08,y-.79,.36,w*.87,.16,.88,plaster);wall(w*.08,y-.31,.76,w*.87,.75,.10,j%3?'#b2c1bb':tones[(i+2)%4]);
      for(const s of [-1,1])for(let k=0;k<2;k++)wall(s*w/2,y,-d*(.24+.45*k),.10,1.50,d*.25,'#8da4a4');
    }
    wall(0,h+.1,-d/2,w+.25,.2,d+.24,plaster);
    if(i%3===0){add(new CylinderGeometry(.81,.81,1.6,20).translate(w*.18,h+.82,-d*.57),'#9fa9a2');wall(w*.18,h+1.63,-d*.57,1.59,.10,1.59,zinc);}
  });
  // A small sheet-metal parcel depot at the bend. Its loading doors look
  // diagonally between the coffee house and florist, under their real eaves.
  local(28.6,46.0,-2.80);
  wall(0,1.70,-2.16,9.4,3.40,4.32,'#a89e8b');picture(0,1.69,.004,9.38,3.36,9,'pane',0,'#cdc1a9');
  wall(0,.26,.05,9.4,.52,.35,'#8d9890');wall(0,3.45,-2.18,9.7,.20,4.78,'#738883');
  for(const x of [-2.10,1.58]){
    wall(x,1.43,.070,2.78,2.49,.19,'#626c68');
    wall(x,1.77,.185,2.57,1.87,.07,'#9aa59b');
    for(let j=0;j<10;j++)wall(x,.89+j*.18,.232,2.55,.021,.022,'#849189');
    wall(x,2.76,.28,3.10,.085,.76,'#708078');wall(x,2.681,.11,2.97,.079,.24,'#66746d');
    for(let k=0;k<3;k++)wall(x-.76+k*.68,.48,.29,.55,.54-k%2*.10,.58,k%2?'#ba9d70':'#a68b68');
  }
  wall(0,3.91,-2.75,5.82,.79,1.72,'#bad0c6');
  pitched(0,4.37,-2.76,6.13,.121,2.03,'#6e827f',-.16);
  for(let i=0;i<6;i++)wall(-2.53+i*1.02,3.94,-1.853,.059,.68,.055,'#6c7c74');
  // Turn the glimpse into a street in depth: catch-basin, loading stripe,
  // culvert curb and a pair of short timber utility poles down the side lane.
  local(0,0);
  for(const [x,z] of [[20.25,43.1],[30.1,37.85]]){
    wall(x,.013,z,.58,.025,.24,'#727c77');for(let k=0;k<6;k++)wall(x-.22+k*.088,.029,z,.031,.01,.19,'#525f5b');
  }
  const pole=(x:number,z:number)=>{
    add(rod([x,0,z],[x+.038,5.77,z],.081,.057,10),'#827a6a');wall(x,5.49,z,1.20,.084,.094,'#596762');
    for(const dx of [-.49,.49])add(rod([x+dx,5.52,z],[x+dx,5.69,z],.039,.042,8),'#abb6ae');
  };
  pole(20.13,44.48);pole(30.65,42.30);
  for(const dx of [-.49,.49]){
    add(rod([20.13+dx,5.69,44.48],[25.38+dx,5.37,43.39],.012,.012,5),'#707b75');
    add(rod([25.38+dx,5.37,43.39],[30.65+dx,5.69,42.30],.012,.012,5),'#707b75');
  }

  // Across the rail cutting, the street rises to a concrete abutment and
  // a pair of low houses facing the water. Keep their roofs below the sky
  // from the station, and clear the seaward view from the park benches.
  for(const [house,x,z,w,d,grade] of [[0,-11.8,37.4,5.3,4.7,.86],[1,-13.1,30.6,4.15,4.0,.62]]){
    local(x,z,1.38);const tint=house?'#b7c2b6':'#ccba9e',h=house?2.98:4.42;
    wall(0,grade+h/2,-d/2,w,h,d,tint);picture(0,grade+h/2,.004,w,h,9,'pane',0,tint);
    wall(0,grade-.21,-d/2,w+.07,.43,d+.08,'#98a098');
    wall(0,grade+.21,-d/2,w+.12,.42,d+.13,'#89948b');
    wall(-w*.30,grade+1.11,.044,1.02,2.16,.12,'#667873');pane(w*.17,grade+1.38,.015,w*.40,1.03,7);
    if(!house){
      pane(-w*.19,grade+3.25,.015,2.34,1.32,8);balcony(-w*.17,grade+2.47,2.64,'#a9b5a7');
      wall(w*.30,grade+2.90,.11,.92,.53,.28,'#a7aa97');for(let j=0;j<5;j++)wall(w*.30,grade+2.72+j*.065,.265,.75,.019,.018,'#85948a');
    }
    pitched(0,grade+h+.22,-d/2,w+.45,.16,d+.70,house?'#70857f':'#907e69',-.13);
  }
  local(0,0);
  const prints=new BufferGeometry();prints.setAttribute('position',new Float32BufferAttribute(p,3));prints.setAttribute('uv',new Float32BufferAttribute(uv,2));prints.setAttribute('color',new Float32BufferAttribute(rgb,3));prints.setIndex(index);prints.computeVertexNormals();prints.computeBoundingSphere();
  return {solid:solids.finish(),prints};
}
