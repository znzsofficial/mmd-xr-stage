"""Draw original Chinese teaching plates, exhibit captions and hygiene packaging.

Offline: Python, Pillow, a CJK font. Sources for the copy: see
docs/scenery/clinic-teaching.md. No third-party image is sampled.
"""
import json, os
from pathlib import Path
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

CLINIC = Path(__file__).resolve().parents[1] / 'src/mmdVrShowcase/scenery/clinic'
layout = json.loads((CLINIC / 'teachingPrints.json').read_text(encoding='utf-8'))
atlas = Image.new('RGB', layout['size'], '#f5efdf')
ink, paper, teal, rust, slate = '#153a3a', '#fcf7e8', '#276c65', '#983f4d', '#38595b'
bladder, uterus, rectum, bone = '#609faf', '#c46a76', '#ac825c', '#dfca91'

@lru_cache(None)
def font(size, bold=False):
    file = os.environ.get('CLINIC_FONT_BOLD' if bold else 'CLINIC_FONT',
                          'C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc')
    return ImageFont.truetype(file, size)

def start(key, bg=paper):
    global image, d, region
    region = layout['regions'][key]
    image = Image.new('RGB', tuple(region[2:]), bg); d = ImageDraw.Draw(image)

def finish(): atlas.paste(image, tuple(region[:2]))
def txt(x,y,s,size=22,color=ink,bold=False): d.text((x,y), s, font=font(size,bold), fill=color, anchor='lt')
def line(points,color=ink,w=3): d.line(points,fill=color,width=w,joint='curve')
def curve(a,*segments):
    pts=[a]
    for b,c,e in segments:
        for j in range(1,25):
            t=j/24; pts.append(tuple((1-t)**3*a[i]+3*t*(1-t)**2*b[i]+3*t*t*(1-t)*c[i]+t**3*e[i] for i in range(2)))
        a=e
    return pts

def lobe(color,a,*segments): d.polygon(curve(a,*segments),fill=color)
def head(n,en,zh,tint):
    d.rectangle((0,0,511,10),fill=tint);txt(24,30,'北区  /  妇产科',17,tint,True);txt(411,30,n,17,tint,True)
    line([(24,63),(488,63)],tint,2);txt(21,84,zh,45,ink,True);txt(24,151,en,17,tint,True)

start('pelvisPlate');head('图 07','ANATOMY   /   MEDIAN SECTION','骨盆正中矢状面',rust)
# Sagittal profile, anterior at left. The uterus curves forward over the
# bladder. Separate outlets; pubic symphysis anterior, sacrum posterior.
lobe('#efdfc9',(144,204),((144,241),(112,272),(127,321)),((133,359),(153,423),(202,441)),((249,456),(338,454),(371,414)),((412,348),(361,287),(378,204)),((308,211),(213,219),(144,204)))
lobe(bone,(342,208),((378,202),(365,246),(356,272)),((348,301),(335,318),(319,329)),((326,301),(334,275),(334,256)),((338,234),(342,220),(342,208)))
lobe(rectum,(306,227),((329,239),(337,268),(321,291)),((309,318),(289,330),(301,352)),((321,385),(286,403),(285,438)),((274,443),(263,441),(264,433)),((263,400),(287,380),(276,357)),((253,320),(299,288),(302,265)),((306,249),(282,243),(292,226)))
lobe('#ac6277',(231,325),((246,311),(267,309),(262,335)),((254,372),(237,407),(230,439)),((220,440),(209,439),(209,435)),((213,398),(231,352),(231,325)))
lobe(uterus,(173,272),((173,252),(194,243),(210,246)),((248,250),(268,279),(259,314)),((256,328),(252,340),(247,348)),((234,356),(222,342),(227,332)),((235,309),(220,299),(199,296)),((183,293),(170,289),(173,272)))
line(curve((190,268),((225,265),(253,293),(242,335))),'#f2c9af',5)
lobe(bladder,(162,328),((167,302),(196,302),(215,310)),((232,321),(225,344),(208,356)),((198,365),(187,362),(190,379)),((191,403),(195,423),(195,433)),((185,437),(183,433),(183,427)),((177,395),(180,378),(173,365)),((161,355),(157,339),(162,328)))
lobe(bone,(147,348),((156,346),(163,356),(163,366)),((162,385),(149,388),(142,378)),((133,365),(133,349),(147,348)))
for label,a,b,x,y in [('子宫',(198,276),(133,246),37,224),('膀胱',(182,326),(121,313),34,290),('直肠',(310,287),(382,275),405,254),('阴道',(233,378),(355,399),406,383)]:
    line([a,b,(x+20 if x<100 else x-4,b[1])],slate,2);d.ellipse((a[0]-3,a[1]-3,a[0]+3,a[1]+3),fill=slate);txt(x,y,label,24,ink,True)
txt(49,454,'前方',20,teal,True);txt(407,454,'后方',20,teal,True)
line([(24,495),(488,495)],'#b6bdb2',2);txt(24,517,'从前向后看',28,rust,True)
txt(24,563,'膀胱在前，直肠在后。',25);txt(24,604,'阴道在两者之间，上接宫颈。',25)
txt(24,667,'资料：美国国家癌症研究所 NCI / SEER',17,slate);finish()

start('postpartumPlate','#f1f4e8');head('图 08','POSTPARTUM   /   CARE & SUPPORT','产后也要照顾自己',teal)
for y,n,title,body in [(199,'01','记下身体的变化','出血、疼痛、排尿或喂养有困扰，'),(343,'02','也谈谈心情','把持续的低落或焦虑告诉医护人员。')]:
    d.ellipse((24,y,73,y+49),fill=teal);txt(34,y+13,n,20,paper,True);txt(87,y+6,title,31,ink,True)
    txt(26,y+63,body,24);line([(24,y+126),(488,y+126)],'#b6c6b5',2)
txt(26,291,'可在产后随访时与医护人员讨论。',24)
d.rounded_rectangle((22,496,490,638),radius=13,fill='#f1dcd1');txt(39,512,'这些情况要立即就医',29,rust,True)
txt(39,561,'胸痛、呼吸困难或大量出血',24);txt(39,597,'（如一小时浸透一片或更多卫生巾）。',22)
txt(24,670,'资料：英国 NHS 产后复查；美国 CDC Hear Her',17,slate);finish()

for i,(key,title,en) in enumerate([('pelvisBase','盆腔矢状剖面','SAGITTAL PELVIS'),('uterusBase','子宫与附件','UTERUS & ADNEXA'),('pregnancyBase','胎儿与胎盘','FETUS & PLACENTA')]):
    start(key,ink);d.rectangle((0,0,74,89),fill='#b6cebd');txt(13,24,'0'+str(i+1),37,ink,True);txt(92,7,title,39,paper,True);txt(95,59,en,19,'#bfd8c8',True);finish()
start('supplyHeader',teal);txt(18,12,'卫生用品',45,paper,True);txt(19,68,'PERSONAL CARE',17,'#d0e5d6',True);txt(365,32,'自助取用',27,paper,True);finish()
start('binLabel');txt(16,23,'卫生废弃物',55,ink,True);line([(18,100),(428,100)],teal,3);txt(18,123,'请勿投入马桶',33,teal,True);finish()
start('instrumentLabel',ink);txt(18,14,'妇产科器械盘',47,paper,True);txt(19,83,'GYNAECOLOGY  /  INSTRUMENTS',20,'#c6dfcb',True);finish()

for key,title,en,tint in [('testPack','验孕试纸','hCG  /  TEST STRIPS','#37798d'),('padPack','卫生巾','WINGED PAD','#a15066'),('briefPack','一次性内裤','DISPOSABLE BRIEF','#536b93')]:
    start(key);w,h=image.size;d.rectangle((0,0,w,h*.10),fill=tint);txt(12,h*.15,title,38,tint,True);txt(14,h*.39,en,16,slate,True)
    if key=='testPack':
        d.rectangle((34,140,318,164),fill='#f7f7ee',outline=tint,width=3);d.rectangle((237,141,317,163),fill=tint)
        for x in (178,190):d.line((x,143,x,161),fill='#b16778',width=3)
    elif key=='padPack':
        d.polygon([(120,151),(143,161),(166,151),(199,163),(192,181),(162,179),(143,184),(120,179),(92,181),(83,164)],fill='#eabac6')
        d.rounded_rectangle((114,128,169,223),26,fill='#f8e5e2',outline=tint,width=3);d.rounded_rectangle((123,140,160,211),15,outline='#c48291',width=2)
    else:
        pts=[(66,139),(223,139),(211,177),(190,180),(159,211),(132,211),(101,181),(78,176)];d.polygon(pts,fill='#dce3ef');line(pts+[pts[0]],tint,4);line([(69,151),(219,151)],tint,4)
    finish()
start('inventory');txt(19,16,'器械识别',39,ink,True);txt(331,28,'THEATRE   /   02',21,teal,True);line([(18,71),(563,71)],teal,3)
for i,(zh,en) in enumerate([('产钳','OBSTETRIC FORCEPS'),('窥器','SPECULUM'),('卵圆钳','SPONGE FORCEPS'),('手术剪','SCISSORS')]):
    x=20+(i%2)*282;y=90+(i//2)*105;txt(x,y,str(i+1).zfill(2),29,rust,True);txt(x+56,y,zh,31,ink,True);txt(x+1,y+47,en,18,slate,True)
finish()
atlas.save(CLINIC/'clinic-teaching.webp', quality=94,method=6)
