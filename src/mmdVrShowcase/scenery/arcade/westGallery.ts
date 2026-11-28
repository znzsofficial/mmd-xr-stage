// The red passage is under the sign; the display windows face the return
// lane on the far side of the stair. Keep the turn at the foot of the stair open.
type Piece={x:number;y:number;z:number;w:number;h:number;d:number;ink:string;tag:string;roll?:number};
const solids:Piece[]=[],skins:Piece[]=[];
const box=(list:Piece[],tag:string,x:number,y:number,z:number,w:number,h:number,d:number,ink:string,roll=0)=>list.push({tag,x,y,z,w,h,d,ink,roll});
const body=(tag:string,x:number,y:number,z:number,w:number,h:number,d:number,ink:string)=>box(solids,tag,x,y,z,w,h,d,ink);
const edge=(x:number,y:number,z:number,w:number,h:number,d:number,ink:string,roll=0)=>box(skins,'trim',x,y,z,w,h,d,ink,roll);

const enamel='#b96358',lip='#cf806a',blue='#527486',steel='#454f61';
export const westStreetDoor={x:9.10,inGate:14.45,outGate:15.15,half:1.55};
// The two travel lines straddle an actual opening from the street into the
// forecourt. Its low cheek walls lead back to the court, leaving the sign in
// the taller, recessed game gallery visible from the approach.
const door=westStreetDoor,entryZ=(door.inGate+door.outGate)/2;
export const forecourtEdge=13;
export const forecourtWall={z:12.96,d:.25};
const courtFace=forecourtWall.z+forecourtWall.d/2;
for(const side of [-1,1]){
  const x=door.x+side*(door.half+.16),end=entryZ-.18,start=side<0?courtFace:forecourtEdge;
  body('west-portal',x,.38,(start+end)/2,.22,.76,end-start,'#ac8978');
  body('west-portal',x,.795,(start+end)/2,.26,.07,end-start,'#d8c7a8');
  body('west-portal',x,.18,entryZ,.32,.36,.36,'#756d69');
  body('west-portal',x,1.51,entryZ,.26,2.30,.32,enamel);
}
body('west-portal',door.x,2.76,entryZ,3.84,.20,.39,enamel);
body('west-portal',door.x,2.89,entryZ,3.94,.06,.48,'#687b79');

export const lastRiser={x:10.255,z:1.50,w:1.97};
export const gallerySign={x:9.30,y:3.93,z:6.32,w:3.50,h:1.12,d:.18};
const s=gallerySign;
body('west-sign',s.x,s.y,s.z,s.w,s.h,s.d,'#505771');
for(const x of [7.80,10.80])edge(x,3.46,6.23,.10,.57,.17,steel);

body('west-spine',11.11,1.57,4.06,.26,3.14,5.2,'#568082');
body('west-transom',12.66,2.783,1.66,2.65,.766,.16,'#536a75');
// Use the tall back face of the top step as a service panel. The actual
// path turns at its left edge towards the side doors; no false door here.
edge(lastRiser.x,1.55,1.526,1.75,2.78,.045,'#4b626c');
edge(lastRiser.x,1.54,1.555,1.57,2.60,.023,'#72908a');
for(const x of [9.57,10.94])edge(x,1.50,1.575,.035,2.42,.025,'#95a79a');
for(const z of [5.48,2.37]){
  for(const [x,side] of [[7.29,1],[10.87,-1]]){
    body('west-portal',x,1.28,z,.19,2.56,.26,enamel);
    body('west-shoe',x,.115,z,.31,.23,.39,'#a25c55');
    edge(x,1.38,z+.135,.112,2.25,.019,lip);
    edge(x+side*.137,2.60,z,.13,.44,.24,enamel,-side*Math.PI/4);
  }
  body('west-portal',(7.29+10.87)/2,2.84,z,3.77,.56,.26,enamel);
  edge(9.08,2.60,z+.138,3.38,.047,.021,lip);
}

// The seat, casing and display depth all take real floor space. Their small
// fittings stay in the visual batch instead of becoming collision triangles.
body('west-seat',10.67,.41,4.0,.56,.14,2.0,'#929993');
for(const z of [3.25,4.75]){body('west-seat-foot',10.70,.18,z,.34,.36,.12,steel);edge(10.88,.49,z,.052,.46,.08,steel);}
edge(10.89,.73,4.0,.077,.29,2.0,'#9da8a1');
for(const x of [10.49,10.65,10.81])edge(x,.49,4,.14,.018,1.98,'#b6aaa1');
export const displays=[-3.21,-1.65,-.09];
for(const [i,z] of displays.entries()){
  body('west-vitrine',13.64,1.28,z,.40,2.56,1.54,blue);
  body('west-plinth',13.33,.15,z,.26,.30,1.53,'#586e76');
  edge(13.405,.42,z,.082,.76,1.52,'#435d70');
  edge(13.34,.83,z,.22,.085,1.53,'#95aaa8');edge(13.37,2.34,z,.18,.12,1.53,steel);
  for(const off of [-.742,.742])edge(13.37,1.58,z+off,.18,1.42,.036,'#859ca1');
  for(const h of [1.05,1.50])edge(13.32,h,z,.23,.034,1.43,'#859c9b');
  for(let j=0;j<3;j++){
    const cz=z-.46+j*.43;
    edge(13.29,1.20,cz,.15,.26,.29,['#b99c77','#7596a5','#927b88'][(i+j)%3]);
    edge(13.32,1.64,cz,.16,.24,.23,steel);
  }
}
// Lay in ceiling coffers and recessed opal lights. Viewed from the far
// doorway the repeating fixtures lead the eye back towards the forecourt.
export const diffusers:{x:number;y:number;z:number}[]=[];
for(const [x,start,end,width,ceiling] of [[9.14,1.5,6.65,4.12,3.14],[8.13,-4.5,1.50,2.18,3.14],[12.60,-4.32,4.38,2.64,3.17]]){
  for(let z=start+.42;z<end;z+=.86)edge(x,ceiling-.032,z,width,.056,.035,steel);
  for(const t of [-.25,.25])edge(x+width*t,ceiling-.044,(start+end)/2,.033,.062,end-start,steel);
  for(let z=start+1;z<end-.3;z+=2.56){edge(x,ceiling-.079,z,.55,.082,1.21,'#5c6871');diffusers.push({x,z,y:ceiling-.125});}
}
// Printed-metal fascias have a relief chevron rather than a solid beam over the view.
for(let i=0;i<5;i++){
  const x=11.42+i*.51;
  for(const side of [-1,1])edge(x+side*.072,3.26,-4.38,.029,.216,.032,'#a4b8b4',side*-.58);
}
// Narrow electrical trunk and service boxes at the turn, clear of the stair landing.
for(const x of [7.84,8.34]){edge(x,2.08,-5.453,.42,.56,.063,'#455e69');edge(x,2.10,-5.409,.35,.44,.035,'#859b9b');edge(x,1.54,-5.447,.034,.54,.043,'#59727b');}
edge(8.09,1.28,-5.448,.53,.033,.038,'#59727b');
export const westGallery={solids,skins};
