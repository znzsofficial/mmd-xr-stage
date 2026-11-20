"""Original ink-and-colour stage screen and carved signs. Offline; Pillow/numpy.
Set QINHUAI_FONT to a CJK calligraphic font when not on Windows."""
from pathlib import Path
import math, random, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

root=Path(__file__).resolve().parent
r=random.Random(829); w,h=1536,1024
im=Image.new('RGB',(w,h),'#312d2c'); d=ImageDraw.Draw(im)
for y in range(640):
    t=y/640; d.line((0,y,w,y), fill=tuple(int(a+(b-a)*t) for a,b in zip((207,174,121),(234,204,148))))
def oval(x,y,a,b,c): d.ellipse((x-a,y-b,x+a,y+b),fill=c)
oval(1032,145,64,64,'#f4e5b3')
for j,(cy,amp,col) in enumerate([(292,61,'#acaa94'),(350,83,'#929e93'),(386,41,'#728d85')]):
    pts=[(x,cy+amp*(.42*math.cos(x*.014+j)+.36*math.sin(x*.0091-j*2.0)+.15*math.sin(x*.026)+.06*math.cos(x*.063))) for x in range(-4,w+8,4)]
    d.polygon(pts+[(w,cy+76),(0,cy+76)],fill=col)
    for x,y in pts[::2]:
        if r.random()<.58:d.line([(x,y+1),(x-3,y+8),(x-9,y+13)],fill=('#a2a58f','#87998d','#69887f')[j],width=1)
for j in range(600):
    x=r.uniform(0,w);y=r.uniform(387,630);d.line((x,y,x+r.uniform(4,80),y),fill=r.choice(['#c2b394','#d9c199','#b4aa8e']),width=1)
# Island and tiny open pavilion at the foot of the mountains.
d.polygon([(793,397),(838,389),(872,390),(892,384),(979,383),(1031,389),(1094,399)],fill='#718176')
for x in [893,908,926,947]:d.rectangle((x,354,x+3,384),fill='#555e54')
d.polygon([(879,357),(899,346),(917,328),(930,342),(957,356),(969,351),(956,361),(883,361),(872,356)],fill='#4e635e')
for x in [874,975,979,989]:
    ht=r.uniform(19,43); d.line((x,388,x-1,388-ht),fill='#566b60',width=2)
    for i in range(6):oval(x+r.uniform(-6,6),388-ht+i*3,4+i,3,'#708376')
# A spreading pine, with individual bunches of needles in the foreground.
d.polygon([(-15,642),(-15,451),(55,435),(134,465),(180,459),(216,477),(289,493),(371,549),(430,580),(536,616),(597,640)],fill='#647569')
def pine(x,y,ang,length,width,level):
    bend=r.uniform(-.33,.33);mx=x+length*.48*math.cos(ang);my=y+length*.48*math.sin(ang)
    ex=mx+length*.52*math.cos(ang+bend);ey=my+length*.52*math.sin(ang+bend)
    d.line([(x,y),(mx,my),(ex,ey)],fill='#4e5144',width=max(1,int(width)),joint='curve')
    d.line([(x+2,y),(mx+2,my),(ex+1,ey)],fill='#8a7756',width=max(1,int(width*.19)))
    if level:
        pine(ex,ey,ang+r.uniform(-.48,.18),length*r.uniform(.68,.83),width*.67,level-1)
        pine(ex,ey,ang+r.uniform(.38,.93),length*r.uniform(.46,.7),width*.59,level-1)
    else:
        for k in range(27):
            a=r.uniform(-3.1,-.15);ll=r.uniform(7,25); ox=r.uniform(-10,10);d.line((ex+ox,ey,ex+ox+math.cos(a)*ll,ey+math.sin(a)*ll),fill=r.choice(['#4f6858','#60755e','#707d61']),width=2)
pine(-47,484,-.62,170,22,5);pine(-18,482,-1.22,132,17,5)
for x,y in [(737,189),(711,196),(689,200),(1071,244),(1093,237)]:d.line([(x-8,y-3),(x-4,y-2),(x,y+2),(x+4,y-2),(x+9,y-4)],fill='#68776e',width=2)
def font(n):return ImageFont.truetype(os.environ.get('QINHUAI_FONT','C:/Windows/Fonts/simkai.ttf'),n)
def column(text,x,y,sz,ink):
    for i,c in enumerate(text):d.text((x,y+i*sz*1.19),c,font=font(sz),fill=ink,anchor='mt')
column('江聲入畫',1415,55,42,'#625847');column('泊月樓藏',1360,60,22,'#796a54');d.rectangle((1345,185,1372,215),fill='#aa5845');d.text((1358,190),'月',font=font(19),fill='#e5c6a0',anchor='mt')
def plaque(box,bg,edge):
    x,y,xx,yy=box;d.rectangle(box,fill=bg);d.rectangle((x+6,y+6,xx-6,yy-6),outline=edge,width=3);d.rectangle((x+12,y+12,xx-12,yy-12),outline=edge,width=1)
    for px,sx in [(x+17,1),(xx-17,-1)]:
        for py,sy in [(y+17,1),(yy-17,-1)]:d.line([(px,py+21*sy),(px+10*sx,py+21*sy),(px+10*sx,py+9*sy),(px+22*sx,py+9*sy),(px+22*sx,py)],fill=edge,width=3)
plaque((0,650,780,908),'#383938','#bf9c65')
for i,c in enumerate('樓月泊'):d.text((177+i*213,770),c,font=font(165),fill='#e4c48b',anchor='mm')
plaque((800,650,1534,908),'#663d37','#b68e64')
for i,c in enumerate('音清江一'):d.text((918+i*163,773),c,font=font(124),fill='#e4bc82',anchor='mm')
# Tiled brocade band from an original interlocking water and plum pattern.
d.rectangle((0,920,w,1024),fill='#713f40');d.line((0,930,w,930),fill='#e6bf87',width=3);d.line((0,1014,w,1014),fill='#e6bf87',width=3)
for i in range(-1,34):
    x=i*48;y=972;d.polygon([(x-44,y),(x,y-32),(x+44,y),(x,y+32)],outline='#ba8d66',width=3);oval(x,y,4,4,'#e2bc83')
    for a in range(5):oval(x+math.cos(a*1.257)*9,y+math.sin(a*1.257)*9,4,4,'#c8a07a')
arr=np.asarray(im).astype(np.int16);rng=np.random.default_rng(280); yy,xx=np.indices((h,w));grain=rng.normal(0,2,(h,w))+((xx%3)==0)*2+((yy%4)==0)*1.5
Image.fromarray(np.clip(arr+grain[:,:,None],0,255).astype('uint8')).save(root/'songhouse-silk.webp',quality=89,method=6)
