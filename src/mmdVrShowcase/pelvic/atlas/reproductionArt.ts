import type {ConceptionEvent} from '../../bodyState/reproduction/game';
import {PICTURE_END} from '../../bodyState/reproduction/pictureClock';
import {ovary,tubePath,type V} from './model';
import {encounterCut,paintConceptionLens} from './conceptionStudy';

type Paper=CanvasRenderingContext2D;
type Project=(p:V)=>V;
const tau=2*Math.PI,gold='#ffe1a1',paper='#281d2a';
const wings=([-1,1] as const).map(side=>({ovum:ovary(side),tube:Array.from({length:25},(_,i)=>tubePath(i/24,side))}));
function dot(c:Paper,x:number,y:number,r:number,ink:string){c.beginPath();c.arc(x,y,r,0,tau);c.fillStyle=ink;c.fill();}
function locator(c:Paper,x:number,y:number,scale:number):Project{
  c.save();c.translate(x,y);c.scale(scale,-scale);c.lineWidth=.16;c.lineCap='round';
  c.beginPath();c.moveTo(-2.12,3.62);c.bezierCurveTo(-2.35,4.45,-.94,4.89,0,4.65);c.bezierCurveTo(1.02,4.88,2.35,4.46,2.12,3.62);
  c.bezierCurveTo(2,1.9,.64,1.18,.49,-.58);c.quadraticCurveTo(0,-1.28,-.49,-.58);c.bezierCurveTo(-.64,1.13,-2.02,1.91,-2.12,3.62);
  c.fillStyle='#945e71';c.fill();c.strokeStyle='#d59a9a';c.stroke();
  c.beginPath();c.moveTo(-1.6,3.63);c.quadraticCurveTo(0,2.91,1.6,3.63);c.quadraticCurveTo(.35,2.88,0,.46);c.quadraticCurveTo(-.35,2.88,-1.6,3.63);c.fillStyle='#633d55';c.fill();
  c.beginPath();c.moveTo(-.49,-.58);c.lineTo(-.57,-2.62);c.moveTo(.49,-.58);c.lineTo(.57,-2.62);c.stroke();
  for(const {tube,ovum} of wings){c.beginPath();tube.forEach(([px,,pz],i)=>{if(i)c.lineTo(px,pz);else c.moveTo(px,pz);});c.strokeStyle='#cf9998';c.lineWidth=.26;c.stroke();
    c.beginPath();c.ellipse(ovum[0],ovum[2],.72,.44,0,0,tau);c.fillStyle='#deb79f';c.fill();}
  c.restore();return ([px,,pz])=>[x+px*scale,y-pz*scale,0];
}
const along=(e:ConceptionEvent,t:number):V=>{
  const start=e.target==='vaginal'?-2.36:1.65;
  if(t<.39){const k=t/.39;return [e.side*.63*k*k,.25,start+(3.42-start)*k];}
  const k=(t-.39)/.61;
  if(k<.21){const end=tubePath(0,e.side);return [.63*e.side+(end[0]-.63*e.side)*k/.21,.25+(end[1]-.25)*k/.21,3.42+(end[2]-3.42)*k/.21];}
  return tubePath(.80*(k-.21)/.79,e.side);
};
function location(c:Paper,event:ConceptionEvent|undefined,project:Project,x:number,y:number,r:number,k:number,age:number){
  if(!event)return;
  const [px,py]=project(tubePath(.8,event.side)),dir=Math.atan2(py-y,px-x);
  c.beginPath();c.moveTo(px,py);c.lineTo(x+r*Math.cos(dir),y+r*Math.sin(dir));c.strokeStyle='#ac8978';c.lineWidth=k;c.stroke();
  dot(c,px,py,4*k,gold);dot(c,px,py,2.7*k,paper);dot(c,px,py,1.3*k,gold);
  // A schematic transit, only for a retained internal dose. Sampling the
  // delivery's own target keeps a later lens or destination change read-only.
  if(event.target&&age<5)for(let i=0;i<5;i++){
    const t=(age-i*.21)/3.85;if(t<0||t>1)continue;const p=project(along(event,t)),q=project(along(event,Math.max(0,t-.035)));
    c.beginPath();c.moveTo(q[0],q[1]);c.lineTo(p[0],p[1]);c.strokeStyle='#d8b7b0';c.lineWidth=k;c.stroke();dot(c,p[0],p[1],1.65*k,'#fff4de');
  }
}

/** The operating sheet uses its whole plate for the encounter. The actor's
 * anatomical overview below uses precisely the same brush at inset scale. */
export function drawEncounter(c:Paper,event:ConceptionEvent|undefined,w:number,h:number,zh:boolean,age=PICTURE_END,degrees=38){
  const r=Math.min(w*.355,h*.444),x=w-r-w*.025,y=h*.46;
  c.save();c.fillStyle='#211722';c.fillRect(0,0,w,h);
  const project=locator(c,(x-r)*.5,h*.59,Math.min((x-r)*.080,h*.042));location(c,event,project,x,y,r,Math.min(w/344,h/282),age);
  paintConceptionLens(c,event,x,y,r,zh,age,age,encounterCut(event,age),degrees);c.restore();
}
export function drawEncounterInset(c:Paper,event:ConceptionEvent,project:Project,w:number,h:number,sideCut:boolean,zh:boolean,age=PICTURE_END,degrees=38){
  c.save();const map=sideCut?locator(c,w*.16,h*.41,w*.026):project,k=Math.min(w/344,h/282),cut=encounterCut(event,age);
  const [midX,midY]=project([0,0,-2.6]),scale=Math.abs(project([0,0,-1.6])[1]-midY),limit=(w-7*k-midX-1.40*scale)/2;
  const extra=cut.close*Math.max(0,Math.min(16*k,limit-58*k)),r=58*k+extra,x=w-7*k-r,y=h*.736-1.25*extra;
  location(c,event,map,x,y,r,k,age);paintConceptionLens(c,event,x,y,r,zh,age,age,cut,degrees);c.restore();
}
