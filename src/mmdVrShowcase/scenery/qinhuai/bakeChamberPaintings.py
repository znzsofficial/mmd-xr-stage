"""Repaint the four original silk/paper rectangles. python bakeChamberPaintings.py

PyMuPDF rasterises these hand-authored ink paths; Pillow adds the silk tooth,
eight-pixel colour bleed and the final WebP. No fonts, reference images or network.
Drawing space is 360 × 240. Colours are pigments, not the room's illumination.
"""
from pathlib import Path
from math import sin, cos, pi
from random import Random
import pymupdf
from PIL import Image, ImageOps

ink='#4c3835'; hair='#332f33'; light='#f5d4b4'; gold='#e0b16e'; brown='#d7a786'; rose='#ad655d'
ivory='#ead7af'; blue='#4c7274'; teal='#76918b'; wine='#9a5257'; cinnabar='#af4e41'
def p(d, fill='none', line=ink, w=1.05):
    return f'<path d="{d}" fill="{fill}" stroke="{line}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"/>'
def b(d,col): return p(d,col,'none')
def pen(d,col=ink,w=.8): return p(d,'none',col,w)
def oval(x,y,rx,ry,col,line='none',w=.8):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{col}" stroke="{line}" stroke-width="{w}"/>'
def g(items,tr):return f'<g transform="{tr}">{items}</g>'
def face(x,y,angle,side=1,style='pin',skin=light,scale=1):
    # A turned three-quarter face. Keep the bridge, eyelids and chin in
    # silhouette, and reserve the darkest ink for the swept hair and pupil.
    f=p('M-8 3 Q-13 0 -12 -7 Q-12 -18 0 -18 Q10 -18 12 -10 L13 -4 Q13 -1 16 2 L13 4 Q14 6 12 7 Q14 10 9 13 Q6 17 2 16 L1 22 Q-3 24 -9 20 L-6 9Z',skin)
    f+=b('M-7 8 Q-3 14 5 15 L2 17 L1 22 Q-4 22 -7 19Z','#c9927c')
    f+=p('M-8 8 Q-12 6 -12 2 Q-12 -2 -9 -1 Q-7 -1 -6 3',skin,ink,.8)+pen('M-10 1 Q-8 1 -9 5','#af736b',.65)
    f+=p('M-8 1 Q-6 -4 -7 -9 Q0 -6 6 -13 Q10 -13 12 -7 Q15 -13 9 -18 Q2 -23 -7 -19 Q-17 -17 -17 -7 Q-17 4 -10 10 Q-8 8 -8 5Z',hair)
    f+=pen('M-14 -4 Q-16 -14 -7 -16 M-11 -7 Q-10 -13 -4 -16 M-6 -11 Q1 -11 6 -16','#796862',.65)
    f+=p('M1 -4 Q4 -7 10 -6 Q7 -6 3 -4Z',ink,ink,.35)+pen('M1 -1 Q5 .7 9 -2 M11 -1 L12 0 M11 4 L13 3',ink,.8)
    f+=pen('M3 .8 Q6 1.8 8 .3 M11 5 L10.1 5.2','#b77f70',.48)+oval(7,-.8,.8,.53,ink)
    f+=pen('M9 7 Q11 6 13 6 M10 8 L12 8',cinnabar,.7)
    if style=='scholar':
        f+=p('M-10 -17 C-18 -17 -19 -23 -14 -25 Q-8 -28 -4 -23 Q-2 -19 -5 -17Z',hair)
        f+=pen('M-16 -18 L-2 -22',gold,1.8)+pen('M-12 9 Q-10 13 -10 14 M8 13 L5 16',hair,.75)
        f+=p('M9 5.7 Q10.3 4.4 12.3 5.1 L13 5.8 Q11.7 5.1 10 6.1Z',hair,'none')
    else:
        f+=p('M-14 -11 C-24 -14 -22 -23 -15 -24 C-14 -33 -2 -30 -1 -23 C3 -22 4 -18 2 -17 Q-5 -13 -14 -11Z',hair)
        f+=pen('M-17 -17 Q-20 -23 -13 -22 Q-13 -28 -8 -27 M-11 -18 Q-13 -23 -8 -24','#806d67',.8)
        f+=pen('M-22 -18 L-1 -24',gold,1.15)+oval(-21,-18,2,1.5,gold,ink,.5)
        if style=='peony':
            for a in range(5): f+=oval(-13+2*cos(a*1.256),-18+2*sin(a*1.256),2.4,1.6,'#c47c77')
            f+=oval(-13,-18,1.4,1.2,gold)
        f+=pen('M-10 7 L-11 14',gold,.85)+oval(-11,14,1.2,2.2,'#dfb377',ink,.45)
    return g(f,f'translate({x} {y}) rotate({angle}) scale({side*scale} {scale})')

def branch(x,y,k,angle=0):
    s=pen('M0 0 C19 -8 28 -21 38 -32 S59 -43 74 -62 M18 -11 Q34 -14 45 -22 M40 -34 Q44 -52 50 -58 M52 -45 Q74 -42 82 -48','#665b4c',2)
    for a,b_,r in [(28,-18,25),(38,-31,-4),(46,-22,0),(48,-51,-10),(62,-50,22),(73,-60,15),(77,-46,18)]:
        s+=g(p('M0 0 Q0 -6 5 -8 Q6 -2 0 0Z','#718980','#576d65',.55),f'translate({a} {b_}) rotate({r})')
        for j in range(5):s+=oval(a+2.45*cos(j*1.257),b_+2.45*sin(j*1.257),2.1,1.8,'#d99c92','#ad756f',.36)
        s+=oval(a,b_,1.1,1,gold)
    return g(s,f'translate({x} {y}) rotate({angle}) scale({k})')

def window(x,y,r):
    s=oval(x,y,r,r,'#b6b7a0','#a18f74',2)+oval(x,y,r-3,r-3,'#d6cba8','#aa9a7e')
    s+=b(f'M{x-r+4} {y+6} q12 -2 19 -9 q6 -6 12 0 q13 -15 18 -12 q7 2 12 11 q8 3 14 9 q-8 23 -31 25 q-29 4 -44 -24Z','#95a398') if r>=40 else ''
    s+=oval(x+r*.29,y-r*.42,r*.16,r*.16,'#f1dfb0')
    return s
def seal(x,y):
    return g(p('M0 0 H10 V12 H0Z',cinnabar,'#b27463',.7)+pen('M2 2 H8 V5 H5 V10 M2 5 H4 M2 7 V10 M7 7 H8 V10','#f1c4a2',.65),f'translate({x} {y})')
def stitches():
    return pen('M180 7 Q178.8 58 180 115 T180 233','#a89177',1.55)+pen('M181.3 9 Q180.5 59 181.6 116 T181.4 229','#f2ddba',.75)
def drape(x,y,sx,sy,col,fold):
    s=p('M0 0 H66 Q64 21 46 41 Q28 58 20 71 Q18 76 24 93 L32 129 Q27 135 23 129 Q18 143 14 138 Q11 146 7 140 L0 144Z',col)
    s+=pen('M5 0 C18 31 16 43 18 65 M19 0 Q36 27 19 67 M39 0 Q53 22 21 67 M58 0 Q56 28 25 58 M15 80 Q9 104 11 134 M18 80 Q17 112 24 128',fold,1.2)
    s+=pen('M10 73 Q17 70 23 74 M10 76 Q18 72 24 76 M22 76 Q32 82 28 97',gold,1.55)+b('M28 96 l3 8 -6 0Z',gold)
    for x0,y0 in [(10,10),(23,19),(40,12),(12,31),(26,43),(12,53),(8,103),(12,119)]:
        s+=g(p('M-3 1 Q-3 -2 0 -1 Q-2 -5 0 -5 Q3 -4 2 -1 Q6 -3 5 0 Q5 2 1 2 Q0 4 -2 4 Q-3 4 -2 2Z',fold,'none'),f'translate({x0} {y0}) scale(.75)')
    return g(s,f'translate({x} {y}) scale({sx} {sy})')
def quilt(col,fold):
    s=p('M10 150 Q57 137 111 144 Q184 134 233 145 L349 151 L350 220 Q316 217 292 222 Q223 211 183 222 Q106 211 66 221 L10 215Z',col)
    s+=pen('M12 197 Q58 203 85 196 T157 199 Q208 204 254 197 T347 201 M12 202 Q51 208 86 201 T157 204 Q212 209 256 202 T347 207',fold,1.45)
    s+=pen('M18 212 Q32 201 52 207 T85 209 M105 213 Q125 208 141 212 M205 213 Q228 206 248 210 M298 211 Q317 207 344 213',fold,.7)
    for j in range(2):
        for i in range(15):
            x=16+i*23+(j%2)*7;y=176+j*13+sin(i*.8)*2
            s+=pen(f'M{x} {y} q3 -4 7 -5 q-1 4 -7 5 q5 -1 9 2 q-7 1 -9 -2',fold,.76)
    return s

def bed_scene():
    """Silk: reclining adult woman and her bare-chested, kneeling lover.
    The faces and their joined hands sit on either side of the left hinge.
    """
    s=window(73,64,40)+branch(242,89,.94,-10)+quilt(teal,'#bdc5a6')+drape(0,0,1.12,.93,wine,'#c88b7c')
    s+=drape(360,0,-.87,.86,'#cf9d86','#ad766a')
    # Cushion behind the reclining neck and the unfurled cinnabar outer robe.
    s+=p('M34 139 Q39 124 53 124 L101 137 Q110 143 103 157 L58 161 Q40 160 34 152Z','#af855f')
    s+=p('M42 136 Q51 125 59 131 L99 143 L94 153 L53 154 Q40 151 42 136Z','#dbb582')
    s+=p('M51 145 C76 142 87 127 115 134 Q154 144 177 134 Q227 117 249 135 Q261 155 287 165 L324 182 Q299 189 267 180 Q230 173 207 184 Q192 196 159 182 Q131 168 97 169 Q61 171 33 181 Q47 163 51 145Z','#b86560')
    s+=pen('M38 176 Q81 148 110 154 Q141 154 166 170 M197 178 Q228 157 257 171 L291 180 M52 163 Q78 151 97 153','#e1ae8d',2)
    # His far knee, raised heel and lean forward. Indigo robe has slipped from
    # his shoulders: one cuff pools on the mattress behind the bare flank.
    s+=p('M222 127 Q251 127 261 144 Q269 156 285 161 Q306 165 311 171 Q309 177 298 175 L276 172 Q249 169 234 157 L208 149Z',brown)
    s+=p('M195 60 Q205 58 216 66 Q238 80 238 99 Q236 110 249 123 Q266 139 251 151 Q239 160 220 150 Q201 136 195 125 Q191 111 188 100 Q178 94 179 82 Q180 69 195 60Z',brown)
    s+=b('M215 73 Q239 91 231 108 Q228 115 240 128 Q231 124 225 114 Q223 93 212 86Z','#bd8c75')
    s+=pen('M204 77 Q211 77 216 84 M200 91 Q206 95 214 91 M204 99 Q206 107 209 111 M212 119 Q216 123 221 122','#956d5e',.78)+oval(213,89.5,1.8,1.05,'#94685b')
    s+=p('M231 106 Q251 111 255 119 L280 132 Q294 144 310 139 Q306 158 335 166 Q308 176 290 163 Q262 145 248 144 Q237 133 231 106Z',blue)
    s+=pen('M249 119 Q266 143 293 147 M261 125 Q276 141 304 140 M279 146 Q299 166 324 166','#9eafa1',1.3)
    s+=face(190,60,-32,-1,'scholar',brown)
    # Reclining woman's far thigh is lifted over the lover's hip. Distinct
    # knee, heel and folded instep, with the overlapping near leg painted later.
    s+=p('M169 150 Q183 134 202 128 Q222 125 242 103 Q246 97 247 89 Q247 85 250 86 Q252 89 251 93 Q256 86 259 87 Q263 89 259 94 Q265 91 265 95 Q264 100 258 106 Q241 128 221 143 Q205 153 181 164Z',light)
    s+=pen('M246 106 Q250 102 251 98 M256 96 Q261 92 261 90','#aa7b69',.72)
    s+=p('M86 117 Q96 108 109 111 Q122 110 131 117 Q137 123 145 124 Q154 126 152 133 Q166 140 181 134 Q194 128 201 138 Q211 151 195 161 Q184 169 161 164 Q141 160 126 158 Q107 157 94 147 Q84 140 86 117Z',light)
    s+=b('M100 144 Q116 152 132 151 Q151 151 161 156 Q177 162 191 158 Q179 170 158 162 Q139 155 125 157 Q109 155 100 144Z','#d8a489')
    s+=pen('M130 120 Q136 124 133 130 Q129 135 123 133 M144 126 Q151 126 151 132 Q149 137 145 137 M158 145 Q165 147 170 146','#94695d',.9)
    s+=oval(130,125,2.4,1.8,'#bc8276')+oval(131,125,1,1,'#9e675f')+oval(149,130,2,1.55,'#bc8276')
    s+=face(95,108,-56,1,'peony',light,1.03)
    s+=p('M203 122 Q204 131 197 137 L187 144 Q183 144 183 141 Q183 137 187 135 Q192 131 195 123',brown,'#8d6255',.8)
    s+=pen('M185 141 Q187 138 190 137 M194 131 L198 125','#a57868',.55)
    s+=p('M190 138 Q201 128 217 121 Q229 111 241 115 Q254 119 260 139 Q265 155 279 161 L294 164 Q302 164 304 169 Q302 174 289 171 L271 168 Q255 166 246 149 L237 136 Q222 147 203 159 Q190 168 179 160',light)
    s+=pen('M235 128 Q242 126 245 133 M267 163 Q273 160 276 160 M289 166 L298 168 M199 152 Q208 147 215 144','#ae806c',.9)
    # Her wrist rounds his nape; his hand supports her near shoulder.
    s+=p('M103 116 Q111 111 119 111 L143 102 Q151 99 155 91 L172 77 Q175 73 179 74 Q185 76 189 73 Q193 72 191 75 Q188 79 184 79 Q189 78 189 80 Q187 83 180 83 L163 101 Q156 111 148 114 L123 126 Q111 131 104 125',light)
    s+=p('M198 76 Q205 84 197 94 Q181 110 167 113 Q151 116 135 118 L122 126 Q117 128 118 125 L124 119 Q114 124 112 121 Q115 114 127 111 L159 102 L181 80',brown)
    s+=pen('M117 119 L126 115 M121 122 L130 117 M177 79 Q182 81 186 78',ink,.65)
    s+=seal(327,31)
    return s

def lap_scene():
    # Twin upright silhouettes: the seated scholar and a woman astride his
    # lap, her far forearm going behind his neck, her nearer knee in front.
    s=p('M18 15 H111 V103 H18Z','#a69274','#8b765f',1)+p('M22 19 H107 V99 H22Z','#e5d5b4','#b5a07c',.75)+branch(28,95,.91,-5)
    s+=pen('M246 13 V71 M242 72 Q246 65 250 72',ink,1)+p('M230 74 Q245 65 261 74 L263 98 Q248 110 228 99Z','#c89373')+pen('M234 74 Q230 86 233 100 M244 71 Q241 88 243 103 M252 72 Q256 87 252 102','#edc793',1)+pen('M230 74 H260 M229 99 Q249 106 261 98 M245 104 L245 116',ink,1.1)
    s+=quilt('#b78275','#e1b998')+drape(360,0,-.74,.79,blue,'#90a89c')
    s+=p('M51 178 Q73 153 109 146 Q152 135 170 151 Q203 153 240 168 Q278 175 300 194 Q269 196 248 187 Q205 177 187 192 Q162 209 127 192 Q99 180 72 192 L41 195Z',blue)
    s+=pen('M53 188 Q86 166 121 168 Q147 171 163 183 M188 182 Q222 162 254 181 M193 188 Q217 175 244 180','#a4b4a5',1.4)
    s+=p('M135 68 Q120 69 115 86 Q108 106 115 124 Q119 136 108 149 Q94 164 111 173 Q133 184 153 170 Q165 165 181 174 Q200 186 224 182 L257 177 Q272 174 269 169 Q265 163 250 168 Q226 174 214 163 Q193 142 159 143 Q153 131 157 115 Q164 95 156 83 Q150 72 142 70Z',brown)
    s+=b('M120 90 Q115 113 125 125 Q128 137 116 154 Q135 142 139 132 Q137 118 129 112Z','#bd8b72')
    s+=pen('M147 86 Q159 93 154 100 M133 125 Q138 132 135 138 M246 171 Q251 171 256 170','#a27866')
    s+=p('M193 91 Q182 94 173 82 L160 70 Q154 65 145 68 L137 73 Q132 75 132 72 L140 64 Q148 59 155 60 Q162 59 170 66 L188 78Z',light)
    s+=face(145,61,8,1,'scholar',brown)
    s+=pen('M150 88 Q149 92 145 94 M140 106 Q137 117 142 120','#996c5d',.8)+oval(145,94,1.8,1.15,'#9d6e5e')
    s+=p('M192 81 Q204 80 214 91 Q223 102 223 120 Q222 133 233 140 Q246 151 238 165 Q229 179 213 173 Q198 169 189 158 Q184 151 178 148 Q173 140 180 133 Q187 123 181 116 Q168 116 168 108 Q169 102 177 98 Q178 90 192 81Z',light)
    s+=b('M211 101 Q221 115 214 129 Q211 143 225 149 Q230 154 225 164 Q237 160 235 151 Q223 138 220 131 Q226 113 211 101Z','#d7a487')
    s+=pen('M177 101 Q181 107 177 113 Q174 116 170 114 M188 117 Q192 119 196 116 M192 132 Q193 137 189 140','#a37363')+oval(169.5,108,2.2,1.6,'#ba7b6e')
    s+=face(192,74,-18,-1,'pin',light)
    # The gap above the bent near thigh exposes the joining contours at the
    # pelvis. The seated figure's pubis is on the left; her weight is on his lap.
    s+=p('M145 147 Q153 145 160 148 Q170 145 178 140 Q181 138 185 139 L187 142 Q185 145 181 146 L162 157 Q160 163 155 164 Q148 164 148 158 L144 157',brown,'#916253',.9)
    s+=b('M159 153 Q172 149 182 142 Q174 149 161 156 Q157 160 156 161Z','#bd8776')
    s+=pen('M177 142 Q179 142 181 146 M148 147 l2 -2 m0 3 2 -2 m0 3 2 -1 M183 138 Q186 135 187 135','#916253',.67)
    s+=p('M227 147 Q239 158 227 168 Q213 176 198 177 L171 184 Q156 191 141 188 Q125 185 119 177 L107 162 Q102 154 104 150 Q107 144 111 151 L119 158 Q128 163 133 170 Q151 171 168 161 Q186 149 205 143',light)
    s+=pen('M124 172 Q129 174 133 171 M143 181 Q155 180 163 176 M106 152 L110 157','#a67765')
    s+=p('M116 87 Q108 101 113 115 Q117 124 129 127 L165 137 Q174 145 184 147 L188 146 L182 140 Q193 147 194 143 Q188 133 174 130 L134 114 Q126 107 130 95',brown)
    s+=p('M202 95 Q212 100 207 108 Q204 115 192 115 Q176 113 166 100 L152 85 Q145 83 141 77 Q139 74 142 74 L149 78 Q143 71 146 70 Q154 72 159 78 L177 92 Q187 100 195 102',light)
    s+=pen('M146 74 L153 80 M147 79 L152 82 M179 138 L188 143','#966859')
    s+=p('M223 121 Q230 125 229 130 L234 140 Q250 149 262 149 Q280 153 299 151 L285 165 Q257 165 240 156 Q226 151 220 138Z','#bd8c69')
    s+=pen('M227 134 Q243 152 278 155 M230 139 Q248 158 279 160','#ecd2a0',1.1)+seal(118,22)
    return s

def bath_scene():
    # Behind the bather, an adult companion lifts her loose hair; the brass
    # rim crosses the figures. A steep asymmetry and a cropped bath replace
    # the low bed and its horizontal textile pattern from the other leaves.
    s=window(98,70,41)+branch(263,83,.87,5)+drape(0,0,.75,.78,blue,'#9eb3a0')
    s+=p('M0 160 Q90 146 180 158 Q280 168 360 139 L360 240 H0Z','#ad9e85','#a19279')
    s+=p('M213 81 Q231 80 237 95 Q244 113 260 126 Q269 142 260 162 L252 182 L226 186 L203 151 Q198 137 203 124 Q205 116 199 111 Q194 108 195 101 Q197 91 210 85Z',brown)
    s+=p('M227 98 Q235 104 243 119 Q257 126 275 139 Q291 149 303 172 Q289 189 291 211 Q273 222 243 217 Q231 206 209 213 Q204 191 203 173 Q200 159 191 141 Q206 137 215 123Z',wine)
    s+=p('M223 97 Q225 102 233 111 Q229 127 217 139 L209 143 L203 140 Q217 121 223 97Z','#d9b68e')
    s+=pen('M237 125 Q239 149 259 164 Q276 181 280 200 M229 145 Q231 167 243 178 M215 160 Q225 179 222 198 M244 153 Q267 166 276 181','#ca8a79',1.4)
    s+=face(210,78,-26,-1,'peony',brown)
    # Back and shoulder blade of seated nude, one knee breaking the water.
    s+=oval(136,170,91,24,'#a7815e',ink,1.4)+oval(136,167,86,18,'#7a9991','#ceb088',2)
    s+=p('M135 97 Q147 98 158 105 Q171 111 171 124 Q169 136 180 147 Q196 159 185 169 Q176 178 153 174 L124 171 Q110 166 117 150 Q124 138 118 130 Q107 129 109 122 Q109 117 116 113 Q119 103 135 97Z',light)
    s+=b('M157 110 Q169 120 162 133 Q160 140 176 153 Q180 158 176 164 Q185 163 186 157 Q172 143 170 133 Q173 117 157 110Z','#d5a489')
    s+=pen('M140 110 Q151 110 153 121 M136 121 Q142 129 139 138 M144 150 Q155 152 160 160 M112 121 Q117 118 120 122','#ac7d69')+oval(110.5,124,1.75,1.45,'#b98073')
    s+=face(130,91,-12,-1,'pin',light)
    s+=p('M141 75 C157 75 158 87 156 94 Q155 104 162 108 Q177 116 178 130 Q170 124 166 125 Q156 128 150 117 Q159 121 155 111 Q140 101 145 91Z',hair)
    s+=pen('M151 84 Q158 92 151 99 Q152 105 162 112 Q169 116 171 122','#73625c')
    s+=p('M128 112 Q133 117 128 126 Q119 140 116 149 L102 154 L84 147 Q75 147 71 143 Q68 138 72 139 L80 141 Q76 136 79 136 Q85 136 90 141 L101 143 L112 119',light)
    s+=p('M124 165 Q112 161 103 151 Q94 143 88 146 Q76 150 74 167 Q88 170 104 172Z',light)
    s+=p('M215 94 Q222 101 215 111 Q207 122 194 119 L169 109 Q163 109 158 105 Q153 100 156 99 L164 102 Q159 96 162 95 Q169 98 174 101 L192 108 L202 97',brown)
    s+=p('M203 86 Q197 95 189 96 Q178 96 170 91 L158 84 Q154 85 148 82 L145 77 Q145 75 149 77 L156 79 Q151 74 153 73 Q160 75 163 79 L179 84 Q186 85 194 79',brown)
    s+=pen('M161 101 L169 106 M148 79 L155 82','#986b5b')+p('M145 75 L160 71 L162 73 L148 78Z',gold,ink,.7)
    for i in range(5):s+=pen(f'M{148+i*2.4} {76-i*.65} l1.3 4',gold,.9)
    s+=p('M45 170 Q134 201 227 169 L215 207 Q137 230 59 208Z','#99816b')
    s+=pen('M48 173 Q136 200 225 172 M55 197 Q131 220 217 198','#d2b182',2.8)
    for i in range(9):s+=pen(f'M{55+19*i} {178+8*sin(i*pi/8)} l{5-1.3*i} 23','#776453',.85)
    return s+seal(300,98)

def night_scene():
    # Two lovers face one another on their sides. Hair spreads across the
    # bolster, lower legs interleave, his forearm lies beneath her tilted head.
    s=p('M0 0 H360 V117 Q272 104 197 120 Q73 125 0 113Z','#7d8b86','#7d8b86')
    s+=window(287,61,35)+branch(214,101,.70,-5)+drape(0,0,.83,.91,'#b17f6e','#d9a78b')
    s+=quilt('#bfa077','#e3cba3')+p('M40 133 C65 119 105 107 146 104 Q186 95 209 108 Q243 117 284 108 Q311 110 328 128 Q335 151 306 166 Q257 173 222 166 Q177 160 138 175 Q92 188 40 167Z',blue)
    s+=pen('M42 144 Q78 119 125 117 M220 124 Q271 135 306 119 M236 158 Q278 166 308 151','#a6b6a3',1.35)
    # His back is behind her lifted leg; his dark sleeve falls off the divan.
    s+=p('M164 100 Q169 83 193 85 Q218 86 234 105 Q244 116 263 115 Q284 114 297 127 Q307 137 318 135 Q325 133 328 136 Q330 141 317 145 Q295 146 282 135 L257 137 Q230 146 214 134 Q203 126 188 125 Q166 123 157 115Z',brown)
    s+=b('M198 114 Q213 113 226 121 Q244 138 259 129 Q277 124 291 130 Q276 120 259 123 Q240 128 229 117 Q210 102 198 114Z','#bd8a73')
    s+=p('M195 87 Q205 79 221 87 Q249 95 261 90 Q272 92 279 104 Q264 101 257 108 Q240 120 219 106 Q201 97 193 100Z','#a96160')
    s+=pen('M211 89 Q233 105 253 100 M221 90 Q241 99 256 95','#d79986',1.2)
    s+=face(162,96,-60,-1,'scholar',brown)
    s+=p('M180 99 Q186 105 178 110 Q164 119 143 121 L118 117 Q106 119 97 115 Q91 111 95 109 L103 112 Q98 106 102 105 L117 111 L141 110 L168 101',brown)
    # Her loose braid fans over the bolster, behind the upturned face.
    s+=p('M110 110 Q99 104 85 113 Q77 119 64 119 Q46 118 41 125 Q57 122 67 126 Q80 135 92 128 Q85 136 72 138 Q93 140 108 128Z',hair)
    s+=pen('M47 124 Q57 121 71 124 Q88 129 101 115 M73 134 Q89 132 101 120','#79695f')
    s+=p('M116 128 Q132 117 149 123 Q158 126 163 132 Q176 143 196 137 Q211 132 218 142 Q230 159 210 166 Q189 172 171 161 Q157 156 145 158 Q128 157 117 149 Q107 141 116 128Z',light)
    s+=pen('M141 127 Q145 122 153 126 Q158 131 153 135 M156 136 Q163 134 165 140 M174 148 Q181 149 185 146','#a67663')+oval(151,126,2.3,1.7,'#bb8072')+oval(164,139,1.8,1.35,'#bb8072')
    s+=face(116,117,-71,1,'peony',light)
    s+=p('M204 139 Q213 130 226 120 Q234 110 242 110 Q255 109 267 120 L284 132 Q292 133 296 138 Q298 143 291 142 L278 139 Q264 135 251 127 L244 124 Q236 144 217 155Z',light)
    s+=p('M210 146 Q224 141 240 140 Q255 136 263 147 L278 162 Q295 165 309 162 Q316 159 319 162 Q319 167 312 169 Q295 177 274 173 Q267 173 263 168 L251 156 Q232 164 211 166 Q196 167 193 159',light)
    s+=pen('M246 151 Q252 148 256 151 M303 167 Q311 167 315 164 M199 161 Q207 162 218 156','#ac7b68')
    s+=p('M124 136 Q132 140 140 137 L162 122 Q167 118 174 112 L178 103 Q181 100 180 97 Q177 96 175 102 L174 96 Q172 93 171 96 L169 104 L159 112 L132 123',light)
    s+=p('M191 98 Q204 101 202 111 Q198 127 180 136 L163 147 Q153 151 143 149 Q137 148 138 146 L147 144 Q139 144 142 141 L157 138 L177 124 L188 109',brown)
    s+=pen('M142 145 L153 143 M145 148 L153 146',ink,.65)
    return s+seal(32,188)

def image(index,draw):
    # Reserve a narrow integral mounting border on album leaves; the triptych
    # has timber rails, so its image runs out to all four edges.
    base=p('M0 0 H360 V240 H0Z',['#e6d4ad','#e4d2ae','#e9d9b9','#dfcaa6'][index],'none')
    scene=draw()
    if index:
        scene=g(scene,'translate(9 10) scale(.95 .91)')
        scene+=pen('M8 9 H352 V230 H8Z','#9a836c',.8)+pen('M5 6 H355 V233 H5Z','#b3a18a',.6)+stitches()
        scene+=p('M342 237 Q348 235 354 226 L359 218 Q358 230 357 238Z','#cbb390','#9d876e',.6)+p('M342 237 Q348 232 349 228 Q355 225 359 218 Q355 231 342 237Z','#efdfc4','#ac947b',.6)
        # Smudged cinnabar folio number, brush strokes instead of a UI label.
        for j in range(index):scene+=pen(f'M329 {234+j*1.3} l6 -.4',cinnabar,.6)
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 360 240">{base}{scene}</svg>'
    with pymupdf.open(stream=svg.encode(),filetype='svg') as doc:
        pix=doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5,1.5),alpha=False)
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples).resize((752,496),Image.Resampling.LANCZOS)
    px=im.load();rng=Random(85+index)
    for y in range(im.height):
        for x in range(im.width):
            noise=rng.choice((-2,-1,-1,0,0,0,1,1,2))+(1 if (x+2*y)%5==0 else 0)
            px[x,y]=tuple(max(0,min(255,v+noise)) for v in px[x,y])
    return im

if __name__=='__main__':
    atlas=Image.new('RGB',(1536,1024))
    for i,draw in enumerate([bed_scene,lap_scene,bath_scene,night_scene]):
        im=image(i,draw);tile=ImageOps.expand(im,8)
        tile.paste(im.crop((0,0,1,496)).resize((8,496)),(0,8));tile.paste(im.crop((751,0,752,496)).resize((8,496)),(760,8))
        for y,row in [(0,8),(504,503)]:tile.paste(tile.crop((0,row,768,row+1)).resize((768,8)),(0,y))
        atlas.paste(tile,(i%2*768,i//2*512))
    target=Path(__file__).with_name('chamber-paintings.webp');atlas.save(target,quality=88,method=6);print(target.name,target.stat().st_size)
