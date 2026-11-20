"""Original clinic figure paint; no photographs or external assets. Pillow + NumPy."""
from pathlib import Path
import math
import numpy as np
from PIL import Image, ImageDraw

# Left half: cylindrical face UV, U=.5 at the nose, V=0 at the chin.
n=512
y,x=np.mgrid[:n,:n]; angle=(x/(n-1)-.5)*2*math.pi; v=1-y/(n-1)
rng=np.random.default_rng(57)
base=np.zeros((n,n,3))+[224,176,146]
base+=rng.normal(0,.8,(n,n,1))
def wash(a,b,s,t,col,amount):
    g=np.exp(-((angle-a)/s)**2-((v-b)/t)**2)[...,None]*amount
    base[:]=base*(1-g)+np.array(col)*g
for side in [-1,1]:
    wash(side*.53,.37,.34,.14,[194,122,111],.45)
    wash(side*.38,.556,.27,.071,[144,100,92],.5)
    wash(side*1.26,.50,.40,.19,[181,135,117],.40)
wash(0,.07,.64,.08,[180,128,114],.35)
face=Image.fromarray(np.uint8(np.clip(base,0,255))); d=ImageDraw.Draw(face)
def pts(seq):return [((a/(2*math.pi)+.5)*(n-1),(1-b)*(n-1)) for a,b in seq]
def poly(seq,c): d.polygon(pts(seq),fill=c)
def line(seq,c,w):d.line(pts(seq),fill=c,width=w,joint='curve')
for s in [-1,1]:
    def mir(seq): return [(s*a,b) for a,b in seq]
    # The lids enclose the iris; the darker upper lid overlaps its upper arc.
    eye=[(.19,.514),(.27,.531),(.37,.538),(.46,.534),(.55,.522),(.48,.508),(.38,.500),(.28,.503)]
    poly(mir(eye),'#e1d1be');xy=pts([(s*.365,.518)])[0];ix,iy=xy
    d.ellipse((ix-5.5,iy-6.5,ix+5.5,iy+5.5),fill='#564437');d.ellipse((ix-2.5,iy-3.5,ix+2.5,iy+2),fill='#2c2823');d.ellipse((ix-2,iy-3,ix-.5,iy-1.5),fill='#e2d9cc')
    line(mir(eye[:5]),'#59423b',2);line(mir([(.24,.550),(.35,.559),(.46,.554),(.53,.540)]),'#b78571',1)
    poly(mir([(.17,.603),(.26,.619),(.40,.628),(.56,.617),(.65,.597),(.52,.607),(.37,.611),(.23,.599)]),'#665046')
    line(mir([(.047,.340),(.094,.333),(.13,.339)]),'#926452',2)
poly([(-.245,.204),(-.10,.219),(0,.214),(.09,.219),(.245,.204),(.10,.197),(0,.195),(-.11,.198)],'#ab7467')
poly([(-.245,.204),(-.12,.179),(0,.174),(.13,.182),(.245,.204),(0,.196)],'#c18b7f');line([(-.205,.203),(0,.197),(.205,.203)],'#925f56',1)
atlas=Image.new('RGB',(1024,512),'white');atlas.paste(face,(0,0));
# Hair brush follows the sweep towards the low twist. Keep value variation in
# broad locks; dark fine strands never become bright isolated pixels at distance.
p=(x/(n-1));t=y/(n-1);phase=2*math.pi*(p*35+.55*np.sin(p*2*math.pi+t*3)+.33*t)
h=4.4*np.sin(phase)+2.5*np.sin(phase*2.9)+5*np.sin(p*math.pi*8+t*2)
hair=np.uint8(np.clip(np.array([65,48,42])[None,None,:]+h[...,None]*[1,.8,.67],0,255));atlas.paste(Image.fromarray(hair).resize((256,256)),(512,0))
weave=(np.sin(p*math.pi*230)*1.8+np.cos(t*math.pi*194)*1.8+.9*np.sin(t*30+p*6))
cloth=np.uint8(np.clip(247+weave,0,255));atlas.paste(Image.fromarray(cloth).convert('RGB').resize((256,256)),(768,0))
# A woven clinic emblem and pen marks, not a real employee identity.
badge=Image.new('RGB',(248,150),'#e6e9de');bd=ImageDraw.Draw(badge);bd.rectangle((0,0,247,26),fill='#335f66');bd.ellipse((15,52,62,99),fill='#6c999b');bd.line((24,76,35,76,40,64,46,85,51,76,55,76),fill='#f2ede1',width=3)
for yy,w in [(56,116),(76,94),(96,121)]:bd.rounded_rectangle((79,yy,79+w,yy+6),radius=2,fill='#75918e')
atlas.paste(badge,(520,272));atlas.save(Path(__file__).with_name('clinic-nurse.webp'),quality=94,method=6)
