import type { Vector3 } from 'three';
import { pelvicSection } from './geometry';
import { rod, rodRadii } from './path';
import type { PelvicProfile, PelvicSample } from './stateTypes';

// One calibrated sagittal projection for the actor sheet, the screen, and the
// read-only plate beside the actor. Measurements remain in world metres.
export const SECTION_W = 344, SECTION_H = 282;
const art = { paper:'#fcf8f5', ink:'#302b32', muted:'#62545c', rule:'#daced1',
  uterus:'#e3b1ad', cervix:'#cd9296', canal:'#f3d5cf', wall:'#885961',
  fluid:'#62bfb9', meniscus:'#176a68', shaft:'#253e67', tip:'#264fc3', alert:'#973b49' };
const left = 82, right = 335, top = 33, bottom = 187;
type P2 = {x:number; y:number};
const cm = (v:number) => (100*v).toFixed(1);
export const fmtUnits = (v:number) => String(+v.toFixed(2));

export function sectionLayout(lengthM:number, radiusM:number) {
  const section = pelvicSection({ lengthM,radiusM });
  // The chart is socket-relative, not camera-relative: a head turn cannot
  // turn insertion into retraction. Tilt the cut on paper for label clearance.
  const c = Math.cos(Math.PI/6), s = Math.sin(Math.PI/6);
  const flat = (y:number,z:number):P2 => ({ x:c*z+s*y, y:s*z-c*y });
  const all = [...section.uterus,...section.cervix,...section.canal].map(p=>flat(p.y,p.z));
  const outside=Math.min(lengthM*2.1,.205);
  all.push(flat(-radiusM*.35,outside));
  const xs=all.map(p=>p.x), ys=all.map(p=>p.y);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const pxPerM=Math.min((right-left)/(x1-x0||1),(bottom-top)/(y1-y0||1));
  const project = (y:number,z:number):P2 => {const p=flat(y,z);return {
    x:(left+right)/2+(p.x-(x0+x1)/2)*pxPerM, y:(top+bottom)/2+(p.y-(y0+y1)/2)*pxPerM,
  };};
  function region(points:Vector3[],throat:number,canal=false) {
    const ps=points.map(p=>project(p.y,p.z));
    // Both oval contours are paired at equal axial depth; the tubular canal
    // returns along its second wall. Preserve the solver's full outer contour
    // and draw a distinct schematic lumen inside it, not liquid in the wall.
    const cavity=ps.map((p,i)=>{const q=ps[canal?ps.length-1-i:(ps.length-i)%ps.length];return {
      x:(p.x+q.x)/2+(p.x-q.x)*throat/2,y:(p.y+q.y)/2+(p.y-q.y)*throat/2,
    };});
    function loop(vertices:P2[]){const p=new Path2D();vertices.forEach(({x,y},i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p;}
    const yLo=Math.min(...cavity.map(p=>p.y)),yHi=Math.max(...cavity.map(p=>p.y));
    const target=ps.reduce((a,p)=>p.x<a.x?p:a,ps[0]);
    return {path:loop(ps),lumen:loop(cavity),yLo,yHi,target};
  }
  return { project,pxPerM, canal:region(section.canal,.75,true),cervix:region(section.cervix,.19),uterus:region(section.uterus,.58),entry:project(section.entry.y,section.entry.z) };
}
type Layout = ReturnType<typeof sectionLayout>;
function label(ctx:CanvasRenderingContext2D, text:string,x:number,y:number,color=art.ink,weight=550,size=16,align:CanvasTextAlign='left') {
  ctx.fillStyle=color; ctx.textAlign=align; ctx.font=`${weight} ${size}px system-ui,sans-serif`;ctx.textBaseline='middle';ctx.fillText(text,x,y);
}
function line(ctx:CanvasRenderingContext2D, points:readonly P2[], color:string,width:number) {
  ctx.beginPath(); points.forEach(({x,y},i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function dot(ctx:CanvasRenderingContext2D,p:P2,r:number,color:string){ctx.beginPath();ctx.arc(p.x,p.y,r,0,2*Math.PI);ctx.fillStyle=color;ctx.fill();}

export function drawPelvicSection(ctx:CanvasRenderingContext2D, layout:Layout, profile:PelvicProfile, sample:PelvicSample|null, zh:boolean) {
  const l=(a:string,b:string)=>zh?a:b, mode=profile.container, fantasy=mode==='fantasyUterine';
  ctx.save();ctx.scale(ctx.canvas.width/SECTION_W,ctx.canvas.height/SECTION_H);
  ctx.fillStyle=art.paper;ctx.fillRect(0,0,SECTION_W,SECTION_H);ctx.lineJoin=ctx.lineCap='round';
  label(ctx,l('骨盆矢状剖面','Pelvic sagittal section'),10,15,art.ink,650,17);
  const uncertain=!!sample&&!sample.outletInside&&!sample.outletVisible;
  const status=!sample?l('无杆位采样','No rod sample'):sample.outletInside?(sample.atCervix?l('限位 · 在内','Stop · inside'):l('喷口在内','Outlet inside')):
    sample.outletVisible?l('喷口在外','Outlet outside'):sample.atCervix?l('越限 · 不释放','Past stop · no dose'):l('未确认 · 不释放','Unverified · no dose');
  label(ctx,status,SECTION_W-10,15,uncertain||sample?.atCervix?art.alert:art.muted,550,15,'right');
  for (const key of ['uterus','canal','cervix'] as const) {
    const shape=layout[key];ctx.fillStyle=art[key];ctx.fill(shape.path);
    ctx.fillStyle='#fff2eb';ctx.fill(shape.lumen);
    const vessel=key==='uterus'?'fantasyUterine':key==='canal'?'vaginal':null;
    // Fantasy balance is retained when switching away, but is only drawn on
    // the uterus with the explicitly labelled fictional mode selected.
    if(vessel&&(vessel==='vaginal'||fantasy)&&profile.fluid[vessel]>0) {
      const fraction=Math.max(0,Math.min(1,profile.fluid[vessel]/profile.capacity[vessel]));
      const h=(shape.yHi-shape.yLo)*fraction, y=shape.yHi-h;
      ctx.save();ctx.clip(shape.lumen);ctx.fillStyle=art.fluid;ctx.fillRect(0,y,SECTION_W,h+1);
      line(ctx,[{x:0,y},{x:SECTION_W,y}],art.meniscus,2.2);ctx.restore();
    }
    ctx.strokeStyle='#b8777a';ctx.lineWidth=1.2;ctx.stroke(shape.lumen);
    ctx.strokeStyle=art.wall;ctx.lineWidth=key==='cervix'?2.2:1.6;ctx.stroke(shape.path);
  }
  if(sample) {
    const points=(sample.shaft?.length ? sample.shaft : [sample.tail,sample.tip]).map(p=>layout.project(p[1],p[2]));
    const tip=layout.project(sample.tip[1],sample.tip[2]);
    ctx.save();ctx.beginPath();ctx.rect(left-2,top-3,right-left+2,bottom-top+7);ctx.clip();
    // When the mould samples are present, also project the actual shaft
    // profile (including its flange). The centreline stays legible over tint.
    const shaft=sample.shaft;
    if(shaft&&shaft.length===rod.length){
      const a=shaft[0],b=shaft[1],scale=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/rod[1].distanceTo(rod[0]);
      const rims:P2[][]=[[],[]];
      points.forEach((p,i)=>{
        const prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
        const dx=next.x-prev.x,dy=next.y-prev.y,n=Math.hypot(dx,dy)||1,r=rodRadii[i]*scale*layout.pxPerM;
        rims[0].push({x:p.x+r*dy/n,y:p.y-r*dx/n});rims[1].push({x:p.x-r*dy/n,y:p.y+r*dx/n});
      });
      ctx.beginPath();[...rims[0],...rims[1].reverse()].forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
      ctx.fillStyle='rgba(99,129,177,0.47)';ctx.fill();ctx.strokeStyle=art.shaft;ctx.lineWidth=1;ctx.stroke();
    }
    if(uncertain||!sample.aligned)ctx.setLineDash([5,3]);
    line(ctx,points,art.paper,7);line(ctx,points,art.shaft,4.8);ctx.setLineDash([]);
    dot(ctx,tip,5.4,art.paper);dot(ctx,tip,3.8,uncertain?art.alert:art.tip);
    if(uncertain){line(ctx,[{x:tip.x-1.5,y:tip.y-1.5},{x:tip.x+1.5,y:tip.y+1.5}],art.paper,1.2);line(ctx,[{x:tip.x+1.5,y:tip.y-1.5},{x:tip.x-1.5,y:tip.y+1.5}],art.paper,1.2);}
    else if(sample.outletVisible&&!sample.outletInside)dot(ctx,tip,1.8,art.paper);
    ctx.restore();
    // A tracked hand can be metres away. Do not squeeze the anatomy to fit it
    // or clamp a false 'tip' to the edge. Point towards the off-chart sample.
    if(tip.x<left||tip.x>right||tip.y<top||tip.y>bottom){
      const e=layout.entry,dx=tip.x-e.x,dy=tip.y-e.y;
      const k=Math.min(dx>0?(right-7-e.x)/dx:dx<0?(left+7-e.x)/dx:Infinity,dy>0?(bottom-5-e.y)/dy:dy<0?(top+5-e.y)/dy:Infinity);
      const x=e.x+dx*k,y=e.y+dy*k, a=Math.atan2(dy,dx);ctx.save();ctx.translate(x,y);ctx.rotate(a);
      line(ctx,[{x:-7,y:-4},{x:0,y:0},{x:-7,y:4}],uncertain?art.alert:art.tip,2.4);ctx.restore();
    }
  }
  const names = [l('子宫','Uterus'),l('宫颈','Cervix'),l('阴道','Vagina')];
  const labels = ([layout.uterus,layout.cervix,layout.canal]).map((r,i)=>({target:r.target,title:names[i]})).sort((a,b)=>a.target.y-b.target.y);
  let prev=top-17;
  labels.forEach(({target,title},i)=>{
    const y=Math.min(bottom-20*(2-i),Math.max(prev+23,target.y)), x=target.x-3;prev=y;
    line(ctx,[{x:66,y},{x:74,y},{x:x-8,y:target.y},{x,y:target.y}],art.wall,1);dot(ctx,{x,y:target.y},1.8,art.wall);
    label(ctx,title,10,y,art.ink,550,16);
  });
  const x=11,y=bottom-8;
  line(ctx,[{x,y},{x:x+17,y}],art.shaft,3.8);dot(ctx,{x:x+17,y},3.5,art.tip);
  label(ctx,l('杆 / 尖端','Rod / tip'),x,y-16,art.shaft,550,14);
  line(ctx,[{x:10,y:196},{x:SECTION_W-10,y:196}],art.rule,1);
  const depth=sample?`${cm(sample.depth)} cm`:'—',angle=sample?`${Math.round(sample.angleDeg)}°`:'—';
  label(ctx,`${l('深度','Depth')} ${depth}`,10,211,art.ink,600,16);
  label(ctx,`${l('轴角','Angle')} ${angle}`,142,211,art.ink,600,16);
  label(ctx,sample?`${l('侧偏','Lat.')} ${cm(sample.tip[0])} cm`:'',SECTION_W-10,211,art.muted,500,13,'right');
  const amount=profile.fluid[mode], capacity=profile.capacity[mode];
  label(ctx,fantasy?l('虚构宫腔液位','Fantasy uterine level'):l('阴道液位','Vaginal level'),10,235,art.meniscus,600,16);
  label(ctx,`${fmtUnits(amount)} / ${fmtUnits(capacity)} ${l('游戏单位','game u.')}`,SECTION_W-10,235,art.ink,600,16,'right');
  ctx.fillStyle=art.rule;ctx.fillRect(10,249,SECTION_W-20,4);ctx.fillStyle=art.meniscus;ctx.fillRect(10,249,(SECTION_W-20)*Math.min(1,amount/capacity),4);
  label(ctx,`${l('溢出','Overflow')} ${fmtUnits(profile.overflow)}`,10,268,profile.overflow>0?art.alert:art.muted,550,15);
  label(ctx,`${l('已排出','Drained')} ${fmtUnits(profile.drained)}`,SECTION_W-10,268,art.muted,550,15,'right');
  ctx.restore();return `${status} · ${l('深度','Depth')} ${depth} · ${angle} · ${fantasy?l('虚构宫腔','Fantasy uterus'):l('阴道','Vagina')} ${fmtUnits(amount)} / ${fmtUnits(capacity)} · ${l('溢出','Overflow')} ${fmtUnits(profile.overflow)} · ${l('已排出','Drained')} ${fmtUnits(profile.drained)}`;
}
