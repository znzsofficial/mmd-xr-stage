"""Paint the Jiangnan house albedo plates. python architectureBake.py (Pillow, NumPy).

Each 512-square slot has a 12 px edge extrusion for oblique mip samples. Patterns
are painted for a particular surface: roof troughs run UP the slope; the dark
edge of each brick is the top mortar joint, not a screen-space drop shadow.
"""
from pathlib import Path
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFont

N = 488
Y, X = np.mgrid[:N, :N] / N
rng = np.random.default_rng(52)
r = random.Random(721)
atlas = Image.new('RGB', (2048, 2048))


def noise(frequency):
    a = rng.normal(0, 1, (frequency, frequency))
    # Periodic smooth interpolation makes the stone, plaster and wood repeat.
    u, v = X * frequency, Y * frequency
    i, j = u.astype(int), v.astype(int)
    u, v = u % 1, v % 1
    u, v = u*u*(3-2*u), v*v*(3-2*v)
    return sum(a[(j+b) % frequency, (i+c) % frequency] * (v if b else 1-v) *
               (u if c else 1-u) for b in range(2) for c in range(2))


large, fine, grain = noise(5), noise(28), rng.normal(0, 1, (N, N))


def surface(rgb, relief):
    return Image.fromarray(np.uint8(np.clip(np.array(rgb)[None, None, :] + relief[:, :, None], 0, 255)))


def store(i, image):
    arr = np.pad(np.asarray(image.convert('RGB')), ((12, 12), (12, 12), (0, 0)), mode='edge')
    atlas.paste(Image.fromarray(arr), ((i % 4) * 512, (i // 4) * 512))


def masonry(nx, ny, rgb, mortar, chips, seed):
    j = np.floor(Y*ny).astype(int)
    x = X*nx + (j % 2) * .5
    dx, dy = ((x + .5) % 1 - .5) / nx, ((Y*ny + .5) % 1 - .5) / ny
    edge = np.minimum(abs(dx), abs(dy)) * N + fine * chips
    shade = np.random.default_rng(seed).uniform(-8, 7, (ny, nx))[j, np.floor(x).astype(int) % nx]
    v = large*3 + fine*2 + grain*1.9 + shade
    v += mortar*np.clip((2.4-edge)/1.45,0,1) + np.where((edge>=1.8)&(edge<3.3), np.where((abs(dx)<abs(dy)) == (dx>0), -6, 3), 0)
    return surface(rgb, v)


store(0, masonry(4, 10, [111,117,114], -26, .88, 55))  # water-polished blue brick
store(1, surface([213,207,188], large*3.1 + fine*2.2 + grain*1.7 + np.maximum(0, -large-1.1)*-5))
stone = masonry(2, 4, [151,153,148], -32, .61, 31)
d = ImageDraw.Draw(stone, 'RGBA')
for _ in range(1100):
    x, y = r.randrange(N), r.randrange(N)
    d.line((x,y,x+r.randrange(1,5),y-1), fill=(61,67,64,r.randrange(6,26)))
store(2, stone)
# Eight rows of convex cover tiles alternate with broad concave water channels.
phase = np.cos(X * math.tau * 8)
barrel = np.clip((phase-.14)/.86, 0, 1)**.43
y = (Y*6 + .18*(1-barrel)) % 1
lip = np.exp(-((y-.91)/.050)**2)*10 - np.exp(-((y-.99)/.046)**2)*21
shade = (12*barrel + np.sin(math.tau*8*X)*barrel*11 - 8*(phase<.17) + lip + large*3 + fine*2.4 + grain*1.8)
store(3, surface([76,83,85], shade))


def timber(rgb, amp=1):
    phase = Y*18 + .14*np.sin(math.tau*X) + .23*large
    lens = np.exp(-(((X-.55)/.18)**2+((Y-.58)/.09)**2))
    veins = np.sin(math.tau*phase + lens*7) + .38*np.sin(phase*15+large)
    return surface(rgb, amp*(3.3*veins-3.9*(veins<-.81) + 1.9*large+grain*1.25))


store(4, timber([128,78,52]))
door = timber([140,58,42], .81).transpose(Image.Transpose.ROTATE_90)
d = ImageDraw.Draw(door)
for inset, col, width in [(7,'#65382f',6),(14,'#af6c48',3),(28,'#673d32',6),(37,'#bc7755',3)]:
    d.rounded_rectangle((inset,inset,N-inset-1,N-inset-1),radius=2,outline=col,width=width)
for y0,y1 in [(51,166),(187,435)]:
    for i,col in [(0,'#67362d'),(4,'#a1563d'),(9,'#78412f')]:
        d.rectangle((55+i,y0+i,N-55-i,y1-i),outline=col,width=3)
for _ in range(155):  # rubbed lacquer wears at the arrises, not across the panel
    y0=r.randrange(22,N-22); x0=r.choice([12,35,53,N-13,N-36,N-54])+r.randrange(-2,3)
    d.line((x0,y0,x0+1,y0+r.randrange(1,5)), fill=r.choice(['#a06a4c','#b57c54','#774731']))
store(5,door)


def polar(cx,cy,radius,a): return (cx+radius*math.cos(a),cy+radius*math.sin(a))


def flower(d,cx,cy,rad,dark,light):
    for k in range(8):
        a=k*math.tau/8
        def petal(t, angle): return polar(cx,cy,t*rad,a+angle)
        points=[petal(.18,0),petal(.46,-.23),petal(.76,-.17),petal(.94,0),petal(.75,.17),petal(.46,.23),petal(.18,0)]
        d.polygon(points,fill=dark);d.line(points[:4],fill=light,width=max(1,int(rad*.042)))
        d.line([petal(.3,0),petal(.66,0)],fill=light,width=max(1,int(rad*.026)))
    d.ellipse((cx-rad*.16,cy-rad*.16,cx+rad*.16,cy+rad*.16),fill=light,outline=dark,width=2)


tile = surface([94,97,94], fine*2.7+grain*2.5); d=ImageDraw.Draw(tile)
for rad, col, w in [(228,'#626664',18),(210,'#93958c',8),(194,'#454c4b',7),(175,'#808681',6)]:
    d.ellipse((244-rad,244-rad,244+rad,244+rad),outline=col,width=w)
flower(d,244,244,178,'#495350','#8b9188')
for j in range(28):
    x,y=polar(244,244,181,j*math.tau/28);d.ellipse((x-4,y-4,x+4,y+4),fill='#858b80')
store(6,tile)
# Brick-cut scrolling lotus band. Paint the relief once, mirrored by the mason.
band = surface([125,130,123], large*2 + fine*2 + grain*1.8); d=ImageDraw.Draw(band)
for y0 in [31,46,N-47,N-32]: d.line((0,y0,N,y0),fill='#899084' if y0%2 else '#626c64',width=7)
for i in range(4):
    cx=(i+.5)*N/4
    flower(d,cx,N*.50,59,'#69736b','#a2a798')
    for side in [-1,1]:
        pts=[(cx+(t-.50)*142,N*.5+side*(57+81*math.sin(math.pi*t))) for t in np.linspace(0,1,50)]
        d.line(pts,fill='#616d65',width=8);d.line([(x,y-3) for x,y in pts],fill='#9ba596',width=3)
        for t in [.22,.78]:
            x,y=pts[round(t*49)];d.polygon([(x,y),(x+15,y+side*26),(x+4,y+side*45),(x-1,y+side*24)], fill='#939e91')
store(7,band)

# White-stone relief of two swallows and a flowering prunus bough, for the
# recessed face of the yingbi. No borrowed prints or photographic scans.
screen = surface([186,183,164], large*3 + fine*2 + grain*2); d=ImageDraw.Draw(screen)
for a,col,w in [(8,'#8f958a',7),(21,'#c9c8b5',4),(32,'#92998b',3)]:d.rectangle((a,a,N-1-a,N-1-a),outline=col,width=w)
def twig(points,w):
    d.line(points,fill='#767e74',width=w,joint='curve');d.line([(x-1,y-2) for x,y in points],fill='#c9c9b8',width=max(1,w//4))
twig([(52,408),(108,356),(161,335),(211,260),(268,241),(305,180),(333,158)],10)
for x,y,dx,dy in [(116,354,-23,-61),(160,334,62,-11),(212,260,-39,-78),(257,246,61,-13),(301,186,10,-51)]:
    twig([(x,y),(x+dx*.55,y+dy*.6),(x+dx,y+dy)],5)
    for i in range(4):
        a,b=x+dx+i*7-10,y+dy+int(9*math.sin(i*1.7));flower(d,a,b,r.randrange(7,13),'#959d8e','#d8d7c5')
def swallow(cx,cy,s,flip):
    pts=[(-42,12),(-19,7),(-37,23),(-7,12),(5,6),(23,9),(29,5),(39,5),(29,0),(23,-3),(12,-2),(2,-17),(-20,-32),(-12,-13),(-5,-4),(-20,-9),(-37,-15),(-26,-1),(-12,3)]
    pts=[(cx+flip*x*s,cy+y*s) for x,y in pts];d.polygon(pts,fill='#747f75');d.line(pts[9:14],fill='#c7cbba',width=2)
swallow(205,142,1.35,1);swallow(310,111,.97,-1)
store(8,screen)


def local_font(size):
    candidates=[os.environ.get('WEDDING_CJK_FONT',''), 'C:/Windows/Fonts/simkai.ttf','/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc']
    path=next((p for p in candidates if p and Path(p).is_file()),None)
    if not path: raise ValueError('Set WEDDING_CJK_FONT to a local CJK font')
    return ImageFont.truetype(path,size=size)


def plaque(text,rgb,ink):
    im=timber(rgb,.53); g=ImageDraw.Draw(im)
    for a,col,w in [(7,'#4f4035',8),(18,'#b19462',5),(31,'#826b4b',3)]:g.rectangle((a,a,N-a-1,N-a-1),outline=col,width=w)
    # Horizontally compressed atlas art expands to the actual 3:1 board.
    strip=Image.new('L',(1152,364)); sg=ImageDraw.Draw(strip);font=local_font(260 if len(text)==3 else 246)
    sg.text((576,174),text,font=font,anchor='mm',fill=255,stroke_width=1);mask=strip.resize((408,355),Image.Resampling.LANCZOS)
    im.paste('#382e2b',(42,75,450,430),mask);im.paste(ink,(40,70,448,425),mask)
    return im

# The horizontal boards read from right to left above a traditional doorway.
store(9,plaque('家宜室宜',[91,93,82],'#dfd7b9'))
store(10,plaque('堂喜雙',[74,58,47],'#d9b67a'))
paper=surface([203,193,161],large*2.5+fine*2+grain*2+np.cos(math.tau*Y*122)*1.5)
store(11,paper)
store(12,masonry(3,3,[150,145,137],-31,.53,93))
store(13,surface([162,152,135],fine*4 + grain*4 + large*3 - (grain>1.66)*9))
silks=surface([233,231,216],fine+grain*1.3)  # left quarter remains the neutral tint swatch
for start,text in [(170,'花好月圓'),(340,'琴瑟和鳴')]:
    width=109
    weave=1.25*np.cos(2*math.pi*Y*121)+.95*np.cos(2*math.pi*X*96)+1.45*fine+grain
    strip=surface([157,60,48],weave).crop((start,0,start+width,N));d=ImageDraw.Draw(strip)
    for x in (4,8,width-9,width-5):d.line((x,0,x,N), fill='#ac7053' if x%2 else '#ad7258',width=1)
    for y in (12,N-13):
        d.line((10,y,width-11,y),fill='#c39163',width=2)
        for x in [19,width-20]:d.polygon([(x-5,y),(x,y-4),(x+5,y),(x,y+4)],fill='#ca9e6f')
    for i,char in enumerate(text):
        y=85+106*i;d.text((width//2+1,y+2),char,anchor='mm',font=local_font(81),fill='#69372e');d.text((width//2,y),char,anchor='mm',font=local_font(81),fill='#e0bc80')
    silks.paste(strip,(start,0));silks.paste(strip.crop((0,0,1,N)).resize((10,N)),(start-10,0));silks.paste(strip.crop((width-1,0,width,N)).resize((10,N)),(start+width,0))
store(14,silks)
board=timber([119,86,64],.87);d=ImageDraw.Draw(board)
for row in range(4):
    yy=row*N//4;d.line((0,yy,N,yy),fill='#523e35',width=4);d.line((0,yy+3,N,yy+3),fill='#916a4f',width=2)
store(15,board)

target = Path(__file__).with_name('architecture-jiangnan.webp')
atlas.save(target, 'WEBP', quality=88, method=6)
print(f'{target.name}: {atlas.width} x {atlas.height}, {target.stat().st_size} bytes')

# A matching, premultiplied downsampled cutout. Hand-drawn osmanthus sprigs
# use one diffuse print with real bifurcating twigs and sparse cream florets.
# Their edges get alpha-tested in one leaf pass, not one draw per leaf.
r=random.Random(986);size=768;leaf=Image.new('RGBA',(size,size),(0,0,0,0));g=ImageDraw.Draw(leaf)
def draw_spray(points,weight):
    g.line(points,fill='#737852',width=weight,joint='curve')
    for i in range(1,len(points)-1):
        x,y=points[i];nx,ny=points[i+1];ang=math.atan2(ny-y,nx-x)
        for side in [-1,1]:
            theta=ang+side*r.uniform(.48,.99);length=r.uniform(63,100);half=length*r.uniform(.12,.175)
            ux,uy=math.cos(theta),math.sin(theta);lc=(r.choice(['#96a37a','#8f9e72','#a0ae85','#798e64','#9cae7c']))
            def p(t,d):return (x+t*ux*length-d*uy*half,y+t*uy*length+d*ux*half)
            left=[p(0,0),p(.2,.56),p(.47,1),p(.74,.67),p(1,0)];right=[p(.73,-.65),p(.44,-.93),p(.18,-.42)]
            g.polygon(left+right,fill=lc);g.polygon([p(0,0),p(.50,.13),p(1,0)]+right,fill=r.choice(['#788c68','#8e9c74','#8c9e71']))
            g.line([p(.08,-.04),p(.61,.005),p(.88,0)],fill='#b5bc91',width=2)
        if i%4==1:
            for _ in range(5):
                cx=x+r.uniform(-13,13);cy=y+r.uniform(-9,9);rr=r.uniform(2.3,4.3);g.ellipse((cx-rr,cy-rr,cx+rr,cy+rr),fill='#d6c58b')
main=[(367,754),(366,684),(377,609),(362,531),(376,451),(390,381),(381,306),(406,231),(408,158),(423,79),(421,39)]
draw_spray(main,6)
for sx,sy,ex,ey in [(367,704,130,356),(375,616,618,303),(365,548,114,232),(374,468,594,140),(385,374,203,111),(381,309,519,67)]:
    points=[(sx+(ex-sx)*i/8+7*math.sin(i*.85),sy+(ey-sy)*i/8) for i in range(9)];draw_spray(points,4)
leaf=leaf.resize((512,512),Image.Resampling.LANCZOS);leaf_target=Path(__file__).with_name('architecture-osmanthus.webp');leaf.save(leaf_target,'WEBP',quality=86,method=6)
print(f'{leaf_target.name}: 512 x 512, {leaf_target.stat().st_size} bytes')
