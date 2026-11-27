"""Original Shiomi Lane shop windows, signwriting and paving (Pillow + NumPy).

The merchandise is painted on the inside wall of each bay. Sashes, awnings,
window returns, shelving sills and the building relief are actual game geometry.
Run from any directory; the stage does not need Python or system fonts.
"""
from pathlib import Path
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


OUT = Path(__file__).resolve().parents[4] / 'public/scenery/terminus'
W, H, SIGN = 768, 512, 112
rng = random.Random(86101)
noise = np.random.default_rng(5762)


def font(size, japanese=False, serif=False):
    candidates = (['meiryob.ttc', 'NotoSansCJK-Bold.ttc'] if japanese else
                  ['georgiab.ttf', 'DejaVuSerif-Bold.ttf'] if serif else
                  ['segoeuib.ttf', 'DejaVuSans-Bold.ttf'])
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    raise RuntimeError(f'Missing signwriting font: {candidates}')


def rgb(hex_color):
    return [int(hex_color[i:i+2], 16) for i in (1, 3, 5)]


def gradient(w, h, stops):
    a = np.array([rgb(c) for _, c in stops]); y = np.arange(h)/h
    colors = np.stack([np.interp(y, [p for p, _ in stops], a[:, i]) for i in range(3)], axis=1)
    return Image.fromarray(np.uint8(np.broadcast_to(colors[:, None, :], (h, w, 3))))


def text(g, x, y, msg, size, color, jp=False, serif=False, anchor='mm'):
    g.text((x, y), msg, fill=color, font=font(size, jp, serif), anchor=anchor)


shops = [
    ('汐風ベーカリー', 'SHIOKAZE   /   BREAD & BUTTER', '#516e6c', '#faf0d5'),
    ('月舟書房', 'TSUKIFUNE   BOOKS   &   RECORDS', '#f0dfbf', '#463e37'),
    ('草花　紬', 'TSUMUGI   BOTANICAL   STUDIO', '#72816a', '#fff5dc'),
    ('喫茶 青波', 'A O N A M I     C O F F E E', '#35585d', '#ffe4b6'),
    ('浜田自転車', 'HAMADA   CYCLE   WORKS   •   1978', '#b65a42', '#fff0cf'),
    ('うつわ 灯', 'AKARI    /    POTTERY   ATELIER', '#586472', '#f2e2be'),
]


def shelf(g, y, wood='#977052'):
    g.rectangle((14, y, W-14, y+10), fill=wood)
    g.line((14, y, W-14, y), fill='#e3bc87', width=3)
    g.line((17, y+12, W-16, y+12), fill='#433e38', width=4)


def pendants(g):
    for x, y in [(114, 173), (466, 187), (649, 166)]:
        g.line((x, SIGN, x, y), fill='#45423d', width=3)
        g.pieslice((x-29, y-14, x+29, y+22), 180, 360, fill='#ad7855')
        g.ellipse((x-27, y+1, x+27, y+8), fill='#ffe2a5')


def bakery(g):
    pendants(g)
    for row, y in enumerate([316, 431, 502]):
        for i in range(9):
            x = 58+82*i+rng.randrange(-9, 7); half = rng.randrange(27, 35)
            g.ellipse((x-half-6, y-8, x+half+7, y+1), fill='#5d5140')
            if (i+row)%3 == 0:
                g.rounded_rectangle((x-half, y-48, x+half, y-2), 9, fill='#be7c43', outline='#8b5a34', width=2)
                for j in range(3):
                    g.ellipse((x-half+3+18*j, y-60, x-half+26+18*j, y-31), fill=['#d8a062', '#e8b570', '#d59a56'][j])
            else:
                g.ellipse((x-half, y-35, x+half, y-2), fill='#c88948', outline='#986239', width=2)
                for j in range(3):
                    g.arc((x-half+9+14*j, y-32, x-8+14*j, y-6), 165, 263, fill='#f5d49a', width=4)
            if i%3==1:
                g.rectangle((x+17,y-4,x+41,y+5), fill='#f0e4c3');g.line((x+20,y,x+34,y),fill='#847258')
        shelf(g,y+7)


def books(g):
    shades=['#b8906e','#839a8d','#c56f52','#ddd3aa','#8395ab','#648785','#e2bc75','#cbb8b3']
    for y in [222,321,421,506]:
        x=21
        while x<733:
            h,w=rng.randrange(42,85),rng.randrange(7,19)
            g.rectangle((x,y-h,x+w-2,y),fill=rng.choice(shades));g.line((x+2,y-h+4,x+w-4,y-h+4),fill='#e0d4b3')
            if w>10:g.line((x+w//2,y-h+11,x+w//2,y-16),fill='#645d58',width=2)
            x+=w
        shelf(g,y)
    for i,(bg,fg) in enumerate([('#496279','#f3ba75'),('#d69467','#596d71'),('#c8ac83','#825550')]):
        x=68+i*207; y=351-i%2*12;g.rectangle((x,y,x+115,y+119),fill=bg,outline='#d1b890',width=2)
        g.ellipse((x+29,y+15,x+82,y+68),fill=fg);g.polygon([(x+6,y+90),(x+47,y+42),(x+112,y+98)],fill='#384f59')
        text(g,x+58,y+105,['NIGHT TIDE','CAPE LINE','ORBIT'][i],11,'#f0ddb4')


def flowers(g):
    for i in range(16):
        x=26+i*48+rng.randint(-5,4); y=rng.randint(435,496); height=rng.randint(85,195)
        for j in range(13):
            px=x+rng.randint(-41,41); py=y-height+rng.randint(-28,40)
            g.line((x,y-24,px,py),fill=rng.choice(['#425e4d','#738459','#668575']),width=2)
            k=rng.uniform(.28,.72); lx=x+(px-x)*k;ly=y-24+(py-y+24)*k
            g.polygon([(lx,ly),(lx-12,ly-3),(lx-20,ly-14),(lx-6,ly-9)],fill='#759075')
            petals=('#e7bb84','#f1c78a','#ce8a60') if i%3==0 else ('#d6d8b5','#eee8c6','#b9bda0') if i%3==1 else ('#e0a491','#d98f88','#e9b6a4')
            r=rng.randrange(3,8)
            for u,v in [(-r,0),(r,0),(0,-r),(0,r)]:g.ellipse((px+u-r,py+v-r,px+u+r,py+v+r),fill=rng.choice(petals))
            g.ellipse((px-2,py-2,px+3,py+3),fill='#a0844f')
        g.polygon([(x-17,y-46),(x+17,y-46),(x+11,y),(x-11,y)],fill=rng.choice(['#798982','#899b98','#ae8065']))
        g.line((x-16,y-46,x+17,y-46),fill='#d3cbb1',width=3)


def coffee(g):
    pendants(g)
    g.rounded_rectangle((403,214,707,334),3,fill='#3f514b',outline='#bd9a72',width=5)
    text(g,555,238,'SEASONAL BREW',20,'#e6dabe',serif=True)
    for i,name in enumerate(['HOUSE BLEND', 'ESPRESSO', 'AU LAIT']):
        text(g,437,265+i*19,name,12,'#d7d2b8',anchor='lm');text(g,677,265+i*19,str(420+i*40),12,'#d7d2b8',anchor='rm')
    for i in range(6):
        x=443+i*37;g.rounded_rectangle((x,376-i%2*9,x+24,408),5,fill='#e7ddbe');g.arc((x+16,378-i%2*9,x+35,397),250,105,fill='#d4cbb4',width=3)
    g.rounded_rectangle((70,315,351,413),10,fill='#6a7975',outline='#3d5657',width=4)
    g.rectangle((80,328,342,354),fill='#bcc2b3');g.rectangle((86,361,335,402), fill='#3d4744')
    for x in [122,212,300]:
        g.ellipse((x-10,331,x+10,350),fill='#ded6bf',outline='#6f756a',width=2);g.line((x,341,x+4,334),fill='#9e6250',width=2)
        g.rectangle((x-9,353,x+10,369), fill='#a6a99b');g.line((x+3,367,x+23,375),fill='#aa8359',width=4)
        g.rounded_rectangle((x-12,379,x+14,400),4,fill='#e9debc')
    shelf(g,415);g.rectangle((14,429,752,512),fill='#987454')
    for x in range(16,750,12):g.line((x,433,x,512),fill='#705e48',width=2)


def cycles(g):
    for i in range(14):
        x=30+i*53;y=164+(i%4)*12
        g.line((x,y,x+4,y+36),fill='#71766d',width=5);g.arc((x-7,y-8,x+7,y+7),30,330,fill='#b3b4a2',width=3)
    for n,x in enumerate([120,465]):
        y=450;r=48 if n else 58; axle=y-r
        for wheel in [x,x+145]:
            g.ellipse((wheel-r,axle-r,wheel+r,axle+r),outline='#343f3e',width=7)
            for j in range(14):
                a=j*math.tau/14;g.line((wheel,axle,wheel+(r-6)*math.cos(a),axle+(r-6)*math.sin(a)),fill='#a7afa3',width=1)
        frame='#83a59a' if not n else '#c47e66'
        g.line([(x,axle),(x+65,axle+4),(x+39,axle-63),(x,axle)],fill=frame,width=7)
        g.line([(x+43,axle-44),(x+71,axle-20),(x+116,axle-62),(x+65,axle+4)],fill=frame,width=6)
        g.line([(x+145,axle),(x+116,axle-62),(x+112,axle-79),(x+97,axle-80)],fill='#b6b4a3',width=5)
        g.rounded_rectangle((x+24,axle-68,x+53,axle-61),4,fill='#785741');g.ellipse((x+54,axle-7,x+77,axle+16),outline='#ccc6af',width=3)
        g.polygon([(x+118,axle-75),(x+169,axle-75),(x+162,axle-50),(x+127,axle-50)],fill='#ad8860');g.line((x+116,axle-75,x+171,axle-75),fill='#d5b88b',width=3)


def pottery(g):
    colors=['#829b9f','#c39169','#d5c4a7','#92aaa2','#657e90','#c0a991']
    for j,y in enumerate([249,349,475]):
        for i in range(9):
            x=51+82*i+rng.randrange(-7,8); r=rng.randrange(18,34);h=rng.randrange(17,40);color=rng.choice(colors)
            if (i+j)%3:
                g.chord((x-r,y-2*h,x+r,y),0,180,fill=color);g.ellipse((x-r,y-h-4,x+r,y-h+4),fill='#5c6a65',outline='#d3c7aa',width=2)
                g.arc((x-r+3,y-2*h+4,x+r-3,y-2),23,157,fill='#bcb49d',width=2)
            else:
                g.ellipse((x-r,y-2*h,x+r,y),fill=color);g.rectangle((x-r//2,y-2*h-8,x+r//2,y-2*h+15),fill=color)
                g.ellipse((x-r//2-2,y-2*h-10,x+r//2+2,y-2*h-4),fill='#53615b',outline='#d0bf9d',width=2)
        shelf(g,y+2)


def paint_window(index):
    name,latin,ground,ink=shops[index]
    im=gradient(W,H,[(0,'#605d51'),(.25,'#4b514c'),(.68,'#8b8772'),(1,'#525e55')]);g=ImageDraw.Draw(im)
    # Perspective returns and a narrow pool of ambient light at the back wall.
    g.polygon([(0,SIGN),(57,SIGN+25),(57,H-30),(0,H)], fill='#545a51')
    g.polygon([(W,SIGN),(W-57,SIGN+25),(W-57,H-30),(W,H)],fill='#6b6b59')
    [bakery,books,flowers,coffee,cycles,pottery][index](g)
    veil=Image.new('RGBA',im.size);v=ImageDraw.Draw(veil)
    for x,w,a in [(-134,98,20),(265,17,22),(459,157,15),(678,39,21)]:
        v.polygon([(x,SIGN),(x+w,SIGN),(x-120+w,H),(x-120,H)],fill=(206,229,227,a))
    im=Image.alpha_composite(im.convert('RGBA'),veil).convert('RGB');g=ImageDraw.Draw(im)
    g.rectangle((0,0,W,SIGN-1),fill=ground)
    for y in [8,SIGN-10]:g.line((16,y,W-16,y),fill=ink,width=1)
    text(g,W/2,40,name,40,ink,jp=True);text(g,W/2,82,latin,16,ink,serif=index in (1,3))
    return im


def upper_window(index):
    im=gradient(W,H,[(0,'#a5c3cd'),(.45,'#94aeb3'),(.72,'#8b9e9c'),(1,'#566963')]);g=ImageDraw.Draw(im)
    # Reflections belong in the glazing, not as a row of identical squares.
    for i in range(9):
        x=i*102-42; y=347+rng.randrange(-43,35); w=rng.randint(90,133)
        g.rectangle((x,y,x+w,H),fill=rng.choice(['#809496','#859799','#839598','#8d9d9e']))
        g.polygon([(x-7,y+2),(x+w*.33,y-18),(x+w*.6,y-18),(x+w+8,y+2)],fill='#849797')
        for j in range(4):g.rectangle((x+7+j*w/4,y+17,x+15+j*w/4,y+31),fill='#7c8d8d')
    im=im.filter(ImageFilter.GaussianBlur(2.4));g=ImageDraw.Draw(im)
    if index==1:
        for j in range(19):
            y=2+16*j;g.polygon([(0,y),(W,y+3),(W,y+13),(0,y+10)],fill='#b6c2bb')
            g.line((0,y+1,W,y+4),fill='#cccec1',width=2)
        for x in [168,614]:g.line((x,0,x+1,306),fill='#9aaca4',width=2)
    else:
        y,x=np.indices((H,W));width=157 if index==0 else 104
        outside=np.minimum(x,W-x);fold=np.cos((outside+y*.022)*.14)+.26*np.cos(outside*.37)
        fabric=np.array([213,210,191])+(fold*6-y/H*13)[:,:,None]
        edge=width+7*np.cos(y/H*4)-y/H*32
        mix=np.clip((edge-outside)/3,0,1)[:,:,None]*.86
        im=Image.fromarray(np.uint8(np.asarray(im)*(1-mix)+fabric*mix))
    return im


def mineral_tile(brick):
    # Neutral reflectance modulates the material colour. Broad sediment, fine
    # aggregate, runnels under the coping and ambient shade at the eaves are
    # separate scales; mip filtering removes the grit before the larger forms.
    y,x=np.indices((H,W));fx=x/W;fy=y/H
    def field(cols,rows):
        im=Image.fromarray(noise.standard_normal((rows,cols)).astype('float32'))
        return np.asarray(im.resize((W,H),Image.Resampling.BICUBIC))
    tone=234+3.7*field(14,11)+2*field(85,50)+2.4*noise.standard_normal((H,W))
    tone-=27*np.exp(-fy*13)+9*fy**5+8*np.exp(-np.minimum(fx,1-fx)*40)
    runs=np.clip(field(102,3),0,1.8);tone-=8*runs*np.exp(-fy*5)
    im=np.repeat(tone[:,:,None],3,axis=2)
    if brick:
        bh,bw=11,48;row=y//bh;col=(x+(row%2)*(bw//2))//bw
        soil=noise.uniform(-8,7,(H//bh+1,W//bw+2))[row,col]
        im+=soil[:,:,None]
        joint=((x+(row%2)*(bw//2))%bw<1)|(y%bh<1)
        im[joint]=im[joint]*.73+np.array([249,253,248])*.27
    else:
        # Expansion joints in floated render: thin, with a sunlit return, not
        # a heavy cartoon outline. Stains are strongest above the podium.
        for v in [123,382,637]:
            im[:,v:v+1]*=.93;im[:,v+1:v+2]+=4
        im[H-12:H-10]*=.91
    return Image.fromarray(np.uint8(im.clip(0,255)))


def lawn_print():
    # A clipped seaside lawn with small blades, overlapping tip shadows,
    # clover rosettes and broad changes of species/colour. At bench distance
    # it should resolve as turf, not triangles scattered across green paint.
    def field(cols,rows):
        a=Image.fromarray(noise.normal(0,1,(rows,cols)).astype('float32'))
        return np.asarray(a.resize((W,H),Image.Resampling.BICUBIC))
    a=field(12,10);b=field(69,43);fine=noise.normal(0,2.2,(H,W))
    base=np.array([136,153,107])+a[:,:,None]*np.array([5,4.5,2])+b[:,:,None]*3+fine[:,:,None]
    im=Image.fromarray(np.uint8(base.clip(0,255)));g=ImageDraw.Draw(im)
    for _ in range(66500):
        x=rng.randrange(W);y=rng.randrange(H);orientation=a[y,x]*.9+rng.uniform(-1.38,1.38)
        l=rng.uniform(1.4,5.8);dx=l*math.cos(orientation);dy=l*math.sin(orientation)
        shade=rng.uniform(-19,13)+2*b[y,x];tone=base[y,x]+shade
        g.line((x,y,x+dx,y+dy),fill=tuple(np.uint8(tone.clip(0,255))),width=1)
        if l>4.9:g.point((x+int(dx),y+int(dy)),fill='#a5af7a')
    for _ in range(345):
        x=rng.randrange(W);y=rng.randrange(H);angle=rng.random()*6.28
        for j in range(3):
            px=x+1.8*math.cos(angle+j*2.094);py=y+1.8*math.sin(angle+j*2.094)
            g.ellipse((px-1.3,py-1.1,px+1.3,py+1.1),fill='#9ca976')
    return im


def bake():
    OUT.mkdir(exist_ok=True,parents=True); atlas=Image.new('RGB',(W*3,H*4))
    print_noise=noise.bit_generator.state
    for i in range(9):
        cell=paint_window(i) if i<6 else upper_window(i-6)
        atlas.paste(cell,((i%3)*W,(i//3)*H))
    for i,cell in enumerate([mineral_tile(False),mineral_tile(True),lawn_print()]):atlas.paste(cell,(W*i,H*3))
    atlas.save(OUT/'park-shops.webp',quality=91,method=6)
    noise.bit_generator.state=print_noise
    # Four metres square of sawn granite, laid in stretcher bond. The noise
    # amplitude stays below the mortar contrast; neither flickers at a distance.
    n=768;y,x=np.indices((n,n)); row=y//96; across=(x+(row%2)*96)%192
    palette=noise.normal(0,3.5,(8,4)); delta=palette[row,((x+(row%2)*96)//192)%4]
    delta+=noise.normal(0,3.5,(n,n));delta+=2*np.sin(math.tau*x/n)*np.cos(2*math.tau*y/n)
    a=np.array([207,200,179])+delta[:,:,None]
    a[(across<=1)|(y%96<=1)]*=.73;a[(across==2)|(y%96==2)]+=7
    Image.fromarray(np.uint8(a.clip(0,255))).save(OUT/'park-paving.webp',quality=88,method=6)


if __name__=='__main__':
    bake()
