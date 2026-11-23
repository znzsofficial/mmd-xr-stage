import type {ReproductiveSample} from '../../bodyState/reproduction/game';

const {sin,cos,PI}=Math,TAU=PI*2;
const unit=(x:number)=>Math.min(1,Math.max(0,x));
export const ease=(a:number,b:number,t:number)=>{const k=unit((t-a)/(b-a));return k*k*(3-2*k);};
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const contactAngle=-.31;
const encounterNames={approach:['游近','Approach'],ring:['精子围拢','Encounter'],fusion:['融合','Fusion'],
  zygote:['受精卵','Fertilized egg'],disperse:['精子散去','Dispersal'],miss:['未受精','Not fertilized']} as const;
type Cut={close:number;press:number;lift:number;warmth:number;title:keyof typeof encounterNames|undefined};
/** One cut, three beats. Both outcomes share the approach and ring; only the
 * successful take earns the close contact and the long release of warm light. */
export function encounterCut(s:ReproductiveSample,t:number):Cut{
  const encounter=s.tried&&(s.stage==='fertilized'||s.stage==='unfertilized'),success=encounter&&s.fertilized;
  const close=encounter?ease(0,2.4,t)*(1-ease(9.35,12,t)):0;
  const press=success?ease(5.95,7.05,t)*(1-ease(7.12,7.96,t)):0;
  const lift=success?ease(7.12,7.96,t)*(1-ease(7.96,10.05,t)):0;
  const warmth=success?ease(6.95,7.98,t)*(1-ease(8.28,12,t)):0;
  const title=encounter?(t<2.55?'approach':t<6.12?'ring':success?(t<8.62?'fusion':'zygote'):(t<9.7?'disperse':'miss')):undefined;
  return {close,press,lift,warmth,title};
}
// Fixed cast, not droplets emitted every frame. Each has a different arrival,
// heading and bend frequency. Keep their arcs separated at phone scale.
const cast=[
  [.32, .64, .10,1.08], [1.38,-.47, .86,.82], [2.55,.48,.37,.97],
  [3.68,-.55,1.35,.89], [4.74,.39,.68,1.02], [5.63,-.42,1.72,.78],
] as const;
export type Swimmer={index:number;x:number;y:number;angle:number;size:number;beat:number;alpha:number;fusion:number};
function position(i:number,t:number,success:boolean){
  const [base,speed,lag]=cast[i],winner=success&&i===0;
  const arrival=ease(lag,lag+2.95,t),orbit=.19*Math.min(t,6.25)+.37*speed*sin(t*.83+i),lock=ease(5.5,7.35,t);
  const initial=base-1.60+orbit+sin(t*(.78+.09*i)+i)*.083;
  // The hero holds against the membrane, then slips through. Bystanders stay
  // outside even with their caps pointing inward; they turn away on the release.
  const contact=winner?(.43*ease(5.15,6.28,t)+.57*ease(7.02,8.04,t)):0,escape=winner?0:ease(6.95+lag*.42,10.33+lag*.65,t);
  const theta=winner?mix(initial,contactAngle,lock):initial+escape*speed*1.2;
  const settle=.764+.041*sin(i*2.36+t*.93);
  const radius=mix(mix(1.25+.08*lag,settle,arrival),.30,contact)+escape*.96;
  return {x:cos(theta)*radius,y:sin(theta)*radius*.96,theta,contact,escape};
}
/** Lens coordinates in radii. A single selected index may pass the zona; a
 * failed cohort never gets a contacting head, a fusion flash or a second nucleus. */
export function encounterSwimmers(s:ReproductiveSample,t:number):Swimmer[]{
  if(!s.tried||!(s.stage==='fertilized'||s.stage==='unfertilized')||t>=12)return [];
  return cast.flatMap(([,speed,lag,size],i)=>{
    const {x,y,theta,contact,escape}=position(i,t,s.fertilized),next=position(i,t+.045,s.fertilized);
    const inward=Math.atan2(-y,-x),heading=Math.atan2(next.y-y,next.x-x);
    const look=contact ? .59+.4*contact : (.28+.34*ease(2,4.2,t))*(1-escape);
    const angle=heading+Math.atan2(sin(inward-heading),cos(inward-heading))*look;
    const alpha=s.fertilized&&i===0?1-ease(7.50,8.48,t):1-ease(.42,.99,escape);
    return alpha<=0||x*x+y*y>1.55?[]:[{index:i,x,y,angle:Number.isFinite(angle)?angle:theta+PI,size,alpha,
      beat:t*(7.2+lag*1.3)+i*2.27+speed,fusion:s.fertilized&&i===0?ease(6.62,7.98,t):0}];
  });
}

type C=CanvasRenderingContext2D;
type Ink=string|CanvasGradient;
function oval(c:C,x:number,y:number,a:number,b:number,fill:Ink,turn=0){
  c.beginPath();c.ellipse(x,y,a,b,turn,0,TAU);c.fillStyle=fill;c.fill();
}
function band(c:C,x:number,y:number,a:number,b:number,turn:number,from:number,to:number,width:number,col:Ink){
  c.beginPath();c.ellipse(x,y,a,b,turn,from,to);c.lineWidth=width;c.strokeStyle=col;c.stroke();
}
function pool(c:C,x:number,y:number,r:number,colors:ReadonlyArray<readonly [number,string]>){
  const g=c.createRadialGradient(x-r*.28,y-r*.36,r*.03,x,y,r);for(const [t,col] of colors)g.addColorStop(t,col);return g;
}
function wash(c:C,a:string,b:string){const g=c.createLinearGradient(-.1,-.74,.15,.86);g.addColorStop(0,a);g.addColorStop(1,b);return g;}

function swimmer(c:C,p:Swimmer){
  c.save();c.globalAlpha*=p.alpha;c.translate(p.x,p.y);c.rotate(p.angle);c.scale(p.size,p.size);
  // Wide at the midpiece, threadlike at the distal end. Sample one travelling
  // wave into a tapered ribbon; a thin warm rim keeps its shape in peripheral vision.
  const radial=Math.hypot(p.x,p.y),toward=-(cos(p.angle)*p.x+sin(p.angle)*p.y)/(radial||1);
  // At the rim a head points into the egg while its flagellum trails around
  // the fluid current. A straight tail would run off the circular crop just
  // when six clearly readable silhouettes matter most.
  const turn=.34+2.4*ease(.1,.93,toward)*ease(.42,.72,radial),hand=p.index%2?-1:1;
  c.lineJoin='round';c.lineCap='round';c.beginPath();
  for(let side=0;side<2;side++)for(let j=0;j<=21;j++){
    const u=side?1-j/21:j/21,theta=turn*u,L=.47*(1-.47*p.fusion),amp=(.026+.092*u)*Math.min(1,u*4);
    const wave=amp*sin(u*7.8-p.beat)+(side?1:-1)*(.024*(1-.78*u)+.005);
    const x=-.084-L*sin(theta)/turn+hand*sin(theta)*wave,y=hand*L*(1-cos(theta))/turn+cos(theta)*wave;
    if(!side&&!j)c.moveTo(x,y);else c.lineTo(x,y);
  }
  c.closePath();c.fillStyle='#ffe8d6';c.strokeStyle='#704252';c.lineWidth=.014;c.stroke();c.fill();
  oval(c,-.091,0,.077,.032,'#e7a4a6');oval(c,-.113,-.011,.042,.010,'#fff5db');
  c.beginPath();c.moveTo(-.119,0);c.bezierCurveTo(-.065,-.052,.009,-.101,.088,-.071);c.bezierCurveTo(.165,-.043,.167,.046,.092,.076);
  c.bezierCurveTo(.010,.115,-.066,.039,-.119,0);c.closePath();c.fillStyle=pool(c,.011,-.003,.154,[[0,'#fff9da'],[.50,'#ffdcba'],[.84,'#e69fa0'],[1,'#bd7384']]);c.fill();
  c.lineWidth=.017;c.strokeStyle='#783e58';c.stroke();
  // Pearl cap across the broad nose; one curved dark fold defines the head
  // at a 5–8 px phone footprint without turning it into a white dot.
  oval(c,.013,.015,.059,.038,'#bd788c',.10);c.beginPath();c.moveTo(.039,-.066);c.bezierCurveTo(.117,-.095,.167,-.018,.117,.038);
  c.quadraticCurveTo(.093,-.030,.039,-.041);c.closePath();c.fillStyle=p.fusion>.25?'#fffbd9':'#fff1d3';c.fill();oval(c,.075,-.046,.034,.014,'#fffcee',.22);c.restore();
}

function nucleus(c:C,x:number,y:number,r:number,female=true){
  oval(c,x,y,r,r*.93,pool(c,x,y,r,[[0,female?'#ffceb4':'#fff4ca'],[.5,female?'#da8192':'#e4a79d'],[1,'#925266']]));
  oval(c,x-r*.23,y-r*.22,r*.25,r*.18,'#ffe5d1',-.35);oval(c,x+r*.22,y+r*.24,r*.21,r*.19,'#a35f76');
}
function skinRadius(a:number,press:number,lift:number){
  const toward=cos(a-contactAngle),local=Math.max(0,toward)**15;
  return (1+.018*sin(3*a+.54)-.016*cos(2*a-.76))*(1-.18*press*local+.085*lift*Math.max(0,toward)**4);
}
function skin(c:C,r:number,press:number,lift:number,fill:Ink){
  c.beginPath();for(let i=0;i<=72;i++){const a=i*TAU/72,d=r*skinRadius(a,press,lift),x=d*cos(a),y=.965*d*sin(a);if(i)c.lineTo(x,y);else c.moveTo(x,y);}
  c.closePath();c.fillStyle=fill;c.fill();
}
// Tapered reflections, not circles painted around the specimen. Their ends
// thin out as the curved membrane rolls away from the same upper-left light.
function slick(c:C,r:number,start:number,end:number,width:number,ink:Ink,press=0,lift=0){
  c.beginPath();for(let side=0;side<2;side++)for(let i=0;i<=18;i++){
    const u=side?1-i/18:i/18,a=mix(start,end,u),d=(r+(side?0:width*sin(PI*u)**.75))*skinRadius(a,press,lift),x=d*cos(a),y=.965*d*sin(a);
    if(!side&&!i)c.moveTo(x,y);else c.lineTo(x,y);
  }c.closePath();c.fillStyle=ink;c.fill();
}
function zona(c:C,r:number,t:number,clouded=false,cut?:Cut){
  const press=cut?.press??0,lift=cut?.lift??0,warmth=cut?.warmth??0,body=r*.814;
  skin(c,r,press,lift,pool(c,0,0,r,[[0,'#8e566f'],[.73,'#a96883'],[.815,'#84506a'],[.865,'#d89aa2'],[.92,'#f6c8b3'],[.966,'#a56b86'],[1,'#ffdfc4']]));
  skin(c,body,press,lift,pool(c,-r*.04,-r*.01,body,[[0,clouded?'#cfa49e':'#ffeaca'],[.31,clouded?'#c49799':'#ffc6a5'],[.63,clouded?'#ad8290':'#f39495'],[.84,'#ce677f'],[1,'#a25072']]));
  // Secondary transmission from under the cell: a shallow rose crescent
  // and a peach pool below the opaque cortex give the egg depth at small size.
  slick(c,body*.71,-.06,2.58,body*.16,'rgba(255,172,152,.72)',press,lift);
  slick(c,body*.63,.62,2.18,body*.07,'rgba(255,209,171,.60)',press,lift);
  for(let i=0;i<9;i++){const a=i*2.4+.43,d=body*(.45+.30*((i*7)%11)/11),x=cos(a)*d,y=sin(a)*d;
    oval(c,x,y,body*(.06+.018*(i%2)),body*.032,i%3?'#f3b1a2':'#d78690',a);}
  if(warmth){c.save();c.globalAlpha*=warmth;
    skin(c,body*.985,press,lift,pool(c,r*.30,-r*.09,body,[[0,'rgba(255,245,192,.91)'],[.44,'rgba(255,217,167,.74)'],[.78,'rgba(255,164,147,.36)'],[1,'rgba(248,135,146,0)']]));c.restore();}
  slick(c,r*.89,3.46,4.64,r*.077,'#fff2d2',press,lift);slick(c,r*.915,4.72,5.09,r*.034,'#ffe0c1',press,lift);
  slick(c,r*.91,.18,1.78,r*.045,'#ffcbbc',press,lift);slick(c,body*.90,3.55,4.79,body*.04,'#ffd8ad',press,lift);
  oval(c,r*.58,-r*.61,r*.067,r*.049,'#ffe3b4',.86);
  const glint=-.5+.045*sin(t*.7);oval(c,-body*.35,-body*.43,body*.21,body*.08,'rgba(255,244,209,.88)',glint);
  oval(c,-body*.59,-body*.24,body*.057,body*.033,'#ffe3c5',glint);
}
function egg(c:C,s:ReproductiveSample,age:number,time:number,cut:Cut){
  const success=s.stage==='fertilized',failed=s.stage==='unfertilized'||s.stage==='expired';
  const swarm=encounterSwimmers(s,age);
  for(const p of swarm)if(p.size<.9)swimmer(c,p);
  const joined=success?ease(7.52,9.98,age):0;
  const r=.51+.041*cut.close+.016*cut.lift+.004*sin(time*.96);
  c.save();c.rotate(contactAngle);c.scale(1-.034*cut.press+.025*cut.lift,1+.053*cut.press-.027*cut.lift);c.rotate(-contactAngle);
  zona(c,r,time,failed&&age>9,cut);nucleus(c,-.117+.034*joined,.077-.02*joined,.096);
  if(success&&joined){c.save();c.globalAlpha*=ease(0,.30,joined);nucleus(c,mix(.35,.103,joined),mix(-.115,.025,joined),.070+.020*joined,false);c.restore();}
  if(cut.warmth){c.save();c.globalAlpha*=cut.warmth;slick(c,r*.93,contactAngle-.70,contactAngle+.73,r*.063,'#fff0ba',cut.press,cut.lift);c.restore();}c.restore();
  for(const p of swarm)if(p.size>=.9)swimmer(c,p);
}

const blastomeres:Record<number,readonly (readonly [number,number,number,number,number])[]>={
  2:[[-.231,.01,.26,.411,.20],[.23,-.012,.261,.414,.15]],
  4:[[-.183,-.195,.253,.227,-.25],[.221,-.161,.226,.237,.35],[-.186,.195,.241,.243,.53],[.214,.206,.240,.222,.07]],
  8:[[-.23,-.256,.173,.176,-.3],[.023,-.307,.178,.16,.2],[.285,-.19,.167,.183,.4],[-.331,.006,.16,.185,-.24],
    [.005,-.016,.193,.185,.3],[.291,.098,.155,.195,.4],[-.19,.27,.189,.171,-.26],[.113,.284,.181,.171,.2]],
};
function cleavage(c:C,n:number,time:number){
  zona(c,.574,time);const cells=blastomeres[n]??blastomeres[2];
  for(const [i,[x,y,a,b,turn]] of cells.entries()){
    c.save();c.translate(x,y);c.rotate(turn+sin(time*.55+i)*.014);c.scale(a,b);
    oval(c,0,0,1,1,pool(c,0,0,1,[[0,'#ffe2bc'],[.58,'#efa79b'],[.90,'#bf7484'],[1,'#98566e']]));
    nucleus(c,.03,.12,.23);band(c,0,0,.82,.82,.2,3.4,4.42,.11,'#ffe6c3');c.restore();
  }
}
function blastocyst(c:C,x:number,y:number,scale:number){
  c.save();c.translate(x,y);c.scale(scale,scale);
  oval(c,0,0,.52,.49,pool(c,0,0,.53,[[0,'#dda3a4'],[.52,'#be8095'],[.82,'#965f80'],[1,'#fbc6a9']]));
  band(c,0,0,.49,.462,0,0,TAU,.043,'#ffdfc3');
  for(let i=0;i<13;i++){const a=i*TAU/13;oval(c,.428*cos(a),.406*sin(a),.100,.052,i%3?'#f6beaa':'#edaca1',a+PI/2);}
  for(const [x,y,r] of [[-.25,.14,.116],[-.31,.01,.088],[-.19,.27,.105],[-.14,.10,.091],[-.07,.206,.079],[-.27,.244,.071]]){
    oval(c,x,y,r,r*.94,pool(c,x,y,r,[[0,'#ffe2b9'],[.6,'#e29a95'],[1,'#a7627b']]));}
  band(c,.035,-.018,.322,.30,-.2,3.75,4.60,.024,'rgba(255,227,216,.70)');c.restore();
}
function lining(c:C,y:number){
  c.beginPath();c.moveTo(-1.2,y+.03);c.bezierCurveTo(-.84,y-.22,-.45,y+.045,-.23,y+.04);c.bezierCurveTo(.04,y+.20,.24,y-.13,.47,y-.15);c.quadraticCurveTo(.64,y-.20,1.2,y-.12);
  c.lineTo(1.2,1.2);c.lineTo(-1.2,1.2);c.closePath();c.fillStyle=wash(c,'#fac5ad','#b46180');c.fill();
  c.strokeStyle='#ffc7b3';c.lineWidth=.04;c.stroke();
  for(let i=0;i<7;i++){const x=-.90+i*.29;c.beginPath();c.moveTo(x,y+.24+.08*sin(i));c.bezierCurveTo(x-.12,y+.36,x+.14,y+.48,x+.04,1.1);
    c.strokeStyle=i%2?'#e3989b':'#b8728a';c.lineWidth=.044;c.stroke();}
}
function unborn(c:C,day:number,time:number){
  const fetus=day>=57,grow=unit((day-22)/210),breath=.012*sin(time*1.5);
  c.save();c.rotate(-.24);oval(c,0,0,.53+.10*grow,.70,pool(c,0,0,.71,[[0,'#a15e77'],[.69,'#98516b'],[.86,'#d58b95'],[.96,'#eaaea0'],[1,'#fff0cc']]));
  c.translate(.01,breath);const size=fetus ? .92+.10*grow : .62;c.scale(size,size);
  c.lineWidth=.045;c.strokeStyle='#dc9698';c.beginPath();c.moveTo(-.09,.17);c.bezierCurveTo(-.38,.11,-.39,-.14,-.43,-.06);c.bezierCurveTo(-.52,.11,-.53,.18,-.59,.21);c.stroke();
  c.beginPath();c.moveTo(.17,-.12);c.bezierCurveTo(.46,.06,.39,.53,.10,.57);c.bezierCurveTo(-.15,.62,-.34,.42,-.36,.23);
  c.bezierCurveTo(-.32,.30,-.14,.33,-.078,.19);c.bezierCurveTo(-.022,.086,-.19,-.027,-.075,-.12);c.closePath();c.fillStyle=wash(c,'#ffe6c4','#d79190');c.fill();
  oval(c,.045,-.269,.294,.277,pool(c,.045,-.269,.29,[[0,'#ffe7c6'],[.69,'#f0baaa'],[1,'#cb8993']]));
  if(fetus){oval(c,-.143,-.204,.092,.049,'#f1b8a6',-.43);band(c,-.102,-.274,.052,.032,0,.22,2.79,.020,'#b87881');
    c.strokeStyle='#b57482';c.lineWidth=.078;c.lineCap='round';c.beginPath();c.moveTo(.133,.004);c.quadraticCurveTo(.032,.164,-.132,.052);c.moveTo(.175,.365);c.quadraticCurveTo(-.10,.46,-.20,.281);c.stroke();
    c.strokeStyle='#f0bba5';c.lineWidth=.051;c.stroke();}
  c.restore();
}

export function paintConceptionLens(c:C,s:ReproductiveSample,x:number,y:number,r:number,zh:boolean,time:number,age:number,cut:Cut){
  c.save();c.translate(x,y);c.scale(r,r);c.lineCap='round';c.lineJoin='round';
  oval(c,0,.035,1.009,1.009,'#291b2b');oval(c,0,0,1,1,pool(c,-.08,.07,1.11,[[0,'#b87389'],[.36,'#aa627c'],[.70,'#86455f'],[.90,'#653449'],[1,'#492b40']]));
  c.save();c.beginPath();c.arc(0,0,.973,0,TAU);c.clip();
  // Tubal folds sit at the periphery; warm reflected light leaves the cell
  // and the six ivory, tailed swimmers at the centre of visual attention.
  // A folded, wet field with a dark centre for the ivory tails. The reflected
  // band lives at the wall; nothing is emitted into the fluid for emphasis.
  c.save();c.rotate(-.29);c.translate(.06,.018*sin(time*.43));
  c.beginPath();c.moveTo(-1.1,-.34);c.bezierCurveTo(-.84,-.76,-.46,-.86,-.13,-.84);c.bezierCurveTo(.34,-.79,.57,-.97,.87,-.86);
  c.bezierCurveTo(.39,-1.15,-.66,-1.17,-1.1,-.83);c.closePath();c.fillStyle=wash(c,'#db91a1','#a15b77');c.fill();
  slick(c,.865,3.7,4.56,.025,'#f3b7b1');slick(c,.837,4.59,5.04,.018,'#c98597');
  slick(c,.858,.74,2.53,.101,'rgba(220,133,152,.52)');slick(c,.921,1.32,2.32,.029,'#db929e');c.restore();
  let name:string;
  if(s.stage==='transit'){cleavage(c,s.cells,time);name=zh?`${s.cells} 细胞`:`${s.cells} cells`;}
  else if(s.stage==='cavity'){lining(c,.66);blastocyst(c,-.025,-.09+.024*sin(time*.8),.96);name=zh?'宫腔囊胚':'Blastocyst';}
  else if(s.stage==='notImplanted'){const retreat=ease(.3,5.7,age);lining(c,.31);c.save();c.globalAlpha=.96-.45*retreat;
    blastocyst(c,-.09-.25*retreat,-.04-.46*retreat,.79-.16*retreat);c.restore();name=zh?'未着床':'Not implanted';}
  else if(s.implanted&&s.gestation<22){const settle=s.gestation===7?ease(.24,5.86,age):1;lining(c,.32);
    blastocyst(c,-.012,-.30+.43*settle,.90);if(settle>.28){
      c.save();c.globalAlpha*=ease(.26,1,settle);c.beginPath();c.moveTo(-.92,.52);c.bezierCurveTo(-.52,.20,-.36,.16,-.24,.36);c.bezierCurveTo(-.11,.575,.16,.53,.28,.31);c.quadraticCurveTo(.51,.040,.92,.25);
      c.lineTo(1,.97);c.lineTo(-1,1);c.closePath();c.fillStyle=wash(c,'#f2ad9e','#b26681');c.fill();c.lineWidth=.029;c.strokeStyle='#f8bcac';c.stroke();c.restore();}name=s.gestation===7?(zh?'着床':'Implantation'):(zh?'早期孕囊':'Gestational sac');
  }else if(s.implanted){lining(c,.61);unborn(c,s.gestation,time);name=zh?`孕日 ${s.gestation}`:`Gestation day ${s.gestation}`;}
  else{egg(c,s,age,time,cut);
    if(cut.title)name=encounterNames[cut.title][zh?0:1];
    else if(s.stage==='expired')name=zh?'卵子失活':'Window closed';
    else name=s.eggs===2?(zh?'两侧排卵 · 单侧放大':'One of two ova'):(zh?'卵子':'Ovum');}
  c.restore();band(c,0,0,.99,.99,0,0,TAU,.018,'#d9ac98');band(c,0,0,.948,.948,0,3.23,4.95,.015,'#f3c9b2');
  c.restore();c.textAlign='center';c.textBaseline='top';c.font=`600 ${r*.233}px system-ui,sans-serif`;c.fillStyle='#ffeede';c.fillText(name,x,y+r+2,r*2.22);
}
