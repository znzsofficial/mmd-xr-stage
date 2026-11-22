type FrameSize={width:number;height:number};
type Request<F>={options:F;scale:number;paint:(draw:(ctx:CanvasRenderingContext2D)=>void)=>void};
type Illustrator<F>={draw(ctx:CanvasRenderingContext2D,frame:F):void;dispose():void};

/** One transferable bitmap per mounted diagram. A worker reply only wakes the
 * destination; painting (including fallback) belongs to its next visible frame. */
export function diagramOutput<F extends FrameSize>(makeWorker:()=>Worker,makeLocal:()=>Illustrator<F>,wake:(result:'ready'|'retry')=>void){
  let worker:Worker|null=null,local:Illustrator<F>|undefined,request:Request<F>|null=null,bitmap:ImageBitmap|null=null;
  let inFlight=false,dead=false,unavailable=false;
  function terminate(){if(worker){worker.onerror=null;worker.onmessageerror=null;worker.onmessage=null;worker.terminate();worker=null;}}
  function discard(){request=null;bitmap?.close();bitmap=null;}
  function fail(){unavailable=true;terminate();inFlight=false;discard();}
  function retry(){fail();if(!dead)wake('retry');}
  function flush(){
    if(!bitmap||!request)return;
    const r=request,b=bitmap;request=bitmap=null;
    try{r.paint(ctx=>ctx.drawImage(b,0,0,r.options.width,r.options.height));}finally{b.close();}
  }
  function fallback(r:Request<F>){r.paint(ctx=>(local??=makeLocal()).draw(ctx,r.options));}
  function submit(r:Request<F>){
    if(dead||inFlight||request)return;
    if(!unavailable&&!worker){
      if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||!OffscreenCanvas.prototype.transferToImageBitmap)unavailable=true;
      else try{
        const current=worker=makeWorker();
        worker.onerror=e=>{e.preventDefault();if(worker===current)retry();};worker.onmessageerror=()=>{if(worker===current)retry();};
        worker.onmessage=(e:MessageEvent<{bitmap?:ImageBitmap}>)=>{
          const b=e.data.bitmap;if(dead||worker!==current){b?.close();return;}if(!b){retry();return;}
          inFlight=false;if(request)bitmap=b;else b.close();wake('ready');
        };
      }catch{unavailable=true;}
    }
    if(!worker){fallback(r);return;}
    request=r;inFlight=true;try{worker.postMessage({options:r.options,scale:r.scale});}catch{fail();fallback(r);}
  }
  return {submit,flush,discard,get inFlight(){return inFlight;},dispose(){if(dead)return;dead=true;terminate();discard();local?.dispose();local=undefined;}};
}
