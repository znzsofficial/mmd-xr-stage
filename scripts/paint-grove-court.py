"""Original field studies for the wisteria walk and the meridian gate. Offline only."""
from pathlib import Path
from math import sin, cos, pi, tau
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).resolve().parents[1]/'src/mmdVrShowcase/scenery'
r=random.Random(98143)

def foliage():
    # Left: a spray of compound leaves. Right: pendulous pea flowers and unopened buds.
    im=Image.new('RGBA',(512,384),(112,144,87,0)); d=ImageDraw.Draw(im)
    def leaf(x,y,dx,dy,tone):
        wx,wy=-dy*.22,dx*.22
        def pt(t,w):return (x+dx*t+w*wx,y+dy*t+w*wy)
        d.polygon([pt(0,0),pt(.23,.72),pt(.55,1),pt(.80,.56),pt(1,0),pt(.76,-.69),pt(.39,-.96),pt(.17,-.55)],fill=tone)
        d.polygon([pt(0,0),pt(.23,.72),pt(.55,1),pt(.80,.56),pt(1,0)],fill=tuple(min(255,a+14) for a in tone));d.line([pt(.03,0),pt(.56,.07),pt(.94,0)],fill='#a8b876',width=2)
        for t in [.27,.48,.66]:d.line([pt(t,0),pt(t+.14,.61)],fill=tuple(min(255,a+22) for a in tone))
    for j in range(7):
        a=(-.86+j*.269);base=(122,345-j*15);dx,dy=sin(a)*119,-136-r.random()*78
        d.line([base,(base[0]+dx,base[1]+dy)],fill='#85915b',width=3)
        for k in range(1,8):
            t=k/8;x,y=base[0]+dx*t,base[1]+dy*t
            for side in [-1,1]:
                l=(1-t*.42)*(28+r.random()*20);angle=a+side*(.83+r.random()*.39);shade=r.randrange(-21,18)
                leaf(x,y,l*sin(angle),-l*cos(angle),(129+shade,161+shade,87+shade))
    def stem(t):return 382+14*sin(2.3*t)-18*t*t,15+350*t
    d.line([stem(i/30) for i in range(31)],fill='#97946a',width=4)
    for j in reversed(range(86)):
        t=j/86; a=j*2.399;x,y=stem(t);sz=6+18*(1-t)**.7
        dx=(1-t*.88)*(40+11*sin(t*pi))*sin(a);px=x+dx;py=y+4*cos(a)
        d.line([(x,y-4),(px,py+3)],fill='#899360',width=2)
        shade=int(14*cos(a))+r.randrange(-8,9);c=lambda R,G,B:(R+shade,G+shade,B+shade)
        d.ellipse((px-sz*.27,py-3,px+sz*.32,py+sz*1.02),fill=c(134,106,163))
        d.ellipse((px-sz*.70,py-sz*.38,px+sz*.68,py+sz*.51),fill=c(196,172,210));d.arc((px-sz*.65,py-sz*.37,px+sz*.65,py+sz*.5),185,348,fill=c(221,202,224),width=2)
        d.ellipse((px-sz*.34,py+sz*.18,px+sz*.17,py+sz*.78),fill=c(156,124,183));d.ellipse((px-sz*.10,py+sz*.18,px+sz*.29,py+sz*.65),fill=c(180,147,200));d.line((px-2,py+1,px+2,py+3),fill='#f5ddb3',width=2)
    im.save(OUT/'garden-botanicals.webp',quality=91,method=6)

def meridian():
    w=h=1024;y,x=np.mgrid[:h,:w];rng=np.random.default_rng(8712)
    def field(nx,ny):return (np.array(Image.fromarray(rng.integers(0,255,(ny,nx),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC),dtype='f')-128)/100
    coarse=field(12,12);grain=rng.normal(0,2.1,(h,w));v=coarse*7+field(65,53)*3+grain
    cloth=x<512;v+=np.where(cloth,2*np.sin(x*2.1)+2*np.sin(y*2.23)+6*np.cos(x*.061+.45*np.sin(y*.01)),4*np.sin(.04*y+.008*x+coarse*4))
    base=np.where(cloth[:,:,None],np.array([44,106,108]),np.array([160,153,147]));im=Image.fromarray(np.uint8(np.clip(base+v[:,:,None],0,255)));d=ImageDraw.Draw(im)
    gold='#e0bd7f';shadow='#725f4e';light='#f6d9a3';green='#9bc4b6'
    def star(x,y,r,n=4):
        pts=[(x+cos(i*pi/n-pi/2)*(r if i%2==0 else r*.24),y+sin(i*pi/n-pi/2)*(r if i%2==0 else r*.24)) for i in range(2*n)];d.polygon(pts,fill=gold);d.line([pts[0],(x,y),pts[n]],fill=light,width=2)
    def circle(x,y,r,col,lw=1):d.ellipse((x-r,y-r,x+r,y+r),outline=col,width=lw)
    def dial(cx,cy,rad):
        for k in [.42,.73,.88,1]:circle(cx,cy,rad*k,gold,2)
        for i in range(60):
            a=i*tau/60;t=.79 if i%5==0 else .87;d.line((cx+rad*t*cos(a),cy+rad*t*sin(a),cx+rad*.96*cos(a),cy+rad*.96*sin(a)),fill=light,width=2 if i%5==0 else 1)
        d.ellipse((cx-rad*.42,cy-rad*.88,cx+rad*.42,cy+rad*.88),outline=green,width=2);star(cx,cy,rad*.64,8)
    # Auriga field standard: satin edging, diagrammatic embroidery, tassel hem.
    for xx in (15,29,481,495):d.line((xx,0,xx,790),fill=gold,width=4 if xx in (15,495) else 2)
    for j in range(27):
        for side in (-1,1):
            xx=256+side*221; yy=36+25*j;d.line((xx,yy,xx+side*8,yy+7,xx,yy+15),fill=green,width=2)
    for y0 in [48,61,626,635]:d.line((21,y0,490,y0),fill=gold,width=2)
    for radius in [158,165]:circle(256,331,radius,gold,2)
    dial(256,331,129)
    for sy in (112,550):star(256,sy,18);d.line((196,sy,228,sy),fill=gold,width=2);d.line((284,sy,316,sy),fill=gold,width=2)
    for j in range(52):
        px=r.randrange(45,467);py=r.randrange(88,612)
        if (px-256)**2+(py-331)**2>168**2:star(px,py,r.uniform(1.8,6))
    for yy in [666,678,706]:d.line((20,yy,256,yy+53,492,yy),fill=gold,width=3)
    # Right column: stone courses, recessed enamel hour panels, brass journal pins.
    for yy in [43,92,249,406,563,720]:d.line((512,yy,1023,yy+1),fill='#766e69',width=4);d.line((512,yy+4,1023,yy+4),fill='#c8bcab',width=2)
    for j in range(4):
        cx=576+j*128;d.rounded_rectangle((cx-43,123,cx+43,694),radius=34,fill='#736f70',outline='#d5bc96',width=5);d.rounded_rectangle((cx-36,133,cx+36,683),radius=28,fill='#506e71',outline='#334f56',width=3)
        dial(cx,280,28);star(cx,196,12);d.line((cx,320,cx,587),fill=gold,width=2)
        for i in range(22):
            yy=330+i*11;dx=17 if i%5==0 else 8;d.line((cx-dx,yy,cx+dx,yy),fill=gold,width=2)
        for k in [-1,1]:circle(cx,624+k*10,5,gold,2)
        d.text((cx,90),['I','II','III','IV'][j],font=ImageFont.load_default(size=26),anchor='ms',fill=shadow)
    # Bottom course, mapped block by block to the broken arch. Raised floret,
    # punched copper borders, recess shadow. No extra draw for the stone face.
    d.rectangle((0,784,1023,1023),fill='#696977');d.rounded_rectangle((12,794,1011,1012),radius=33,fill='#aca59b',outline='#dcd0b7',width=7);d.rounded_rectangle((36,817,986,988),radius=27,fill='#898584',outline='#6b6667',width=5)
    for i in range(7):
        px=96+i*138;d.line((px-62,902,px,847,px+62,902,px,957,px-62,902),fill='#c9b38f',width=5);star(px,902,29)
    # Break up the digital precision without losing the large pattern at a distance.
    a=np.asarray(im).astype(float);wear=np.clip((field(57,68)-.42)*.48,0,.35)[:,:,None];a=a*(1-wear)+np.array([153,152,133])*wear;a+=grain[:,:,None]*.8
    Image.fromarray(np.uint8(np.clip(a,0,255))).save(OUT/'meridian-workshop.webp',quality=90,method=6)

if __name__=='__main__':foliage();meridian()
