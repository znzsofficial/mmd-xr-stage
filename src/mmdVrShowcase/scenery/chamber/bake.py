"""Original painted scenery for the Camera Examinis. Python, Pillow and numpy."""
from pathlib import Path
from math import cos, sin, pi
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT=Path(__file__).parent
R=random.Random(7017); rng=np.random.default_rng(7017)
def save(a,name,q=87):
    if not isinstance(a,Image.Image): a=Image.fromarray(np.uint8(np.clip(a,0,255)))
    a.convert('RGB').save(OUT/(name+'.webp'),quality=q,method=6)
def noise(w,h,cols,rows):
    # Wrap the control field before interpolation; no straight seams in the repeats.
    a=np.pad(rng.uniform(-1,1,(rows,cols)).astype('float32'),1,mode='wrap')
    im=Image.fromarray(a)
    return np.array(im.resize((w,h),Image.Resampling.BICUBIC,box=(1,1,cols+1,rows+1)))
def font(size):
    for f in ['georgia.ttf','DejaVuSerif.ttf']:
        try:return ImageFont.truetype(f,size)
        except OSError:pass
    raise RuntimeError('Georgia or DejaVu Serif required')
def stone(w,h,wall):
    Y,X=np.mgrid[0:h,0:w].astype('float32');X/=w;Y/=h
    coarse=noise(w,h,13,12); fleck=noise(w,h,w//3,h//3); fine=rng.normal(0,1,(h,w)).astype('float32')
    tex=7*coarse+5*noise(w,h,63,37)+3*fleck+2.4*fine
    if wall:
        xx=X+(.0022*coarse+.0012*fleck); yy=Y+.003*noise(w,h,21,12)+.0013*fleck
        rows,cols=7,5
        levels=np.array([0,.143,.286,.408,.561,.718,.859,1.0]); col=0; field=0; shade=0
        yw=yy%1;row=np.clip(np.searchsorted(levels,yw)-1,0,rows-1)
        dy=np.minimum(yw-levels[row],levels[row+1]-yw)
        for i in range(rows):
            edges=np.r_[0,np.arange(1,cols)/cols+rng.uniform(-.04,.04,cols-1),1]; a=(xx+i*.105)%1
            idx=np.clip(np.searchsorted(edges,a)-1,0,cols-1); left=a-edges[idx];right=edges[idx+1]-a
            q=np.minimum(np.minimum(left,right)*3.32,dy*1.92)
            face=np.clip((q-.003)/.015,0,1); dx=np.where(left<right,1,-1); chip=(1-np.clip((q-.012)/.015,0,1))*fleck
            grain=(i==row)*(face*(7*rng.uniform(-1,1,cols)[idx]+tex)+face*14+chip*5-15*(1-face)+dx*face*(1-face)*27)
            shade+=grain
        a=np.array([151,145,132])+shade[:,:,None]+np.maximum(coarse[:,:,None],0)*np.array([6,4,0]);return a
    return np.array([184,177,159])+tex[:,:,None]+2*np.sin((X*3+Y*13+coarse*.42)*2*pi)[:,:,None]
save(stone(896,512,True),'ashlar');save(stone(448,448,False),'toolstone')

# Flagstones: hand-set rows and a flush, clipped-corner porphyry judgement dais.
w,h=1024,1792;py,px=np.mgrid[0:h,0:w].astype('float32');x=px/w*6.90-3.45;z=py/h*12-7.45
n=noise(w,h,48,70);j=noise(w,h,180,250);xx=x+.008*n;zz=z+.009*n+.002*j
rows=np.r_[-7.66,-7.66+np.cumsum(rng.uniform(.44,.77,26))];val=np.zeros_like(x)
for i in range(len(rows)-1):
    edges=np.r_[-5.,-5+np.cumsum(rng.uniform(.66,1.30,15))];idx=np.clip(np.searchsorted(edges,xx)-1,0,len(edges)-2)
    dist=np.minimum.reduce([xx-edges[idx],edges[idx+1]-xx,zz-rows[i],rows[i+1]-zz]);t=np.clip(dist/.023,0,1)
    val+=((zz>=rows[i])&(zz<rows[i+1]))*(-24+31*t+rng.uniform(-7,8,len(edges)-1)[idx]*t)
tex=val+8*n+5*j+3*rng.normal(0,1,(h,w))+3*noise(w,h,516,586)
ar=np.array([139,135,126])+tex[:,:,None];dx=abs(x+.54);dz=abs(z+5.74);edge=np.maximum.reduce([dx-1.64,dz-1.18,(dx+dz-2.51)*.7071]);inside=edge<0
ar[inside]=np.array([115,79,70])+tex[inside,None]*.83
for a,b,c in [(-.112,-.071,[174,148,102]),(-.156,-.141,[194,172,128]),(-.04,-.016,[100,92,78])]:
    m=(edge>a)&(edge<b);ar[m]=np.array(c)+tex[m,None]*.52
# Light cast through the west clerestory and the north slits; continuous across stone joints.
def wash(a,b,start,stop,spread):return np.clip((a-start)/spread,0,1)*np.clip((stop-b)/spread,0,1)
sx=z-(x+3.45)*.53; stripe=wash(x,x,-3.28,-.02,.37)*wash(sx,sx,.88,1.94,.065)
for bar in [1.13,1.43,1.72]:stripe*=.28+.72*np.clip(abs(sx-bar)/.065,0,1)
rear=x-.34*(z+7.45);beam=wash(z,z,-7.26,-3.05,.38)*wash(rear,rear,1.66,2.32,.085)
for bar in [1.86,2.12]:beam*=.34+.66*np.clip(abs(rear-bar)/.060,0,1)
ar+=stripe[:,:,None]*np.array([37,44,43])+beam[:,:,None]*np.array([40,48,50]);
for bx,bz,bw,bd in [(-1.77,.82,2.04,1),(2.99,1.16,.66,1.6),(-3.05,-4.79,.64,1.54)]:
    d=np.maximum(abs(x-bx)-bw/2,abs(z-bz)-bd/2);ar*=1-.22*np.exp(-np.maximum(d,0)*6)[:,:,None]
ar*=.81+.19*np.clip(np.minimum.reduce([3.45-abs(x),z+7.45,4.55-z])/.52,0,1)[:,:,None];save(ar,'pavement',90)

w=h=512;y,x=np.mgrid[0:h,0:w]/512;wobble=.12*np.sin(2*pi*y)+.09*noise(w,h,7,4)
grain=14*noise(w,h,91,5)+4*noise(w,h,239,19)+5*np.cos(2*pi*(x*29+wobble*2))+3*np.cos(2*pi*(x*74+wobble*5))+2*rng.standard_normal((h,w))
save(np.array([185,158,121])+grain[:,:,None],'oak')

# Figured arras: two flat manuscript clerks witness the city's open register beneath a star.
w,h=704,880;im=Image.new('RGB',(w,h),(99,44,36));d=ImageDraw.Draw(im)
gold=(201,159,85);pale=(226,196,135);blue=(49,75,79);ink=(50,48,47);red=(132,60,43)
def star(cx,cy,r,c):
    pts=[(cx+sin(i*pi/4)*(r if i%2==0 else r*.24),cy+cos(i*pi/4)*(r if i%2==0 else r*.24)) for i in range(8)];d.polygon(pts,fill=c)
def text(cx,cy,s,n,c):d.text((cx,cy),s,font=font(n),anchor='mm',fill=c)
for x0 in [12,21,49,w-50,w-22,w-13]:d.line((x0,0,x0,h),fill=gold,width=3)
for side in [35,w-36]:
    for j in range(34):star(side,j*28,8,pale)
for j in range(2,27):
    for i in range(4,34):
        if (i+j)%3==0:star(i*19+(j%2)*7,j*31,4,(163,101,60))
def canopy(cx,base,span,high):
    profile=[(cx-span,base),(cx-span,high+98),(cx-span*.74,high+60),(cx-span*.36,high+35),(cx,high),(cx+span*.36,high+35),(cx+span*.74,high+60),(cx+span,high+98),(cx+span,base)]
    d.polygon(profile,fill=blue);d.line(profile,fill=pale,width=6);d.line((cx-span,base,cx+span,base),fill=gold,width=6)
for cx in [165,539]:
    canopy(cx,646,83,307);q=1 if cx<352 else -1
    def P(v):return [(cx+a*q,b) for a,b in v]
    d.polygon(P([(-49,630),(-35,516),(-16,477),(3,468),(17,486),(24,520),(49,534),(35,554),(15,548),(30,629)]),fill=(169,126,73))
    d.polygon(P([(-15,480),(-22,462),(-20,443),(-12,428),(3,423),(19,432),(19,444),(26,454),(18,458),(16,470),(5,471),(3,486)]),fill=pale)
    d.polygon(P([(-25,447),(-32,435),(-16,411),(5,410),(20,427),(19,439),(6,430),(-9,437)]),fill=(149,75,50))
    d.polygon(P([(22,512),(61,500),(61,530),(28,544)]),fill=pale);d.line(P([(22,512),(28,544),(61,530)]),fill=ink,width=4)
    for k in [-22,-6,8]:d.line(P([(k,535),(k-12,621)]),fill=(113,79,58),width=3)
canopy(352,643,86,162);star(352,310,49,pale)
for j in range(3):
    y=432+j*5;d.polygon([(272,y),(316,y-8),(352,y+5),(389,y-8),(432,y),(429,y+66),(390,y+58),(352,y+70),(312,y+59),(275,y+66)],fill=[gold,ink,pale][j]);
for x0 in [284,363]:
    for t in range(5):d.line((x0,467+t*6,x0+42,465+t*6),fill=(132,94,60),width=2)
d.rectangle((70,679,634,750),fill=blue,outline=gold,width=3);text(352,714,'SIGILLVM  CVRIAE',37,pale)
for j in range(7):star(109+j*81,788,10,gold)
x,y=np.meshgrid(np.arange(w),np.arange(h));weave=(np.sin(x*1.97)*2.4+np.sin(y*2.98)*3.4+noise(w,h,62,137)*4)[:,:,None];save(np.array(im)+weave,'arras',91)

w,h=896,576;im=Image.new('RGB',(w,h),(218,197,153));d=ImageDraw.Draw(im)
depositions=[['In camera, post nonam,','scriba folium aperuit.','Adstabant duo testes,','in actis commemorati.','De lumine in turri','primum quaesitum est.','Respondit tabellarius:','signum e porta vidi,','sed vocem non audivi.','Deinde lecta sunt','verba testium coram','notario civitatis.','Sub signo libri.'],
             ['Die lunae, hora tertia.','Ad quaestionem de','litteris respondit:','sigillum integrum erat.','Testis alter dixit','in atrio se mansisse','donec campana sonuit.','Librum clausit scriba;','testimonium receptum','et ad acta relatum.','Ad crastinum remissa','est causa. Scriptum','in curia civitatis.']]
try: script=ImageFont.truetype('georgiai.ttf',17)
except OSError: script=font(17)
for half,title in [(0,'Acta'),(448,'Testimonia')]:
    d.rectangle((half+31,34,half+413,534),outline=(149,89,57),width=2);d.rectangle((half+37,40,half+407,528),outline=(174,134,83),width=1)
    text(half+222,86,title,52,(117,52,39));text(half+223,129,'CAMERA  EXAMINIS' if half==0 else 'LIBER    ·    XII',19,(76,65,51))
    for row,line in enumerate(depositions[half//448]):
        yy=171+row*25;d.line((half+56,yy+2,half+389,yy+2),fill=(182,154,114),width=1)
        d.text((half+65+(row%4==0)*9,yy),line,anchor='ls',font=script,fill=(124,53,40) if row in [0,12] else (76,65,51))
        if row in [0,4,8]:d.polygon([(half+47,yy-9),(half+51,yy-3),(half+47,yy+1),(half+44,yy-3)],fill=(156,78,52))
    text(half+221,504,'·   XI   ·' if half==0 else '·   XII   ·',19,(123,77,55))
fold=(1-.18*np.exp(-np.abs(np.arange(w)-w/2)/16))[None,:,None];save(np.array(im)*fold+noise(w,h,140,100)[:,:,None]*4,'register',92)

w,h=512,352;im=Image.new('RGB',(w,h),(53,68,67));d=ImageDraw.Draw(im)
for i,(a,b) in enumerate([('CAMERA','EXAMINIS'),('ACTA','TABVLARIVM')]):
    oy=i*176;d.rectangle((9,oy+9,502,oy+166),outline=gold,width=4);d.rectangle((16,oy+16,495,oy+159),outline=gold,width=1)
    text(256,oy+57,a,29,pale);text(256,oy+106,b,46,pale)
    for x0 in [39,473]:star(x0,oy+86,10,gold)
save(np.array(im)+noise(w,h,34,19)[:,:,None]*4,'tablets',94)
