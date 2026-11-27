import {Color,Float32BufferAttribute,LatheGeometry,Vector2} from 'three';
import {PAD_RADIUS} from './planetLayout';
import {lanes} from './windAtlas';

export const dialRadius=PAD_RADIUS-.055;
// The compass directs the visitor to the collar, not to the moon in the sky.
// Texture north is world -Z; number tops face outwards from the standing mark.
export const chartBearings=lanes.map(({home,moon})=>({angle:Math.atan2(home.foot.x,-home.foot.z),
  number:moon.sign.split(' · ')[0],ink:moon.color}));

/** The dial ends where this machined rim begins. No metal crosses the walking
 * face, and there is no cylinder lid immediately underneath the printed scale. */
export function northBezel(){
  const r=PAD_RADIUS,profile=[
    [r-.13,-.34,'#47565b'],[r-.062,-.29,'#707a75'],[r-.062,-.22,'#637475'],
    [r-.022,-.20,'#ad8960'],[r-.022,-.17,'#8e7557'],[r-.052,-.163,'#415352'],
    [r-.043,-.09,'#526869'],[r-.012,-.072,'#a58560'],[r,-.04,'#b79c74'],
    [r-.009,-.018,'#d5b784'],[r-.023,-.002,'#c3aa7c'],[dialRadius,0,'#ac8c62'],
  ] as const;
  const g=new LatheGeometry(profile.map(([x,y])=>new Vector2(x,y)),144),c=new Color(),rgb=new Float32Array(g.attributes.position.count*3);
  for(let i=0;i<g.attributes.position.count;i++)c.set(profile[i%profile.length][2]).toArray(rgb,3*i);
  g.setAttribute('color',new Float32BufferAttribute(rgb,3));return g;
}

// Artwork in dial units. The existing fired-enamel compass supplies the
// central rose and grain. The outer azimuth scale is engraved in one face.
export function engraveNorthDial(c:CanvasRenderingContext2D,size:number,rose:CanvasImageSource){
  c.save();c.scale(size/1024,size/1024);c.translate(512,512);
  const tau=Math.PI*2;
  const disk=(r:number,ink:string)=>{c.fillStyle=ink;c.beginPath();c.arc(0,0,r,0,tau);c.fill();};
  const circle=(r:number,ink:string,w:number)=>{c.strokeStyle=ink;c.lineWidth=w;c.beginPath();c.arc(0,0,r,0,tau);c.stroke();};
  const strip=(a:number,r1:number,r2:number,w:number,ink:string)=>{c.save();c.rotate(a);c.fillStyle=ink;c.fillRect(-w/2,-r2,w,r2-r1);c.restore();};
  c.drawImage(rose,-512,-512,1024,1024);
  const annulus=(r:number,w:number,ink:string)=>circle(r-w/2,ink,w);
  annulus(513,119,'#354d54');annulus(511,10,'#857861');annulus(495,69,'#344b50');
  circle(501,'#202f34',2.6);circle(495,'#c3ac7d',2);circle(424,'#ac9473',1.6);circle(394,'#c5b086',2);
  // 72 divisions rather than a false degree readout. Longer cuts mark each
  // 30°; only the enamel pointers have a route number and destination ink.
  for(let i=0;i<72;i++){const a=i*tau/72;strip(a,i%6?482:472,492,i%6?1.85:3.2,i%6?'#91a6a4':'#ddc89e');}
  for(let i=0;i<32;i++){
    const a=(i+.5)*tau/32;c.save();c.rotate(a);c.translate(0,-502);disk(3.8,'#283a40');disk(2.6,'#a38c6d');c.rotate(.8+2.4*i);c.fillStyle='#586360';c.fillRect(-1.8,-.55,3.6,1.1);c.restore();
  }
  for(const {angle,number,ink} of chartBearings){
    c.save();c.rotate(angle);
    c.beginPath();c.moveTo(-28,-435);c.lineTo(-28,-464);c.lineTo(-20,-475);c.lineTo(0,-488);c.lineTo(20,-475);c.lineTo(28,-464);c.lineTo(28,-435);c.quadraticCurveTo(0,-429,-28,-435);
    c.closePath();c.fillStyle='#162f36';c.fill();c.lineWidth=2.2;c.strokeStyle='#a79876';c.stroke();
    c.beginPath();c.moveTo(-8,-473);c.lineTo(0,-481);c.lineTo(8,-473);c.closePath();c.fillStyle=ink;c.fill();
    c.textAlign='center';c.textBaseline='middle';c.font='600 30px system-ui,sans-serif';c.fillStyle='#fff0cd';c.fillText(number,0,-450,48);
    c.fillStyle=ink;c.fillRect(-13,-425,26,3.5);c.restore();
  }
  c.restore();
}
