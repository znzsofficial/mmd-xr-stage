import {createOrganArt,type OrganArtOptions} from './organArt';

type Request={options:OrganArtOptions;scale:number;paint:(draw:(ctx:CanvasRenderingContext2D)=>void)=>void};

/** Single-slot mailbox. Only the visible destination's frame may consume a
 * bitmap (or invoke the synchronous fallback). The next request is sampled
 * from the stores on that frame, not queued behind a slow worker. */
export function organOutput(wake:(result:'ready'|'retry')=>void){
  let worker:Worker|null=null, fallback:ReturnType<typeof createOrganArt>|undefined;
  let request:Request|null=null,bitmap:ImageBitmap|null=null,inFlight=false,dead=false,unavailable=false;
  function local(r:Request){r.paint(ctx=>(fallback??=createOrganArt()).draw(ctx,r.options));}
  function terminate(){if(worker){worker.onerror=null;worker.onmessageerror=null;worker.onmessage=null;worker.terminate();worker=null;}}
  function discard(){request=null;bitmap?.close();bitmap=null;}
  function fail(){unavailable=true;terminate();inFlight=false;discard();}
  function retry(){fail();if(!dead)wake('retry');}
  function flush(){
    if(!bitmap||!request)return;
    const r=request,b=bitmap;request=bitmap=null;
    try{r.paint(ctx=>ctx.drawImage(b,0,0,r.options.width,r.options.height));}finally{b.close();}
  }
  function submit(r:Request){
    if(dead||inFlight||request)return;
    if(!unavailable&&!worker){
      if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||!OffscreenCanvas.prototype.transferToImageBitmap)unavailable=true;
      else try{
        worker=new Worker(new URL('./organ.worker.ts',import.meta.url),{type:'module'});
        worker.onerror=e=>{e.preventDefault();retry();};
        worker.onmessageerror=retry;
        worker.onmessage=(e:MessageEvent<{bitmap?:ImageBitmap}>)=>{
          const b=e.data.bitmap;if(!b){retry();return;}
          inFlight=false;
          if(!dead&&request)bitmap=b;else b.close();
          if(!dead)wake('ready');
        };
      }catch{unavailable=true;}
    }
    if(!worker){local(r);return;}
    request=r;inFlight=true;try{worker.postMessage({options:r.options,scale:r.scale});}catch{fail();local(r);}
  }
  return {submit,flush,discard,get inFlight(){return inFlight;},dispose(){if(dead)return;dead=true;terminate();discard();fallback?.dispose();}};
}
