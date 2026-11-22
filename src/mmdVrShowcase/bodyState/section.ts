import { ENDOMETRIAL_PATCHES, functionalDepthAt, type EndometrialTissue } from './data';

// One wall at a fixed magnification: lumen above, myometrium below. The
// basal band and the blind ends of the glands have the same location each day.
const width=160, height=88, muscleY=72, basalY=60, depthScale=52;
const ink={muscle:'#8b5b70', fiber:'#745065', basal:'#b06982',
  epithelial:'#fbb8ba', glandWall:'#bf7888', glandLumen:'#f7c5be', vessel:'#933d61', vesselCore:'#cc8090'};
const fibers='M-4 80Q11 71 23 77T50 78 M59 82Q71 74 91 78T116 77 M123 81Q143 72 163 76 M5 88Q16 81 32 85 M37 85Q51 79 59 85 M84 88Q97 81 110 85 M127 87Q139 81 153 84';

// Surface relief is proportional to the REMAINING depth. Even in a deep
// local breach no outline, gland or sloughed piece can excavate the base.
function surface(t:EndometrialTissue, x:number) {
  const relief=1+.042*Math.sin(x*.098)+.026*Math.cos(x*.19);
  return basalY-depthScale*relief*functionalDepthAt(t,x/width);
}

type Ctx=CanvasRenderingContext2D;
function stroke(ctx:Ctx, path:Path2D, color:string, weight:number) {
  ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke(path);
}

// Trace tubes up from the retained gland ends and arterial supply. Wavelength
// stays in section coordinates: a shortened gland is not a squeezed long one.
function tubes(ctx:Ctx,t:EndometrialTissue, vessel:boolean) {
  const sites=vessel?[29,67,108,146]:[10,45,86,126,156];
  const coil=vessel?t.vesselCoil:t.glandCoil;
  for(const x of sites){
    const rootY=muscleY-(vessel?0:3), path=new Path2D();
    const endY=surface(t,x)+(vessel?3:-4);
    const at=(y:number)=>{
      const z=Math.max(0,basalY-y), activation=Math.min(1,z/11);
      const drift=1.7*Math.sin((rootY-y)*.105+x)*Math.min(1,(rootY-y)/9);
      const turn=z*(vessel?.49:.33)*(1+.09*Math.cos(x))+.28*Math.sin(z*.17)+x;
      return x+drift+activation*coil*(vessel?4:5.2)*Math.sin(turn);
    };
    path.moveTo(x,rootY);
    for(let y=rootY-1; y>endY; y--)path.lineTo(at(y),y);
    path.lineTo(at(endY),endY);
    if(vessel){
      stroke(ctx,path,ink.vessel,2.25);stroke(ctx,path,ink.vesselCore,.68);
      // A fine ascending branch stays short at eroded sites. It never opens
      // onto the lumen like the pale gland next to it. Fade in as it elongates.
      const depth=basalY-endY;
      if(depth>0){
        const y0=endY+depth*.4, x0=at(y0), reach=Math.min(7,depth*.27)*Math.sign(Math.sin(x));
        const branch=new Path2D();branch.moveTo(x0,y0);
        branch.bezierCurveTo(x0+reach*.7,y0-1,x0+reach*.38,endY+2,x0+reach,endY+1.2);
        ctx.globalAlpha=Math.min(1,depth/8);stroke(ctx,branch,ink.vessel,1);ctx.globalAlpha=1;
      }
    }else{
      stroke(ctx,path,ink.glandWall,5.4);stroke(ctx,path,ink.glandLumen,3.1);
    }
  }
}

/** Both the screen canvas and the XR texture use this same tissue and scale. */
export function drawBodySection(ctx:Ctx,x:number,y:number,w:number,h:number,t:EndometrialTissue) {
  ctx.save();ctx.translate(x,y);ctx.scale(w/width,h/height);
  ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();ctx.lineCap='round';ctx.lineJoin='round';
  const lumen=ctx.createLinearGradient(0,0,0,basalY);
  lumen.addColorStop(0,'#392331');lumen.addColorStop(1,'#6d384b');
  ctx.fillStyle=lumen;ctx.fillRect(0,0,width,height);
  ctx.fillStyle=ink.muscle;ctx.fillRect(0,muscleY,width,height-muscleY);stroke(ctx,new Path2D(fibers),ink.fiber,1.4);

  const edge=new Path2D();edge.moveTo(0,surface(t,0));
  for(let i=1;i<=width;i++)edge.lineTo(i,surface(t,i));
  const wall=new Path2D(edge);wall.lineTo(width,muscleY);wall.lineTo(0,muscleY);wall.closePath();
  ctx.save();ctx.clip(wall);
  const wash=ctx.createLinearGradient(0,basalY-depthScale,0,basalY);
  wash.addColorStop(0,'#f2a6ac');wash.addColorStop(.64,'#d88599');wash.addColorStop(1,'#bc6c89');
  ctx.fillStyle=wash;ctx.fillRect(0,0,width,muscleY);
  ctx.fillStyle=ink.basal;ctx.fillRect(0,basalY,width,muscleY-basalY);
  stroke(ctx,edge,ink.epithelial,3.4);
  tubes(ctx,t,true);tubes(ctx,t,false);
  ctx.restore();

  // Detached islands lift over their own defect. Their volume vanishes with
  // the missing functional layer, including when its manual level is zero.
  for(const patch of ENDOMETRIAL_PATCHES){
    const cx=patch.center*width, missing=(t.functionalDepth-functionalDepthAt(t,patch.center))*depthScale;
    if(missing<=0)continue;
    const cy=surface(t,cx)-missing*.62, r=width*patch.radius*.59*t.breakdown, rise=Math.min(3.8,missing*.19);
    const flake=new Path2D();flake.moveTo(cx-r,cy+rise*.4);
    flake.quadraticCurveTo(cx-r*.1,cy-rise,cx+r,cy-rise*.52);
    flake.lineTo(cx+r*.74,cy+rise*.42);flake.lineTo(cx+r*.3,cy+rise*.46);
    flake.quadraticCurveTo(cx-r*.26,cy+rise*1.25,cx-r,cy+rise*.4);flake.closePath();
    ctx.globalAlpha=Math.min(1,missing/5);ctx.fillStyle='#d77d91';ctx.fill(flake);stroke(ctx,flake,ink.epithelial,1.2);
  }
  ctx.restore();
}
