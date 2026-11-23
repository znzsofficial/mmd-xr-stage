import {Color} from 'three';
import {apseStrike,apseWing,bedFlare,caveMouth,easeTide} from './tideLayout';

export const chalk=new Color('#fff1d6');
const shell=new Color('#ebcdab'),ochre=new Color('#d8a17c'),apricot=new Color('#f1c39d');
const blue=new Color('#506a9c'),indigo=new Color('#374a79'),lilac=new Color('#a3a5b9'),washed=new Color('#b1bdcb');
export type StoneFace='inside'|'outside'|'edge'|'apse'|'window'|'bluff';

// Material, not scene grading. The chalk cap, coral-beige bedding and blue
// marine clay are continuous broad deposits with different exposure on each
// cut. The backdrop is a quiet middle value, even with no dynamic shadows.
export function tideLimestone(c:Color,x:number,y:number,z:number,face:StoneFace,t:number){
  const h=apseStrike(y,z)+.12*(x-4),bed=easeTide(.18,.61,h)*(1-easeTide(1.27,1.76,h));
  const grain=.5+.5*Math.sin(1.05*x+.74*z-.7*y);
  if(face==='outside'){
    c.copy(shell).lerp(ochre,.57*bed).lerp(chalk,.32+.45*easeTide(1.6,3.8,h)+.10*grain);
  }else if(face==='edge'){
    // A single warm fossil bed below a bleached cap. It tapers through the
    // thinner side; no painted tracing around the outline of the arch.
    c.copy(apricot).lerp(chalk,.80*easeTide(.49,.88,t)).lerp(lilac,.74*bedFlare(t,.32,.11));
  }else if(face==='inside'){
    const light=1-easeTide(.0,1.55,x-caveMouth(z));
    c.copy(indigo).lerp(blue,.32+.28*grain).lerp(washed,.64*bed).lerp(shell,.67*light+.13*(1-easeTide(.2,1.4,y)));
  }else if(face==='window'){
    if(t<0)c.copy(indigo).lerp(lilac,.22-.36*t);else c.copy(shell).lerp(chalk,.18+.69*t);
  }else if(face==='bluff'){
    c.copy(ochre).lerp(shell,.54*easeTide(.18,.32,t)).lerp(lilac,.72*bedFlare(t,.54,.12)).lerp(chalk,.86*easeTide(.68,.93,t));
  }else{
    const wing=apseWing(z),cut=apseStrike(y,z);
    c.copy(blue).lerp(indigo,.21+.14*grain);
    c.lerp(ochre,.84*bedFlare(cut,.25,.36)).lerp(shell,.69*bedFlare(cut,.49,.19));
    c.lerp(lilac,(.49+.25*wing)*bedFlare(cut,2.19,.37)).lerp(shell,(.48+.25*wing)*bedFlare(cut,2.40,.18));
  }
}
