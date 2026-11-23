import type {ConceptionEvent} from '../../bodyState/reproduction/game';
import {ease,encounterSwimmers,lensView,mix,nuclei,SHELL,site,type Cut,type Swimmer,type V} from './encounterGeometry';
export {encounterCut,encounterSwimmers} from './encounterGeometry';

const {sin,cos,PI}=Math,TAU=PI*2;
const names={approach:['游近','Approach'],ring:['精子围拢','Encounter'],fusion:['精卵融合','Fusion'],nuclei:['原核靠近','Pronuclei approach'],
  zygote:['受精卵','Fertilized egg'],disperse:['精子散去','Dispersal'],miss:['未受精','Not fertilized']} as const;
type C=CanvasRenderingContext2D;
type Ink=string|CanvasGradient;
type Project=ReturnType<typeof lensView>;
function oval(c:C,x:number,y:number,a:number,b:number,fill:Ink,turn=0){
  c.beginPath();c.ellipse(x,y,a,b,turn,0,TAU);c.fillStyle=fill;c.fill();
}
function band(c:C,x:number,y:number,a:number,b:number,turn:number,from:number,to:number,width:number,col:Ink){
  c.beginPath();c.ellipse(x,y,a,b,turn,from,to);c.lineWidth=width;c.strokeStyle=col;c.stroke();
}
function pool(c:C,x:number,y:number,r:number,colors:ReadonlyArray<readonly [number,string]>){
  const g=c.createRadialGradient(x-r*.28,y-r*.36,r*.03,x,y,r);for(const [t,col] of colors)g.addColorStop(t,col);return g;
}
function shellRadius(a:number,press:number,lift:number,impact:number){const toward=Math.max(0,cos(a-impact));
  return (1+.018*sin(3*a+.54)-.016*cos(2*a-.76))*(1-.118*press*toward**16+.045*lift*toward**9);}
function outline(c:C,r:number,press:number,lift:number,impact:number){
  c.beginPath();for(let i=0;i<=72;i++){const a=i*TAU/72,d=r*shellRadius(a,press,lift,impact),x=d*cos(a),y=.965*d*sin(a);
    if(i)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();
}
function skin(c:C,r:number,fill:Ink,press=0,lift=0,impact=0){outline(c,r,press,lift,impact);c.fillStyle=fill;c.fill();}
// Tapered reflections follow the curve and the pressure of the local membrane.
function slick(c:C,r:number,start:number,end:number,width:number,ink:Ink,press=0,lift=0,impact=0){
  c.beginPath();for(let side=0;side<2;side++)for(let i=0;i<=18;i++){
    const u=side?1-i/18:i/18,a=mix(start,end,u),d=(r+(side?0:width*sin(PI*u)**.75))*shellRadius(a,press,lift,impact),x=d*cos(a),y=.965*d*sin(a);
    if(!side&&!i)c.moveTo(x,y);else c.lineTo(x,y);
  }c.closePath();c.fillStyle=ink;c.fill();
}
function zona(c:C,r:number,t:number,p:V,view:Project,cut:Cut){
  const angle=Math.atan2(p[1],p[0]),rim=ease(.47,.90,Math.hypot(p[0],p[1])),press=cut.press*rim,lift=cut.lift*rim,body=r*.814;
  skin(c,r,pool(c,0,0,r,[[0,'#8e566f'],[.73,'#a96883'],[.815,'#84506a'],[.865,'#d89aa2'],[.92,'#f6c8b3'],[.966,'#a56b86'],[1,'#ffdfc4']]),press,lift,angle);
  skin(c,body,pool(c,-r*.04,-r*.01,body,[[0,'#ffeaca'],[.31,'#ffc6a5'],[.63,'#f39495'],[.84,'#ce677f'],[1,'#a25072']]),press,lift,angle);
  slick(c,body*.71,-.06,2.58,body*.16,'rgba(255,172,152,.72)',press,lift,angle);
  slick(c,body*.63,.62,2.18,body*.07,'rgba(255,209,171,.60)',press,lift,angle);
  // Inclusions are embedded at different depths; the cortex rolls over them
  // on a turn. The upper-left key light and the outer reflections stay put.
  for(let i=0;i<10;i++){const a=i*2.4+.43,depth=.62*sin(i*2.76+.4),ring=Math.sqrt(1-depth*depth),d=body*(.50+.28*((i*7)%11)/11);
    const [x,y,z]=view([cos(a)*d*ring,sin(a)*d*ring,depth*d]);oval(c,x,y,body*(.055+.017*(i%2)),body*.029,z<0?'#df9b98':'#f3b1a2',a);}
  if(cut.warmth){c.save();c.globalAlpha*=cut.warmth;
    skin(c,body*.985,pool(c,r*p[0]*.63,r*p[1]*.63,body,[[0,'rgba(255,245,192,.86)'],[.44,'rgba(255,217,167,.60)'],[.78,'rgba(255,164,147,.26)'],[1,'rgba(248,135,146,0)']]),press,lift,angle);c.restore();}
  slick(c,r*.89,3.46,4.64,r*.077,'#fff2d2',press,lift,angle);slick(c,r*.915,4.72,5.09,r*.034,'#ffe0c1',press,lift,angle);
  slick(c,r*.91,.18,1.78,r*.045,'#ffcbbc',press,lift,angle);slick(c,body*.90,3.55,4.79,body*.04,'#ffd8ad',press,lift,angle);
  const bead=view([-.19,-.39,.213]);oval(c,bead[0],bead[1],r*.067,r*.049,'#ffe3b4',.86);
  const glint=-.5+.045*sin(t*.7);oval(c,-body*.35,-body*.43,body*.21,body*.08,'rgba(255,244,209,.88)',glint);
  oval(c,-body*.59,-body*.24,body*.057,body*.033,'#ffe3c5',glint);
}
function nucleus(c:C,p:V,r:number,female=true){const [x,y]=p;
  oval(c,x,y,r,r*.93,pool(c,x,y,r,[[0,female?'#ffceb4':'#fff4ca'],[.5,female?'#da8192':'#e4a79d'],[1,'#925266']]));
  oval(c,x-r*.23,y-r*.22,r*.25,r*.18,'#ffe5d1',-.35);oval(c,x+r*.22,y+r*.24,r*.21,r*.19,'#a35f76');
}
function head(c:C,p:Swimmer,view:Project){const [x,y,z]=view(p.head),axis=view(p.axis),size=p.size*(1+.055*z),shrink=1-.54*(1-p.headInk);
  c.save();c.globalAlpha*=p.headInk*(1-.21*p.entry);c.translate(x,y);c.rotate(Math.atan2(axis[1],axis[0]));
  c.scale(size*shrink*(.62+.38*Math.hypot(axis[0],axis[1])),size*shrink);
  oval(c,-.091,0,.074,.030,'#e7a4a6');oval(c,-.113,-.011,.039,.010,'#fff5db');
  c.beginPath();c.moveTo(-.119,0);c.bezierCurveTo(-.065,-.052,.009,-.101,.088,-.071);c.bezierCurveTo(.165,-.043,.167,.046,.092,.076);
  c.bezierCurveTo(.010,.115,-.066,.039,-.119,0);c.closePath();c.fillStyle=pool(c,.011,-.003,.154,[[0,'#fff9da'],[.50,'#ffdcba'],[.84,'#e69fa0'],[1,'#bd7384']]);c.fill();
  c.lineWidth=.015;c.strokeStyle='#783e58';c.stroke();oval(c,.013,.015,.059,.038,'#bd788c',.10);
  c.beginPath();c.moveTo(.039,-.066);c.bezierCurveTo(.117,-.095,.167,-.018,.117,.038);c.quadraticCurveTo(.093,-.030,.039,-.041);c.closePath();c.fillStyle=p.entry>.25?'#fffbd9':'#fff1d3';c.fill();
  oval(c,.075,-.046,.034,.014,'#fffcee',.22);c.restore();
}
function tail(c:C,p:Swimmer,points:V[],start:number,end:number,inner:boolean){
  const last=points.length-1;
  function ribbon(extra:number,col:string){c.beginPath();for(let side=0;side<2;side++)for(let i=0;i<=end-start;i++){
    const j=side?end-i:start+i,[x,y]=points[j],a=points[Math.max(0,j-1)],b=points[Math.min(last,j+1)];
    const dx=b[0]-a[0],dy=b[1]-a[1],w=(side?1:-1)*(extra+.005+.019*(1-j/last))*p.size/(Math.hypot(dx,dy)||1);
    if(!side&&!i)c.moveTo(x-dy*w,y+dx*w);else c.lineTo(x-dy*w,y+dx*w);
  }c.closePath();c.fillStyle=col;c.fill();}
  c.save();c.globalAlpha*=p.tailInk*(inner?.57:1);ribbon(.006,inner?'#a57480':'#704252');ribbon(0,inner?'#ffdac1':'#ffe8d6');c.restore();
}
type Piece={depth:number;inside:boolean;index:number;paint:()=>void};
function castLayers(swarm:Swimmer[],view:Project,c:C){const back:Piece[]=[],front:Piece[]=[];
  for(const p of swarm){const pts=p.tail.map(view);let start=0,previous=-1;
    const record=(stop:number,layer:number)=>{if(stop<=start)return;const a=start,b=stop,inside=layer===1;
      (layer===0?back:front).push({inside,index:p.index,depth:pts[(a+b)>>1][2],paint:()=>tail(c,p,pts,a,b,inside)});};
    for(let j=0;j<pts.length-1;j++){
      const a=p.tail[j],b=p.tail[j+1],inside=p.entry>0&&Math.hypot(a[0]+b[0],a[1]+b[1],a[2]+b[2])<2*SHELL;
      const layer=inside?1:pts[j][2]+pts[j+1][2]<0?0:2;
      if(previous!==layer){if(previous>=0)record(j,previous);start=j;previous=layer;}
    }record(pts.length-1,previous);
    if(p.headInk){const z=view(p.head)[2],inside=p.entry>0&&Math.hypot(...p.head)<SHELL;
      (inside||z>=0?front:back).push({inside,index:p.index,depth:z,paint:()=>head(c,p,view)});}
  }
  const order=(a:Piece,b:Piece)=>Number(b.inside)-Number(a.inside)||a.depth-b.depth;
  return {back:back.sort(order),front:front.sort(order)};
}
function egg(c:C,event:ConceptionEvent|undefined,t:number,time:number,cut:Cut,degrees:number){
  const view=lensView(degrees),p=view(site(event?.side??1)),r=SHELL+.012*cut.close+.003*sin(time*.74),angle=Math.atan2(p[1],p[0]);
  const layers=castLayers(encounterSwimmers(event,t),view,c);for(const part of layers.back)part.paint();
  zona(c,r,time,p,view,cut);
  // On the reverse side the entrant passes under the curved shell. Let the
  // contact area transmit its muted silhouette; don't pop a head from fully
  // occluded to fully visible as its centre crosses the internal cutaway.
  if(event?.success&&p[2]<0&&t>5.8&&t<10.18){c.save();const rim=ease(.47,.90,Math.hypot(p[0],p[1]));
    outline(c,r,cut.press*rim,cut.lift*rim,angle);c.clip();c.globalAlpha*=.67*ease(5.80,7.16,t);
    for(const part of layers.back)if(part.index===0)part.paint();c.restore();}
  const n=nuclei(event,t),separate=1-n.united;
  if(separate>0){c.save();c.globalAlpha*=separate;nucleus(c,view(n.maternal),.088);
    if(n.paternal){c.globalAlpha*=n.drawn;nucleus(c,view(n.paternal),.062+.022*n.drawn,false);}c.restore();}
  if(n.united){const centre=view(n.maternal);c.save();c.globalAlpha*=n.united;nucleus(c,centre,.100+.010*n.united,false);
    band(c,centre[0],centre[1],.123,.108,-.35,3.39,5.31,.011,'#ffe6bd');c.restore();}
  for(const part of layers.front)part.paint();
  if(cut.press||cut.lift){const k=ease(.47,.90,Math.hypot(p[0],p[1]));c.save();c.globalAlpha*=.83*cut.press+.64*cut.lift;
    if(k>.45)slick(c,r*.924,angle-.32,angle+.34,r*.044,'#ffeed0',cut.press*k,cut.lift*k,angle);
    else if(p[2]>0)band(c,r*p[0],r*p[1],.052,.039,angle,-.91,1.39,.010,'#ffe6ca');c.restore();}
}

export function paintConceptionLens(c:C,event:ConceptionEvent|undefined,x:number,y:number,r:number,zh:boolean,time:number,age:number,cut:Cut,degrees=38,caption=true){
  c.save();c.translate(x,y);c.scale(r,r);c.lineCap='round';c.lineJoin='round';
  oval(c,0,.035,1.009,1.009,'#291b2b');oval(c,0,0,1,1,pool(c,-.08,.07,1.11,[[0,'#b87389'],[.36,'#aa627c'],[.70,'#86455f'],[.90,'#653449'],[1,'#492b40']]));
  c.save();c.beginPath();c.arc(0,0,.973,0,TAU);c.clip();
  c.save();c.rotate(-.29);c.translate(.06,.018*sin(time*.43));
  c.beginPath();c.moveTo(-1.1,-.34);c.bezierCurveTo(-.84,-.76,-.46,-.86,-.13,-.84);c.bezierCurveTo(.34,-.79,.57,-.97,.87,-.86);
  c.bezierCurveTo(.39,-1.15,-.66,-1.17,-1.1,-.83);c.closePath();const wall=c.createLinearGradient(-.1,-.74,.15,.86);wall.addColorStop(0,'#db91a1');wall.addColorStop(1,'#a15b77');c.fillStyle=wall;c.fill();
  slick(c,.865,3.7,4.56,.025,'#f3b7b1');slick(c,.837,4.59,5.04,.018,'#c98597');slick(c,.858,.74,2.53,.101,'rgba(220,133,152,.52)');slick(c,.921,1.32,2.32,.029,'#db929e');c.restore();
  egg(c,event,age,time,cut,degrees);c.restore();band(c,0,0,.99,.99,0,0,TAU,.018,'#d9ac98');band(c,0,0,.948,.948,0,3.23,4.95,.015,'#f3c9b2');
  c.restore();if(caption){const name=cut.title?names[cut.title][zh?0:1]:zh?'卵子':'Ovum';c.save();c.textAlign='center';c.textBaseline='top';
    c.font=`600 ${r*.233}px system-ui,sans-serif`;c.fillStyle='#ffeede';c.fillText(name,x,y+r+2,r*2.22);c.restore();}
}
