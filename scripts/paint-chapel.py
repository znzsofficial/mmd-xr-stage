"""Offline chapel glass cartoons, limestone and inlaid floor. Pillow + NumPy only.
Original botanical designs; run from any directory to regenerate the WebP maps.
"""
from pathlib import Path
from math import cos, sin, pi, tau
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[1]/'src/mmdVrShowcase/scenery'
rng = np.random.default_rng(81720)
lead = '#4d5056'

def noise(w,h,n):
    tile=Image.fromarray(rng.integers(0,255,(max(3,h//n),max(3,w//n)),dtype=np.uint8))
    return (np.asarray(tile.resize((w,h),Image.Resampling.BICUBIC)).astype('f')-127)/80

def patina(im,grain=1):
    w,h=im.size
    n=noise(w,h,29)*3+noise(w,h,7)*1.8+rng.normal(0,grain,(h,w))
    return Image.fromarray(np.uint8(np.clip(np.asarray(im).astype('f')+n[:,:,None],0,255)))

def save(im,name,size=None):
    if size: im=im.resize(size,Image.Resampling.LANCZOS)
    im.save(OUT/f'chapel-{name}.webp',quality=86,method=6)

def bez(p,a,b,q):
    return [tuple((1-t)**3*p[i]+3*t*(1-t)**2*a[i]+3*t*t*(1-t)*b[i]+t**3*q[i] for i in (0,1)) for t in np.linspace(0,1,19)]

def glass(g,path,color,width=5):
    g.polygon(path,fill=color);g.line([*path,path[0]],fill=lead,width=width,joint='curve')

# A wheel of eight lilies, with separate petals, enamel red bosses and a lapis border.
im=Image.new('RGB',(800,800),'#605655');g=ImageDraw.Draw(im)
def polar(a,r):return (400+r*cos(a),400+r*sin(a))
for count,ri,ro,offset,palette in [(32,344,385,.5,['#96c3d5','#d3b976','#bcdada','#caa066']),
        (16,302,341,0,['#b37782','#a45868','#cf8b7f','#9c5878']),
        (16,55,300,0,['#78a6be','#6180a5','#97bac7','#7095b4'])]:
    for i in range(count):
        angles=np.linspace((i+offset)*tau/count,(i+1+offset)*tau/count,12)
        glass(g,[polar(a,ri) for a in angles]+[polar(a,ro) for a in reversed(angles)],palette[i%len(palette)],4)
for i in range(8):
    a=i*tau/8-pi/2
    def local(p):
        x,y=p;return polar(a+np.arctan2(x,y),np.hypot(x,y))
    for side in [-1,1]:
        root=(0,90);tip=(side*86,242)
        path=bez(root,(side*10,172),(side*96,172),tip)+bez(tip,(side*47,240),(side*20,179),root)
        glass(g,[local(p) for p in path],['#efc890','#e6abb2'][side>0],5)
    root=(0,142);tip=(0,293)
    glass(g,[local(p) for p in bez(root,(-50,197),(-15,245),tip)+bez(tip,(20,248),(45,199),root)],'#ffefbf',5)
    x,y=local((0,101));g.ellipse((x-11,y-11,x+11,y+11),fill='#a95261',outline=lead,width=3)
for i in range(16):
    a=(i+.5)*tau/16
    def jewel(r,spread,deep,color):
        glass(g,[polar(a,r-deep),polar(a+spread,r),polar(a,r+deep),polar(a-spread,r)],color,3)
    jewel(326,.052,13,'#e0a973');jewel(364,.047,13,'#6c819e')
    # Thin radial leadwork across the blue ground, broken where it meets the petals.
    for r in [194,249]:
        path=[polar(a+u,r+4*cos(8*u)) for u in np.linspace(-.075,.075,17)]
        g.line(path,fill='#536579',width=3)
for r,c in [(62,'#d3ad61'),(48,'#925466'),(30,'#fff0ba')]:g.ellipse((400-r,400-r,400+r,400+r),fill=c,outline=lead,width=5)
save(patina(im),'rose',(512,512))

# A lancet pair: a vine rises from a blue vase into a white lily. Geometric
# panes keep their lead seams visible behind the silhouette at a distance.
im=Image.new('RGB',(440,800),'#d5c8a6');g=ImageDraw.Draw(im)
pal=['#76a5bb','#a1c3c4','#c3d4c1','#e5c996','#b2ccd5','#d8c4ab']
for j in range(-1,10):
    for i in range(-1,6):
        x=i*104+(j%2)*52;y=j*100
        glass(g,[(x,y-94),(x+50,y),(x,y+94),(x-50,y)],pal[(3*i+j*j)%6],4)
for s in (-1,1):
    x=220+s*88
    stem=bez((x,610),(x-68*s,518),(x+32*s,426),(x,320));g.line(stem,fill=lead,width=13);g.line(stem,fill='#739a79',width=6)
    for y in [424,504,566]:
        for k in [-1,1]:
            a=(x,y);b=(x+k*54,y-51);glass(g,bez(a,(x,y-26),(x+k*30,y-37),b)+bez(b,(x+k*39,y-20),(x+k*12,y),a),'#8cafa2',4)
    for k in [-1,1,0]:
        a=(x,337);tip=(x+k*67,233+abs(k)*28)
        glass(g,bez(a,(x-25+k*24,310),(tip[0]-14,tip[1]+18),tip)+bez(tip,(tip[0]+23,tip[1]+20),(x+14+k*22,313),a),'#fce1a7' if k==0 else '#f7edcd',4)
    glass(g,[(x-21,604),(x+21,604),(x+29,621),(x+12,663),(x-13,663),(x-28,621)],'#657eaa')
    for y in (370,694):g.line((x-74,y,x+74,y),fill=lead,width=3)
for x in (13,427,220):g.line((x,20,x,792),fill='#625958',width=8)
save(patina(im),'lancet',(256,512))

# Four courses of bedded limestone, edges periodic when mapped onto long walls.
im=Image.new('RGB',(512,512),'#b5aa99');g=ImageDraw.Draw(im)
for j in range(8):
    for i in range(-1,5):
        x=i*128+(j%2)*64;y=j*64;n=rng.integers(-7,8)
        g.rectangle((x+1,y+1,x+127,y+63),fill=tuple(int(v+n) for v in (217,207,189)))
        g.line((x+2,y+2,x+126,y+2),fill='#e4d9c8',width=1)
save(patina(im),'ashlar')

# Orthographic floor painting in world metres; texture-top points to the altar.
W,H=928,1440; ppm=80
def px(x,z):return ((x+5.8)*ppm,(z+9)*ppm)
im=Image.new('RGB',(W,H),'#b8ab9a');g=ImageDraw.Draw(im)
for j in range(21):
    for i in range(-1,13):
        x=i*88+(j%2)*44;y=j*72;k=rng.integers(-6,7);c=(207+k,198+k,184+k)
        g.rectangle((x+1,y+1,x+87,y+71),fill=tuple(map(int,c)))
for sign in (-1,1):
    for x,w,col in [(1.34,.13,'#73777a'),(1.46,.03,'#b29d79'),(1.20,.025,'#aa9373')]:
        a=sign*x;g.rectangle([px(a-w/2,-9),px(a+w/2,9)],fill=col)
    for z in np.arange(-8.4,9,1.15):
        x=sign*1.34;g.polygon([px(x-.05,z),px(x,z-.15),px(x+.05,z),px(x,z+.15)],fill='#e6d3aa')
for z in [-4.15,3.45]:
    for r,col in [(.58,'#858080'),(.53,'#c6ae83'),(.48,'#939c97'),(.44,'#e1d4bc')]:g.ellipse([px(-r,z-r),px(r,z+r)],fill=col)
    for i in range(8):
        a=i*tau/8;g.polygon([px(0,z),px(.16*cos(a-.4),z+.16*sin(a-.4)),px(.42*cos(a),z+.42*sin(a)),px(.16*cos(a+.4),z+.16*sin(a+.4))],fill='#a29484' if i%2 else '#798789')
im=patina(im)
# Oblique transmitted light from the left bank of windows, fixed to the stone,
# not a transparent overlay or an extra light on the viewer's character.
light=Image.new('RGBA',(W,H));l=ImageDraw.Draw(light)
for z in [-7.5,-4.5,-1.5,1.5,4.5,7.5]:
    def project(u,v):return px(-5.8+1.23*v,z+u-.60*v)
    for j in range(6):
        for i in range(4):
            u=-.83+i*.42;v=1.12+j*.49;w=.40;h=.47
            if j==5 and i in (0,3):continue
            col=[(252,211,139,126),(137,203,221,108),(255,235,176,145),(227,161,164,98)][(i+j//2)%4]
            l.polygon([project(u,v),project(u+w,v),project(u+w,v+h),project(u,v+h)],fill=col)
im=Image.alpha_composite(im.convert('RGBA'),light.filter(ImageFilter.GaussianBlur(3.5))).convert('RGB')
# Contact shadow under the pews gives the heavy carved oak a grounded silhouette
# with shadow maps switched off. The central strip remains pale for dark habits.
occlusion=Image.new('L',(W,H));o=ImageDraw.Draw(occlusion)
for z in [-2.4,-.85,.70,2.25,3.8,5.35]:
    for x in (-2.85,2.85):
        o.polygon([px(x-1.29,z-.35),px(x+1.30,z-.35),px(x+1.62,z+.24),px(x-1.10,z+.36)],fill=110)
        for sign in (-1,1):
            xx=x+sign*1.25;o.rectangle([px(xx-.11,z-.32),px(xx+.12,z+.33)],fill=176)
o.rectangle([px(-3.93,-9),px(3.95,-5.55)],fill=75)
im=Image.composite(Image.blend(im,Image.new('RGB',im.size,'#5e5556'),.78),im,occlusion.filter(ImageFilter.GaussianBlur(3)))
save(im,'pavement')
