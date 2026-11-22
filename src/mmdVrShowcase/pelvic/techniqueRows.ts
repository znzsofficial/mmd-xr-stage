import {buttons,field,key,note,type Localize,type Row} from './controlRows';
import {MAX_TAKE_SECONDS} from './railTechnique';
import {clearRailTechnique,patchPelvic,PELVIC_LIMITS,saveRailTechnique,startRailTechnique,type PelvicActive,type PelvicProfile} from './store';

export function techniquePage(assetId:string,p:PelvicProfile,take:PelvicActive['take'],l:Localize,
  controls:{manual:boolean;ready:boolean;home:boolean;jog:Row;withdraw:Row;slider:Row;back:()=>void}){
  const {manual,ready,home,jog,withdraw,slider,back}=controls,clip=p.technique,rate=p.replayRate??1,rows:Row[]=[];
  const length=clip?.seconds.toFixed(1);
  let status='';
  const clear=()=>key(l('清除手法','Clear take'),()=>clearRailTechnique(assetId),{danger:true});
  if(!manual||!ready){
    status=(clip?l(`已保存 ${length} 秒。`,`Saved: ${length} s. `):'')+l('返回操作页，放好手动支架并确认衣着。','Place the manual stand and confirm clothing under Use.');
    if(clip&&!take)rows.push(buttons(clear()));
  }
  else if(take?.kind==='record'){
    status=take.seconds===MAX_TAKE_SECONDS?(take.canSave?l('已录满 20 秒。保存或停止录制。','20 seconds recorded. Save or stop recording.'):
      l('杆位没有变化。停止录制后可重录。','No movement recorded. Stop and record again.')):
      l(`录制中 · ${take.seconds} / ${MAX_TAKE_SECONDS} 秒。用滑杆推进、停留或撤回。`,`Recording · ${take.seconds} / ${MAX_TAKE_SECONDS} s. Move or hold the rail.`);
    rows.push(jog,slider,buttons(key(clip?l('保存并替换手法','Save and replace take'):l('保存手法','Save take'),()=>saveRailTechnique(assetId),{primary:true,disabled:!take.canSave})));
  }else{
    status=take?l(`正在回放 · ${length} 秒 · ${rate}×`,`Playing · ${length} s · ${rate}×`):
      `${clip?l(`已保存 ${length} 秒。`,`Saved: ${length} s. `):l('此角色还没有手法。','No take for this actor yet. ')}${home?l('从入口外录制，最多 20 秒。','Record from outside, up to 20 seconds.'):
        l('先完全退出到起点，再录制或播放。','Withdraw fully to the starting point before recording or playing.')}`;
    if(!take){
      if(!home)rows.push(withdraw);
      rows.push(buttons(key(clip?l('重录手法','Record again'):l('录制手法','Record take'),()=>startRailTechnique(assetId,'record'),{primary:!clip,disabled:!home}),
        ...(clip?[key(l('播放手法','Play take'),()=>startRailTechnique(assetId,'replay'),{primary:true,disabled:!home})]:[])));
    }
    if(clip){
      rows.push(field(l('回放速度','Playback speed'),rate,'×',PELVIC_LIMITS.replayRate,.25,n=>patchPelvic(assetId,{replayRate:n})),
        buttons(key(p.replayLoop?l('循环：开','Loop: on'):l('循环：关','Loop: off'),()=>patchPelvic(assetId,{replayLoop:!p.replayLoop}),{active:!!p.replayLoop}),
          ...(!take?[clear()]:[])));
    }
    if(!take&&!clip)rows.push(note(l('只录杆位和停顿。释放由你单独操作。','The take stores movement and pauses. Release remains a separate action.')));
  }
  rows.push(buttons(key(l('返回操作','Back to controls'),back)));return {status,rows};
}
