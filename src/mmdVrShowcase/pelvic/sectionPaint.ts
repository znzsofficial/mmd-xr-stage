import { rod, rodRadii } from './path';
import {semenColor,semenFill,semenHighlight} from '../play/semenAppearance';
import { plot, SECTION_H, SECTION_W, outletLabel, sectionEvidence, type Point, type SectionLayout, type Slice } from './sectionProjection';
import {drawVulva,exteriorBox,exteriorLens} from './atlas/vulvaSurface';
import type {EntryType} from './atlas/entryLettering';
import type { PelvicProfile, PelvicSample } from './stateTypes';
export { sectionLayout, SECTION_H, SECTION_W, type SectionAngle } from './sectionProjection';

type Ctx = CanvasRenderingContext2D;
type Evidence = ReturnType<typeof sectionEvidence>;
const ink={paper:'#211722',pearl:'#fff1e9',muted:'#cfb9c2',rule:'#694957',gold:'#ebc68e',fluid:semenColor,
  tip:'#90bcff',exterior:'#c7a5ff',warning:'#ffba9f'};
export const fmtUnits=(v:number)=>String(+v.toFixed(2));
const cm=(v:number)=>`${(100*v).toFixed(1)} cm`;
const signedCm=(v:number)=>`${v>0?'+':''}${cm(v)}`;
function label(ctx:Ctx,text:string,x:number,y:number,color=ink.pearl,size=14,weight=550,align:CanvasTextAlign='left'){
  ctx.font=`${weight} ${size}px system-ui,"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(text,x,y);
}
function path(points:readonly Point[],close=false){
  const p=new Path2D();for(const [i,q] of points.entries())if(i)p.lineTo(q.x,q.y);else p.moveTo(q.x,q.y);
  if(close)p.closePath();return p;
}
function stroke(ctx:Ctx,p:Path2D,color:string,width:number){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke(p);}
function fill(ctx:Ctx,p:Path2D,color:string|CanvasGradient){ctx.fillStyle=color;ctx.fill(p);}
function line(ctx:Ctx,ps:readonly Point[],color:string,width:number){stroke(ctx,path(ps),color,width);}
function dot(ctx:Ctx,p:Point,r:number,color:string){ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function cubic(points:Point[]){
  const p=new Path2D();p.moveTo(points[0].x,points[0].y);
  for(let i=1;i+2<points.length;i+=3){const [a,b,c]=points.slice(i,i+3);p.bezierCurveTo(a.x,a.y,b.x,b.y,c.x,c.y);}
  return p;
}
function gradient(ctx:Ctx,a:Point,b:Point,stops:readonly (readonly [number,string])[]){
  const g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);for(const [at,col] of stops)g.addColorStop(at,col);return g;
}
function ringAt(rs:Slice[],t:number){return rs[Math.round((rs.length-1)*t)];}
function contour(rs:Slice[],kind:'skin'|'face'|'lumen'){
  const lumen=kind==='lumen',left=kind==='face'?-.80:-1,right=kind==='face'?.96:1;
  const vl=kind==='face'?.60:0,vr=kind==='face'?.28:0;
  const ps=rs.map(r=>r.at(left,vl,lumen));for(let i=rs.length-1;i>=0;i--)ps.push(rs[i].at(right,vr,lumen));
  // The near half of the elliptical basal rim is visible. Its height and
  // orientation follow the viewing direction, including the entry plane.
  const start=Math.acos(right),end=Math.acos(left);
  for(let j=1;j<15;j++){const a=start+(end-start)*j/15;ps.push(rs[0].at(Math.cos(a),Math.sin(a)*(kind==='face'?.72:1),lumen));}
  return path(ps,true);
}
function apertureLoop(basal:Slice,inside:boolean){
  return path(Array.from({length:48},(_,i)=>{const a=i*Math.PI/24;return basal.at(Math.cos(a),Math.sin(a),inside);}),true);
}
function contours(v:SectionLayout){
  const rings=[...v.canal,...v.cervix.slice(1),...(v.entryFocus?[]:v.uterus.slice(1))];
  const end=v.uterus.findIndex(r=>!r.open),body=v.uterus.slice(0,end<0?undefined:end+1);
  const canal=contour(v.canal,'lumen'),aperture=apertureLoop(v.canal[0],true),canalLiquid=new Path2D(canal);
  // The longitudinal cut meets the near lip; a low dose is still visible
  // through the exposed end face when looking in from the exterior.
  if(Math.cos(v.yaw)>.015)canalLiquid.addPath(aperture);
  return {skin:contour(rings,'skin'),face:contour(rings,'face'),canal,canalLiquid,aperture,
    cervix:contour(v.cervix,'lumen'),uterus:body.length?contour(body,'lumen'):new Path2D(),body};
}
type Shapes=ReturnType<typeof contours>;

function drawAdnexa(ctx:Ctx,v:SectionLayout){
  const face=Math.abs(Math.cos(v.yaw)),width=v.pxPerM*v.lengthM;
  for(const [i,a] of v.adnexa.entries()){
    ctx.save();ctx.globalAlpha=.25+.75*face;
    if(i===0)ctx.globalAlpha*=.70+.30*face;
    const tube=cubic(a.tube),w=Math.max(1.6,width*.052);
    stroke(ctx,tube,'#512f43',w+2.3);stroke(ctx,tube,'#bc737e',w);stroke(ctx,tube,'#f5b5ab',w*.34);
    const ampulla=cubic(a.tube.slice(3));stroke(ctx,ampulla,'#d89594',w*1.34);stroke(ctx,ampulla,'#ffd0b2',w*.42);
    // A separate, tilted ovoid with a pearl margin and follicle pits,
    // behind the flared infundibulum; not a circle glued to the tube.
    ctx.save();ctx.translate(a.at.x,a.at.y);ctx.rotate(a.roll);
    const oval=new Path2D();oval.ellipse(0,0,a.rx,a.ry,0,0,2*Math.PI);
    fill(ctx,oval,gradient(ctx,{x:0,y:-a.ry},{x:0,y:a.ry},[[0,'#f4d9bb'],[.36,'#ddb1a3'],[.72,'#c18389'],[1,'#865566']]));
    stroke(ctx,oval,'#f1c3ae',.85);ctx.clip(oval);
    for(const [x,y,k] of [[-.48,-.12,.17],[.05,.27,.20],[.34,-.19,.23],[-.18,-.49,.11]]){
      const rr=Math.max(.65,a.ry*k);dot(ctx,{x:x*a.rx,y:y*a.ry},rr+.45,'#efcbbb');dot(ctx,{x:x*a.rx,y:y*a.ry-.25},rr,'#a97480');
    }
    ctx.restore();
    for(const strand of a.fringe){const f=cubic(strand);stroke(ctx,f,'#85495c',Math.max(1.6,w*.70));stroke(ctx,f,'#f6b1a0',Math.max(.85,w*.33));}
    ctx.restore();
  }
}

function tissue(ctx:Ctx,v:SectionLayout,g:Shapes){
  const fundus=ringAt(v.entryFocus?v.canal:v.uterus,.7),ls=fundus.at(-1,0),rs=fundus.at(1,0);
  ctx.save();ctx.translate(1.5,2);stroke(ctx,g.skin,'#301d2e',3);ctx.restore();
  fill(ctx,g.skin,gradient(ctx,ls,rs,[[0,'#6a3b53'],[.15,'#aa6078'],[.31,'#eaa49d'],[.66,'#ad667a'],[1,'#69394f']]));
  stroke(ctx,g.skin,'#e29b9b',1.12);
  fill(ctx,g.face,gradient(ctx,ls,rs,[[0,'#cc8290'],[.19,'#f0b9a7'],[.42,'#eaa499'],[.72,'#bd7182'],[.91,'#e29b95'],[1,'#f4b49d']]));
  stroke(ctx,g.face,'#f6bea5',.85);
  // Fine fascicles on the oblique cut surface. Varying width and curvature
  // around the fundus follow the loft instead of a screen-space hatch.
  ctx.save();ctx.clip(g.face);
  if(!v.entryFocus)for(const sign of [-1,1])for(let j=0;j<4;j++){
    const begin=.08+j*.11,end=.96-j*.014,points=v.uterus.flatMap((r,i)=>{
      const t=i/(v.uterus.length-1);if(t<begin||t>end)return [];
      const k=(t-begin)/(end-begin),u=.34+.115*j+.18*Math.sin(Math.PI*k)-.19*k;
      return [r.at(sign*u,.12+.12*Math.sin(Math.PI*k))];
    });line(ctx,points,j%2?'#c57d89':'#ffd0b5',.77);
  }
  // The two narrow transverse cuts define the cervical lips.
  for(const t of [.18,.73]){const r=ringAt(v.cervix,t);line(ctx,[r.at(-.8,.28),r.at(-.36,.22),r.at(0,.26),r.at(.47,.27),r.at(.89,.22)],'#bd7683',.9);}
  ctx.restore();
  for(const [p,r] of [[g.uterus,fundus],[g.canal,ringAt(v.canal,.49)],[g.cervix,ringAt(v.cervix,.39)]] as const){
    if(v.entryFocus&&p===g.uterus)continue;
    const wash=gradient(ctx,r.at(-1,0,true),r.at(1,0,true),[[0,'#925a70'],[.15,'#77465b'],[.53,'#482c41'],[.88,'#663e52'],[1,'#a36776']]);
    stroke(ctx,p,'#b97483',3.8);fill(ctx,p,wash);stroke(ctx,p,'#ffcfb2',1.24);
  }
  // Rugae are paired, offset mucosal ridges on the exposed back wall. They
  // break at the midline. The much narrower cervical canal stays separate.
  ctx.save();ctx.clip(g.canal);
  for(let j=0;j<6;j++)for(const sign of [-1,1]){
    const t=.13+j*.126+(sign>0?.025:0),a=ringAt(v.canal,t),b=ringAt(v.canal,t+.055);
    const p=cubic([a.at(sign*1.02,0,true),a.at(sign*.71,-.10,true),b.at(sign*.45,-.20,true),b.at(sign*.20,-.23,true)]);
    stroke(ctx,p,'#543247',1.75);stroke(ctx,p,'#b07783',.76);
  }
  ctx.restore();
  if(!v.entryFocus)for(const sign of [-1,1])line(ctx,g.body.map(r=>r.at(sign*.89,-.04,true)),'#db998e',.75);
  // The true aperture ellipse closes the open end of the longitudinal cut.
  // Edge-on it reduces to a lip; from the exterior the viewer sees its bore.
  const basal=v.canal[0];
  if(Math.cos(v.yaw)>.015){
    const outer=apertureLoop(basal,false);fill(ctx,outer,'#bd7d87');
    fill(ctx,g.aperture,gradient(ctx,basal.at(0,1,true),basal.at(0,-1,true),[[0,'#472b40'],[.53,'#643c51'],[1,'#9a6071']]));
    stroke(ctx,outer,'#e5ab9c',.85);stroke(ctx,g.aperture,'#f0b7a4',.95);
  }
  // A gold interrupted bar is the actual terminal cross section. There is
  // no live trajectory running from here into the illustrated uterine lumen.
  const end=v.canal[v.canal.length-1];ctx.save();ctx.setLineDash([2.6,2.1]);
  line(ctx,[end.at(-.75,0),end.center,end.at(.75,0)],ink.gold,1.65);ctx.restore();
}

function callouts(ctx:Ctx,v:SectionLayout,zh:boolean){
  const t=(z:string,e:string)=>zh?z:e;
  const tags=[{to:ringAt(v.uterus,.65).at(-.92,0),name:t('宫体','Uterus')},
    {to:ringAt(v.cervix,.53).at(-.96,0),name:t('宫颈','Cervix')},
    {to:ringAt(v.canal,.43).at(-.92,0),name:t('阴道','Vagina')},
    {to:v.canal[0].at(-.88,.15,true),name:t('入口','Entry')}];
  if(Math.abs(Math.cos(v.yaw))>.54){const ov=v.adnexa.reduce((a,b)=>a.at.x<b.at.x?a:b);tags.push({to:ov.at,name:t('卵巢','Ovary')});}
  tags.sort((a,b)=>a.to.y-b.to.y);
  let prev=plot.top-15;
  tags.forEach(({to,name},i)=>{
    const y=Math.min(plot.bottom-8-22*(tags.length-1-i),Math.max(prev+22,to.y));prev=y;
    const x=Math.max(64,to.x-3);
    line(ctx,[{x:59,y},{x:68,y},{x:Math.max(72,x-16),y:to.y},{x,y:to.y}],'#a77d83',.85);
    dot(ctx,{x,y:to.y},1.7,ink.gold);label(ctx,name,9,y,ink.pearl,13.5,550);
  });
  // An actual metre ruler; choose a 1/2/5 step near 26 logical pixels.
  const span=26/v.pxPerM,unit=10**Math.floor(Math.log10(span)),n=span/unit;
  const distance=(n>=5?5:n>=2?2:1)*unit,x=SECTION_W-11,y=plot.bottom-7,w=distance*v.pxPerM;
  line(ctx,[{x:x-w,y:y-3},{x:x-w,y},{x,y},{x,y:y-3}],ink.gold,1.1);label(ctx,`${fmtUnits(distance*100)} cm`,x,y-10,ink.gold,11.5,550,'right');
}

function paintPlate(ctx:Ctx,v:SectionLayout,g:Shapes,zh:boolean,type?:EntryType|null){
  ctx.fillStyle=ink.paper;ctx.fillRect(0,0,SECTION_W,SECTION_H);ctx.lineJoin=ctx.lineCap='round';
  if(v.entryFocus){
    drawVulva(ctx,v.yaw);tissue(ctx,v,g);
    const exterior=exteriorLens(v.yaw,v.radiusM),rim=exterior(-.4*v.radiusM,-.92*v.radiusM,0);
    function leader(name:string,from:Point,x:number,y:number,right=false){
      const w=right?(zh?56:77):(zh?40:49);
      type?.draw(ctx,name,right?x-w:x,y);
      const end=x+(right?-1:1)*(w+5);line(ctx,[from,{x:end+(right?-6:6),y},{x:end,y}],ink.muted,.85);dot(ctx,from,1.65,ink.gold);
    }
    // At a full lateral view the near fold occludes the external opening.
    // The cutaway remains available; don't label the outer skin as the bore.
    if(Math.abs(Math.cos(v.yaw))>.30)leader(zh?'阴道口':'Opening',rim,9,201);
    leader(zh?'宫颈限位':'Cervical stop',v.canal.at(-1)!.at(.72,0),335,34,true);
    type?.draw(ctx,zh?'外阴':'Vulva',9,15);type?.draw(ctx,zh?'阴道剖面':'Vaginal canal',181,15);
    line(ctx,[{x:171,y:10},{x:171,y:214}],ink.rule,.8);
    line(ctx,[{x:9,y:223},{x:335,y:223}],ink.rule,1);
    return;
  }
  const a=v.stop,glow=ctx.createRadialGradient(a.x,a.y,0,a.x,a.y,92);glow.addColorStop(0,'rgba(134,71,86,.20)');glow.addColorStop(1,'rgba(134,71,86,0)');
  ctx.fillStyle=glow;ctx.fillRect(plot.left,plot.top,plot.right-plot.left,plot.bottom-plot.top);
  drawAdnexa(ctx,v);tissue(ctx,v,g);callouts(ctx,v,zh);
  for(const y of [25.5,198.5])line(ctx,[{x:9,y},{x:SECTION_W-9,y}],ink.rule,1);
}
// Reuse a single backing canvas *per destination*, even through animated
// yaw. During tracking, the only work is one blit plus liquid, probe and text.
type Plate={canvas:HTMLCanvasElement;v?:SectionLayout;zh?:boolean;g?:Shapes;type?:EntryType|null};
const plates=new WeakMap<Ctx,Plate>();
function background(ctx:Ctx,v:SectionLayout,zh:boolean,type?:EntryType|null){
  let b=plates.get(ctx);const {width,height}=ctx.canvas;
  if(!b&&typeof document!=='undefined'){b={canvas:document.createElement('canvas')};plates.set(ctx,b);}
  if(b){
    if(v!==b.v||zh!==b.zh||type!==b.type||width!==b.canvas.width||height!==b.canvas.height||!b.g){
      if(width!==b.canvas.width)b.canvas.width=width;if(height!==b.canvas.height)b.canvas.height=height;
      const c=b.canvas.getContext('2d');if(c){
        b.g=contours(v);c.setTransform(width/SECTION_W,0,0,height/SECTION_H,0,0);paintPlate(c,v,b.g,zh,type);b.v=v;b.zh=zh;b.type=type;
      }
    }
    if(b.v===v&&b.g){ctx.drawImage(b.canvas,0,0,SECTION_W,SECTION_H);return b.g;}
  }
  const g=contours(v);paintPlate(ctx,v,g,zh,type);return g;
}

function liquid(ctx:Ctx,shape:Path2D,y:number){
  ctx.save();ctx.clip(shape);ctx.fillStyle=semenFill;ctx.fillRect(0,y,SECTION_W,SECTION_H-y);
  line(ctx,[{x:0,y},{x:SECTION_W,y}],semenHighlight,2);ctx.restore();
}
function marker(ctx:Ctx,p:Point,state:Evidence['state'],r:number){
  if(state==='absent')return;
  const {x,y}=p;
  if(state==='parked'){
    ctx.fillStyle=ink.paper;ctx.fillRect(x-r,y-r,2*r,2*r);ctx.strokeStyle=ink.gold;ctx.lineWidth=1.6;ctx.strokeRect(x-r,y-r,2*r,2*r);return;
  }
  if(state==='inside'){dot(ctx,p,r+1,'#342c46');dot(ctx,p,r,ink.tip);dot(ctx,p,r*.40,'#eef7ff');return;}
  if(state==='outside'){
    const d=path([{x:x-r,y},{x,y:y-r},{x:x+r,y},{x,y:y+r}],true);fill(ctx,d,ink.paper);stroke(ctx,d,ink.exterior,2);return;
  }
  dot(ctx,p,r+.9,ink.paper);line(ctx,[{x:x-r*.65,y:y-r*.65},{x:x+r*.65,y:y+r*.65}],ink.warning,2.1);
  line(ctx,[{x:x-r*.65,y:y+r*.65},{x:x+r*.65,y:y-r*.65}],ink.warning,2.1);
}
function drawProbe(ctx:Ctx,v:SectionLayout,e:Evidence,sample:PelvicSample){
  const tip=e.tip!,plot=v.box;ctx.save();ctx.beginPath();ctx.rect(plot.left,plot.top,plot.right-plot.left,plot.bottom-plot.top);ctx.clip();
  const inside=e.state==='inside',points=e.shaft,src=sample.shaft;
  if(points.length>1){
    const parked=e.state==='parked',color=stateInk(e.state);
    if(src&&points.length===rod.length){
      const a=src[0],b=src[1],scale=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])/rod[1].distanceTo(rod[0]);
      const left:Point[]=[],right:Point[]=[];
      points.forEach((p,i)=>{const prev=points[Math.max(0,i-1)],next=points[Math.min(i+1,points.length-1)];
        const dx=next.x-prev.x,dy=next.y-prev.y,h=Math.hypot(dx,dy)||1,r=rodRadii[i]*scale*v.pxPerM;
        left.push({x:p.x-r*dy/h,y:p.y+r*dx/h});right.push({x:p.x+r*dy/h,y:p.y-r*dx/h});});
      const shape=path([...left,...right.reverse()],true);if(!parked)fill(ctx,shape,inside?'rgba(113,155,255,.39)':'rgba(174,141,232,.30)');else ctx.setLineDash([3,3]);stroke(ctx,shape,color,.95);ctx.setLineDash([]);
    }
    if(!inside)ctx.setLineDash([4,3]);const linePath=path(points);stroke(ctx,linePath,'#372b48',4);stroke(ctx,linePath,color,2);ctx.setLineDash([]);
  }
  bearingOrMarker(ctx,plot,v.entry,tip,e.state);ctx.restore();
}
function bearingOrMarker(ctx:Ctx,plot:{left:number;right:number;top:number;bottom:number},o:Point,tip:Point,state:Evidence['state']){
  if(tip.x<plot.left||tip.x>plot.right||tip.y<plot.top||tip.y>plot.bottom){
    // This is a bearing, not a clamped tip. Its terminal glyph is an arrow.
    const dx=tip.x-o.x,dy=tip.y-o.y,m=Math.min(dx>0?(plot.right-5-o.x)/dx:dx<0?(plot.left+5-o.x)/dx:Infinity,
      dy>0?(plot.bottom-5-o.y)/dy:dy<0?(plot.top+5-o.y)/dy:Infinity);
    ctx.save();ctx.translate(o.x+m*dx,o.y+m*dy);ctx.rotate(Math.atan2(dy,dx));line(ctx,[{x:-7,y:-4},{x:0,y:0},{x:-7,y:4}],stateInk(state),2.2);ctx.restore();
  }else marker(ctx,tip,state,4.25);
}
const stateInk=(s:Evidence['state'])=>s==='parked'?ink.gold:s==='unverified'?ink.warning:s==='inside'?ink.tip:s==='outside'?ink.exterior:ink.muted;

export function drawPelvicSection(ctx:Ctx,layout:SectionLayout,profile:PelvicProfile,sample:PelvicSample|null,zh:boolean,parked=false,type?:EntryType|null){
  const t=(z:string,e:string)=>zh?z:e,e=sectionEvidence(layout,profile,sample,parked);
  const mode=profile.container,fantasy=mode==='fantasyUterine',amount=profile.fluid[mode],capacity=profile.capacity[mode];
  const state=e.state,status=outletLabel(sample,zh,parked);
  const deg=Math.round(layout.yaw*180/Math.PI),view=deg===0?t('正面','Front'):deg===90?t('侧面','Side'):deg===38?t('斜前','Oblique'):`${deg}°`;
  const depth=e.depth===null?'—':cm(e.depth),angle=e.angle===null?'—':`${Math.round(e.angle)}°`,lat=e.lateral===null?'—':signedCm(e.lateral);
  const vessel=fantasy?t('宫腔精液量','Semen · uterus'):t('阴道精液量','Semen · vagina');
  ctx.save();ctx.scale(ctx.canvas.width/SECTION_W,ctx.canvas.height/SECTION_H);ctx.lineJoin=ctx.lineCap='round';
  const g=background(ctx,layout,zh,type);
  if(e.vaginal>0)liquid(ctx,g.canalLiquid,layout.levelY('canal',e.vaginal));if(!layout.entryFocus&&e.uterine>0)liquid(ctx,g.uterus,layout.levelY('uterus',e.uterine));
  if(sample)drawProbe(ctx,layout,e,sample);
  if(layout.entryFocus){
    if(sample&&sample.tip[2]>=0&&state!=='inside'){
      const project=exteriorLens(layout.yaw,layout.radiusM);bearingOrMarker(ctx,exteriorBox,project(0,0,0),project(...sample.tip),state);
    }
    if(sample)marker(ctx,{x:14,y:242},state,4.2);
    const name=!sample?t('入口半径','Opening radius'):state==='inside'?t('在内深度','Insertion depth'):t('距入口平面','From entry plane');
    const value=!sample?cm(layout.radiusM):state==='inside'?depth:signedCm(sample.tip[2]),metric=`${name}  ${value}`;
    const offset=sample?`${t('侧偏','Lateral')}  ${lat}`:'';
    if(type){type.draw(ctx,status,sample?27:9,242);type.draw(ctx,name,9,265);type.number(ctx,value,zh?146:179,265);
      if(sample){type.draw(ctx,t('侧偏','Lateral'),223,265);type.number(ctx,lat,335,265);}}
    ctx.restore();
    return `${t('外阴、阴道口及阴道剖面','Vulva, opening and vaginal canal')} · ${status} · ${metric}${offset?' · '+offset:''}`;
  }
  label(ctx,`${t('测量剖面','Section')} · ${view}`,9,12,ink.pearl,15.5,650);
  const key=stateInk(state);
  label(ctx,status,SECTION_W-9,12,key,14.5,600,'right');const w=ctx.measureText(status).width;marker(ctx,{x:SECTION_W-18-w,y:12},state,3.6);
  for(const [x,name,value] of [[10,t('进入深度','Depth'),depth],[133,t('轴角','Angle'),angle],[225,t('侧偏','Lateral'),lat]] as const){
    label(ctx,name,x,208,ink.muted,12.5,520);label(ctx,value,x,224,ink.pearl,16,650);
  }
  label(ctx,vessel,10,245,ink.fluid,14.5,600);
  label(ctx,`${fmtUnits(amount)} / ${fmtUnits(capacity)} ${t('游戏单位','game u.')}`,SECTION_W-10,245,ink.pearl,14.5,600,'right');
  ctx.fillStyle='#57404e';ctx.fillRect(10,255,SECTION_W-20,3);ctx.fillStyle=ink.fluid;ctx.fillRect(10,255,(SECTION_W-20)*(fantasy?e.uterine:e.vaginal),3);
  const overflow=`${t('溢出','Overflow')} ${fmtUnits(profile.overflow)}`,drained=`${t('已排出','Drained')} ${fmtUnits(profile.drained)}`;
  label(ctx,overflow,10,270,profile.overflow>0?ink.warning:ink.muted,13.5);label(ctx,drained,SECTION_W-10,270,ink.muted,13.5,550,'right');ctx.restore();
  const plane=sample?` · ${t('喷口相对入口 Z（向外为正）','Nozzle Z from entry (+out)')} ${signedCm(sample.tip[2])}`:'';
  return `${view} · ${status} · ${t('深度','Depth')} ${depth} · ${t('轴角','Angle')} ${angle} · ${t('侧偏','Lateral')} ${lat}${plane} · ${t('入口半径','Entry radius')} ${cm(layout.radiusM)} · ${t('通道长度','Canal length')} ${cm(layout.lengthM)} · ${vessel} ${fmtUnits(amount)} / ${fmtUnits(capacity)} · ${overflow} · ${drained}`;
}
