"""Translate saved Rigid Body Bones proxy objects, not the add-on's Python.

Only single-group boxes, spheres, capsules and generic joints are supported.
An unrecognised physical setup must not silently become a free-falling rig.
"""
import re
from mathutils import Matrix, Vector


SWAP = Matrix(((1,0,0),(0,0,1),(0,1,0)))
ZERO = (0.,0.,0.)


def proxies(scene, arm, weighted, skeleton_only=False):
    aliases = {c.subtarget: n for n in weighted for c in arm.pose.bones[n].constraints
               if c.type == 'COPY_TRANSFORMS' and c.target == arm and c.subtarget}
    records = {}
    for ob in scene.objects:
        if not ob.rigid_body: continue
        match = re.fullmatch(r'(.+) \[(Active|Passive|Blank)\]',ob.name)
        if not match or not arm.data.bones.get(match[1]): continue
        key, role = match.groups()
        if role == 'Active':
            if not any(getattr(c,'target',None)==ob for c in arm.pose.bones[key].constraints): continue
        elif ob.parent != arm or ob.parent_bone != key: continue
        records[ob] = (aliases.get(key,key),key,role)
    links=[]; parents={}
    for pivot in scene.objects:
        c=pivot.rigid_body_constraint
        if not c or not c.enabled: continue
        if c.object1 not in records and c.object2 not in records: continue
        if c.object1 not in records or c.object2 not in records or (not skeleton_only and c.type not in ('GENERIC','GENERIC_SPRING')):
            if skeleton_only:continue
            raise ValueError('Unsupported or external rigid constraint: '+pivot.name)
        a,b=records[c.object1],records[c.object2]
        links.append((pivot,c.object1,c.object2))
        if b[2]=='Active' and not arm.data.bones[b[0]].parent: parents[b[0]]=a[0]
    connected={b for _,_,b in links}
    if not skeleton_only and any(role=='Active' and ob not in connected for ob,(_,_,role) in records.items()):
        raise ValueError('Found an unanchored active proxy; export the rig without physics instead')
    return records, links, parents


def convert(arm, records, links, indices, pos, units):
    ids={ob:i for i,ob in enumerate(records)}; bodies=[]; joints=[]
    def rest_delta(key):
        # Proxy objects may have been saved in pose mode. Move them to the
        # source bone's bind frame, including the armature object's transform.
        return (arm.matrix_world @ arm.data.bones[key].matrix_local) @ (arm.matrix_world @ arm.pose.bones[key].matrix).inverted_safe()
    def orientation(m):
        # PMX input to the shipped loader is composed as Ry * Rx * Rz.
        return (SWAP @ m.to_quaternion().to_matrix() @ SWAP).to_euler('ZXY')[:]
    for ob,(bone,key,role) in records.items():
        rb=ob.rigid_body; m=rest_delta(key) @ ob.matrix_world
        bits=[i for i,v in enumerate(rb.collision_collections) if v]
        if len(bits)>1 or (bits and bits[0]>=15): raise ValueError('Unrepresentable Blender collision collection')
        group=bits[0] if bits else 15
        dims=Vector([max(p[i] for p in ob.bound_box)-min(p[i] for p in ob.bound_box) for i in range(3)])
        dims=Vector([abs(x*s)*units for x,s in zip(dims,m.to_scale())]);cx,cy,cz=dims
        if role=='Blank': shape=0;size=(.001,0,0)
        elif rb.collision_shape=='CAPSULE':
            radius=(cx+cy)/4;shape=2;size=(radius,max(.00001,cz-2*radius),0)
        elif rb.collision_shape=='BOX':shape=1;size=(cx/2,cz/2,cy/2)
        elif rb.collision_shape=='SPHERE':shape=0;size=(max(dims)/2,0,0)
        else:raise ValueError('Unsupported rigid shape: '+rb.collision_shape)
        center=sum((Vector(v) for v in ob.bound_box),Vector())/8 if role!='Blank' else Vector()
        # PMX mask as consumed by the target runtime is the permitted groups.
        bodies.append((ob.name,indices[bone],group,(1<<group) if bits else 0,shape,size,pos(m@center),orientation(m),
                       (rb.mass if role=='Active' else 0,rb.linear_damping,rb.angular_damping,rb.restitution,rb.friction),int(role=='Active')))
    for pivot,a,b in links:
        c=pivot.rigid_body_constraint;m=rest_delta(records[b][1]) @ pivot.matrix_world
        def limits(kind):
            low=[];high=[]
            for s in 'xzy':
                if getattr(c,'use_limit_'+kind+'_'+s):
                    l=getattr(c,'limit_'+kind+'_'+s+'_lower');h=getattr(c,'limit_'+kind+'_'+s+'_upper')
                    if kind=='lin':l*=units;h*=units
                    else:l,h=-h,-l # rotation axes are pseudovectors under reflection
                else:l,h=(1.,-1.) # Bullet convention: free, not locked at zero
                low.append(l);high.append(h)
            return low,high
        def spring(kind):
            return [getattr(c,'spring_stiffness_'+kind+s) if c.type=='GENERIC_SPRING' and getattr(c,'use_spring_'+kind+s) else 0. for s in 'xzy']
        joints.append((pivot.name,ids[a],ids[b],pos(m.translation),orientation(m),*limits('lin'),*limits('ang'),spring(''),spring('ang_')))
    return bodies,joints
