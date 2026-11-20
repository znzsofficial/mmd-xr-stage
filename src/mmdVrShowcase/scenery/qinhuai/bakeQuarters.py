"""Original house board, moon-window plum painting, quilt and woven valance.
Run offline with Pillow. Every tile has mip gutters; no runtime fonts or SVG."""
import math, os, random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root=Path(__file__).resolve().parent
im=Image.new('RGB',(1024,512)); d=ImageDraw.Draw(im); rng=random.Random(715)
def font(n): return ImageFont.truetype(os.environ.get('QINHUAI_FONT','C:/Windows/Fonts/simkai.ttf'),n)
def framed(bounds,bg,edge):
    x,y,X,Y=bounds; d.rectangle(bounds,fill=bg)
    for inset,w in [(6,3),(13,1)]: d.rectangle((x+inset,y+inset,X-inset,Y-inset),outline=edge,width=w)
    for px,s in [(x+18,1),(X-18,-1)]:
        for py,t in [(y+18,1),(Y-18,-1)]:
            d.line([(px,py+16*t),(px+10*s,py+16*t),(px+10*s,py+8*t),(px+23*s,py+8*t),(px+23*s,py)],fill=edge,width=3)
def petal(x,y,s,c,core):
    for k in range(5):
        a=k*math.tau/5+.25; u=x+math.cos(a)*s*.58;v=y+math.sin(a)*s*.58
        d.ellipse((u-s*.45,v-s*.45,u+s*.45,v+s*.45),fill=c)
    d.ellipse((x-s*.20,y-s*.20,x+s*.20,y+s*.20),fill=core)

# Chinese boards traditionally read from the right. The thinner lower line
# identifies the fictional house as a courtesan's residence, not a second stage.
framed((8,8,504,222),'#403038','#bf9f70')
for j,c in enumerate('館蘅月'):d.text((126+j*122,96),c,font=font(102),fill='#f2d49d',anchor='mm')
d.text((256,180),'寓 書 淮 秦',font=font(30),fill='#d9b68a',anchor='mm')

# Quilt seen from above: framed five-petal rosettes in plum and old jade on
# madder silk. The fold at the foot is a different weave, not a scaled decal.
framed((8,242,504,504),'#9c6465','#d6b794')
for row in range(4):
    for col in range(8):
        x=43+col*59+(row%2)*15;y=280+row*61
        if x>470 or y>474:continue
        d.arc((x-20,y-14,x+18,y+13),192,344,fill='#d2a98c',width=2)
        for s in [-1,1]:d.polygon([(x+s*4,y-1),(x+s*14,y-9),(x+s*15,y-4),(x+s*10,y)],fill='#baa891')
        petal(x,y,7,'#e1c3ae','#a76f56')

# Plum branch framed in silk; the image is sampled by a round window mesh.
d.rectangle((526,8,1016,375),fill='#d5c8a7')
for i in range(220):
    x=rng.randrange(530,1016);y=rng.randrange(12,372);d.line((x,y,x+rng.randrange(2,9),y),fill='#d8ceb2')
def branch(x,y,angle,length,w,level):
    a=angle+rng.uniform(-.27,.28);mx=x+length*.51*math.cos(angle);my=y+length*.51*math.sin(angle);ex=mx+length*.49*math.cos(a);ey=my+length*.49*math.sin(a)
    d.line([(x,y),(mx,my),(ex,ey)],fill='#685e52',width=max(1,round(w)),joint='curve')
    if level>0:
        branch(ex,ey,a+rng.uniform(-.32,.12),length*.76,w*.66,level-1)
        branch(mx,my,a+rng.choice([-1,1])*rng.uniform(.53,1.04),length*.61,w*.49,level-1)
    if level<3:
        for f in [.21,.69,1]:
            if rng.random()>.25:
                X=mx+(ex-mx)*f;Y=my+(ey-my)*f
                if 530<X<1011 and 13<Y<368:petal(X,Y,rng.uniform(3.3,6.8),rng.choice(['#ad6967','#ad736c','#bc8a7b']),'#deb48e')
branch(552,365,-.86,167,15,5);branch(625,357,-1.13,113,8,4);branch(1006,350,-2.16,123,9,4)

# Continuous indigo brocade for the headboard, canopy valance and folded throw.
d.rectangle((526,397,824,504),fill='#556d71')
for y in (403,410,492,499):d.line((526,y,824,y),fill='#d6b98a',width=2)
for i in range(5):
    x=557+61*i;y=451
    d.polygon([(x-28,y),(x,y-26),(x+28,y),(x,y+26)],outline='#c6ad85',width=2)
    petal(x,y,10,'#c9b697','#a76c62')

# Reed mat swatch. Pairs of interlaced reeds alternate over/under in a
# diagonal twill. UVs use metre-sized pieces, not one giant stretched weave.
d.rectangle((844,397,1016,504),fill='#ad9777')
for j in range(18):
    for i in range(44):
        x=844+i*4;y=397+j*6
        color=rng.choice(['#b9a68c','#c1ad90','#b6a182']) if (i-j)%4<2 else rng.choice(['#ab987b','#ad9b80'])
        d.rectangle((x,y,min(x+3,1016),min(y+4,504)),fill=color)

# The plum picture is cut into a circle. Use its unused upper-left corner
# for the convex mirror's soft reflected light; there is no reflection pass.
mirror=Image.new('RGB',(68,52));px=mirror.load()
for j in range(52):
    for i in range(68):
        x=(i-33.5)/33.5;y=(j-25.5)/25.5
        n=rng.uniform(-1,1)+.75*math.cos(x*27+y*14)
        gleam=math.exp(-((x*.82-y*.62+.25)/.21)**2)*17+math.exp(-((x*.82-y*.62-.02)/.05)**2)*9
        c=[int(a+gleam+n-11*y-14*x+3*(1-x*x-y*y)) for a in [181,180,153]]
        px[i,j]=tuple(c)
im.paste(mirror,(533,15))

# Duplicate all tile edges into neighbouring texels for filtered minification.
for x,y,X,Y in [(8,8,504,222),(8,242,504,504),(526,8,1016,375),(533,15,600,66),(526,397,824,504),(844,397,1016,504)]:
    tile=im.crop((x,y,X+1,Y+1)); w,h=tile.size
    im.paste(tile.crop((0,0,w,1)).resize((w,7)),(x,y-7));im.paste(tile.crop((0,h-1,w,h)).resize((w,7)),(x,Y+1))
    edge=im.crop((x,y-7,X+1,Y+8));im.paste(edge.crop((0,0,1,h+14)).resize((7,h+14)),(x-7,y-7));im.paste(edge.crop((w-1,0,w,h+14)).resize((7,h+14)),(X+1,y-7))
im.save(root/'quarters-silk.webp',quality=91,method=6)
