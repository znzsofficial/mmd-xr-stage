"""Original plate artwork and terrazzo print. Offline only: Pillow, numpy and Node >= 26.

Re-run from any directory. Uses a system CJK font for the bilingual room plates;
set CLINIC_FONT and CLINIC_FONT_BOLD on systems without Microsoft YaHei.
"""
import json, math, os, random, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

HERE = Path(__file__).resolve().parent
CW, CH = 512, 320
atlas = Image.new('RGB', (4*CW, 4*CH))
regular = os.environ.get('CLINIC_FONT', 'C:/Windows/Fonts/msyh.ttc')
bold = os.environ.get('CLINIC_FONT_BOLD', 'C:/Windows/Fonts/msyhbd.ttc')
rng = random.Random(1144)
pine, sea, cream, apricot = '#214f50','#337672','#f5f1df','#edba90'

def card(bg):
    im=Image.new('RGB',(CW,CH),bg);return im,ImageDraw.Draw(im)
def put(i,im): atlas.paste(im,((i%4)*CW,(i//4)*CH))
def txt(d,xy,t,s,c,b=False): d.text(xy,t,font=ImageFont.truetype(bold if b else regular,s),fill=c,anchor='lt')
def sprig(d,x,y,scale,stem,leaf):
    pts=[(x,y),(x+8*scale,y-34*scale),(x+27*scale,y-68*scale),(x+48*scale,y-105*scale)]
    d.line(pts, fill=stem,width=max(1,int(2*scale)))
    for j in range(8):
        a=j/9;xx=x+48*scale*a*a; yy=y-105*scale*a; side=(-1)**j
        d.polygon([(xx,yy),(xx+side*13*scale,yy-5*scale),(xx+side*22*scale,yy-23*scale),(xx+side*11*scale,yy-19*scale)],fill=leaf)
for i,(no,title,en,bg) in enumerate([('01','妇科门诊','GYNAECOLOGY',pine),('03','女卫生间','WOMEN  /  WC','#6d525f'),('02','手术室','OPERATING ROOM','#2d5c63'),('A','候诊区','WAITING LOUNGE','#957357')]):
    im,d=card(bg);txt(d,(27,22),'N   /   NORTH WING',21,cream,True);d.line((28,64,483,64),fill='#c5d7c6',width=2)
    txt(d,(26,96),title,64,cream,True);txt(d,(30,213),en,32,cream);txt(d,(419,257),no,35,apricot,True);put(i,im)

im,d=card('#eceddf');txt(d,(26,19),'NORTH WING   /   DIRECTORY',21,sea,True);txt(d,(24,57),'妇科诊疗中心',46,pine,True)
for j,(c,n,s) in enumerate([(sea,'01','妇科门诊   ·   Clinic'),('#527687','02','手术室       ·   Theatre'),('#8d6776','03','卫生间       ·   Restroom')]):
    y=141+52*j;d.line((26,y-12,485,y-12),fill='#afbfad',width=2);d.rounded_rectangle((27,y-1,83,y+32),8,fill=c);txt(d,(35,y),n,23,'white',True);txt(d,(112,y-1),s,23,pine)
put(4,im)
im,d=card('#efe8d8');d.ellipse((306,-61,589,215),fill='#e0bda0');sprig(d,332,315,2.25,'#3e6560','#668c83');sprig(d,399,312,1.38,'#4f7974','#a9b9a4');txt(d,(28,29),'HERBARIUM   /   06',23,sea,True);txt(d,(23,142),'木兰',64,pine);txt(d,(28,231),'Magnolia',29,pine);d.line((29,283,192,283),fill=sea,width=2);put(5,im)
im,d=card('#f4e8da');txt(d,(22,20),'GYNAECOLOGY   /   PLATE 01',19,pine,True);txt(d,(22,57),'女性盆腔解剖示意',31,pine,True)
# Symmetrical educational line study of the uterus and ovaries. No patient data.
for side in [-1,1]:
    def pts(ps): return [(253+side*x,y) for x,y in ps]
    d.polygon(pts([(0,125),(24,123),(44,136),(53,149),(42,171),(18,205),(12,240),(0,242)]),fill='#d4928e');d.line(pts([(0,144),(22,144),(34,150),(19,168),(7,195),(0,228)]),fill='#f6d6bc',width=6)
    d.line(pts([(35,141),(65,125),(92,116),(113,122),(118,135),(110,144)]),fill='#c18082',width=6,joint='curve');xx=253+side*105;d.ellipse((xx-17,146,xx+17,168),fill='#ce9e8d');d.line(pts([(120,156),(148,142),(191,142)]),fill='#8e7d73',width=2)
d.line((38,270,473,270),fill='#b7ada2',width=2);txt(d,(32,282),'PELVIC ANATOMY     /     SCHEMATIC',16,sea);put(6,im)
im,d=card('#1b393a');txt(d,(27,25),'NORTH WING   /   1F',20,'#adccbb',True);txt(d,(25,68),'门诊候诊',46,cream,True);d.line((27,139,485,139),fill='#87a699',width=2)
txt(d,(29,174),'当前诊室',25,'#b1c9ba');txt(d,(27,224),'Consultation room',21,'#b1c9ba');txt(d,(328,157),'01',94,'#e5d6ab',True);put(7,im)
im,d=card('#102323');txt(d,(18,13),'PATIENT MONITOR  ·  DEMO',17,'#dae3d8',True)
for j,(co,name,val) in enumerate([('#81e8a7','ECG','72'),('#6ed5e5','PLETH','98'),('#f4cb7a','RESP','16')]):
    y=81+j*81;txt(d,(18,y-30),name,14,co);txt(d,(411,y-28),val,42,co,True)
    pp=[]
    for i in range(362):
        u=(i%85)/85; a=(.04*math.sin(u*2*math.pi)+.17*math.exp(-((u-.17)/.045)**2)-.19*math.exp(-((u-.34)/.034)**2)+1.06*math.exp(-((u-.39)/.022)**2)-.32*math.exp(-((u-.45)/.031)**2)+.25*math.exp(-((u-.70)/.08)**2)) if j==0 else (math.sin(u*math.pi)**3*(.52+.35*math.sin(2*math.pi*u)) if j==1 else math.sin((i/130)*math.pi)*.55)
        pp.append((19+i,y+8-28*a))
    d.line(pp,fill=co,width=3)
put(8,im)
im,d=card('#16262b');txt(d,(18,14),'ULTRASOUND   /   TRAINING',19,'#cfe4dd',True);txt(d,(17,267),'B   4.2 MHz',20,'#b4c8ca')
for j in range(15500):
    a=rng.uniform(-.63,.63);r=rng.uniform(20,218);x=264+r*math.sin(a);y=46+r*math.cos(a);tone=max(28,min(194,72+50*math.cos(r/13+math.sin(a*5)*2)+rng.gauss(0,29)))
    d.point((int(x),int(y)),fill=(int(tone*.91),int(tone),int(tone)))
for j in range(9):d.line((437,64+j*24,448 if j%2 else 456,64+j*24),fill='#b4c8ca',width=2)
put(9,im)
im,d=card('#c8d9d5');txt(d,(20,19),'THEATRE SERVICES',22,pine,True);txt(d,(19,67),'医用气体终端',33,pine,True)
for j,(co,n) in enumerate([('#4b927c','O₂'),('#d3a655','AIR'),('#629ab8','VAC')]):
    x=92+163*j;d.ellipse((x-35,139,x+35,209),fill='#738785',outline='#edf1df',width=4);d.ellipse((x-23,151,x+23,197),fill=co,outline=pine,width=4);d.ellipse((x-9,165,x+9,183),fill='#334545');txt(d,(x-25,225),n,22,pine,True)
put(10,im)
im,d=card('#dce7db');txt(d,(22,23),'WASH STATION   /   1F',22,sea,True);txt(d,(20,78),'手部清洁',52,pine,True)
for j,(a,b) in enumerate([('01','冲洗'),('02','搓洗'),('03','擦干')]):
    x=22+j*163;d.line((x,174,x+134,174),fill=sea,width=2);txt(d,(x,192),a,24,sea,True);txt(d,(x,242),b,31,pine)
put(11,im)
# Daylight behind privacy glazing, deliberately soft and not an exterior route.
im,d=card('#d3e7e4')
for y in range(CH):
    f=y/CH;d.line((0,y,CW,y),fill=tuple(int(a*(1-f)+b*f) for a,b in zip((191,217,224),(235,231,197))))
for j in range(65):
    x=rng.randrange(-40,545);y=rng.randrange(193,360);r=rng.randrange(11,47);d.ellipse((x-r,y-r,x+r,y+r), fill=rng.choice(['#a7c6af','#bad1b7','#c9d7b9','#98b9a9']))
from PIL import ImageFilter
put(12,im.filter(ImageFilter.GaussianBlur(8)))
im,d=card('#d4d6ca');txt(d,(18,15),'WOMEN’S HEALTH  ·  OUTPATIENT',17,sea,True);txt(d,(21,61),'门诊工作站',38,pine,True)
for j in range(4):d.rectangle((22,132+j*40,470-j%2*90,143+j*40),fill=['#9bb4a8','#b4beb0'][j%2]);put(13,im)
# This long strip samples only the central 136 px of its cell.
im,d=card('#235b58');d.rounded_rectangle((15,102,112,203),10,fill='#d7d5ac');d.rectangle((55,124,72,182),fill=pine);d.rectangle((36,144,92,161),fill=pine);txt(d,(129,102),'妇科诊疗中心',51,cream,True);txt(d,(133,172),'WOMEN’S HEALTH  /  NORTH WING',18,'#c9d7c8',True);put(14,im)
im,d=card('#e4e4d8');txt(d,(26,33),'WELCOME  /  导诊',27,sea,True);txt(d,(26,108),'候诊登记',54,pine,True);d.rounded_rectangle((28,219,475,274),12,fill=sea);txt(d,(56,229),'Check in     →',27,cream);put(15,im)
atlas.save(HERE/'clinic-plates.webp',quality=92,method=6)

# The floor uses the same geometry coordinates as collision and furniture.
data=json.loads(subprocess.check_output(['node','--input-type=module','-e',"""
import {registerHooks} from 'node:module';
import {extname} from 'node:path';
// The app uses bundler resolution; the native Node reader needs an extension.
registerHooks({resolve(id,context,next){return next(id.startsWith('./')&&!extname(id)?id+'.ts':id,context);}});
const {WARD,WALLS,FIXTURES,TOILETS,STALL_PANELS}=await import('./clinicLayout.ts');
console.log(JSON.stringify({WARD,WALLS,FIXTURES,TOILETS,STALL_PANELS}));
"""],cwd=HERE))
ward=data['WARD'];res=94; w=round((ward['east']-ward['west'])*res);h=round((ward['south']-ward['north'])*res)
xx,zz=np.meshgrid(ward['west']+(np.arange(w)+.5)/w*(ward['east']-ward['west']), ward['north']+(np.arange(h)+.5)/h*(ward['south']-ward['north']))
colors=np.zeros((h,w,3),np.float32);colors[:]=[211,210,192]; hall=(xx>ward['left'])&(xx<ward['right']);wc=(xx<ward['left'])&(zz<ward['wcSouth']);theatre=(xx>ward['right'])&(zz<ward['orSouth']);colors[wc]=[192,201,194];colors[theatre]=[159,192,183];colors[(xx<ward['left'])&(~wc)]=[209,199,186]
dist=np.abs(xx+1.41);colors[hall&(dist<.053)]=[118,157,149];colors[hall&(abs(dist-.10)<.012)]=[156,171,152]
colors[(np.abs(xx)<1.9)&(zz<-7.84)]=[181,197,183]
noise=np.random.default_rng(3612);grain=noise.normal(0,2.8,(h,w));specks=noise.random((h,w))>.988;grain[specks]-=noise.uniform(10,30,np.sum(specks));grain+=np.sin(xx*1.73+zz*.59)*.7
grout=(np.minimum(abs((xx+.56)%.56),abs((xx+.56)%.56-.56))<.009)|(np.minimum(abs((zz+9)%.56),abs((zz+9)%.56-.56))<.009);grain[grout&wc]-=20
ao=np.zeros_like(grain)
for i,r in enumerate(data['WALLS']+list(data['FIXTURES'].values())+data['TOILETS']+data['STALL_PANELS']):
    delta=np.hypot(np.maximum(0,abs(xx-r['x'])-r['w']/2),np.maximum(0,abs(zz-r['z'])-r['d']/2));ao=np.maximum(ao,np.exp(-(delta/.16)**1.4)*.12+np.exp(-(delta/.47)**1.5)*.065)
colors=(colors+grain[:,:,None])*(1-ao[:,:,None]);Image.fromarray(np.uint8(np.clip(colors,0,255))).save(HERE/'clinic-floor.webp',quality=80,method=6)
