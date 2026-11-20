"""Repaint the east garden entrance: enamel, two paving modules and garden limestone.
Offline, Pillow + numpy. Set CLINIC_FONT / CLINIC_FONT_BOLD for local CJK fonts.
The 8px extruded gutters and UV crops correspond to GardenEntrance.tsx.
"""
import math, os, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

r=random.Random(22143)
REG=os.environ.get('CLINIC_FONT','C:/Windows/Fonts/msyh.ttc')
BOLD=os.environ.get('CLINIC_FONT_BOLD','C:/Windows/Fonts/msyhbd.ttc')
atlas=Image.new('RGB',(1024,1024))

def mount(image,x,y):
    atlas.paste(Image.fromarray(np.pad(np.asarray(image),((8,8),(8,8),(0,0)),mode='edge')),(x,y))

def lettering(d,x,y,text,size,bold=False,color='#fff5df'):
    d.text((x,y),text,font=ImageFont.truetype(BOLD if bold else REG,size),fill=color,anchor='lt')

def enamel(i,cn,en,arrow=None):
    im=Image.new('RGB',(496,240),'#204e50' if i!=2 else '#527159');d=ImageDraw.Draw(im)
    d.rounded_rectangle((3,3,492,236),radius=11,outline='#acc1af',width=2)
    d.line((23,49,468,49),fill='#94aba0',width=2)
    lettering(d,23,17,'E A S T    /    0 1' if i in (0,1) else 'G A R D E N    /    0 2',20,color='#d9d2ac')
    if arrow:
        # The stem and head form one continuous enamel silhouette.
        p=[(60,88),(85,115),(78,122),(66,110),(66,155),(54,155),(54,110),(42,122),(35,115)]
        d.polygon(p,fill='#f0cd89');x=111
    else:
        # An original ginkgo leaf, also used in the door safety band.
        leaf=[(58,145),(28,123),(25,109),(36,96),(49,92),(58,100),(66,91),(83,96),(94,110),(91,126)]
        d.polygon(leaf,fill='#eac58d');d.line((58,154,58,139,47,108), fill='#ac8f63',width=3);x=112
    lettering(d,x,75,cn,64,True);lettering(d,x+2,163,en,29,True)
    d.line((x+2,209,468,209),fill='#89a298',width=2)
    mount(im,(i%2)*512,(i//2)*256)

enamel(0,'门诊入口','OUTPATIENTS');enamel(1,'门诊','CLINIC',True)
enamel(2,'花园草坪','MEADOW',True)
im=Image.new('RGB',(496,64),'#a2b5af');d=ImageDraw.Draw(im)
for i in range(-1,14):
    x=i*43;d.polygon([(x,44),(x+21,18),(x+36,18),(x+15,44)],fill='#eae7ce')
d.line((0,11,496,11),fill='#e9e7d7',width=4);d.line((0,52,496,52),fill='#527e79',width=3)
mount(im,512,256)
# The waiting room window laminate: a frosted lower pane, fine curtain folds
# and the reflection of a leafy arcade rather than a featureless blue wall.
im=Image.new('RGB',(496,160));d=ImageDraw.Draw(im)
for y in range(160):
    a=y/160;t=int(20*math.sin(a*2.6));d.line((0,y,496,y),fill=(135+t,163+t,161+int(.6*t)))
for i in range(10):
    x=i*67+r.randrange(-14,12);y=r.randrange(76,117)
    d.polygon([(x-43,145),(x-32,y-6),(x-19,y-14),(x+3,y-18),(x+27,y+8),(x+42,149)],fill=('#94aaa0','#8da696','#98aca0')[i%3]);d.line((x,y,x+4,155),fill='#99aca2',width=2)
for i in range(13):
    x=310+15*i;d.polygon([(x,0),(x+8,0),(x-2,156),(x-9,156)],fill=('#bcc2ad','#b5bdad','#c4c5b4')[i%3]);d.line((x+2,0,x-8,156),fill='#c7ccbb',width=2)
d.rectangle((0,123,495,159),fill='#b5c0b5');d.line((0,118,495,118),fill='#cad1c1',width=3)
mount(im,512,336)

def pavement(outer,wet):
    w,h=496,496;scene=Image.new('RGB',(w,h),'#9f9f93');g=ImageDraw.Draw(scene)
    for row in range(6):
        for col in range(-1,5):
            x=round((col+(row%2)*.5)*w/3);y=round(row*h/6)
            x1=round((col+1+(row%2)*.5)*w/3)-1;y1=round((row+1)*h/6)-1
            n=r.randint(-8,8);t=tuple(c+n for c in outer)
            g.rectangle((x+1,y+1,x1,y1),fill=t);g.line((x+1,y1,x+1,y+1,x1,y+1),fill=tuple(c+7 for c in t),width=1)
    # Stippled capillary tide marks: concentrate dampness along a rain edge,
    # not uniformly shiny stone. No alpha overlay/extra material at runtime.
    yy,xx=np.mgrid[0:h,0:w];noise=np.random.default_rng(932).normal(0,2.6,(h,w));a=np.array(scene,dtype=float)
    water=(.5+.5*np.cos((yy+14*np.sin(xx*2*math.pi/w))*2*math.pi/h))**7
    water*=.5+.5*np.sin(2*math.pi*xx/w+.9*np.sin(2*math.pi*yy/h))
    a+=noise[:,:,None];a-=np.expand_dims(water,2)*np.array((32,26,17))*(1 if wet else .42)
    return Image.fromarray(np.uint8(np.clip(a,0,255)))
mount(pavement((199,194,172),True),0,512);mount(pavement((203,184,153),False),512,512)
out=Path(__file__).with_name('clinic-garden.webp');atlas.save(out,'WEBP',quality=89,method=6);print(out.name,out.stat().st_size)
