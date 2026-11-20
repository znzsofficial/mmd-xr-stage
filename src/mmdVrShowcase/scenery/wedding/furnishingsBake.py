"""Original wedding prints; run `python furnishingsBake.py` (Pillow + NumPy).

No fonts, external artwork or system-specific resources. All drawing functions
use tile-local pixel coordinates; each tile extrudes its own edge into a gutter.
"""
from pathlib import Path
from math import cos, sin, pi
import random
import numpy as np
from PIL import Image, ImageDraw


S = 2  # supersampling
ATLAS = Image.new('RGBA', (1536, 1024))


class Tile:
    def __init__(self, w, h, color):
        self.w, self.h = w, h
        self.image = Image.new('RGBA', (w*S, h*S), color)
        self.pen = ImageDraw.Draw(self.image)

    def line(self, pts, color, width=1):
        self.pen.line([(round(x*S), round(y*S)) for x, y in pts], fill=color,
                      width=max(1, round(width*S)), joint='curve')

    def poly(self, pts, color):
        self.pen.polygon([(round(x*S), round(y*S)) for x, y in pts], fill=color)

    def oval(self, x, y, rx, ry, color, outline=None, stroke=1):
        self.pen.ellipse(tuple(round(v*S) for v in (x-rx, y-ry, x+rx, y+ry)),
                         fill=color, outline=outline, width=max(1, round(stroke*S)))

    def pack(self, x, y, noise=0, weave=False):
        img = self.image.resize((self.w, self.h), Image.Resampling.LANCZOS)
        a = np.array(img)
        yy, xx = np.indices((self.h, self.w))
        val = np.random.default_rng(x*2048+y+17).normal(0, noise, xx.shape)
        if weave:
            val += (np.cos(xx*pi/2)*1.6 + np.cos(yy*pi/1.55)*2.4 +
                    np.cos(yy*.026 + np.sin(xx*.034))*1.9)
        a[:, :, :3] = np.uint8(np.clip(a[:, :, :3]+val[:, :, None], 0, 255))
        # An 8px true gutter on every side, including corners at coarse mips.
        ATLAS.paste(Image.fromarray(np.pad(a, ((8,8),(8,8),(0,0)), mode='edge')), (x,y))


def wave(p, c, a, b, width, color):
    p.line([(x, c+a*sin(2*pi*x/b)) for x in range(-2,p.w+3,2)],color,width)


def bez(a, b, c, d, n=24):
    def pt(t):
        return tuple(a[j]*(1-t)**3 + 3*b[j]*t*(1-t)**2 + 3*c[j]*t*t*(1-t) + d[j]*t**3 for j in (0,1))
    return [pt(i/n) for i in range(n+1)]


def petal(p, x, y, angle, length, width, fill, edge=None):
    def trans(t, v):
        return x + length*t*cos(angle) - v*sin(angle), y + length*t*sin(angle) + v*cos(angle)
    pts = [trans(t/20, side*width*sin(pi*t/20)**.82*(1.24-.45*t/20))
           for side in (1,-1) for t in (range(21) if side==1 else range(19,-1,-1))]
    p.poly(pts, fill)
    if edge: p.line(pts+[pts[0]], edge, 1.4)


def rosette(p,x,y,r,colors,petals=8):
    dark,mid,light=colors
    for i in range(petals):
        a=2*pi*i/petals
        petal(p,x,y,a,r,r*.173,mid,dark)
        petal(p,x,y,a+.08,r*.78,r*.06,light)
    p.oval(x,y,r*.21,r*.21,dark,light,1)
    p.oval(x,y,r*.09,r*.09,light)


def brocade(plum):
    p=Tile(496,496,'#762733' if plum else '#b83f3e')
    base, shadow, silk, shine = (('#973f50','#6e2e43','#cf8f71','#ebbd8c') if plum else
                                  ('#c9584a','#973a40','#dca15d','#f2c77a'))
    # Brick-staggered persimmon calyx lattice vs. lotus wheels on a diaper ground.
    for j in range(-1,6):
        for i in range(-1,6):
            x=(i+.5*(j%2))*124; y=j*124
            for s in (-1,1):
                p.line(bez((x,y),(x+16*s,y+14),(x+57*s,y+47),(x+62*s,y+62)),base,3)
                p.line(bez((x+s*62,y-62),(x+s*30,y-36),(x+s*22,y-26),(x,y)),base,2)
            if plum:
                for k in range(4):
                    a=k*pi/2+pi/4; petal(p,x,y,a,38,8,shadow,silk)
                    p.oval(x+26*cos(a),y+26*sin(a),2.6,2.6,shine)
                rosette(p,x,y,17,(shadow,silk,shine),5)
            else:
                rosette(p,x,y,34,(shadow,silk,shine))
                for s in (-1,1):
                    stem=bez((x+s*23,y+24),(x+s*66,y+4),(x+s*58,y+55),(x+s*37,y+45))
                    p.line(stem,silk,2.2)
                    petal(p,x+s*36,y+27,.3 if s==1 else pi-.3,12,3.5,shine)
    # Woven cloud collar; mirrored hems remain distinct when gathered into pleats.
    for v in [17,479]:
        for h in [-10,-6,6,10]:p.line([(0,v+h),(496,v+h)],shine if abs(h)==10 else shadow,2)
        for x in range(-5,510,31):
            p.line([(x,v),(x+7,v-4),(x+16,v+3),(x+23,v-4),(x+31,v)],silk,2.7)
    return p


def paper():
    clear=(161,46,44,0); red='#b53637'
    p=Tile(496,496,clear); c=248
    for r,w in [(233,9),(216,4),(159,5)]:p.oval(c,c,r,r,None,red,w)
    for i in range(16):
        a=2*pi*i/16; x=c+194*cos(a);y=c+194*sin(a)
        petal(p,c+158*cos(a),c+158*sin(a),a,60,13,red)
        petal(p,c+171*cos(a),c+171*sin(a),a,35,4,clear)
        rosette(p,x+17*sin(a),y-17*cos(a),14,(red,red,red),5)
    # Hand-cut 囍: two 士, two framed upper mouths, 八/一 and lower mouths.
    for x in [155,250]:
        def rule(l,t,r,b):p.poly([(x+l,t),(x+r,t),(x+r,b),(x+l,b)],red)
        rule(5,151,87,162);rule(39,139,52,187);rule(14,178,78,188)
        for top,bot in [(199,235),(282,329)]:
            rule(9,top,84,top+10);rule(9,bot-10,84,bot);rule(9,top,21,bot);rule(72,top,84,bot)
        p.poly([(x+19,239),(x+32,239),(x+42,258),(x+30,261)],red)
        p.poly([(x+65,239),(x+79,239),(x+66,261),(x+54,258)],red)
        rule(-1,257,98,270)
    for side in (-1,1):
        p.line([(248+side*95,264),(248+side*116,264),(248+side*131,241),(248+side*157,241)],red,8)
        p.line([(237 if side==-1 else 258,315),(248+side*3,315)],red,8)
    return p


def blue_band():
    p=Tile(496,144,'#f2f0e0');ink='#254779'; wash='#5b819f'; soft='#91adba'
    for y in [5,10,22,119,132,139]:p.line([(0,y),(496,y)],ink if y in [10,132] else wash,3 if y==10 else 1.8)
    for i in range(-1,5):
        x=i*124
        p.line(bez((x,80),(x+25,13),(x+86,120),(x+124,80)),ink,3.2)
        for j in range(3):
            ox=x+9+j*22;oy=66-j*4
            petal(p,ox,oy,-.74+j*.19,22,5,soft,ink)
        rosette(p,x+92,78,24,(ink,wash,soft),6)
    return p


def wood():
    p=Tile(496,176,'#a86f4d');rng=random.Random(21)
    for i in range(180):
        y=rng.uniform(-5,184);x=rng.uniform(-200,496);length=rng.randrange(26,470)
        shade=rng.choice(['#a36a47','#ad7752','#976649','#b67d56','#a66847'])
        p.line([(x+t/24*length,y+sin(t/24*4+x)*1.7+sin(t*.5)*.55) for t in range(25)],shade,rng.uniform(.4,1.7))
    for x,y in [(92,64),(336,129)]:
        for k in [1,2,3,4]:
            p.line(bez((x-16*k,y),(x-3*k,y-4*k),(x+8*k,y-2*k),(x+17*k,y)),'#946347',1)
    return p


def bronze():
    p=Tile(496,144,'#c6aa79'); yy,xx=np.indices((p.h*S,p.w*S)); u=xx/(p.w*S);v=yy/(p.h*S)
    # Soft uneven polish, an edge patina and broad sky glint, no reflected actors.
    r=((u-.5)**2+(v-.5)**2)**.5
    glint=np.exp(-((u*.65+v*.45-.44)/.115)**2)
    worn=np.exp(-((r-.47)/.040)**2)*(.58+.42*np.sin(u*43+v*29)**2)
    tone=32*glint-25*r+1.4*np.sin(r*284)+5*np.sin(u*4.8-v*12)
    rgb=np.clip(np.array([198,176,128])+tone[:,:,None]+worn[:,:,None]*[-23,-10,1]+glint[:,:,None]*[-3,2,12],0,255).astype(np.uint8)
    p.image=Image.fromarray(rgb).convert('RGBA');return p


def lacquer():
    p=Tile(496,496,'#583437')
    for r,w,col in [(12,4,'#bc8f63'),(18,2,'#dcb480'),(30,3,'#bb8565'),(36,1,'#ba8a64')]:
        p.line([(r,r),(495-r,r),(495-r,495-r),(r,495-r),(r,r)],col,w)
    def branch(a,b,c,d,width):
        pts=bez(a,b,c,d)
        for i in range(len(pts)-1):p.line(pts[i:i+2],'#b49466',max(1,width*(1-i/25)))
    branch((31,415),(135,300),(204,388),(344,181),12)
    branch((103,345),(159,234),(114,201),(206,129),8)
    branch((186,316),(251,329),(335,350),(421,279),5)
    branch((239,281),(310,204),(367,227),(457,126),5)
    rng=random.Random(64)
    for x,y in [(138,254),(163,180),(201,144),(211,317),(297,243),(343,187),(377,208),(410,166),(345,318),(400,291)]:
        for k in range(3):
            x1=x+rng.uniform(-16,16);y1=y+rng.uniform(-10,10);r=rng.uniform(5.4,10.2)
            for j in range(5):
                a=j*2*pi/5+.4*k;p.oval(x1+cos(a)*r*.71,y1+sin(a)*r*.71,r*.67,r*.68,['#dd8d75','#f2c49c','#bf655d'][k])
            p.oval(x1,y1,1.8,1.8,'#dab77b')
    # Magpie perched on the plum bough: forked long tail, pale mantle, little claws.
    p.poly([(210,241),(282,303),(269,297),(279,314),(195,257)],'#343837')
    p.poly([(191,225),(204,218),(226,239),(243,262),(216,258),(197,248)],'#d6bf91')
    p.oval(191,224,13,14,'#323936');p.poly([(183,219),(169,223),(183,225)],'#c6a26c');p.oval(187,221,1.7,1.7,'#f1d5a0')
    petal(p,198,230,.64,51,8,'#41534f','#cfa472')
    for x in [207,218]:p.line([(x,251),(x-4,262),(x-9,264)],'#c9ad79',2.2)
    return p


def fish_plate():
    p=Tile(496,496,'#f2efdc');c=248;ink='#476a93';soft='#a1b6c0'
    for r,w in [(229,5),(220,2),(199,3),(186,2),(104,2)]:p.oval(c,c,r,r,None,ink if w>2 else soft,w)
    for k in range(20):
        a=2*pi*k/20
        petal(p,c+190*cos(a),c+190*sin(a),a+.57,30,6.5,soft,ink)
    for k in range(2):
        def at(x,y):return (x,y) if k==0 else (496-x,496-y)
        body=bez((169,224),(185,177),(244,171),(285,202))+bez((285,202),(262,205),(217,238),(169,224))
        p.poly([at(*pt) for pt in body],'#7196a7');p.line([at(*pt) for pt in body],ink,3)
        p.poly([at(x,y) for x,y in [(280,201),(310,177),(306,204),(321,222)]],ink)
        p.line([at(*pt) for pt in bez((199,199),(196,206),(201,218),(209,224))],ink,2)
        p.oval(*at(184,213),3.3,3.3,ink)
        for j in range(5):p.line([at(209+11*j,204),at(213+11*j,199),at(219+11*j,202)],'#d5e2db',1.6)
    return p


def window_bird():
    # The dressing-window pair face each other. This 72x54 inset lives OUTSIDE
    # the circular fish-plate UV disc, so no additional atlas row or request.
    p=Tile(72,54,(166,49,48,0));red='#b43a36';clear=(166,49,48,0)
    p.line(bez((3,46),(21,40),(48,52),(69,41)),red,2.3)
    p.line(bez((4,40),(20,35),(41,48),(60,36)),red,2.2)
    body=bez((5,22),(21,29),(26,22),(38,21))+bez((38,21),(45,24),(47,19),(48,15))+bez((48,15),(49,5),(60,6),(63,16))+[(69,16),(61,19)]+bez((61,19),(56,32),(47,40),(34,39))+bez((34,39),(19,38),(10,28),(5,22))
    p.poly(body,red);p.oval(57,13,1.25,1.25,clear)
    p.poly(bez((13,14),(29,18),(30,27),(42,27))+bez((42,27),(37,35),(23,31),(13,14)),red)
    for j in range(3):p.line(bez((16+j*4,21+j*2),(23+j*3,31+j),(32+j*2,32+j),(42+j*2,28+j)),clear,1.35)
    p.line([(45,22),(48,24),(51,23),(54,19)],clear,1.5)
    for j in range(2):p.line([(28+j*12,37),(31+j*10,41),(35+j*10,41)],red,2)
    return p


if __name__=='__main__':
    brocade(False).pack(0,0,1.3,True);brocade(True).pack(512,0,1.2,True);paper().pack(1024,0)
    blue_band().pack(0,512,.8);wood().pack(0,672,1.1);bronze().pack(0,864,1.7)
    lacquer().pack(512,512,1.0);fish_plate().pack(1024,512,.7)
    window_bird().pack(1024,512)
    # Neutral UV for solid-tinted parts in the same draw as the mapped wood.
    ImageDraw.Draw(ATLAS).rectangle((468,677,505,715), fill='#ffffff')
    dest=Path(__file__).with_name('wedding-furnishings.webp')
    ATLAS.save(dest, 'WEBP', quality=88, method=6, exact=True)
    print(f'{dest.name}: {ATLAS.size}, {dest.stat().st_size:,} bytes')
