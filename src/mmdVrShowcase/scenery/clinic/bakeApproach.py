"""Bake the clinic door enamel and safety band with 8 px gutters for GardenEntrance.tsx.
Set CLINIC_FONT / CLINIC_FONT_BOLD for local CJK fonts.
"""
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REG=os.environ.get('CLINIC_FONT','C:/Windows/Fonts/msyh.ttc')
BOLD=os.environ.get('CLINIC_FONT_BOLD','C:/Windows/Fonts/msyhbd.ttc')
atlas=Image.new('RGB',(512,336))

def mount(image,y):
    atlas.paste(Image.fromarray(np.pad(np.asarray(image),((8,8),(8,8),(0,0)),mode='edge')),(0,y))

def lettering(d,x,y,text,size,bold=False,color='#fff5df'):
    d.text((x,y),text,font=ImageFont.truetype(BOLD if bold else REG,size),fill=color,anchor='lt')

im=Image.new('RGB',(496,240),'#204e50');d=ImageDraw.Draw(im)
d.rounded_rectangle((3,3,492,236),radius=11,outline='#acc1af',width=2)
d.line((23,49,468,49),fill='#94aba0',width=2)
lettering(d,23,17,'E A S T    /    0 1',20,color='#d9d2ac')
leaf=[(58,145),(28,123),(25,109),(36,96),(49,92),(58,100),(66,91),(83,96),(94,110),(91,126)]
d.polygon(leaf,fill='#eac58d');d.line((58,154,58,139,47,108),fill='#ac8f63',width=3)
lettering(d,112,75,'门诊入口',64,True);lettering(d,114,163,'OUTPATIENTS',29,True)
d.line((114,209,468,209),fill='#89a298',width=2)
mount(im,0)

im=Image.new('RGB',(496,64),'#a2b5af');d=ImageDraw.Draw(im)
for i in range(-1,14):
    x=i*43;d.polygon([(x,44),(x+21,18),(x+36,18),(x+15,44)],fill='#eae7ce')
d.line((0,11,496,11),fill='#e9e7d7',width=4);d.line((0,52,496,52),fill='#527e79',width=3)
mount(im,256)
out=Path(__file__).with_name('clinic-garden.webp');atlas.save(out,'WEBP',quality=89,method=6);print(out.name,out.stat().st_size)
