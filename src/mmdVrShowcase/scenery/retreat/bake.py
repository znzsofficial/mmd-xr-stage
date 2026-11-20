"""Original repeatable finishes and two views for the retreat interiors; Pillow, numpy."""
from pathlib import Path
import math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

out=Path(__file__).parent
r=random.Random(8271); rng=np.random.default_rng(8271)
def save(im,name,quality=88): im.convert('RGB').save(out/(name+'.webp'),quality=quality,method=6)
def noise(w,h,n,m):
    return np.array(Image.fromarray(rng.integers(0,255,(m,n),dtype=np.uint8)).resize((w,h),Image.Resampling.BICUBIC),dtype=float)/255-.5
def grey(a): return Image.fromarray(np.uint8(np.clip(a,0,255)),'L')
n=512;y,x=np.mgrid[0:n,0:n]/n; t=2*math.pi
grain=205+9*np.sin(t*(x*17+.26*np.sin(t*y)+.56*np.sin(t*(x+y))))+7*np.sin(t*(x*41+.42*np.cos(t*y)))+11*noise(n,n,92,4)+9*noise(n,n,190,12)+6*noise(n,n,n,n)
save(grey(grain),'quarter-sawn')
stone=201+24*noise(n,n,8,8)+18*noise(n,n,29,42)+9*noise(n,n,132,98)+12*noise(n,n,n,n)
im=grey(stone).convert('RGB');d=ImageDraw.Draw(im,'RGBA')
for i in range(980):
    a,b=r.randrange(n),r.randrange(n);s=r.choice([.5,1,1,2,3]);c=r.choice([(249,243,227,78),(50,63,59,52),(162,146,126,74)]);d.ellipse((a,b,a+s*1.5,b+s),fill=c)
save(im,'mineral')
weave=227+6*np.sin(t*x*94)+6*np.sin(t*y*131)+9*np.sin(t*(x*71+y*28))+9*noise(n,n,70,54)+7*noise(n,n,n,n)
save(grey(weave),'silk')
# Deco fan weave: alternately offset open fans, interrupted gold threads.
im=Image.new('RGB',(512,512),(116,54,66));d=ImageDraw.Draw(im)
for j in range(-1,6):
    for i in range(-1,6):
        cx=i*128+(j%2)*64;cy=j*128
        d.pieslice((cx-90,cy-90,cx+90,cy+90),215,325,fill=(111,49,61))
        for a in range(215,326,8):
            c,s=math.cos(math.radians(a)),math.sin(math.radians(a));d.line((cx+c*13,cy+s*13,cx+c*89,cy+s*89),fill=(171,108,98),width=2)
        for rad in (76,84,90):d.arc((cx-rad,cy-rad,cx+rad,cy+rad),215,325,fill=(198,150,119),width=2)
save(Image.fromarray(np.uint8(np.clip(np.array(im,dtype=float)*weave[:,:,None]/231,0,255))),'brocade')

def gradient(size,stops):
    w,h=size; ar=np.zeros((h,w,3),np.uint8)
    for k in range(3):ar[:,:,k]=np.interp(np.linspace(0,1,h),[s[0] for s in stops],[s[1][k] for s in stops])[:,None]
    return Image.fromarray(ar)
w,h=1536,768
im=gradient((w,h),[(0,(21,32,54)),(.50,(87,86,114)),(.71,(181,128,128)),(1,(88,78,90))]);d=ImageDraw.Draw(im,'RGBA')
for i in range(245):
    xx,yy=r.randrange(w),r.randrange(380);d.ellipse((xx,yy,xx+1.5,yy+1.5),fill=(230,235,234,r.randrange(45,155)))
d.ellipse((1082,121,1136,175),fill=(245,223,188));
for level,base in enumerate([550,630,765]):
    xx=-10;col=[(109,104,127),(75,79,103),(45,54,75)][level];
    while xx<w:
        bw=r.randrange(24,55)+level*13; elev=r.triangular(39,212,90)+level*9;top=int(base-elev)
        d.rectangle((xx,top,xx+bw,base),fill=col)
        if r.random()<.7:d.rectangle((xx+bw*.22,top-r.randint(3,15),xx+bw*.74,top),fill=col)
        if r.random()<.13:d.line((xx+bw*.52,top-40,xx+bw*.52,top),fill=col,width=2)
        for wy in range(top+6,base,8+level*2):
            for wx in range(xx+4,xx+bw-2,7+level):
                if r.random()<.49:d.rectangle((wx,wy,wx+r.randrange(2,5),wy+2),fill=r.choice([(245,194,136,194),(177,183,187,136),(227,189,164,184)]))
        xx+=bw+r.randrange(2,12)
save(im,'blue-hour')
# Moon gate: layered ink-wash slopes, stone islands, reflected reeds, pine silhouettes.
w=h=896;im=gradient((w,h),[(0,(129,159,154)),(.46,(217,219,187)),(.62,(189,206,189)),(1,(99,138,130))]);d=ImageDraw.Draw(im,'RGBA')
d.ellipse((465,155,583,273),fill=(250,235,192));
for k,(yy,col) in enumerate([(390,(158,179,163)),(436,(133,160,150)),(474,(105,139,128)),(511,(77,116,108))]):
    ys=noise(w,1,9+k*2,1).ravel();p=[(a,yy+math.sin(a*.008+k*2.7)*46+ys[a]*61) for a in range(w)];d.polygon(p+[(w,565),(0,565)],fill=col)
for i in range(2400):
    xx,yy=r.randrange(w),r.randrange(550,h);ln=r.expovariate(.08)+.5;d.line((xx,yy,xx+ln,yy),fill=(229,225,187,r.randrange(12,82)),width=1)
for a,b,s in [(80,632,1.4),(792,666,1.75),(714,598,.65),(230,575,.42),(892,614,.60)]:
    d.ellipse((a-68*s,b-7*s,a+53*s,b+7*s),fill=(70,102,91));d.polygon([(a-51*s,b),(a-20*s,b-26*s),(a+26*s,b-31*s),(a+44*s,b-8*s),(a+55*s,b)],fill=(91,114,99));d.line((a,b-14*s,a-3*s,b-114*s),fill=(63,85,73),width=round(5*s))
    for j in range(9):
        yy=b-(57+j*8)*s;xx=a-math.sin(j)*7*s;l=(49-j*4)*s;d.line((xx,yy+10*s,xx+l*.7,yy-5*s),fill=(61,87,75),width=round(3*s));d.ellipse((xx-l,yy-9*s,xx+l*.9,yy+5*s),fill=(71,102,85))
save(im,'mist-garden')
# Reflections of the timber screen break sideways with the ripples. Keep scale,
# depth tint and composition specific to this basin; no looping ocean tiles.
w,h=640,768;py,px=np.mgrid[0:h,0:w];X=px/w;Y=py/h
wave=np.sin(t*(Y*17+X*.87+.19*np.sin(t*Y*4)))+.43*np.sin(t*(Y*48-X*1.7))+.77*noise(w,h,22,94)
bend=X+.010*wave+.019*noise(w,h,5,48);slat=.5+.5*np.sin(bend*47+.7*np.sin(11*bend))
sky=np.clip(.69-Y*.88+.07*wave+noise(w,h,7,19)*.22,0,1);shore=np.minimum.reduce([X,1-X,Y,1-Y]);edge=np.exp(-shore*12)
moon=np.exp(-((bend-.58)/.12)**2-((Y+.015*wave-.26)/.20)**2)*(.6+.30*wave)
glint=np.maximum(0,np.sin(Y*272+13*X+3.7*np.sin(Y*36))+np.sin(X*23+Y*48)-1.43)*.50
ar=np.empty((h,w,3));
for k,(base,ref,shallow) in enumerate([(43,54,38),(105,44,30),(99,31,27)]):ar[:,:,k]=base+sky*(20+ref*slat)+edge*shallow+glint*50+wave*(1.8-k*.4)+moon*(31-k*7)+6*noise(w,h,87,78)
save(Image.fromarray(np.uint8(np.clip(ar,0,255))),'spring-water',91)

# Furniture contact penumbra, with a narrow core and a low broad tail.
y,x=np.mgrid[-1:1:128j,-1:1:128j];edge=(abs(x)**4+abs(y)**4)**.25
alpha=np.uint8(255*(np.clip((1-edge)/.62,0,1)**1.4));im=Image.new('RGBA',(128,128),'white');im.putalpha(Image.fromarray(alpha));im.save(out/'contact.webp',lossless=True)
