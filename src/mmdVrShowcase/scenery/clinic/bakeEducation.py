"""Draw the six original women's-health wall prints; offline, no patient images.
Uses Pillow/numpy; CLINIC_FONT and CLINIC_FONT_BOLD override the system CJK fonts.
Each illustration has its own composition, vectors and labelled structures.
"""
import math, os
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
W,H=640,880
atlas=Image.new('RGB',(3*W,2*H));ink='#243e42';sage='#52877d';rose='#b76f70';slate='#51676c';rule='#b4c2b6';cream='#f4f0df';white='#fffcf1'
@lru_cache(maxsize=96)
def font(sz,b=False):return ImageFont.truetype(os.environ.get('CLINIC_FONT_BOLD' if b else 'CLINIC_FONT','C:/Windows/Fonts/msyhbd.ttc' if b else 'C:/Windows/Fonts/msyh.ttc'),sz)
def text(x,y,s,sz=22,c=ink,b=False):d.text((x,y),s,font=font(sz,b),anchor='lt',fill=c)
def line(points,c=ink,w=3):d.line(points,fill=c,width=w,joint='curve')
def dot(x,y,r,c):d.ellipse((x-r,y-r,x+r,y+r),fill=c)
def cubic(a,b,c,e,n=22):
    return [tuple((1-t)**3*a[i]+3*(1-t)**2*t*b[i]+3*(1-t)*t*t*c[i]+t**3*e[i] for i in range(2))for t in np.linspace(0,1,n)]
def path(a,*curves):
    out=[a]
    for a,b,c in curves:out.extend(cubic(out[-1],a,b,c)[1:])
    return out
def leader(points,label,tx,ty):line(points,slate,2);dot(*points[0],3,slate);text(tx,ty,label,20,ink,True)
def base(i,zh,en,color,bg=cream):
    global im,d
    im=Image.new('RGB',(W,H),bg);d=ImageDraw.Draw(im);d.rectangle((0,0,W,14),fill=color)
    text(33,38,'北区  /  妇产科宣教',19,color,True);text(476,39,'图志   '+str(i+1).zfill(2),18,color,True)
    line([(33,78),(607,78)],color,2);text(28,108,zh,50,ink,True);text(34,183,en,18,color,True)
def foot(i,heading,one,two,color=sage):
    line([(33,698),(608,698)],rule,2);text(32,718,heading,25,color,True);text(33,758,one,21);text(33,790,two,21)
    text(32,846,'NORTH WING  /  WOMEN’S HEALTH',15,slate);text(540,844,'1F  /  '+str(i+1).zfill(2),16,slate)
    atlas.paste(im,(i%3*W,i//3*H))

# 01. Trimesters. Each panel has a section through the uterus, amniotic cavity,
# placenta and a stylised developing form. The drawings are not to one scale.
base(0,'认识妊娠三阶段','PREGNANCY   /   THE THREE TRIMESTERS',rose)
for j,(x,y,r,tag,cap) in enumerate([(131,375,72,'早期','器官开始形成'),(321,393,86,'中期','四肢继续发育'),(508,416,96,'晚期','生长与成熟')]):
    d.ellipse((x-r*.80,y-r,x+r*.80,y+r),fill='#d99d92',outline='#aa706b',width=3)
    d.ellipse((x-r*.68,y-r*.86,x+r*.65,y+r*.86),fill='#e4d5be',outline='#f8e5d0',width=5)
    d.arc((x-r*.65,y-r*.83,x+r*.59,y+r*.78),160,255,fill='#bc7971',width=10)
    if j==0:
        limb=path((x+5,y-17),((x+23,y-12),(x+19,y+15),(x-1,y+16)),((x-10,y+16),(x-16,y+11),(x-14,y+7)));line(limb,'#a66e69',12);dot(x+4,y-18,13,'#c1877a')
    else:
        s=1 if j==1 else 1.26
        def xy(p): return (x+s*p[0],y+s*p[1])
        def curve(a,*cs): return path(xy(a),*[tuple(xy(t) for t in c) for c in cs])
        silhouette=curve((9,-46),((38,-43),(42,-13),(22,-5)),((39,12),(37,37),(15,46)),((-5,54),(-32,40),(-30,18)),((-32,6),(-20,0),(-14,6)),((-9,11),(-2,19),(4,16)),((7,9),(-2,0),(-11,-5)),((-31,-17),(-17,-48),(9,-46)))
        d.polygon(silhouette,fill='#d29b87');line(silhouette,'#aa716b',2)
        line(curve((-4,-11),((0,-4),(13,8),(18,16)),((12,17),(4,10),(2,11))),'#a76f67',3);line(curve((-22,19),((-12,11),(-2,27),(11,30)),((16,30),(20,29),(20,24))),'#a76f67',3)
        line(curve((3,18),((-7,21),(-39,10),(-36,-9)),((-38,-24),(-43,-16),(-43,-27))),'#ad7579',3)
    text(x-47,554,'0'+str(j+1)+'  '+tag,24,ink,True);text(x-59,600,cap,18,slate)
line([(60,518),(580,518)],rose,3)
for x in [131,321,508]:dot(x,518,7,rose)
foot(0,'从胚胎到胎儿','图中依次展示三个阶段的形态变化。','各图并非等比例，实际发育存在个体差异。',rose)

# 02. Outpatient journey. Original line icons, deliberately administrative.
base(1,'产检就诊流程','ANTENATAL CARE   /   A VISIT TO THE CLINIC',sage,'#ecf0e6')
line([(83,277),(83,636)],'#87aca0',5)
for j,(cap,sub) in enumerate([('登记签到','核对个人资料，领取候诊号。'),('候诊等候','留意叫号屏和诊室标识。'),('入室交流','向医护人员介绍本次来访情况。'),('记录归档','保存本次就诊记录和预约信息。')]):
    y=255+103*j;d.rounded_rectangle((112,y,601,y+86),14,fill='#fbfbef');dot(83,y+43,21,sage);text(71,y+31,str(j+1).zfill(2),17,'white',True);x=141
    if j==0:
        d.rounded_rectangle((x,y+20,x+55,y+65),4,outline=sage,width=3);dot(x+15,y+36,6,sage);d.arc((x+5,y+41,x+26,y+59),180,360,fill=sage,width=3);line([(x+31,y+33),(x+47,y+33)],sage,3);line([(x+31,y+44),(x+45,y+44)],sage,3)
    if j==1:
        d.rounded_rectangle((x,y+18,x+56,y+55),4,outline=sage,width=3);text(x+9,y+23,'A1',22,sage,True);line([(x+27,y+56),(x+27,y+65)],sage,3);line([(x+11,y+67),(x+44,y+67)],sage,3)
    if j==2:
        d.rounded_rectangle((x,y+23,x+55,y+55),7,outline=sage,width=3);line([(x+12,y+53),(x+10,y+63),(x+27,y+54)],sage,3)
        for jj in range(3):dot(x+14+jj*13,y+39,3,sage)
    if j==3:
        d.rounded_rectangle((x+6,y+17,x+49,y+65),4,outline=sage,width=3);d.rectangle((x+19,y+16,x+36,y+23),fill=sage)
        for yy in [32,42,52]:line([(x+14,y+yy),(x+39,y+yy)],sage,2)
    text(222,y+8,cap,27,ink,True);text(222,y+51,sub,19,slate)
foot(1,'认识门诊动线','候诊区与诊室之间设有房号和双语标牌。','具体就诊安排以现场工作人员说明为准。')

# 03. Sonography principles. A synthetic sector raster with a layered echo
# model and annulus; the lower graphic explains why depth and brightness vary.
base(2,'超声图像从哪来','ULTRASOUND   /   THE ECHO WINDOW','#3f777c','#eaf0e8')
d.rounded_rectangle((32,242,608,580),16,fill='#172e34'); yy,xx=np.mgrid[0:282,0:420];dx=xx-208;dy=yy+11
r=np.hypot(dx,dy);theta=np.arctan2(dx,dy);rg=np.random.default_rng(1402);mask=(np.abs(theta)<.666)&(r>24)&(r<281)
v=25+12*rg.standard_normal(r.shape)+18*np.sin(r*.145+2*np.sin(theta*6))**2+27*(np.cos(r*.052+theta*2)**12)
dist=((xx-222)/63)**2+((yy-176)/36)**2;v+=53*np.exp(-((dist-1)/.22)**2)-36*np.exp(-(dist/.5)**2);v+=20*np.sin(theta*21+r*.06)*np.sin(r*.08);v=np.clip(v,9,174)
arr=np.zeros((*r.shape,3),np.uint8);arr[:]=[23,46,52]
for k,color in enumerate([.90,1.0,1.03]):arr[:,:,k][mask]=np.clip(v[mask]*color,0,255)
im.paste(Image.fromarray(arr),(77,278));text(52,259,'B-MODE  /  模拟回声',17,'#a3d1c3',True)
for j in range(10):line([(518,289+j*26),(529 if j%2 else 539,289+j*26)],'#a0c4bc',2)
text(484,544,'深度 ↓',16,'#b2d1c6');text(50,602,'探头',22,ink,True);text(255,602,'反射回声',22,ink,True);text(493,602,'灰阶图',22,ink,True)
for x in [133,389]:line([(x,619),(x+71,619),(x+61,613),(x+71,619),(x+61,625)],sage,3)
foot(2,'读图小知识','探头发出声波，也接收组织界面的回声。','这里的扇形图为原理示意，并非检查影像。')

# 04. Paired tubes and ovaries, longitudinal uterine section. Side labels
# use a different routing for each callout, avoiding the structures and text.
base(3,'盆腔器官图谱','PELVIC ANATOMY   /   ANTERIOR VIEW',rose)
for side in [-1,1]:
    def xy(q): return (320+side*q[0],q[1])
    def P(a,*cs):return path(xy(a),*[tuple(xy(t) for t in c)for c in cs])
    lig=P((38,397),((83,371),(148,404),(177,438)),((124,443),(78,451),(45,476)),((38,464),(49,422),(38,397)));d.polygon(lig,fill='#dfb7a8')
    shape=P((-1,343),((24,338),(52,342),(72,366)),((77,405),(49,443),(29,476)),((20,501),(20,536),(22,551)),((25,565),(12,573),(-1,572)));d.polygon(shape,fill='#cc8985');line(shape[:-3],'#ac7072',3)
    inner=P((-1,368),((16,367),(36,367),(53,378)),((36,396),(22,416),(10,454)),((5,481),(7,522),(9,545)),((6,553),(2,558),(-1,559)));d.polygon(inner,fill='#eeccac')
    tube=P((58,373),((87,366),(104,325),(146,331)),((178,337),(177,371),(161,382)));line(tube,'#ad7070',11);line(tube,'#df9690',5)
    for j in range(6):line(P((163+j*.5,381-j),((157+j*4,389+j),(152+j*5,396),(144+j*6,399+j%2*6))),'#bd827b',3)
    x,y=xy((145,411));d.ellipse((x-28,y-19,x+28,y+19),fill='#e6b58e',outline='#b68b77',width=3)
    for u,v in [(-12,3),(0,-6),(11,4)]:d.ellipse((x+u-4,y+v-4,x+u+4,y+v+4),fill='#f3d7b0')
leader([(211,348),(174,295),(84,295)],'输卵管',62,258);leader([(177,414),(144,455),(56,455)],'卵巢',58,470)
leader([(345,399),(421,290),(533,290)],'子宫腔',466,253);leader([(344,535),(421,564),(529,564)],'宫颈',477,578)
text(38,624,'正面剖视',22,rose,True);text(157,626,'左右成对的卵巢与输卵管分列子宫两侧。',20,slate)
foot(3,'示意图如何阅读','暖红色代表肌层，浅色内区示意宫腔。','结构位置和相对尺寸经过简化。',rose)

# 05. Placental chorionic surface and coiled cord. Branches taper radially
# toward the edge of a lobulated disc, using a seeded tree for repeatability.
base(4,'胎盘与脐带','MATERNAL–FETAL INTERFACE   /   PLACENTA',rose,'#f4eadd')
cx,cy=303,446;points=[]
for a in np.linspace(0,2*math.pi,180):
    n=1+.028*math.sin(7*a)+.017*math.sin(13*a+.8);points.append((cx+143*n*math.cos(a),cy+121*n*math.sin(a)))
d.polygon(points,fill='#bb7778');line(points+[points[0]],'#99626a',4);rng=np.random.default_rng(711)
for j in range(135):
    a=rng.uniform(0,2*math.pi);rr=math.sqrt(rng.random());x=cx+127*rr*math.cos(a);y=cy+106*rr*math.sin(a);s=rng.uniform(2,8);d.ellipse((x-s,y-s*.55,x+s,y+s*.55),fill='#c68680')
for j in range(17):
    a=j*2*math.pi/17+.09*math.sin(j);x=cx-22;y=cy+5;last=(x,y);c=['#966670','#dfaa93','#839598'][j%3]
    for k in range(1,6):
        q=k/6;r=1.12*q;xx=cx+r*141*math.cos(a)+(1-q)*(-22);yy=cy+r*119*math.sin(a)+math.sin(a*2+k)*5
        line([last,(xx,yy)],c,6-k);tilt=a+(.49 if k%2 else -.40);line([(xx,yy),(xx+19*math.cos(tilt),yy+17*math.sin(tilt))],c,2);last=(xx,yy)
cord=path((282,451),((265,429),(232,397),(250,352)),((269,302),(328,299),(326,248)));line(cord,'#a38b80',16);line(cord,'#dec2a6',10)
for k in range(3,len(cord)-3,4):x,y=cord[k];line([(x-4,y-2),(x+4,y+3)],'#ab8b88',3)
leader([(254,345),(179,293),(77,293)],'脐带',72,257);leader([(398,406),(448,356),(553,356)],'绒毛膜板',469,320);leader([(351,475),(411,587),(540,587)],'表面血管',448,602)
foot(4,'胎儿面示意','脐带连接胎儿与胎盘，可见分支的血管。','胎盘是母体和胎儿之间物质交换的场所。',rose)

# 06. Hand hygiene as a facility guide, not a clinical protocol.
base(5,'认识手卫生设施','HAND HYGIENE   /   THE WASH STATION',sage,'#e9efe5')
d.rounded_rectangle((35,242,604,618),22,fill='#d4e1d4');line([(75,534),(563,534)],'#a6c0b4',4)
# Profile of the curved basin, faucet and metered pump.
bowl=path((143,473),((161,538),(197,556),(292,556)),((362,556),(409,533),(435,473)),((349,487),(233,490),(143,473)));d.polygon(bowl,fill='#f5f6ec');line(bowl,'#6a9791',5)
line(path((208,473),((207,440),(195,350),(228,340)),((268,333),(285,354),(285,379))),'#608e89',15);line([(193,437),(223,419)],'#608e89',8)
for j in range(3):
    x=276+9*j;line([(x,393),(x-2,408)],'#77abb0',3);line([(x-2,417),(x-6,440)],'#77abb0',2)
d.rounded_rectangle((397,403,440,470),7,fill='#7fa79a');d.rectangle((409,392,427,406),fill=cream);line([(418,391),(418,377),(442,377)],'#658e86',6)
leader([(207,389),(160,330),(86,330)],'水龙头',73,293);leader([(418,404),(473,318),(552,318)],'皂液器',468,278)
text(53,643,'清洁设施',23,sage,True);text(185,644,'洗手盆、皂液器与干手用品。',22,ink)
foot(5,'公共洗手区','水龙头设于洗手盆后方，皂液器位于台面。','请为其他使用者留出通行空间。')
atlas.save(HERE/'clinic-education.webp',quality=93,method=6)
