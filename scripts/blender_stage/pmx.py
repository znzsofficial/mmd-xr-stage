"""Small PMX 2.0 writer for linear skinning, vertex morphs and simple joints.

The Blender adapter supplies already-converted MMD-space data. No add-on,
native module or external package is required by the writer.
"""
import struct


def write_model(path, name, vertices, materials, bones, morphs, bodies, joints):
    data = bytearray(b'PMX ')

    def put(fmt, *values):
        data.extend(struct.pack('<' + fmt, *values))

    def text(value):
        encoded = value.encode('utf-8')
        put('i', len(encoded)); data.extend(encoded)

    put('f9B', 2.0, 8, 1, 0, 4, 4, 4, 4, 4, 4)
    for value in (name, name, 'MMDXR:blender-stage/v1;metres-per-unit=0.1', ''):
        text(value)
    put('i', len(vertices))
    for p, n, uv, weights in vertices:
        put('3f3f2f', *p, *n, *uv)
        if len(weights) == 1:
            put('Bi', 0, weights[0][0])
        elif len(weights) == 2:
            put('Biif', 1, weights[0][0], weights[1][0], weights[0][1])
        else:
            padded = weights + [(0, 0.0)] * (4-len(weights))
            put('B4i4f', 2, *(v[0] for v in padded), *(v[1] for v in padded))
        put('f', 1.)
    put('i', sum(len(indices) for _, _, _, indices in materials))
    for _, _, _, indices in materials:
        for i in range(0,len(indices),3):
            put('3I', *indices[i:i+3])
    textures = list(dict.fromkeys(tex for _, tex, _, _ in materials if tex))
    put('i', len(textures))
    for tex in textures: text(tex)
    put('i', len(materials))
    for mat, tex, color, indices in materials:
        text(mat); text(mat)
        put('4f3ff3fB', *color, 0.,0.,0., 1., .40,.40,.40, 0x0f)
        put('4ffiiBBB', 0.,0.,0.,1., 0., textures.index(tex) if tex else -1, -1, 0,1,0)
        text(''); put('i', len(indices))
    put('i', len(bones))
    for jp, en, head, parent, tail in bones:
        text(jp); text(en); put('3fiiH3f', *head, parent, 0, 0x001e, *tail)
    put('i', len(morphs))
    for morph, offsets in morphs.items():
        text(morph); text(morph); put('BBi', 4, 1, len(offsets))
        for index, delta in offsets: put('I3f', index, *delta)
    put('i', 2)
    text('Root'); text('Root'); put('BiBi',1,1,0,0)
    text('表情'); text('Expression'); put('Bi',1,len(morphs))
    for i in range(len(morphs)): put('Bi',1,i)
    put('i', len(bodies))
    for label, index, group, excluded, shape, size, p, r, props, mode in bodies:
        text(label); text(label); put('iBHB3f3f3f5fB',index,group,excluded,shape,*size,*p,*r,*props,mode)
    put('i', len(joints))
    for label, a, b, p, r, linear_lo, linear_hi, angular_lo, angular_hi, spring, spring_rot in joints:
        text(label); text(label); put('Bii',0,a,b)
        for triple in (p,r,linear_lo,linear_hi,angular_lo,angular_hi,spring,spring_rot): put('3f',*triple)
    path.write_bytes(data)
