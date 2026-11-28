import type {Print} from './streetPrint';
import type {streetPlots} from './streetPlots';

type Trade=typeof streetPlots[number][11];
type Paper=CanvasRenderingContext2D;
const jade='#4f8181',paper='#eadbb9',brick='#ad6351',navy='#344f58',gold='#d6aa62';
const inks=[jade,brick,gold,navy,'#809987','#caa486'];
function rect(g:Paper,color:string,x:number,y:number,w:number,h:number){g.fillStyle=color;g.fillRect(x,y,w,h);}
function circle(g:Paper,color:string,x:number,y:number,r:number){g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,2*Math.PI);g.fill();}
function poly(g:Paper,color:string,...points:number[][]){
  g.fillStyle=color;g.beginPath();g.moveTo(points[0][0],points[0][1]);
  for(const [x,y] of points.slice(1))g.lineTo(x,y);g.closePath();g.fill();
}
function type(g:Paper,text:string,x:number,y:number,size:number,ink:string,font='system-ui,sans-serif'){
  g.fillStyle=ink;g.font=`700 ${size}px ${font}`;g.fillText(text,x,y);
}
function shelf(g:Paper,y:number){rect(g,'#a58c6b',10,y,492,4);rect(g,'#414b44',10,y+4,492,3);}
function dial(g:Paper,x:number,y:number,r:number,angle:number){
  circle(g,'#3e5453',x,y,r+3);circle(g,paper,x,y,r);g.save();g.translate(x,y);
  for(let i=0;i<12;i++){rect(g,navy,-.85,2-r,1.7,3.2);g.rotate(Math.PI/6);}
  g.rotate(angle);rect(g,brick,-1.25,-r*.74,2.5,r*.80);g.rotate(-1.8);rect(g,navy,-1.6,-r*.53,3.2,r*.53);
  g.restore();circle(g,navy,x,y,2);
}

const displays:Record<Trade,(g:Paper)=>void>={
  sail(g){
    for(const [i,x] of [57,177,294,438].entries()){
      const y=i%2?73:64;g.strokeStyle=paper;g.lineWidth=13;g.beginPath();g.arc(x,y,25,0,Math.PI*2);g.stroke();
      g.strokeStyle=brick;for(let n=0;n<4;n++){g.beginPath();g.arc(x,y,25,n*Math.PI/2,n*Math.PI/2+.45);g.stroke();}
      rect(g,'#c5b494',x-1,5,2,y-34);
    }shelf(g,112);
  },
  canvas(g){
    for(let i=0;i<5;i++){
      const x=22+i*98,h=42+(i%3)*18;
      poly(g,inks[i],[x,99],[x+45,99-h],[x+49,99]);poly(g,paper,[x+52,95-h],[x+79,91],[x+53,97]);
      rect(g,'#b09e7b',x+49,16,2,89);poly(g,navy,[x,101],[x+84,101],[x+66,110],[x+12,110]);
    }shelf(g,113);
  },
  post(g){
    for(let j=0;j<3;j++)for(let i=0;i<6;i++){
      const x=14+i*50,y=13+j*33;rect(g,'#8c7b61',x,y,47,30);rect(g,'#524e43',x+2,y+2,43,26);
      rect(g,paper,x+8,y+8,18,7);rect(g,'#ad9573',x+27,y+19,10,3);
    }
    rect(g,paper,338,19,146,72);type(g,'末班收件',351,46,19,navy);type(g,'17 : 40',350,77,26,brick);shelf(g,111);
  },
  press(g){
    // Two overlapping pull-proofs; their registration crosses are outside
    // the crop marks. The companion bay holds the compositor's type cases.
    rect(g,'#c3a486',19,21,72,86);rect(g,paper,52,12,77,91);type(g,'潮',59,74,56,navy);
    rect(g,brick,60,80,58,4);type(g,'EDITION  12',61,94,8,navy);
    rect(g,'#dac698',157,19,113,85);circle(g,brick,218,50,23);poly(g,jade,[164,86],[195,46],[227,82],[262,55],[262,96],[164,96]);
    for(const x of [162,265]){rect(g,navy,x-3,24,6,1);rect(g,navy,x,21,1,7);}
    for(let j=0;j<3;j++)for(let i=0;i<7;i++){
      const x=289+i*29,y=24+j*28;rect(g,'#b09a79',x,y,28,26);rect(g,'#62594b',x+2,y+2,24,21);
      type(g,'ESTUARY'[i],x+6,y+17,12,'#c5b7a1','serif');
    }shelf(g,111);
  },
  records(g){
    for(const [i,x] of [24,134,250,381].entries()){
      const y=i%2?41:32;circle(g,'#333f42',x+62,y+32,33);circle(g,inks[(i+1)%6],x+62,y+32,10);
      rect(g,paper,x-1,y-1,56,62);rect(g,inks[i],x,y,54,60);
      if(i%2===0){circle(g,'#e9c078',x+36,y+15,8);poly(g,navy,[x,y+40],[x+13,y+21],[x+30,y+36],[x+42,y+26],[x+54,y+33],[x+54,y+45],[x,y+45]);}
      else for(let line=0;line<6;line++){
        g.strokeStyle=i===1?'#efd3a0':'#80a99d';g.lineWidth=1.8;g.beginPath();g.moveTo(x+3,y+15+line*4);
        g.bezierCurveTo(x+17,y-9+line*4,x+35,y+43-line*3,x+50,y+12+line*4);g.stroke();
      }
      rect(g,paper,x+2,y+48,50,10);type(g,['LOW TIDE','RADIO 6','SLOW WAVE','B SIDE'][i],x+4,y+55,6,navy);
    }shelf(g,108);
  },
  news(g){
    for(let i=0;i<5;i++){const x=19+i*99,y=25+(i%2)*12;rect(g,'#e2d5b7',x,y,76,75);
      type(g,'海站晨报',x+5,y+17,14,navy);rect(g,brick,x+6,y+21,64,2);rect(g,jade,x+6,y+28,30,24);
      for(let r=0;r<5;r++)rect(g,'#8f8e7b',x+40,y+28+r*6,28,2);for(let r=0;r<3;r++)rect(g,'#94927c',x+6,y+57+r*5,62,2);
    }shelf(g,114);
  },
  stationery(g){
    for(const [i,x] of [22,77,132].entries()){
      for(let j=0;j<5;j++){g.save();g.translate(x+19,60);g.rotate((j-2)*.13);rect(g,inks[(i+j)%6],-2,-44+(j%2)*9,4,43);poly(g,paper,[-2,-44+(j%2)*9],[0,-49+(j%2)*9],[2,-44+(j%2)*9]);g.restore();}
      poly(g,i%2?jade:gold,[x,44],[x+39,44],[x+33,82],[x+6,82]);
    }
    rect(g,'#c1b08a',207,20,95,83);rect(g,paper,213,26,83,69);
    poly(g,navy,[222,83],[248,36],[270,82],[259,82],[248,59],[234,83]);type(g,'DRAWING SET',221,94,8,navy);
    for(let i=0;i<6;i++){
      const x=321+29*i,y=22+(i%3)*7;rect(g,inks[i],x,y,25,103-y);rect(g,paper,x+2,y+8,21,15);rect(g,navy,x+3,y+2,2,100-y);
    }
    rect(g,'#ae9471',16,82,166,5);shelf(g,111);
  },
  clocks(g){
    for(const [i,x] of [50,148,251,355,455].entries()){
      const y=49+(i%2)*8,r=i===2?29:20;
      rect(g,i%2?'#947555':'#735f4d',x-r-6,y-r-4,2*r+12,105-y+r+4);
      dial(g,x,y,r,i*.87);rect(g,gold,x-1,y+r,2,12);circle(g,gold,x,y+r+12,4);
    }shelf(g,109);
  },
  pharmacy(g){
    for(let j=0;j<2;j++)for(let i=0;i<16;i++){
      const x=17+30*i,y=53+j*53,h=19+(i%3)*6;
      rect(g,'#624b3f',x+5,y-h-5,8,7);rect(g,i%3===0?'#ced0b7':'#896747',x,y-h,18,h);
      rect(g,'#e4d6ae',x+1,y-h*.74,16,h*.42);rect(g,inks[i%6],x+4,y-h*.61,10,2);
    }shelf(g,56);shelf(g,110);
  },
  pavilion(g){for(let i=0;i<6;i++){const x=i*82+17;rect(g,i%2?'#718879':'#819588',x,10,73,100);type(g,`0${i+1}`,x+8,34,16,paper);rect(g,'#546861',x+59,47,4,15);for(let j=0;j<3;j++)rect(g,'#62776a',x+14,80+j*5,43,2);}shelf(g,113);},
  electrical(g){for(let i=0;i<7;i++){const x=38+72*i;rect(g,'#5c675e',x-1,5,2,28+i%3*5);rect(g,navy,x-6,29+i%3*5,12,8);poly(g,inks[i%6],[x-7,36+i%3*5],[x+7,36+i%3*5],[x+26,59+i%3*5],[x-26,59+i%3*5]);rect(g,paper,x-24,59+i%3*5,48,3);rect(g,'#8b8570',x-17,90,34,16);}shelf(g,110);},
};

export function tradeWindow(trade:Trade):Print{return {w:512,h:128,paint(g){
  const light=g.createLinearGradient(0,0,0,128);light.addColorStop(0,'#435550');light.addColorStop(.64,'#737b69');light.addColorStop(1,'#545b4e');
  g.fillStyle=light;g.fillRect(0,0,512,128);displays[trade](g);
  poly(g,'rgba(201,221,218,.10)',[53,0],[123,0],[65,128],[-5,128]);
  poly(g,'rgba(201,221,218,.07)',[474,0],[512,0],[473,128],[422,128]);
}};}

// A public tide instrument above the sports-street collection window. The
// backwards receipt is the neighbourhood's one unexplained, everyday event.
export const tideGauge:Print={w:512,h:288,paint(g){
  rect(g,'#eadfc7',0,0,512,288);rect(g,navy,0,0,512,45);type(g,'海站水文  /  回潮观测点',16,31,22,paper);
  rect(g,'#d4c8a8',16,57,480,2);
  circle(g,'#657d75',121,149,76);circle(g,'#f4e7c9',121,149,70);
  g.save();g.translate(121,149);
  for(let i=0;i<=16;i++){
    g.save();g.rotate((i/16-.5)*Math.PI*1.40);rect(g,navy,-1.25,-63,2.5,i%4===0?12:6);g.restore();
  }
  g.textAlign='center';type(g,'0',-43,21,13,navy);type(g,'2',0,-42,13,navy);type(g,'4',43,21,13,navy);
  type(g,'METRES',0,42,11,navy);g.rotate(.56);poly(g,brick,[-3,8],[0,-57],[3,8]);circle(g,navy,0,0,5);g.restore();
  type(g,'潮  位',227,121,47,navy);type(g,'TIDE REGISTER',231,153,23,'#627874');
  for(let i=0;i<12;i++)rect(g,i===8?brick:'#899b90',232+i*20,183-(i%3)*3,3,14+(i%3)*3);
  rect(g,brick,230,204,231,4);g.fillStyle=jade;g.beginPath();g.moveTo(0,238);
  for(let i=0;i<8;i++){g.quadraticCurveTo(16+i*64,226,32+i*64,238);g.quadraticCurveTo(48+i*64,250,64+i*64,238);}g.lineTo(512,288);g.lineTo(0,288);g.fill();
  type(g,'← 03   夏日泳池',16,277,25,'#fff0d0');type(g,'04   电玩西廊 →',303,277,25,'#fff0d0');
}};
export const tideCounter:Print={w:512,h:144,paint(g){
  rect(g,'#4f635f',0,0,512,144);rect(g,'#627873',7,7,232,130);
  type(g,'回潮招领窗',17,33,25,paper);type(g,'FOUND AT SEA',18,52,12,'#d6caaa');
  // Only half lowered; the open part reveals a tagged yellow umbrella.
  for(let i=0;i<4;i++)rect(g,'#81918a',17,61+i*5,207,3);
  g.fillStyle=gold;g.beginPath();g.moveTo(36,117);g.quadraticCurveTo(49,94,111,86);g.quadraticCurveTo(165,89,187,116);
  for(const x of [187,157,127,97,67])g.quadraticCurveTo(x-15,107,x-30,117);g.fill();
  g.strokeStyle='#ac844d';g.lineWidth=1.4;for(const x of [67,97,127,157]){g.beginPath();g.moveTo(111,86);g.quadraticCurveTo((111+x)/2+4,89,x,115);g.stroke();}
  g.strokeStyle='#d8c79a';g.lineWidth=3;g.beginPath();g.moveTo(111,113);g.lineTo(111,126);g.quadraticCurveTo(111,138,100,129);g.stroke();
  rect(g,paper,156,117,16,11);type(g,'07',159,125,8,navy);
  rect(g,'#ddceb0',255,10,246,122);type(g,'认领回执    Nº 071',268,36,19,navy);
  rect(g,'#a79e83',267,43,221,2);type(g,'拾得日期   明日',269,75,21,navy);type(g,'归还日期   今日',269,107,21,brick);
}};

export const clockFace:Print={w:128,h:160,paint(g){
  rect(g,'#d8c7a1',0,0,128,160);rect(g,'#4c6e67',3,3,122,154);dial(g,64,59,46,-.71);
  type(g,'校 时',34,134,23,paper);type(g,'STATION TIME',33,149,9,'#d8caaa');
}};
