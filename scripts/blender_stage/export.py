"""Run in background Blender, with --disable-autoexec, after loading the input.

Supported subset: a single skinned character, bind mesh, relative shape keys,
explicit base image or constant colour; optional saved Rigid Body Bones proxies.
No source scene edits are saved. Private outputs only go to the requested ZIP.
"""
import argparse
from collections import defaultdict
import json
from math import sin,cos,radians
from pathlib import Path
import re,struct,sys,tempfile,zipfile
import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
sys.dont_write_bytecode=True
from pmx import write_model
from physics import SWAP,proxies,convert
from textures import appearance


def bone_label(name):
    fixed={'Hips':'下半身','Spine':'上半身','Upper Chest':'上半身2','Neck':'首','Head':'頭','LeftEye':'左目','RightEye':'右目'}
    if name in fixed:return fixed[name]
    m=re.fullmatch(r'(Left|Right) (shoulder|arm|elbow|wrist|leg|knee|ankle|toe)',name)
    if m:return ('左' if m[1]=='Left' else '右')+dict(shoulder='肩',arm='腕',elbow='ひじ',wrist='手首',leg='足',knee='ひざ',ankle='足首',toe='つま先')[m[2]]
    m=re.fullmatch(r'(Thumb|IndexFinger|MiddleFinger|RingFinger|LittleFinger)([0-3])_([LR])',name)
    if m:return ('左' if m[3]=='L' else '右')+dict(Thumb='親指',IndexFinger='人指',MiddleFinger='中指',RingFinger='薬指',LittleFinger='小指')[m[1]]+'０１２３'[int(m[2])]
    m=re.fullmatch(r'Chest_([LR])_(\d+)',name)
    if m:return ('左' if m[1]=='L' else '右')+'胸'+m[2]
    return name


def test_motion(path):
    def fixed(s,n):return s.encode('cp932').ljust(n,b'\0')
    data=bytearray(fixed('Vocaloid Motion Data 0002',30)+fixed('Stage pose',20)+struct.pack('<I',3))
    for frame,angle in [(0,0),(30,24),(60,24)]:
        half=radians(angle)/2;data+=fixed('左腕',15)+struct.pack('<I7f',frame,0,0,0,0,0,sin(half),cos(half))+bytes(([20]*8+[107]*8)*4)
    path.write_bytes(data+bytes(20))


def saved_expression(path, values):
    """VMD morph names have 15 Shift-JIS bytes. Never truncate into another key."""
    tracks=[];omitted=[]
    for name,value in values.items():
        try:encoded=name.encode('cp932')
        except UnicodeEncodeError:encoded=b''
        if not 0<len(encoded)<=15:omitted.append(name);continue
        tracks.append(encoded.ljust(15,b'\0')+struct.pack('<If',0,value))
    if tracks:
        path.write_bytes(b'Vocaloid Motion Data 0002'.ljust(30,b'\0')+b'Stage expression'.ljust(20,b'\0')+
                         struct.pack('<II',0,len(tracks))+b''.join(tracks)+bytes(16))
    return len(tracks),len(omitted)


def export(folder, no_physics=False):
    scene=bpy.context.scene
    meshes=[o for o in scene.objects if o.type=='MESH' and o.visible_get() and not o.hide_render and not o.rigid_body and o.vertex_groups and o.find_armature()]
    rigs={o.find_armature() for o in meshes}
    if len(rigs)!=1:raise ValueError(f'Expected one visible skinned character, found {len(rigs)} armatures')
    arm=rigs.pop();units=10.*scene.unit_settings.scale_length
    weighted={g.name for o in meshes for g in o.vertex_groups if arm.data.bones.get(g.name)}
    records,links,extra=proxies(scene,arm,weighted,skeleton_only=no_physics)
    if no_physics:records,links={},[] # keep original joint-derived bone parenting
    names=[];parents={}
    def include(n,visiting=()):
        if n in parents:return
        if n in visiting:raise ValueError('Bone parent cycle at '+n)
        bone=arm.data.bones[n];parent=extra.get(n) or (bone.parent.name if bone.parent else None)
        if parent:include(parent,(*visiting,n))
        parents[n]=parent;names.append(n)
    for n in sorted(weighted|{rec[0] for rec in records.values()}):include(n)
    ids={n:i+1 for i,n in enumerate(names)}
    bottom=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
    def pos(v):return (v.x*units,(v.z-bottom)*units,v.y*units)
    center='センター' if not any(bone_label(n)=='センター' for n in names) else 'XR Root'
    bones=[(center,'Stage Root',pos(arm.matrix_world@arm.data.bones['Hips'].head_local) if 'Hips' in ids else (0,0,0),-1,(0,.1,0))]
    for n in names:
        b=arm.data.bones[n];head=arm.matrix_world@b.head_local;tail=arm.matrix_world@b.tail_local
        bones.append((bone_label(n),n,pos(head),ids.get(parents[n],0),tuple((SWAP@(tail-head))*units)))
    if len({b[0] for b in bones})!=len(bones):raise ValueError('Bone alias collision; need explicit rig mapping')
    vertices=[];materials={};uv_names={};images={};morphs=defaultdict(list);saved_offsets={};reduced=0;truncated_max=0.;skipped_mods=set()
    for o in meshes:
        mesh=o.data;mesh.calc_loop_triangles();norm=o.matrix_world.to_3x3().inverted().transposed()
        skipped_mods.update(m.type for m in o.modifiers if m.type!='ARMATURE' and m.show_viewport)
        groups={g.index:ids[g.name] for g in o.vertex_groups if g.name in ids};weights=[]
        for v in mesh.vertices:
            pairs=sorted([(groups[g.group],g.weight) for g in v.groups if g.group in groups and g.weight>0],key=lambda v:-v[1]);top=pairs[:4];total=sum(w for _,w in top)
            if len(pairs)>4:reduced+=1;truncated_max=max(truncated_max,1-total/sum(w for _,w in pairs))
            weights.append([(i,w/total) for i,w in top] if total>0 else [(0,1.)])
        split={};copies=defaultdict(list);face_uv={};flip=o.matrix_world.to_3x3().determinant()>0
        for tri in mesh.loop_triangles:
            m=o.material_slots[tri.material_index].material if o.material_slots else None;key=m.name if m else 'Default'
            if key not in materials:
                tex,color,uv_name=appearance(m,folder,images);materials[key]=(key,tex,color,[]);uv_names[key]=uv_name
            if key not in face_uv:
                face_uv[key]=mesh.uv_layers.get(uv_names[key]) if uv_names[key] else next((u for u in mesh.uv_layers if u.active_render),mesh.uv_layers.active)
            uv_layer=face_uv[key]
            if materials[key][1] and not uv_layer:raise ValueError('Missing UV set for '+key)
            face=[]
            for l in tri.loops:
                i=mesh.loops[l].vertex_index;uv=uv_layer.uv[l].vector[:] if uv_layer else (0.,0.);n=mesh.corner_normals[l].vector
                k=(i,*uv,*n);j=split.get(k)
                if j is None:
                    j=len(vertices);split[k]=j;copies[i].append(j);v=mesh.vertices[i]
                    vertices.append((pos(o.matrix_world@v.co),tuple((SWAP@(norm@n)).normalized()),(uv[0],1.-uv[1]),weights[i]))
                face.append(j)
            x,y,z=face;materials[key][3].extend((x,z,y) if flip else (x,y,z))
        keys=mesh.shape_keys
        if keys:
            if not keys.use_relative:raise ValueError('Absolute shape keys not supported')
            for k in list(keys.key_blocks)[1:]:
                if k.mute:continue
                rel=k.relative_key; mask=o.vertex_groups.get(k.vertex_group) if k.vertex_group else None
                for i,js in copies.items():
                    dv=k.data[i].co-rel.data[i].co
                    if dv.length_squared<1e-16:continue
                    factor=next((g.weight for g in mesh.vertices[i].groups if g.group==mask.index),0.) if mask else 1.
                    if factor==0:continue
                    delta=(SWAP@(o.matrix_world.to_3x3()@dv))*(units*factor);d=tuple(delta);morphs[k.name].extend((j,d) for j in js)
                    if abs(k.value)>1e-6:
                        # The same key on face/eyes/body can have different saved
                        # weights. Bake the preset per output vertex, retaining
                        # the individual artist keys as independent controls.
                        for j in js:saved_offsets[j]=saved_offsets.get(j,Vector())+delta*k.value
    bodies,joints=convert(arm,records,links,ids,pos,units)
    preset='保存表情'
    if saved_offsets:
        while preset in morphs:preset+='+'
        morphs[preset]=[(j,tuple(d)) for j,d in saved_offsets.items() if d.length_squared>1e-16]
    write_model(folder/'actor.pmx',Path(bpy.data.filepath).stem,vertices,list(materials.values()),bones,morphs,bodies,joints)
    if any(b[0]=='左腕' for b in bones):test_motion(folder/'arm-check.vmd')
    saved,omitted=saved_expression(folder/'saved-face.vmd',{preset:1.} if saved_offsets else {})
    return dict(meshes=len(meshes),vertices=len(vertices),triangles=sum(len(m[3]) for m in materials.values())//3,
                materials=len(materials),textures=len(images),bones=len(bones),morphs=len(morphs),rigidBodies=len(bodies),
                dynamicBodies=sum(b[-1] for b in bodies),joints=len(joints),baseVertices=sum(len(o.data.vertices) for o in meshes),
                fourWeightReductions=reduced,maxDiscardedWeightFraction=round(truncated_max,6),notBaked=sorted(skipped_mods),
                savedExpressionTracks=saved,skippedExpressionTracks=omitted)


if __name__=='__main__':
    args=argparse.ArgumentParser();args.add_argument('output',type=Path);args.add_argument('--no-physics',action='store_true')
    opts=args.parse_args(sys.argv[sys.argv.index('--')+1:]);target=opts.output.resolve()
    if target.suffix.lower()!='.zip' or target.exists():raise ValueError('Expected a new .zip output path')
    with tempfile.TemporaryDirectory(dir=target.parent) as tmp:
        work=Path(tmp);report=export(work,opts.no_physics);(work/'conversion.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        staging=work/'package.tmp';files=list(work.iterdir())
        with zipfile.ZipFile(staging,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=4) as z:
            for f in files:z.write(f,f.name)
        with staging.open('rb') as src,target.open('xb') as dst:
            import shutil
            try:shutil.copyfileobj(src,dst)
            except BaseException:dst.close();target.unlink();raise
        print('STAGE_EXPORT',json.dumps(report))
