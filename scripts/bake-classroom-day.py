"""Project the clerestory and desk shadows onto the existing contact-only parquet."""
import json
from math import cos, sin
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFilter

scenery = Path(__file__).resolve().parents[1] / 'src/mmdVrShowcase/scenery'
room, high, panes, students, sun = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e', """
    import {ROOM, CLERESTORY, HIGH_PANES, STUDENTS} from './ClassroomLayout.ts';
    import {SHORE_SUN} from './shoreDaylight.ts';
    console.log(JSON.stringify([ROOM,CLERESTORY,HIGH_PANES,STUDENTS,SHORE_SUN]));
    """], cwd=scenery))
base = Image.open(scenery / 'class-floor-shadow.webp').convert('RGBA')
mask = Image.new('L', base.size)
draw = ImageDraw.Draw(mask)


def floor(x, y, z):
    return (base.width * (.5 + (x - y*sun[0]/sun[1]) / room['w']),
            base.height * (.5 + (z - y*sun[2]/sun[1]) / room['d']))


for pane in panes:
    draw.polygon([floor(pane[side], high[level], high['z']) for side, level in
                  [('left','sill'), ('right','sill'), ('right','head'), ('left','head')]], fill=115)
for student in students:
    for kind, y in [('desk', .74), ('chair', .45)]:
        f = student[kind]
        yaw = f.get('yaw', 0)
        corners = []
        for u, v in [(-.5,-.5), (.5,-.5), (.5,.5), (-.5,.5)]:
            x, z = u*f['w'], v*f['d']
            corners.append(floor(f['x']+x*cos(yaw)+z*sin(yaw), y, f['z']-x*sin(yaw)+z*cos(yaw)))
        draw.polygon(corners, fill=0)

day = Image.composite(Image.new('RGB', base.size, '#ffedcf'), base.convert('RGB'), mask.filter(ImageFilter.GaussianBlur(2)))
day.putalpha(base.getchannel('A'))
day.save(scenery / 'class-floor-day.webp', quality=95, method=6)
