"""Original ceramic wayfinding, lane number plates and a mechanical pace clock."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import math,random
out=Image.new('RGB',(1024,512),'#f2e9d2');g=ImageDraw.Draw(out)
def font(n):return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',n)
def text(p,s,n,fill):g.text(p,s,font=font(n),fill=fill,anchor='mm')
for y,title,sub in [(0,'夏 日 泳 池','AQUATICS   /   POOL DECK'),(114,'晴 空 草 坪','GARDENS   /   SCHOOL WALK')]:
    g.rounded_rectangle((1,y+1,765,y+110),10,fill='#28616a',outline='#ccaa72',width=5)
    for x in (18,748):
        for v in (16,95):g.ellipse((x-3,y+v-3,x+3,y+v+3),fill='#d5ccaf')
    text((382,y+42),title,43,'#f9edcf');text((382,y+88),sub,17,'#f2d09a')
for i in range(3):
    x=i*152;g.rectangle((x,231,x+148,359),fill='#247389',outline='#d3d7b9',width=4);text((x+74,293),str(i+1),81,'#fcf3dc')
cx,cy,r=820,373,114;g.ellipse((cx-r,cy-r,cx+r,cy+r),fill='#faf2dc',outline='#415f60',width=4)
for i in range(60):
    a=i*math.tau/60;si,co=math.sin(a),math.cos(a);rr=91 if i%5==0 else 103
    g.line((cx+rr*si,cy-rr*co,cx+109*si,cy-109*co),fill='#314e55',width=4 if i%5==0 else 2)
    if i%5==0:text((cx+77*si,cy-77*co),str(i or 60),17,'#344f56')
text((cx,cy+24),'PACE  CLOCK',11,'#677870')
for i in range(8):
    x=768+i*32;g.rounded_rectangle((x+1,2,x+31,61),4,fill='#f3e5bd',outline='#b09e7b');text((x+16,31),f'{i+1:02}',17,'#345b65')
# One bay of the overflow grille and a panel of sealed slatted timber. Used
# as small atlas quads in the existing signage draw instead of 172 slot boxes.
g.rectangle((772,70,1018,221),fill='#aaa897');
for i in range(8):
    y=72+i*18;g.rounded_rectangle((779,y,1010,y+9),4,fill='#626e68');g.line((787,y+10,1002,y+10),fill='#f1e9cc',width=2)
rng=random.Random(3812);g.rectangle((460,232,698,357),fill='#bd9068');
for i in range(145):
    y=rng.uniform(232,358);v=rng.uniform(-1,1);g.line([(x,y+v*2.3*math.sin(x*.032+i)) for x in range(461,698,3)],fill=rng.choice(['#c59b76','#ad805e','#c79b72']),width=1)
for y in (241,348):
    for x in (473,685):g.ellipse((x-2,y-2,x+2,y+2),fill='#77664f')
g.rectangle((2,370,550,508),fill='#e6d7aa',outline='#566e69',width=4);text((275,407),'泳 道 计 时',35,'#345861');text((275,472),'AQUATICS CLUB    /    TIMING',22,'#51685e')
out.save(Path(__file__).resolve().parents[1]/'src/mmdVrShowcase/scenery/lido-signs.webp',quality=93,method=6)
