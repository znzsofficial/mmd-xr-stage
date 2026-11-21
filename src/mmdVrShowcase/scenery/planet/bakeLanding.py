"""Enamel field compass and tileable diagrams of fractured opal, drawn for the set."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,math,random
out=Path(__file__).parent;random.seed(411);rng=np.random.default_rng(411)
s=768;im=Image.new('RGB',(s,s),'#425f71');c=ImageDraw.Draw(im);h=s/2
def pt(a,r):return(h+math.sin(a)*r,h-math.cos(a)*r)
def circle(r,**kw):c.ellipse((h-r,h-r,h+r,h+r),**kw)
for i in range(48):
    a=i*7.5-90+.20;b=a+7.08;c.pieslice((4,4,s-4,s-4),a,b,fill=['#697985','#596f7e','#72858c','#516e79'][i%4]);
circle(342,fill='#315864',outline='#c0ae83',width=2);circle(307,fill='#476d76');circle(303,fill='#355c6c');circle(271,fill='#385b6a',outline='#678088',width=2)
for i in range(120):
    a=i*math.pi/60;c.line([pt(a,326 if i%5 else 310),pt(a,337)],fill='#d1bd94' if i%5==0 else '#93a5a5',width=3 if i%5==0 else 2)
for i in range(8):
    a=i*math.pi/4;length=253 if i%2==0 else 188
    c.polygon([pt(a,length),pt(a+math.pi/2,29),pt(a,0)],fill='#b8a784' if i%2==0 else '#75888a');c.polygon([pt(a,length),pt(a-math.pi/2,29),pt(a,0)],fill='#5c7980')
    c.ellipse((*[v-4 for v in pt(a,353)],*[v+4 for v in pt(a,353)]),fill='#d9c998')
circle(35,fill='#7a8e8e',outline='#d8bd8b',width=3);circle(25,fill='#264b5c',outline='#a89b79',width=2);circle(6,fill='#e7cda1');
for i in range(96):
    a=random.random()*2*math.pi;r=random.uniform(53,262);x,y=pt(a,r);sz=random.choice([1,1,2,3]);c.ellipse((x-sz,y-sz,x+sz,y+sz),fill='#97a6a2')
try:font=ImageFont.truetype('DejaVuSans.ttf',20)
except OSError:font=ImageFont.load_default(size=20)
for i,t in enumerate(['N','E','S','W']):c.text(pt(i*math.pi/2,287),t,font=font,anchor='mm',fill='#e5d6b2')
p=np.array(im,dtype=float);p+=rng.normal(0,1.5,(s,s,1));Image.fromarray(np.uint8(np.clip(p,0,255))).save(out/'landing-rose.webp',quality=90,method=6)
# A wrapped Voronoi outcrop: soft bedding, irregularly cut plates, intermittent
# mineral grout and chips. No alpha blended decals or view-dependent noise.
s=640;Y,X=np.mgrid[:s,:s]/s
u=(X+.013*np.sin(Y*2*math.pi)+.003*np.sin(2*math.pi*(6*Y+3*X)))%1;v=(Y+.010*np.sin(2*math.pi*(X+2*Y)))%1
d0=np.full_like(u,10);d1=d0.copy();tint=np.zeros_like(u)
for i in range(75):
    xx,yy=rng.random(2);dx=np.abs(u-xx);dy=np.abs(v-yy);d=np.minimum(dx,1-dx)**2+.56*np.minimum(dy,1-dy)**2
    close=d<d0;d1=np.where(close,d0,np.minimum(d1,d));d0=np.where(close,d,d0);tint=np.where(close,rng.uniform(-14,14),tint)
edge=np.sqrt(d1)-np.sqrt(d0);wash=6*np.sin(2*math.pi*(X*3+Y*6)+np.sin(2*math.pi*X))+4*np.sin(2*math.pi*(X*2-Y*13))
bright=232+tint+wash-43*np.exp(-edge*430)+9*np.exp(-((edge-.006)/.0025)**2)+rng.normal(0,2,u.shape)
Image.fromarray(np.uint8(np.clip(bright,0,255))).convert('RGB').save(out/'fracture.webp',quality=87,method=6)
