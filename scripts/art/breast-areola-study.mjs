// CPU only. Node 26, with @napi-rs/canvas resolvable via NODE_PATH or an
// explicit package directory: node scripts/art/breast-areola-study.mjs [canvas-package]
// No scene, browser, headless GPU, private model, server or VMD is involved.
import {createRequire,registerHooks} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {readBreastProfile,compareBreastProfile} from './breast-profile.mjs';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.argv[2]??'@napi-rs/canvas');
// Supply the real painter with CPU bitmap allocation, just as the worker
// supplies it with OffscreenCanvas. Node strips types; resolve its local TS
// imports directly instead of keeping a second implementation of the brush.
globalThis.OffscreenCanvas=class {constructor(w,h){return createCanvas(w,h);}};
const artDir=new URL('../../src/mmdVrShowcase/bodyState/breast/art/',import.meta.url);
registerHooks({resolve(specifier,context,next){
  if(context.parentURL?.startsWith(artDir.href)&&specifier.startsWith('.')&&!specifier.endsWith('.ts'))specifier+='.ts';
  return next(specifier,context);
}});
const {createBreastArt}=await import(new URL('index.ts',artDir));
const {areolaStyles,areolaNames}=await import(new URL('areola.ts',artDir));
const {egg,height,middle}=await import(new URL('teardrop.ts',artDir));
const {camera}=await import(new URL('geometry.ts',artDir));
const {portraitX,portraitY}=await import(new URL('raster.ts',artDir));
const out=new URL('../../local-review/art/breast/',import.meta.url);
await mkdir(out,{recursive:true});
const angles=[0,38,90],plum='#211722',paper='#fff1df',muted='#d5bcc4',gold='#e4c28b';
const ink=(ctx,text,x,y,size,color,weight=400)=>{ctx.font=`${weight} ${size}px "Microsoft YaHei", sans-serif`;ctx.fillStyle=color;ctx.fillText(text,x,y);};

for(const fullness of [0,1]){
  const sheet=createCanvas(1328,876),g=sheet.getContext('2d');g.fillStyle=plum;g.fillRect(0,0,sheet.width,sheet.height);
  ink(g,'水滴形 02 · 乳晕与乳头',22,39,24,paper,600);
  ink(g,`饱满度 ${fullness*100}%　·　平视机位 / 固定画室主光 / 呼吸 0 秒`,560,38,17,muted);
  const art=createBreastArt();
  const profile=[];
  for(const [column,degrees] of angles.entries()){
    const x=96+column*408,cam=camera(degrees);
    ink(g,`${['正面','斜面','侧面'][column]}　${degrees}°`,x,80,18,paper,600);
    // The inset always follows the actor's left side. Both inks use the
    // SAME crop in each view and state, not an independently fitted zoom.
    const y=middle(fullness)-.39*height(fullness),e=egg(y,fullness),r=Math.sqrt(1-e.h**2);
    const cx=e.x+e.rx*.169*r,cz=e.z+e.rz*Math.sqrt(1-.169**2)*r;
    const u=Math.round(portraitX(cam,cx,cz)),v=Math.round(portraitY(y,0));
    for(const [row,areolaStyle] of areolaStyles.entries()){
      const top=95+row*377,c=createCanvas(800,520),ctx=c.getContext('2d');ctx.scale(2,2);
      art.draw(ctx,{width:400,height:260,degrees,fullness,areolaStyle,time:0,lactating:false,left:0,right:0,
        section:false,labels:false,settle:0,leftSettle:0,rightSettle:0,zh:true});
      if(degrees===90)profile.push(readBreastProfile(c));
      if(!column)ink(g,areolaNames.zh[areolaStyle],22,top+128,20,gold,600);
      g.drawImage(c,x,top,400,260);
      g.drawImage(c,2*(u-39),2*(v-21),156,84,x+122,top+267,156,84);
    }
  }
  art.dispose();g.fillStyle='#58434d';g.fillRect(22,455,1284,1);
  ink(g,'上图为 400 × 260 逻辑像素；下方为同一成帧的固定 2× 局部。两款共用肩颈、下缘和镜头。',22,855,15,muted);
  const destination=new URL(`areola-02-${fullness?'full':'default'}.png`,out);
  await writeFile(destination,sheet.toBuffer('image/png'));console.log(fileURLToPath(destination));
  const cy=Math.round(portraitY(middle(fullness)-.39*height(fullness),0)),rows=[cy-22,cy,cy+22];
  console.log(`Fullness ${fullness*100}%, soft → raised profile (400 px HUD):`,compareBreastProfile(...profile).filter(p=>rows.includes(p.y)));
}
