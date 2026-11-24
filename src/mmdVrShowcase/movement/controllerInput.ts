// Quest Touch's xr-standard layout reserves axes 0/1 for a touchpad even
// when none is fitted. A live source can exist before its profile is loaded.
type Profile = {inputSource:XRInputSource; gamepad:{'xr-standard-thumbstick'?:{xAxis?:number;yAxis?:number};'a-button'?:{state?:string};'x-button'?:{state?:string};'y-button'?:{state?:string}}};
export const stickAxis=(v:number)=>Math.sign(v)*Math.max(0,(Math.min(1,Math.abs(v))-.16)/.84);
// The lower face button is A on the right Touch and X on the left.
export const newStick=()=>({x:0,y:0,primary:false,align:false,primaryKnown:false,alignKnown:false,via:'none' as 'none'|'native'|'profile'});
export function readStick(sources:XRInputSourceArray,hand:'left'|'right',profile:Profile|undefined,out:ReturnType<typeof newStick>){
  out.x=out.y=0;out.primary=out.align=out.primaryKnown=out.alignKnown=false;out.via='none';
  for(let i=0;i<sources.length;i++){
    const s=sources[i],g=s.gamepad;if(s.handedness!==hand||s.hand||s.targetRayMode!=='tracked-pointer'||!g)continue;
    const mapped=profile?.inputSource===s?profile.gamepad:undefined,stick=mapped?.['xr-standard-thumbstick'];
    const axes=g.axes;
    if(g.mapping==='xr-standard'&&Number.isFinite(axes[2])&&Number.isFinite(axes[3])){
      out.x=axes[2];out.y=axes[3];out.via='native';
    }else if(stick&&Number.isFinite(stick.xAxis)&&Number.isFinite(stick.yAxis)){out.x=stick.xAxis!;out.y=stick.yAxis!;out.via='profile';}
    const native=g.mapping==='xr-standard'&&s.profiles?.some(p=>/^(oculus-touch|meta-quest-touch)/.test(p))===true;
    const primary=mapped?.[hand==='left'?'x-button':'a-button']?.state,align=mapped?.['y-button']?.state;
    out.primaryKnown=primary!=null||native&&typeof g.buttons[4]?.pressed==='boolean';
    out.alignKnown=hand==='left'&&(align!=null||native&&typeof g.buttons[5]?.pressed==='boolean');
    out.primary=primary==='pressed'||native&&g.buttons[4]?.pressed===true;
    out.align=hand==='left'&&(align==='pressed'||native&&g.buttons[5]?.pressed===true);
    if(out.via!=='none'||out.primaryKnown||out.alignKnown)return;
  }
}
