"""Original lacquer, hemp, cut stone, wood and score for the two hand-distance views.
Run with Python, Pillow and numpy. QINHUAI_FONT optionally selects a CJK font.
Rectangles are content pixels; the outer ten texels are dilated for mip filtering.
"""
import json, math, os, random
from itertools import combinations
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
RECTS = json.loads((ROOT / 'closeAtlas.json').read_text(encoding='utf8'))
for x,y,w,h in RECTS.values():
    assert x >= 10 and y >= 10 and x+w+10 <= 1024 and y+h+10 <= 1024
for (ka,a),(kb,b) in combinations(RECTS.items(),2):
    assert a[0]+a[2]+20 <= b[0] or b[0]+b[2]+20 <= a[0] or a[1]+a[3]+20 <= b[1] or b[1]+b[3]+20 <= a[1], f'Atlas gutters overlap: {ka}, {kb}'
r, rng = random.Random(1971), np.random.default_rng(1971)
atlas = Image.new('RGB', (1024, 1024), (86, 70, 56))

def fields(name):
    w, h = RECTS[name][2:]
    y, x = np.mgrid[0:h, 0:w]
    return w, h, x / (w - 1), y / (h - 1)

def wash(w, h, nx, ny):
    noise = Image.fromarray(rng.integers(0, 256, (ny, nx), dtype='uint8'))
    return np.asarray(noise.resize((w,h), Image.Resampling.BICUBIC)).astype(float)/127.5 - 1

def pigment(base, light, chroma=(1,1,1)):
    return np.array(base) + light[:,:,None] * chroma

def image(rgb):
    return Image.fromarray(np.uint8(np.clip(rgb, 0, 255)))

def lay(name, im):
    x, y, w, h = RECTS[name]
    assert im.size == (w,h)
    atlas.paste(Image.fromarray(np.pad(np.asarray(im), ((10,10),(10,10),(0,0)), mode='edge')), (x-10,y-10))

# A reddish undercoat shows through the black-brown upper lacquer at rubbed
# edges. Transverse broken arcs are sparse and uneven; not parallel ruled bars.
w,h,x,y = fields('lacquer')
cloud = wash(w,h,18,5)
edge = np.exp(-np.minimum(y,1-y)*27) + np.exp(-np.minimum(x,1-x)*135)
streak = np.sin(112*y + 1.8*np.sin(x*6) + .45*cloud)
glaze = 11*cloud + 4*wash(w,h,7,18) + 2*streak + 15*edge + rng.normal(0,1.4,(h,w))
im = image(pigment((73,46,43),glaze,(1.4,.96,.7))); d = ImageDraw.Draw(im,'RGBA')
for _ in range(80):
    start = r.uniform(0,w); cy = r.uniform(-10,h); reach = r.uniform(14,82); bend = r.uniform(-12,12); lean = r.uniform(-.12,.12)
    points = [(start + bend*math.sin(t*1.9)+t*reach*lean+1.5*math.sin(t*7.1), cy+t*reach) for t in np.linspace(0,1,13)]
    d.line(points,fill=(34,24,24,r.randrange(80,145)),width=r.choice([1,1,2]));d.line([(a+1.1,b) for a,b in points[2:-3]],fill=(171,110,74,76))
    if r.random()<.27:
        a,b = points[6];d.line([(a,b),(a+5,b+6),(a+7,b+13),(a+11,b+16)],fill=(39,25,22,110))

# 13 mother-of-pearl hui on the far side of the seven strings. Distances
# are harmonic nodes measured between the two bridges, not equal divisions.
for i,f in enumerate([1/8,1/6,1/5,1/4,1/3,2/5,1/2,3/5,2/3,3/4,4/5,5/6,7/8]):
    cx = ((-.646+1.245*f)+.72)/1.44*(w-1); cy = .117*(h-1); rx = 3.35 if i!=6 else 4.35; ry=rx*1.30
    d.ellipse((cx-rx-1,cy-ry-1,cx+rx+1,cy+ry+1),fill='#3b2a2b');d.ellipse((cx-rx,cy-ry,cx+rx,cy+ry),fill='#cbb79c');d.arc((cx-rx,cy-ry,cx+rx,cy+ry),80,252,fill='#e5dcc0',width=2);d.line((cx-rx+2,cy+2,cx+1,cy-2),fill='#e4d0c0')
# A slender river-grass inlay on the unstrung head, beyond the bridge.
for k in range(5):
    pts=[(969+(k-2)*.9*t+5*t*t,182-t*78) for t in np.linspace(0,1,16)] if k==2 else [(969+(k-2)*6*t+5*t*t,182-t*(78-abs(k-2)*13)) for t in np.linspace(0,1,16)]
    d.line(pts,fill=(215,173,113,203),width=2)
    a,b=pts[-1];d.line((a,b,a+1.2*(k-2),b-8),fill=(226,189,128,224),width=3)
lay('lacquer',im)

# Each cut-stone face shares a datum: stone top -0.092 m, river -0.535 m.
# A broken dry mineral band sits above the current wet/algae belt.
for i in range(3):
    name=f'stone{i}'; w,h,x,y=fields(name)
    large=wash(w,h,8,6); speck=wash(w,h,70,45); chips=wash(w,h,37,31); vein=wash(w,h,5,11)
    stone= pigment((154,147,137),17*large+12*chips+10*speck+4*rng.normal(0,1,(h,w)))
    wave=.018*np.sin(5*x+i*2)+.014*np.sin(16*x)+.010*chips
    dry=np.exp(-((y-.41-wave-.014*large)/.024)**2) * np.clip(.65+chips,0,1)
    soggy=np.clip((y-.45-wave+.023*large)*4.5,0,1)
    moss=np.clip((y-.32-wave + .11*large + .075*chips +.035*speck)*4,0,1) * np.clip(.55+.65*large+.55*chips,0,1)
    stone += dry[:,:,None]*(41,36,27) - soggy[:,:,None]*(41,39,34)
    stone += moss[:,:,None]*(-40,-17,-42)
    # Chisel chatter is intermittent, and largescale lichen crosses several strokes.
    chisel=np.maximum(0,np.sin(182*x+20*y+2*vein))**10 * np.clip(chips+.30,0,1) * (1-soggy*.75)
    stone+=chisel[:,:,None]*11
    im=image(stone);d=ImageDraw.Draw(im,'RGBA')
    for _ in range(220):
        a=r.randrange(w); b=r.randrange(h);d.line((a,b,a+r.randrange(1,5),b+r.choice([-1,0,0,1])),fill=(51,57,52,r.randrange(35,72)))
    lay(name,im)

w,h,x,y=fields('coping');lay('coping',image(pigment((177,166,148),9*wash(w,h,12,5)+8*wash(w,h,84,19)+rng.normal(0,4,(h,w)))))
# Continuous S-laid rope: u wraps every 9 cm; v runs round the circumference.
# Integer phases in both directions keep the diagonal strands joined across UV seams.
w,h,x,y=fields('rope'); theta=2*np.pi*(3*y-3*x)
strand=np.cos(theta); fibres=np.cos(theta*7+.8*np.sin(2*np.pi*(2*y+x)))
light=20*strand-20*np.maximum(-strand,0)**4 + 5*fibres+2*np.sin(2*np.pi*(34*y-33*x))
lay('rope',image(pigment((170,139,99),light,(1,.93,.8))))

w,h,x,y=fields('post'); drift=2.3*np.sin(8*y+3*x)+2*wash(w,h,10,4)
grain=np.sin(85*x+drift)+.38*np.sin(217*x+1.6*drift)
scour=np.exp(-((y-.19)/.085)**2); wet=np.clip((y-.53)*7,0,1)
wood=pigment((119,91,69),9*grain+13*wash(w,h,36,3)+7*wash(w,h,65,8)+12*scour-24*wet+rng.normal(0,2,(h,w)))
im=image(wood);d=ImageDraw.Draw(im,'RGBA')
for _ in range(65):
    a,b=r.randrange(w),r.randrange(h);d.line([(a,b),(a+1,b+9),(a,b+r.randint(14,45))],fill=(61,46,36,r.randint(28,76)),width=1)
lay('post',im)
w,h,x,y=fields('endgrain');xx=x-.47; yy=y-.52; rr=np.sqrt((xx*1.03)**2+yy**2);angle=np.arctan2(yy,xx)
ring=rr*141+2.1*np.sin(5*angle)*rr+1.4*np.sin(8*x+7*y)+.6*wash(w,h,12,12)
im=image(pigment((153,123,89),-18*np.maximum(0,np.sin(ring))**3+6*wash(w,h,7,7)+rng.normal(0,2,(h,w))));d=ImageDraw.Draw(im)
for a,length in [(1.3,.22),(-.34,.35),(2.6,.14)]:
    d.line([(w*.5+math.cos(a)*rr*w,h*.5+math.sin(a)*rr*h+1.8*math.sin(rr*48)) for rr in np.linspace(.5,.5-length,15)],fill='#71543d',width=2)
lay('endgrain',im)

def font(sz):return ImageFont.truetype(os.environ.get('QINHUAI_FONT','C:/Windows/Fonts/simkai.ttf'),sz)
w,h,x,y=fields('score');im=image(pigment((220,200,159),6*wash(w,h,8,5)-8*np.exp(-np.minimum(x,1-x)*18)+rng.normal(0,1.7,(h,w))));d=ImageDraw.Draw(im)
d.rectangle((8,8,w-8,h-8),outline='#8d7359',width=2);d.line((w-71,10,w-71,h-10),fill='#9c8264',width=2)
for i,txt in enumerate('江月'):d.text((w-37,36+i*48),txt,font=font(36),fill='#54413c',anchor='mm')
# A study leaf with right-/left-hand reminders; not a transcription of a historical score.
for j,col in enumerate(['泛音','七徽','散音','挑勾','抹挑','吟猱','按音','八徽']):
    cx=w-94-j*25; d.line((cx-12,14,cx-12,h-15),fill='#b29a77');
    for i,txt in enumerate(col):d.text((cx,42+i*45),txt,font=font(20),fill='#655448',anchor='mm')
lay('score',im)
w,h,x,y=fields('binding');lay('binding',image(pigment((80,106,91),5*np.cos(y*56)+3*np.cos(x*100)+4*wash(w,h,6,4))))
# Mitred frame enclosing the long table panel; change the grain axis at each
# short end. A darker cove under the top catches the narrow rim's highlight.
w,h,x,y=fields('table'); end=np.minimum(x,1-x)*2.05 < np.minimum(y,1-y)*.63
u=np.where(end,y,x);v=np.where(end,x*2.6,y); figure=1.8*np.sin(11*u+3*v)+1.7*wash(w,h,15,4)
inside=np.minimum(np.minimum(x,1-x)*2.05,np.minimum(y,1-y)*.63)
grain=np.sin(129*v+figure)+.60*np.sin(260*v+figure*1.5)
tone=5*grain+8*wash(w,h,9,7)-16*np.exp(-((inside-.047)/.003)**2)+3*(inside<.047)
lay('table',image(pigment((129,83,61),tone,(1,.78,.58))))
w,h,x,y=fields('tableEdge');lay('tableEdge',image(pigment((127,79,56),9*np.cos(y*2*np.pi)-9*np.sin(4*np.pi*y)+3*wash(w,h,18,4))))
atlas.save(ROOT/'songhouse-close.webp',quality=90,method=6)
