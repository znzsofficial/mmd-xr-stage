"""Copy explicit base-color textures. Never guess albedo from masks or normals."""
import struct,zlib
from pathlib import Path
import bpy


def strip_packed_alpha(data):
    # Blender shader packs often use alpha for data unrelated to transparency.
    # Remove the filtered alpha byte losslessly; the RGB predictors for PNG's
    # five filters are channel independent. Avoid round-tripping via view LUTs.
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): return data
    header=data[16:29];w,h,depth,color,comp,filt,interlace=struct.unpack('>IIBBBBB',header)
    if color not in (4,6):return data
    if depth!=8 or interlace or comp or filt:raise ValueError('Unsupported packed-alpha PNG encoding')
    if w*h>8192**2:raise ValueError('Texture too large')
    channels=4 if color==6 else 2;out_channels=channels-1
    chunks=[];compressed=bytearray();at=8
    while at<len(data):
        n=struct.unpack_from('>I',data,at)[0];tag=data[at+4:at+8];v=data[at+8:at+8+n];at+=12+n
        if tag==b'IDAT':compressed.extend(v)
        elif tag in (b'sRGB',b'gAMA',b'iCCP',b'cHRM'):chunks.append((tag,v))
    stride=w*channels+1;raw=zlib.decompress(compressed)
    if len(raw)!=stride*h:raise ValueError('Invalid PNG scanlines')
    dst_stride=w*out_channels+1;dst=bytearray(dst_stride*h)
    for y in range(h):
        a=y*stride;b=y*dst_stride;dst[b]=raw[a];row=raw[a+1:a+stride]
        for k in range(out_channels):dst[b+1+k:b+dst_stride:out_channels]=row[k::channels]
    def chunk(tag,body):return struct.pack('>I',len(body))+tag+body+struct.pack('>I',zlib.crc32(tag+body))
    return data[:8]+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,depth,color-4,0,0,0))+b''.join(chunk(t,v) for t,v in chunks)+chunk(b'IDAT',zlib.compress(dst,6))+chunk(b'IEND',b'')


def appearance(material, folder, cache):
    if material is None:return None,(.8,.8,.8,1.),None
    nodes=material.node_tree.nodes if material.node_tree else ()
    output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output),None)
    if output is None:return None,material.diffuse_color[:],None
    surface=output.inputs['Surface']; shader=surface.links[0].from_node if surface.is_linked else None
    if not shader:raise ValueError('No surface shader: '+material.name)
    socket=shader.inputs.get('Base Color') or (shader.inputs.get('Color') if shader.type in ('EMISSION','BSDF_DIFFUSE') else None)
    if socket is None:raise ValueError('No supported base-color shader: '+material.name)
    if not socket.is_linked:return None,socket.default_value[:],None
    node=socket.links[0].from_node
    if node.type!='TEX_IMAGE' or not node.image:raise ValueError('Base color needs a baked image: '+material.name)
    image=node.image; alpha=shader.inputs.get('Alpha');use_alpha=bool(alpha and alpha.is_linked and alpha.links[0].from_node==node and alpha.links[0].from_socket.name=='Alpha')
    key=(image,use_alpha)
    if key not in cache:
        if image.packed_file:data=bytes(image.packed_file.data)
        else:
            path=Path(bpy.path.abspath(image.filepath,library=image.library)).resolve()
            if not path.is_relative_to(Path(bpy.data.filepath).resolve().parent):
                raise ValueError('External base texture must be packed or inside the chosen project folder: '+image.name)
            data=path.read_bytes()
        ext='png' if data.startswith(b'\x89PNG') else 'jpg' if data.startswith(b'\xff\xd8') else None
        if not ext:raise ValueError('Only PNG/JPEG base textures are supported')
        if not use_alpha:data=strip_packed_alpha(data)
        name=f'tex-{len(cache)+1}.{ext}';(folder/name).write_bytes(data);cache[key]=name
    uv=None;v=node.inputs['Vector'];
    if v.is_linked:
        coord=v.links[0].from_node
        if coord.type=='UVMAP':uv=coord.uv_map or None
        elif coord.type!='TEX_COORD' or v.links[0].from_socket.name!='UV':raise ValueError('Unsupported texture projection: '+material.name)
    return cache[key],(1.,1.,1.,float(alpha.default_value) if alpha and not alpha.is_linked else 1.),uv
