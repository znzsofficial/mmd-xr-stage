"""Original artwork for the arcade set. Inputs: numeric seed and system
fonts only. Pillow + NumPy. Coordinates in pixels, from the top left."""
from pathlib import Path
from math import sin,cos,pi
import random
import numpy as np
from PIL import Image,ImageDraw,ImageFont

out=Path(__file__).parent; rng=np.random.default_rng(618); rand=random.Random(319)
S=512; X,Y=np.meshgrid(np.arange(S),np.arange(S));tau=2*pi
def noise(nx,ny):
    a=np.pad(rng.normal(0,1,(ny,nx)).astype('float32'),1,mode='wrap');return np.array(Image.fromarray(a).resize((S,S),Image.Resampling.BICUBIC,box=(1,1,nx+1,ny+1)))
fine=rng.normal(0,1,(S,S));cloud=noise(8,8);pore=noise(112,112)
def shade(rgb,v):return Image.fromarray(np.uint8(np.clip(np.array(rgb)+v[...,None],0,255)))
def base(rgb):return shade(rgb,1.4*cloud+1.2*pore+.65*fine)
def rgb(c):return tuple(int(c[i:i+2],16) for i in (1,3,5))
def font(s,heavy=False,han=False,mono=False):
    names=['simhei.ttf','msyh.ttc'] if han else (['consolab.ttf','DejaVuSansMono-Bold.ttf'] if mono else ['arialbd.ttf','DejaVuSans-Bold.ttf'] if heavy else ['arial.ttf','DejaVuSans.ttf'])
    for n in names:
        try:return ImageFont.truetype(n,s)
        except OSError:pass
    return ImageFont.load_default(size=s)
def put(d,pos,t,s,color,heavy=False,han=False,mono=False,anchor='la'):d.text(pos,t,fill=color,font=font(s,heavy,han,mono),anchor=anchor)

# Every finish repeats in metres, not once per grey box. Base colour and
# roughness are separate; floors don't inherit polished cabinet highlights.
def floor(patio=False):
    a=base((157,163,153) if patio else (125,138,156));d=ImageDraw.Draw(a);d.rectangle((0,0,S,S),fill='#828b87' if patio else '#556476');height=Image.new('L',(S,S),90);hd=ImageDraw.Draw(height)
    for j in range(2):
        for i in range(2):
            l=i*256+1;t=j*256+1;w=253;r=7;v=rand.randrange(-7,8);col=tuple(c+v for c in ((165,168,153) if patio else (123,137,154)));pts=[(l+r,t),(l+w-r,t),(l+w,t+r),(l+w,t+w-r),(l+w-r,t+w),(l+r,t+w),(l,t+w-r),(l,t+r)];d.polygon(pts,fill=col);hd.polygon(pts,fill=159);d.line(pts[-1:]+pts[:3],fill=tuple(c+12 for c in col),width=1)
            for _ in range(5):
                px=l+rand.randrange(16,229);py=t+rand.randrange(16,229);d.line((px,py,px+rand.randrange(6,25),py-2),fill=tuple(c+rand.randrange(-7,5) for c in col),width=1)
    a=Image.fromarray(np.uint8(np.clip(np.array(a)+(cloud*2.1+pore*1.7+fine*1.1)[:,:,None],0,255)));return a,height,166 if patio else 150
def ceiling():
    a=base((87,124,163));d=ImageDraw.Draw(a);h=Image.new('L',(S,S),170);hd=ImageDraw.Draw(h)
    for j in range(2):
        for i in range(2):
            x=i*256;y=j*256;d.rectangle((x+1,y+1,x+254,y+254),fill=['#6086aa','#547da0','#6389a7','#60829e'][i+j*2]);
            pts=([(x+2,y+2),(x+116,y+2),(x+2,y+116)] if (i+j)%2 else [(x+254,y+254),(x+95,y+254),(x+254,y+95)]);d.polygon(pts,fill='#ab627f');d.line([(x,y+163),(x+85,y+254)],fill='#bb967a',width=2);d.line([(x+56,y),(x+255,y+199)],fill='#9b817a',width=2)
            d.line([(x,y),(x+255,y),(x+255,y+255)],fill='#344f69',width=3);hd.line([(x,y),(x+255,y),(x+255,y+255)],fill=65,width=4)
            for px,py in [(x+8,y+8),(x+246,y+247)]:d.ellipse((px-1,py-1,px+2,py+2),fill='#405f74')
    return a,h,185
def plaster():
    a=shade((204,193,178),3*cloud+1.55*pore+fine*.8);d=ImageDraw.Draw(a);h=Image.new('L',(S,S),170);hd=ImageDraw.Draw(h)
    for j in range(2):
        x=(j*253+1)%512;y=j*256;d.line((0,y,512,y),fill='#988f86',width=2);d.line((x,y,x,y+255),fill='#ada398',width=2);d.line((0,y+3,512,y+3),fill='#ded1bd');hd.line((0,y,512,y),fill=86,width=3);hd.line((x,y,x,y+255),fill=86,width=3)
    return a,h,210
def corrugate():
    f=X%43;fold=np.interp(f,[0,4,8,14,17,36,40,42],[-29,-18,14,11,1,-1,-8,-20]);t=np.minimum(Y,S-1-Y);wear=np.maximum(0,1-t/25)*(6+5*cloud);a=shade((75,128,124),fold+2.7*cloud+1.6*pore+.8*fine-wear);d=ImageDraw.Draw(a)
    for x in [31,203,375]:
        for y in [14,496]:d.ellipse((x-2,y-2,x+2,y+2),fill='#617c76',outline='#9ca89c')
    return a,Image.fromarray(np.uint8(128+fold*2)),137
def timber():
    t=Y%64;g=noise(6,173)*2+2*np.sin(Y*.93+cloud*.5+np.sin(X*tau/S)*.6);edge=np.interp(t,[0,1,3,4,13,62,63],[-45,-26,14,7,0,0,-11]);a=shade((154,100,73),6*noise(4,37)+2*pore+fine+g+edge);return a,Image.fromarray(np.uint8(158+edge)),148
def shutter():
    f=Y%32;fold=np.interp(f,[0,2,4,8,12,26,30,31],[-32,-28,7,12,5,-3,-10,-14]);return shade((142,105,111),fold+2*cloud+1.3*pore+.7*fine),Image.fromarray(np.uint8(138+fold*2)),125
def glass():
    a=shade((91,132,145),5*cloud+(S-Y)*.035);d=ImageDraw.Draw(a,'RGBA');d.polygon([(0,270),(60,258),(84,222),(98,236),(120,202),(145,238),(179,230),(212,263),(265,247),(299,217),(343,251),(378,216),(407,241),(453,213),(477,223),(511,204),(511,359),(0,359)],fill=(38,86,91,68));
    for x,y,w in [(20,289,97),(157,307,131),(351,286,88)]:d.rectangle((x,y,x+w,y+51),fill=(30,57,69,72));d.polygon([(x-3,y),(x+w*.42,y-20),(x+w+4,y)],fill=(64,79,86,118));
    for x in [-290,-118,163,449]:d.polygon([(x,512),(x+50,512),(x+302,0),(x+262,0)],fill=(195,224,226,23));
    d.rectangle((0,458,511,511),fill=(55,82,88,101));return a,Image.new('L',(S,S),156),79
tiles=[floor(),ceiling(),plaster(),corrugate(),timber(),shutter(),floor(True),glass()]
surface=Image.new('RGB',(4*S,2*S));finish=Image.new('RGB',surface.size)
for i,(art,h,rough) in enumerate(tiles):
    xy=(i%4*S,i//4*S);surface.paste(art,xy);v=np.array(h,dtype=float);sx=(np.roll(v,1,1)-np.roll(v,-1,1))*.009;sy=(np.roll(v,-1,0)-np.roll(v,1,0))*.009;den=np.sqrt(1+sx*sx+sy*sy);data=np.stack([127.5+127.5*sx/den,127.5+127.5*sy/den,np.clip(rough+2.6*cloud+pore,32,244)],-1);finish.paste(Image.fromarray(np.uint8(np.clip(data,0,255))),xy)
surface.save(out/'hall-surfaces.webp',quality=89,method=6);finish.save(out/'hall-finishes.webp',lossless=True,method=6)

# A printed sheet for authored graphics, never made by cropping a game image.
sheet=Image.new('RGB',(2048,2048),'#303740');regions={}
def art(tag,box,bg):
    x,y,w,h=box;regions[tag]=box;p=Image.new('RGB',(w,h),bg);return p,ImageDraw.Draw(p)
def paste(tag,p):sheet.paste(p,regions[tag][:2])
def pill(d,box,rad,fill):d.rounded_rectangle(box,rad,fill=fill)
def poster(tag,box,title,sub,swatches):
    p,d=art(tag,box,swatches[0]);w,h=p.size
    for k,y in enumerate([h*.10,h*.39,h*.69]):
        x=w*.70-k*26;d.polygon([(x-100,h),(x+180,h),(w,y-102),(w,y-154)],fill=swatches[1+k]);
    for k in range(6):
        xx=80+k*9;d.arc((xx,-20,xx+h*1.12,h*1.13),87,254,fill=swatches[3],width=3)
    for _ in range(112):
        x=rand.randrange(w);y=rand.randrange(h);r=rand.choice([1,2,2,3,4]);d.ellipse((x-r,y-r,x+r,y+r),fill=rand.choice(swatches[1:]))
    f=font(int(h*.43),True);width=d.textlength(title,font=f);xx=(w-width)*.47;baseline=h*.65
    for off,C in [(5,'#182e44'),(0,'#ffffff')]:
        cursor=xx
        for j,char in enumerate(title):
            d.text((cursor+off,baseline+off+sin(j*.87)*4),char,font=f,anchor='ls',fill=C if off else swatches[1+j%(len(swatches)-1)],stroke_width=1,stroke_fill=swatches[0]);cursor+=f.getlength(char)
    put(d,(w*.09,h*.82),sub,int(h*.075),'#d2d8ce',mono=True);d.line((w*.67,h*.83,w*.90,h*.83),fill=swatches[2],width=2);paste(tag,p)
poster('graffiti',(0,0,1024,256),'GRAFFITI ART','WEST WALK   /   PRINT CLUB   ·   02',['#394a75','#f7cd63','#59d0ca','#dc8fb9','#a693d4'])
poster('lounge',(1024,0,1024,256),'LOUNGE AREA','EAST WING    ·    REST & REPLAY',['#285258','#f7bf91','#95cbbb','#e7869e','#f3d38a'])
def racing(tag,box,night):
    p,d=art(tag,box,'#172342');w,h=p.size
    sky=('#4b316a','#ec986c') if night else ('#244d80','#8bd8c3')
    for y in range(int(h*.62)):
        t=y/(h*.62);d.line((0,y,w,y),fill=tuple(int(a*(1-t)+b*t) for a,b in zip(rgb(sky[0]),rgb(sky[1]))))
    d.ellipse((w*.61,h*.14,w*.77,h*.37),fill='#f9c269');d.polygon([(0,h*.59),(0,h*.46),(w*.13,h*.26),(w*.21,h*.45),(w*.32,h*.32),(w*.47,h*.49),(w*.64,h*.27),(w*.78,h*.45),(w*.89,h*.33),(w,h*.44),(w,h*.62)],fill='#39557a');
    for j in range(14):
        x=j*w/13-10;y=h*.58-rand.uniform(.03,.15)*h;d.rectangle((x,y,x+w*.055,h*.59),fill='#243f61');d.line((x+7,y+8,x+w*.045,y+8),fill='#e7bc83',width=2)
    d.polygon([(w*.48,h*.57),(w*.52,h*.57),(w*.91,h),(w*.11,h)],fill='#5d6687');d.line((w*.49,h*.59,w*.16,h),fill='#f4b69a',width=5);d.line((w*.52,h*.59,w*.87,h),fill='#93e7dc',width=5);
    for i in range(4):d.line((w*.50,h*(.63+.10*i),w*.50,h*(.65+.10*i)),fill='#f1daaa',width=i+1)
    for sx,sy,size,col in [(w*.46,h*.82,1.,'#de696c'),(w*.58,h*.65,.4,'#eab76e')]:
        def car(pt):return [(sx+x*size,sy+y*size) for x,y in pt]
        d.polygon(car([(-40,6),(-32,-6),(-22,-10),(-14,-26),(12,-26),(23,-10),(33,-7),(39,6),(33,14),(-35,14)]),fill=col,outline='#242d4f',width=max(1,int(size*3)));d.polygon(car([(-18,-10),(-10,-22),(8,-22),(17,-10)]),fill='#9adbdf');d.line(car([(-33,2),(-20,3)]),fill='#f3dd99',width=3);d.line(car([(20,3),(32,2)]),fill='#f3dd99',width=3)
    put(d,(18,10),'ORBIT  RALLY' if night else 'NEON  CIRCUIT',int(h*.089),'#fff1c6',True);put(d,(20,h*.91),'STAGE 03    /    PRESS START',int(h*.054),'#8af2da',mono=True);paste(tag,p)
racing('racerA',(0,256,512,384),False);racing('racerB',(512,256,512,384),True)
p,d=art('fault',(1024,256,768,384),'#18242b');d.rectangle((13,12,754,370),outline='#58636c',width=3)
for x in range(27,740,40):d.polygon([(x,38),(x+16,38),(x+28,24),(x+12,24)],fill='#af675e');d.rectangle((31,326,736,328),fill='#8a524e')
put(d,(38,57),'F5  /  SIGNAL RELAY',32,'#b9c9c6',mono=True);put(d,(385,189),'故障中',108,'#e57c65',han=True,anchor='mm');put(d,(384,278),'REFUSED   :   NO CARRIER',31,'#d89580',mono=True,anchor='mm');paste('fault',p)
p,d=art('vents',(1792,256,256,384),'#5b777e');d.rounded_rectangle((12,10,245,373),12,fill='#364d59',outline='#a7b6ac',width=3)
for j in range(14):y=41+j*20;d.rectangle((28,y,228,y+10),fill='#263f49');d.line((28,y+12,228,y+12),fill='#708a8e',width=2)
paste('vents',p)
p,d=art('wood',(0,640,1024,320),'#9b684e');p=tiles[4][0].resize(p.size,Image.Resampling.LANCZOS);d=ImageDraw.Draw(p)
# Stencil mural: a little radio workshop on wheels, sending a signal to a cloud balloon.
d.ellipse((669,36,827,117),fill='#d8c8aa');d.ellipse((707,14,782,129),fill='#d8c8aa');d.polygon([(675,85),(817,85),(764,157),(729,157)],fill='#d8c8aa');d.line((730,145,679,225),fill='#d8c8aa',width=3);d.line((762,145,681,225),fill='#d8c8aa',width=3)
for i in range(3):
    x=161+i*149;y=179+int(14*sin(i*2));d.rounded_rectangle((x,y,x+124,y+68),10,fill='#645457',outline='#c29d82',width=4);d.rectangle((x+17,y+12,x+85,y+40),fill='#c8b6a9');d.ellipse((x+16,y+53,x+42,y+82),fill='#53474a');d.ellipse((x+87,y+53,x+113,y+82),fill='#53474a');d.arc((x+75,y-48,x+153,y+28),220,316,fill='#ddbd95',width=4)
put(d,(81,55),'CLOUD   POST',32,'#e0cead',True);put(d,(78,281),'FIELD TRANSMISSION    /    ARCADE SERVICE  ·  08',16,'#d0b296',mono=True);paste('wood',p)
p,d=art('blueboard',(1024,640,1024,320),'#63758a');w,h=p.size
for y in range(h):d.line((0,y,w,y),fill=tuple(int(v+(h-y)*.027) for v in (87,104,128)))
d.rounded_rectangle((4,4,1019,315),12,outline='#a4a8ab',width=4);d.rounded_rectangle((12,12,1011,307),9,outline='#4c6077',width=3);d.line((62,255,388,255),fill='#728698',width=2)
for x in (22,999):
    for y in (23,294):d.ellipse((x-3,y-3,x+3,y+3),fill='#526170');d.line((x-2,y,x+2,y),fill='#94a0a4')
put(d,(62,263),'S-02   /   UPPER HALL',16,'#9eaab0',mono=True);paste('blueboard',p)
p,d=art('deck',(0,960,512,208),'#536878');d.rounded_rectangle((7,8,505,198),15,fill='#344857',outline='#9db0a7',width=5)
for j,(xx,col) in enumerate([(112,'#e19986'),(325,'#8bc9ba'),(391,'#edb868'),(448,'#d595b2')]):
    d.ellipse((xx-24,72,xx+24,120),fill='#243645',outline='#8f9b9c',width=4);d.ellipse((xx-16,78,xx+16,106),fill=col)
put(d,(36,145),'COIN  /  PLAYER  1',22,'#e5d4b0',mono=True);paste('deck',p)
p,d=art('badge',(512,960,512,208),'#556b76');d.rounded_rectangle((9,8,502,197),22,outline='#9ba9a7',width=4);put(d,(30,35),'F5',100,'#ecdfb8',True);put(d,(223,94),'SERIES  08',24,'#c0d2cc',mono=True);d.line((222,81,478,81),fill='#d9a47b',width=4);paste('badge',p)
p,d=art('game',(1024,960,1024,208),'#48666e');put(d,(60,26),'GAME',65,'#bbded9',True);put(d,(288,89),'WORLD',77,'#d4dfd9',True);put(d,(697,51),'LOWER WALK',21,'#c4c1a8',mono=True);paste('game',p)
p,d=art('marquee',(0,1168,1024,144),'#233747');d.polygon([(64+sin(i*pi/4)*(29 if i%2==0 else 8),63+cos(i*pi/4)*(29 if i%2==0 else 8)) for i in range(8)],fill='#f3c76d');put(d,(120,16),'NEON CIRCUIT',64,'#f3c76d',True);put(d,(690,91),'VIDEO  /  198X',22,'#7cc9cb',mono=True);paste('marquee',p)
p,d=art('direction',(1024,1168,1024,144),'#b76c69');d.polygon([(35,72),(148,16),(148,49),(274,49),(274,95),(148,95),(148,129)],fill='#f8deac');put(d,(339,28),'02   /   EAST',66,'#fae6c3',True);paste('direction',p)
p,d=art('coin',(0,1312,256,224),'#b39b68');pill(d,(4,3,252,219),14,'#e4cb89');d.rounded_rectangle((13,12,243,210),9,fill='#c7ab70',outline='#ead39a',width=3);put(d,(128,111),'?',145,'#fff1be',True,mono=True,anchor='mm');paste('coin',p)
p,d=art('coinPort',(256,1312,256,224),'#536b78');pill(d,(20,26,237,208),17,'#263946');d.rectangle((43,56,122,90),outline='#9aabb0',width=6);d.line((58,72,107,72),fill='#101f28',width=6);put(d,(43,118),'CREDIT',28,'#b6c1b3',True,mono=True);d.rectangle((178,54,204,77),fill='#c7a073');paste('coinPort',p)
p,d=art('tank',(512,1312,512,224),'#91a9a9');d.line((0,192,512,192),fill='#496775',width=9);put(d,(22,24),'P-07',85,'#4c6772',True,mono=True);put(d,(24,134),'PRESSURE   /   SERVICE',20,'#3d626b',mono=True);paste('tank',p)
# Sun-faded print with a curling ink plume and diagonal ribbons; draw the
# face at its installed aspect ratio. The other side reads from the stair.
p,d=art('graffiti',(0,0,1024,256),'#617ba6')
for j,(shift,col) in enumerate([(0,'#eee178'),(16,'#78d9cf'),(163,'#589bbd'),(218,'#f3cf64')]):
    x=302+shift;d.polygon([(x,256),(x+153,256),(x+534,0),(x+381,0)],fill=col)
for j,col in enumerate(['#9976bd','#c591cd','#cda2d5']):
    x=132+j*15;y=24+j*8;d.polygon([(x+85,y+193),(x+19,y+176),(x-12,y+129),(x-8,y+70),(x+15,y+113),(x+30,y+120),(x+16,y+69),(x+36,y+8),(x+45,y+71),(x+69,y+92),(x+82,y+25),(x+99,y+70),(x+136,y+94),(x+144,y+135)],fill=col)
f=font(121,True);title='GRAFFITI ART';xx=(1024-f.getlength(title))/2
for j,ch in enumerate(title):
    yy=160+6*sin(j*1.13);d.text((xx+4,yy+5),ch,font=f,anchor='ls',fill='#41476b',stroke_width=3,stroke_fill='#41476b');d.text((xx,yy),ch,font=f,anchor='ls',fill=['#7be0da','#efd862','#f3b2cd'][j%3],stroke_width=1,stroke_fill='#767a99');xx+=f.getlength(ch)
d.line((28,229,280,229),fill='#abbfd0',width=2);put(d,(31,202),'W / 02     SILKSCREEN CLUB',14,'#dce5dd',mono=True);paste('graffiti',p)
p,d=art('stairMap',(1024,1312,576,224),'#365561');d.rounded_rectangle((5,5,570,218),12,outline='#8bb1ac',width=3);put(d,(25,19),'WEST   /   02',23,'#c4d9ce',mono=True);put(d,(24,61),'STAIR WALK',42,'#efe1bc',True)
for i in range(4):
    x=338+i*44;y=153-i*26;d.line((x,y,x+44,y,x+44,y-26),fill='#dfb777',width=6)
d.line((28,127,305,127),fill='#8bb1ac',width=2);put(d,(28,154),'1F   /   GLASS GALLERY',18,'#ccddd5',mono=True);paste('stairMap',p)
p,d=art('service',(1600,1312,448,100),'#496271');put(d,(21,7),'REPLAY',40,'#e0ddc8',True);put(d,(23,62),'ARCHIVE    /    SERIES 08',17,'#b3c5c5',mono=True);paste('service',p)
p,d=art('turn',(1600,1412,344,124),'#486469');d.line((7,7,335,7),fill='#bdcfba',width=3);d.polygon([(14,74),(60,36),(60,55),(133,55),(133,86),(60,86),(60,105)],fill='#f5d49c');put(d,(159,25),'HALL',42,'#f7dfbc',True);put(d,(162,81),'01   /   WEST',16,'#c9dac8',mono=True);paste('turn',p)
p,d=art('diffuser',(1944,1412,104,124),'#e3dbc5');d.rounded_rectangle((4,3,99,120),6,fill='#f5ebd7');
for x in range(11,95,5):d.line((x,8,x,115),fill='#e7dec9',width=1)
paste('diffuser',p)
# Crop unused rows; use padding between sheets in the runtime UVs.
sheet=sheet.crop((0,0,2048,1536));sheet.save(out/'hall-lettering.webp',quality=93,method=6)
import json
(out/'printRects.json').write_text(json.dumps({'size':list(sheet.size),'rects':regions},indent=2)+'\n',encoding='utf8')

# A cut-out hanging vine spray. Shared 2-sided foliage cards, not rows of blocks.
p=Image.new('RGBA',(512,512),(67,103,67,0));d=ImageDraw.Draw(p)
for i in range(21):
    x=rand.uniform(-35,541);length=rand.uniform(134,460)*(1-.26*abs(x-256)/256);phase=rand.uniform(-3,3);nodes=[]
    for j in range(12):
        v=j/11;cx=x+18*sin(v*5+phase)+11*sin(9*v);cy=length*v-15;nodes.append((cx,cy))
    d.line(nodes,fill=(76,100,65,255),width=3)
    for j,(cx,cy) in enumerate(nodes):
        for k in [-1,1]:
            w=rand.uniform(9,24)*(1-.38*j/11);h=w*1.5;ox=cx+k*w*.55;oy=cy+rand.uniform(-8,7);col=rand.choice(['#658653','#8ea459','#91ae61','#577f59','#759b57','#a7b668']);
            pts=[(cx,cy),(ox-k*w*.75,oy+h*.20),(ox-k*w*.40,oy+h*.46),(ox-k*w*.50,oy+h*.65),(ox+k*w*.50,oy+h),(ox+k*w*.67,oy+h*.55),(ox+k*w,oy+h*.43),(ox+k*w*.69,oy+h*.08),(ox+k*w*.38,oy-h*.10)];d.polygon(pts,fill=col);d.line((cx,cy,ox+k*w*.47,oy+h*.84),fill=tuple(min(255,v+19) for v in rgb(col)),width=1)
fol=Image.new('RGBA',(1536,768),(92,126,90,0));fol.paste(p,(0,0))
tree=Image.new('RGBA',(1024,768),(87,121,76,0));d=ImageDraw.Draw(tree)
d.polygon([(514,766),(554,766),(555,570),(653,450),(699,395),(628,433),(544,507),(529,410),(505,295),(509,434),(520,563),(426,480),(370,367),(398,474),(472,565),(513,606)],fill='#605d4d')
for k in range(75):
    a=rand.uniform(0,tau);rad=rand.random()**.6;x=500+rad*365*cos(a);y=293+rad*182*sin(a);w=rand.uniform(37,102);h=w*rand.uniform(.64,.95)
    for j in range(19):
        u=x+rand.uniform(-w,w);v=y+rand.uniform(-h,h);r=rand.uniform(12,29);val=rand.randrange(-13,14)-int(7*(v-y)/h);c=tuple(np.clip(q+val,0,255) for q in (89,130,79));c=tuple(map(int,c));d.ellipse((u-r,v-r*.76,u+r,v+r*.76),fill=c)
    for j in range(22):
        u=x+rand.uniform(-w,w*.68);v=y+rand.uniform(-h,h*.3);r=rand.uniform(2,7);d.polygon([(u-r,v),(u,v-r*.6),(u+r,v),(u+2,v+r*.4)],fill=rand.choice(['#9bb56e','#94a96a','#79995e']))
fol.paste(tree,(512,0));strip=Image.new('RGBA',(512,256),(120,150,153,0));d=ImageDraw.Draw(strip)
for j in range(3):
    line=[(i,97+j*23+(9-j*2)*sin(tau*i/512*2+j*.8)+4*sin(tau*i/512*6-.4)) for i in range(513)];d.polygon(line+[(512,256),(0,256)],fill=['#a9bdc4','#9bb5b1','#9db69e'][j])
for j in range(22):
    x=rand.randrange(10,500);h=rand.randrange(7,22);y=130+int(4*sin(x*.08));d.rectangle((x,y-h,x+h*.7,y+3),fill='#94a8a9');d.line((x,y-h,x+h*.7,y-h),fill='#bcc6ba',width=1)
fol.paste(strip,(0,512));fol.save(out/'hall-ivy.webp',quality=92,method=6)
