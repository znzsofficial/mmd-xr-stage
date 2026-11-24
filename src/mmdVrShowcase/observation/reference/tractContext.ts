import type {DiagramSpec} from '../../components/ActorDiagram';
import {atlasDiagrams} from '../../pelvic/atlas/AtlasGraphic';
import type {V} from '../../bodyState/breast/art/geometry';
import {useLanguageStore} from '../../../languageStore';
import {chamber} from './uterineStudy';

type Part='vagina'|'vulva';
// The inset is a locator, not a second contact simulation. A gold line
// singles out the canal or external landmark on the same maternal section.
function locator(c:CanvasRenderingContext2D,part:Part,degrees:number,zh:boolean){
  const a=-degrees*Math.PI/180,s=Math.sin(a),k=Math.cos(a),size=110;
  const project=([x,y,z]:V):[number,number]=>[82+(x*k-(z-.21)*s)*size,159-y*size];
  const line=(points:V[],ink:string,width:number,fill=false)=>{c.beginPath();points.forEach((v,i)=>{const p=project(v);if(i)c.lineTo(...p);else c.moveTo(...p);});
    if(fill){c.closePath();c.fillStyle=ink;c.fill();}else {c.lineWidth=width;c.strokeStyle=ink;c.stroke();}};
  c.fillStyle='#291d29';c.fillRect(0,0,164,282);c.lineCap=c.lineJoin='round';
  const cut=(inner:boolean)=>Array.from({length:66},(_,i)=>chamber(i<33?i/32:(65-i)/32,a+(i<33?.5:1.5)*Math.PI,inner));
  line(cut(false),'#d79589',1,true);line(cut(true),'#804e61',1,true);
  const [hx,hy]=project([-.17,.66,.25]);c.fillStyle='#eabd9f';c.beginPath();c.ellipse(hx,hy,21,24,-.26,0,2*Math.PI);c.fill();
  line([[-.09,.52,.19],[0,.43,.17],[.12,.27,.20],[.19,.17,.23]],'#eabd9f',25);
  line([[.19,.16,.23],[.29,.30,.32],[.30,.32,.37],[.15,.17,.42]],'#f0caaa',10);
  line([[.015,.43,.25],[.086,.35,.34],[-.036,.46,.40]],'#f4d6ba',7);
  line([[0,-.22,.18],[0,-.31,.20],[.005,-.41,.234],[.008,-.50,.291]],part==='vagina'?'#f4d39d':'#b87c87',part==='vagina'?9:7);
  line([[-.045,-.512,.29],[0,-.536,.32],[.045,-.512,.29]],part==='vulva'?'#f4d39d':'#b87c87',part==='vulva'?8:6);
  c.textAlign='center';c.textBaseline='middle';c.font='600 18px system-ui,sans-serif';c.fillStyle='#fff1df';
  c.fillText(zh?'孕态位置参考':'Reference map',82,24,154);c.fillStyle='#f4d39d';c.fillText(part==='vagina'?(zh?'阴道':'Vagina'):(zh?'外阴':'Vulva'),82,246,154);
}
export function tractContext(part:Part):DiagramSpec{
  const base=atlasDiagrams[part],width=base.width+164,id=`reference-context-${part}`;
  return {...base,id,width,meshName:`observation:${id}`,open(canvas,owner,wake,upload){
    const dest=canvas.getContext('2d'),scale=canvas.width/width,live=document.createElement('canvas');
    live.width=Math.round(base.width*scale);live.height=canvas.height;
    let lastAngle=NaN,lastLanguage='';
    // Compose on the actual live brush's publication: even while the atlas
    // eases a drag or waits for a bitmap the map never leads its sample.
    return base.open(live,owner,wake,()=>{
      if(!dest)return;const angle=Number(live.dataset.angle),lang=useLanguageStore.getState().language,zh=lang==='zh';
      dest.drawImage(live,0,0);dest.save();dest.scale(scale,scale);
      if(angle!==lastAngle||lang!==lastLanguage){dest.save();dest.translate(base.width,0);locator(dest,part,angle,zh);dest.restore();lastAngle=angle;lastLanguage=lang;}
      dest.font='600 17px system-ui,sans-serif';dest.textBaseline='top';dest.fillStyle='#fff1df';dest.fillText(zh?'角色实况':'Actor view',8,6);dest.restore();
      canvas.setAttribute('aria-label',`${live.getAttribute('aria-label')} · ${zh?'孕态位置参考':'Pregnancy reference map'}`);
      canvas.dataset.view=id;canvas.dataset.angle=live.dataset.angle;upload();});
  }};
}
export const tractContexts={vagina:tractContext('vagina'),vulva:tractContext('vulva')};
