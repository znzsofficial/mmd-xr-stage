import {createOrganArt,type OrganArtOptions} from './organArt';

type Request={options:OrganArtOptions;scale:number;paint:(draw:(ctx:CanvasRenderingContext2D)=>void)=>void};

/** One image in flight plus the most recent requested pose. Never queue a
 * backlog behind a slow device, and never retain transferred bitmap memory. */
export function organOutput(){
  let worker:Worker|null=null, fallback:ReturnType<typeof createOrganArt>|undefined;
  let busy:Request|null=null,next:Request|null=null,dead=false,unavailable=false;
  function local(r:Request){r.paint(ctx=>(fallback??=createOrganArt()).draw(ctx,r.options));}
  function terminate(){if(worker){worker.onerror=null;worker.onmessageerror=null;worker.onmessage=null;worker.terminate();worker=null;}}
  function fail(){
    unavailable=true;terminate();
    const r=next??busy;busy=next=null;if(r&&!dead)local(r);
  }
  function submit(r:Request){
    if(dead)return;
    if(busy){next=r;return;}
    if(!unavailable&&!worker){
      if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||!OffscreenCanvas.prototype.transferToImageBitmap)unavailable=true;
      else try{
        worker=new Worker(new URL('./organ.worker.ts',import.meta.url),{type:'module'});
        worker.onerror=e=>{e.preventDefault();fail();};
        worker.onmessageerror=fail;
        worker.onmessage=(e:MessageEvent<{bitmap?:ImageBitmap}>)=>{
          const b=e.data.bitmap;if(!b){fail();return;}
          const done=busy;busy=null;
          try{if(!dead&&done)done.paint(ctx=>ctx.drawImage(b,0,0,done.options.width,done.options.height));}
          finally{b.close();}
          const pending=next;next=null;if(pending)submit(pending);
        };
      }catch{unavailable=true;}
    }
    if(!worker){local(r);return;}
    busy=r;try{worker.postMessage({options:r.options,scale:r.scale});}catch{fail();}
  }
  return {submit,dispose(){dead=true;terminate();busy=next=null;fallback?.dispose();}};
}
