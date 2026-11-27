// Compare two local builds, one browser/context at a time, at identical views.
// Node scripts/verify-harbour-light.cjs <dist> <label> [--dev]
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {chromium}=require(path.join(process.env.XR_SMOKE_DIR||path.join(os.tmpdir(),'opencode/xr-browser-smoke'),'node_modules/playwright-core'));

function instrument(quality){
  localStorage.setItem('neko-virt-os.mmd-vr-showcase.v2',JSON.stringify({renderQuality:quality,dprPref:1,shadowsPref:'off',viewDistance:52,exposure:1,lightPreset:'stage'}));
  const qa=window.harbourTake={frames:0,gpuMs:[],errors:[],count:0};
  const proto=WebGL2RenderingContext.prototype,compile=proto.compileShader;
  proto.compileShader=function(shader){compile.call(this,shader);if(!this.getShaderParameter(shader,this.COMPILE_STATUS))qa.errors.push(this.getShaderInfoLog(shader));};
  window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',({detail:r})=>{
    if(!r.isWebGLRenderer)return;const render=r.render,gl=r.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending=[];
    r.render=function(s,c){
      if(!s.isScene||!s.getObjectByName('scenery:seaside-terminus'))return render.call(this,s,c);
      if(qa.view){c.position.fromArray(qa.view.eye);c.lookAt(...qa.view.target);c.updateMatrixWorld();}
      qa.timerAvailable=!!ext;
      if(ext&&gl.getParameter(ext.GPU_DISJOINT_EXT)){for(const q of pending)gl.deleteQuery(q);pending.length=0;qa.gpuMs=[];}
      while(pending.length&&gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE)){const q=pending.shift();qa.gpuMs.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}
      let q;if(ext&&qa.count>0){qa.count--;q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);}
      try{return render.call(this,s,c);}finally{
        if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}
        qa.frames++;qa.work={calls:r.info.render.calls,triangles:r.info.render.triangles,textures:r.info.memory.textures,width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,tide:s.getObjectByName('terminus:sea').position.y,shadows:r.shadowMap.enabled};
        const clip=qa.clip,now=performance.now();if(clip&&clip.frames.length<30&&now>=clip.next){clip.frames.push(gl.canvas.toDataURL('image/webp',.84).split(',')[1]);clip.next=now+64;}
        if(qa.photo){qa.photo=false;qa.png=gl.canvas.toDataURL('image/png').split(',')[1];}
      }
    };
  });
}

async function main(){
  const [dist='dist',label='current',mode]=process.argv.slice(2);assert(/^[a-z0-9-]+$/.test(label));
  const quality=process.env.HARBOUR_QUALITY??'balanced';assert(['balanced','high','low'].includes(quality));
  const {preview,createServer}=await import('vite');const oldBay=mode==='--dev-bay-before',dev=mode==='--dev'||oldBay;
  // Load the previous furniture without changing today's sky, camera or renderer.
  const bayBefore={name:'verify-bay-before',enforce:'pre',load(id){
    const match=id.replaceAll('\\','/').match(/\/scenery\/terminus\/(stationParts\.ts|SeasideTerminus\.tsx|platformFinish\.tsx)$/);
    if(match)return execFileSync('git',['show',`4290daa:src/mmdVrShowcase/scenery/terminus/${match[1]}`],{encoding:'utf8'});
  }};
  const server=dev?await createServer({plugins:oldBay?[bayBefore]:[],server:{host:'127.0.0.1',port:0,hmr:false},logLevel:'error'}):await preview({configFile:false,build:{outDir:dist},preview:{host:'127.0.0.1',port:0}});
  const dir=path.resolve('local-review/screenshots/sunny-harbour');let browser;
  try{if(dev)await server.listen();await fs.mkdir(dir,{recursive:true});
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-gpu','--use-angle=d3d11','--no-proxy-server','--ignore-gpu-blocklist','--enable-webgl-developer-extensions']});
    const page=await browser.newPage({locale:'zh-CN',viewport:{width:1190,height:800},deviceScaleFactor:1});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
    page.setDefaultTimeout(12000);await page.addInitScript(instrument,quality);await page.goto(server.resolvedUrls.local[0]+'?set=seasideTerminus');
    await page.locator('.stage-launch-row .stage-btn-secondary').first().click();await page.waitForFunction(()=>harbourTake.frames>25);await page.waitForLoadState('networkidle');
    const views={entrance:{eye:[-2.69,1.58,2.85],target:[1.58,1.19,-8.45]},seaward:{eye:[2.25,1.10,-17.21],target:[6.65,1.10,-28]},boat:{eye:[9.5,1.6,-13.65],target:[9.1,.1,-24.2]},waterline:{eye:[2.1,1.04,-17.1],target:[14.5,1.38,-13]},beacon:{eye:[5.4,1.12,-17.37],target:[15.9,-.22,-11.78]},lateral:{eye:[3.35,1.10,-17.21],target:[7.75,1.10,-28]},skyward:{eye:[2.25,1.1,-17.21],target:[3.9,4.8,-25]}};
    views.bench={eye:[.31,1.11,-1.97],target:[1.98,.49,-3.72]};
    views.benchEnd={eye:[1.11,1.05,-1.72],target:[1.99,.55,-2.91]};
    views.clouds={eye:[13.3,1.56,-12.1],target:[17.5,3.65,-3.0]};
    const data={};for(const [key,view] of Object.entries(views)){
      if(process.env.HARBOUR_VIEWS&&!process.env.HARBOUR_VIEWS.split(',').includes(key))continue;
      const frame=await page.evaluate(v=>{harbourTake.view=v;return harbourTake.frames;},view);await page.waitForFunction(n=>harbourTake.frames>n+12,frame);
      await page.evaluate(()=>{harbourTake.gpuMs=[];harbourTake.count=32;harbourTake.png=null;harbourTake.photo=true;});
      await page.waitForFunction(()=>harbourTake.png&&(!harbourTake.timerAvailable||harbourTake.gpuMs.length>=32));
      const {png,...result}=await page.evaluate(()=>({png:harbourTake.png,work:harbourTake.work,gpuMs:harbourTake.gpuMs.slice(0,32),shaderErrors:harbourTake.errors}));
      assert.deepEqual(result.shaderErrors,[]);data[key]=result;await fs.writeFile(path.join(dir,`${key}-${label}.png`),Buffer.from(png,'base64'));
      console.log(key,result.work,'desktop GPU median ms',result.gpuMs.length?result.gpuMs.slice().sort((a,b)=>a-b)[16]:null);
      if(key==='boat'&&process.env.HARBOUR_CLIP){
        await page.evaluate(()=>{harbourTake.clip={frames:[],next:0};});await page.waitForFunction(()=>harbourTake.clip.frames.length===30);
        const frames=await page.evaluate(()=>{const {frames}=harbourTake.clip;delete harbourTake.clip;return frames;});
        const folder=path.join(dir,'clip-'+label);await fs.mkdir(folder,{recursive:true});for(const [i,frame] of frames.entries())await fs.writeFile(path.join(folder,`${String(i).padStart(2,'0')}.webp`),Buffer.from(frame,'base64'));
      }
    }
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(dir,`${label}.json`),JSON.stringify(data,null,2));
  }finally{await browser?.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
