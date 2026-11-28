"""Offline originals for the pool, live house, stage floor and city bench.
Run: python scripts/paint-close-surfaces.py; no Python on the headset.
"""
from pathlib import Path
from math import sin, cos, pi, tau
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parents[1]/'src/mmdVrShowcase/scenery'
rng=np.random.default_rng(47211)
def noise(w,h,nx,ny):
    im=Image.fromarray(rng.integers(0,255,(ny,nx),dtype=np.uint8))
    return (np.asarray(im.resize((w,h),Image.Resampling.BICUBIC),dtype='f')-127)/100
def variation(im,field):
    return Image.fromarray(np.uint8(np.clip(np.asarray(im).astype('f')+field[:,:,None],0,255)))
def save(im,name):im.save(OUT/(name+'.webp'),quality=87,method=6)
def font(pt):return ImageFont.load_default(size=pt)
def lathe_text(d,at,s,size,c):d.text(at,s,fill=c,font=font(size),anchor='mm')

def lido():
    w,h=1472,864; im=Image.new('RGB',(w,h),'#b9ad99');d=ImageDraw.Draw(im)
    # Cast stone patio. The coping is a separate mosaic border with fan-shell
    # emblems and individual enamel plaques, rather than huge letters on the ground.
    for j in range(19):
        for i in range(-1,16):
            x=i*104+(j%2)*52;y=j*48;n=int(rng.integers(-5,6));base=(226+n,215+n,193+n)
            d.rectangle((x+1,y+1,x+103,y+47),fill=base);d.line((x+1,y+1,x+101,y+1),fill='#f0e3cf')
    im=variation(im,noise(w,h,52,34)*3+noise(w,h,250,160)*1.5+rng.normal(0,2.2,(h,w)));d=ImageDraw.Draw(im)
    for i in range(57):
        x=(i-28)*18+736;d.rectangle((x,9,x+16,36),fill=['#7ba8a4','#80aaa6','#6a9e9e','#86afa8'][i%4]);d.line((x+1,11,x+15,11),fill='#b9cdba')
    for x in [455,736,1016]:
        d.rounded_rectangle((x-40,12,x+40,34),3,fill='#f3e6c9',outline='#478488',width=2);lathe_text(d,(x,23),'1.12 m',15,'#245f67')
    for x in [542,928]:
        for j in range(5):
            a=(-.78+j*.39);d.line([(x,31),(x+13*sin(a),30-14*cos(a))],fill='#f4dfac',width=2)
    # Contact shade at feet, outside the clear centre; no new footprint.
    mask=Image.new('L',(w,h));m=ImageDraw.Draw(mask)
    def uv(x,z):return ((x+11.5)*64,(z+5.75)*64)
    for side in [-1,1]:
        for i in [0,1]:
            x=side*(7.4+i*1.35);z=-2.95;a=side*.16
            m.polygon([uv(x+u*cos(a)+v*sin(a)+.11,z+v*cos(a)-u*sin(a)+.14) for u,v in [(-.35,-.86),(.35,-.86),(.35,.94),(-.35,.94)]],fill=89)
        x=side*8.35;z=-1.35;m.ellipse([uv(x-.29,z-.27),uv(x+.34,z+.33)],fill=118)
    im=Image.composite(Image.blend(im,Image.new('RGB',im.size,'#887c77'),.8),im,mask.filter(ImageFilter.GaussianBlur(3.0)))
    save(im,'lido-pavement')

def garden_joinery():
    # Five separately sawn boards share one small atlas with the botanical label.
    w,h=768,512;im=Image.new('RGB',(w,h),'#bf9972');d=ImageDraw.Draw(im)
    xx=np.arange(w);yy=np.arange(420)[:,None];grain=np.zeros((420,w))
    for k in range(6):
        y0=70*k;n=yy[y0:y0+70]-y0
        knot=215+(k%3)*173;hw=(xx-knot)/51;hy=(n-29)/7
        swirl=np.exp(-(hw**2+hy**2)*.56)*np.sin(hw*1.7+hy*2.8)*6
        grain[y0:y0+70]=2.9*np.sin(n*1.4+.65*np.sin(xx/81+k)+swirl)+2.2*np.sin(n*.48+.9*np.cos(xx/100+k)+swirl*.55)+6*noise(w,70,5,40)
        grain[y0:y0+70]-=np.exp(-(hw**2+hy**2)*1.8)*22
        grain[y0:y0+70]+=10*np.exp(-n/1.8)-7*np.exp(-(69-n)/2.1)
    im.paste(variation(im.crop((0,0,w,420)),grain),(0,0));d=ImageDraw.Draw(im)
    d.rectangle((0,420,w-1,511),fill='#bca77d');d.rounded_rectangle((4,424,w-5,506),12,outline='#756951',width=2)
    for x in (28,w-28):d.ellipse((x-5,461,x+5,471),fill='#6b6860');d.line((x-3,468,x+2,464),fill='#d3c39b',width=2)
    lathe_text(d,(w//2,465),'WISTERIA   /   GARDEN WALK',34,'#504f44')
    save(im,'garden-joinery')

def boards():
    n=1280;im=Image.new('RGB',(n,n),'#554b45');d=ImageDraw.Draw(im)
    for row in range(32):
        y=row*40;x=-int(rng.integers(15,280))
        while x<n:
            w=int(rng.integers(219,365));a=int(rng.integers(-7,7));d.rectangle((x+1,y+1,x+w-1,y+39),fill=(148+a,117+a,95+a));
            for i in range(12):
                off=rng.uniform(1,36);phase=rng.uniform(0,tau);tone=a+int(rng.integers(-15,4));d.line([(x+j*w/24,y+off+1.1*sin(j/5+phase)) for j in range(25)],fill=(148+tone,117+tone,95+tone))
            for xx in [x+7,x+w-7]:
                for yy in [y+6,y+33]:d.ellipse((xx-1,yy-1,xx+1,yy+1),fill='#816e5c')
            x+=w
    im=variation(im,noise(n,n,32,830)*3+noise(n,n,14,135)*4);d=ImageDraw.Draw(im)
    def uv(x,z):return (int((x/11.6+.5)*n),int((z/11.6+.5)*n))
    for x,z,w,h in [(-2.72,-4.52,2.05,1.32),(3.18,-4.34,1.63,.76),(-2.85,2.4,.78,.56),(2.85,2.4,.78,.56)]:
        for sign in [-1,1]:
            a,b=uv(x+sign*(w/2+.08),z+h/2+.07);d.line([(a,b-11),(a,b),(a-sign*14,b)],fill='#c6b48d',width=3)
    save(im,'club-parquet')

def studio():
    n=1024;c=n/2;y,x=np.mgrid[0:n,0:n];light=np.clip(1-np.hypot(x-402,y-386)/720,0,1)
    field=light*14+noise(n,n,750,750)*.95+noise(n,n,34,34)*.8
    im=variation(Image.new('RGB',(n,n),'#d6ddda'),field);d=ImageDraw.Draw(im)
    for rr,col,width in [(488,'#8b9b9d',3),(471,'#8b9a9c',2),(410,'#b5c0bf',1),(388,'#b4bdbb',2),(173,'#bbc4c1',2)]:d.ellipse((c-rr,c-rr,c+rr,c+rr),outline=col,width=width)
    def pt(a,rad):return (c+rad*sin(a),c-rad*cos(a))
    for i in range(120):
        a=tau*i/120;d.line([pt(a,472),pt(a,487 if i%10==0 else 481 if i%5==0 else 477)],fill='#6f8286',width=3 if i%10==0 else 1)
        if i%10==0:
            lathe_text(d,pt(a,452),f'{i*3:03d}',15,'#6b7779');d.line([pt(a,389),pt(a,408)],fill='#93a2a2',width=2)
    for k in range(4):
        a=k*pi/2;d.arc((c-174,c-174,c+174,c+174),k*90-11,k*90+11,fill='#8b9b9c',width=3)
        p=pt(a,190);d.ellipse((p[0]-3,p[1]-3,p[0]+3,p[1]+3),fill='#97a9aa')
    save(im,'studio-registration')

if __name__=='__main__':
    lido()
    # Authored stream start for the parquet, registration marks and bench.
    # Restoring the cached half-word also preserves the first board's length.
    rng.bit_generator.state = {
        'bit_generator':'PCG64',
        'state':{'state':62243019243057628251453394950139041757,'inc':73595516370337634070877500517117243319},
        'has_uint32':1, 'uinteger':3949378895,
    }
    boards();studio();garden_joinery()
