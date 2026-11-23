import {paintedSurface} from '../sceneryPaint';
import type {WindTerminal} from './windTerminalLayout';

/** Two enamel legends on one atlas. Switching the register changes only UVs;
 * the plate and the release target stay put underneath the pointer. */
export function windTerminalPrint({back,lane:{moon}}:WindTerminal,zh:boolean){
  const [code,local]=moon.sign.split(' · '),[name,landform]=moon.caption.split('   /   ');
  const title=back?(zh?'返回北台':'Opal Return'):(zh?local:name);
  const font='"Microsoft YaHei",system-ui,sans-serif';
  return paintedSurface(640,520,c=>{
    for(const active of [true,false]){
      c.save();if(!active)c.translate(0,260);
      c.fillStyle='#203738';c.fillRect(0,0,640,260);c.fillStyle='#172b2e';c.fillRect(0,0,166,260);
      c.fillStyle=moon.color;c.fillRect(14,24,5,212);c.font=`600 27px ${font}`;
      c.fillText(back?'RTN':'WIND',39,65);
      c.fillStyle='#f2e5c9';c.font=`600 94px ${font}`;c.fillText(code,32,175,120);
      c.fillStyle='#b7c9bd';c.font=`500 24px ${font}`;c.fillText('MERIDIAN',192,61);
      c.fillStyle='#fff1d7';c.font=`600 60px ${font}`;c.fillText(title,188,145,425);
      c.fillStyle='#889888';c.fillRect(192,169,420,2);
      c.fillStyle=active?moon.color:'#c2cec4';c.font=`600 ${active?34:27}px ${font}`;
      c.fillText(active?(zh?'G   /   左 X':'G   /   LEFT X'):(back?name:landform),192,223,422);
      c.restore();
    }
  });
}
