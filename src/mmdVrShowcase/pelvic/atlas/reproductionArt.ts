import type {ReproductiveSample} from '../../bodyState/reproduction/game';
import {ovary,tubePath,type V} from './model';
import {PICTURE_END} from '../../bodyState/reproduction/pictureClock';
import {encounterCut,paintConceptionLens} from './conceptionStudy';

type Paper=CanvasRenderingContext2D;
type Project=(p:V)=>V;
const gold='#ffe1a1',paper='#281d2a',pearl='#fff2df',rose='#d18f97';
const tau=2*Math.PI;
function ellipse(c:Paper,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,tau);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke();}
}
export function activeSites(s:ReproductiveSample):V[]{
  if(s.stage==='ovulated'||s.stage==='expired')return s.eggs===2?[ovary(s.side),ovary(-s.side)]:[ovary(s.side)];
  if(s.stage==='fertilized'||s.stage==='transit'||s.stage==='unfertilized')return [tubePath(.80*(1-s.travel),s.side),...(s.secondOvum?[ovary(-s.side)]:[])];
  if(s.stage==='cavity'||s.stage==='notImplanted')return [[s.side*.68,.86,2.85]];
  if(s.implanted)return [[s.side*.73,.85,2.04]];
  return [];
}

/** Sagittal dissection removes the adnexa. Give the tube/ovary marker its own
 * clearly frontal locator rather than painting a phantom ovary over the slit. */
function frontalLocator(c:Paper,w:number,h:number,zh:boolean):Project{
  const size=Math.min(w*.33,h*.47),x=size*.55,y=h*.34;
  const map:Project=([a,,z])=>[x+a*size*.081,y-z*size*.096,0];
  c.save();c.translate(x-size*.51,y-size*.67);c.fillStyle=paper;c.fillRect(0,0,size*1.02,size*.93);
  c.fillStyle=pearl;c.textAlign='center';c.font=`550 ${size*.116}px system-ui,sans-serif`;c.fillText(zh?'正面定位':'Front locator',size*.51,size*.14);c.restore();
  const corpus=map([0,0,1.4]);c.lineWidth=1.4;ellipse(c,corpus[0],corpus[1],size*.123,size*.18,'#915767',rose);
  for(const side of [-1,1]){c.beginPath();for(let i=0;i<=20;i++){const [x,y]=map(tubePath(i/20,side));if(i)c.lineTo(x,y);else c.moveTo(x,y);}
    c.strokeStyle='#edafa2';c.lineWidth=2.6;c.stroke();const [x,y]=map(ovary(side));ellipse(c,x,y,size*.072,size*.044,'#dfb99a');}
  c.font=`550 ${size*.103}px system-ui,sans-serif`;c.textAlign='center';c.fillStyle=pearl;
  const [tx,ty]=map(tubePath(.55,-1)),[ox,oy]=map(ovary(1));
  c.fillText(zh?'输卵管':'Tube',tx,ty-4);c.fillText(zh?'卵巢':'Ovary',ox,oy+size*.16);c.fillText(zh?'子宫':'Uterus',corpus[0],y+size*.20);
  return map;
}

export function drawReproduction(c:Paper,s:ReproductiveSample,project:Project,w:number,h:number,sideCut:boolean,zh:boolean,time:number,age=PICTURE_END){
  c.save();c.lineCap='round';c.lineJoin='round';
  const locator=sideCut?frontalLocator(c,w,h,zh):project,sites=activeSites(s),k=Math.min(w/344,h/282);
  if(sites.length){
    const cut=encounterCut(s,age);
    // Keep the whole plate still. Fit the transient iris into the space to
    // the right of the lower tract, including when the player turns past front.
    const [midX,midY]=project([0,0,-2.6]),scale=Math.abs(project([0,0,-1.6])[1]-midY);
    const limit=(w-7*k-midX-1.40*scale)/2,extra=cut.close*Math.max(0,Math.min(16*k,limit-58*k));
    const pts=sites.map(locator),[px,py]=pts[0],r=58*k+extra,x=w-7*k-r,y=h*.736-1.25*extra;
    // Leader terminates on the locator when the corresponding organ was cut
    // away; an attached sac also has a marker on the visible uterine section.
    const link=Math.atan2(py-y,px-x);c.lineWidth=1.25*k;c.strokeStyle='#e4bf93';c.beginPath();c.moveTo(px,py);c.lineTo(x+r*Math.cos(link),y+r*Math.sin(link));c.stroke();
    if(sideCut&&(s.implanted||s.stage==='cavity'))pts.push(project(sites[0]));
    for(const [i,[x,y]] of pts.entries()){c.lineWidth=1.65*k;ellipse(c,x,y,5.5*k,5.5*k,paper,i>0&&s.secondOvum?rose:gold);
      if(!i||!s.secondOvum)ellipse(c,x,y,2.2*k,2.2*k,gold);}
    paintConceptionLens(c,s,x,y,r,zh,time,age,cut);
  }
  c.restore();
}
