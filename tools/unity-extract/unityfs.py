import struct, io, sys

def lz4_block(src, usize):
    dst = bytearray(); i = 0; n = len(src)
    while i < n:
        tok = src[i]; i += 1
        lit = tok >> 4
        if lit == 15:
            while True:
                b = src[i]; i += 1; lit += b
                if b != 255: break
        dst += src[i:i+lit]; i += lit
        if i >= n: break
        off = src[i] | (src[i+1] << 8); i += 2
        ml = tok & 15
        if ml == 15:
            while True:
                b = src[i]; i += 1; ml += b
                if b != 255: break
        ml += 4
        start = len(dst) - off
        for k in range(ml): dst.append(dst[start+k])
    return bytes(dst)

def decomp(data, flags, usize):
    c = flags & 0x3f
    if c == 0: return data
    if c in (2,3): return lz4_block(data, usize)
    raise Exception('compression %d' % c)

def read_cstr(b, i):
    j = b.index(b'\0', i); return b[i:j].decode('utf8','replace'), j+1

def unityfs_files(b):
    i = 8; ver = struct.unpack('>I', b[i:i+4])[0]; i += 4
    _, i = read_cstr(b, i); _, i = read_cstr(b, i)
    size, csize, usize, flags = struct.unpack('>qIII', b[i:i+20]); i += 20
    if ver >= 7: i = (i + 15) & ~15
    if flags & 0x80:
        binfo = b[len(b)-csize:]
    else:
        binfo = b[i:i+csize]; i += csize
    binfo = decomp(binfo, flags, usize)
    if flags & 0x200: i = (i + 15) & ~15
    r = io.BytesIO(binfo); r.read(16)
    nb = struct.unpack('>i', r.read(4))[0]
    blocks = [struct.unpack('>IIH', r.read(10)) for _ in range(nb)]
    nn = struct.unpack('>i', r.read(4))[0]
    nodes = []
    for _ in range(nn):
        off, sz, fl = struct.unpack('>qqI', r.read(20))
        name = b''
        while True:
            ch = r.read(1)
            if ch == b'\0': break
            name += ch
        nodes.append((off, sz, name.decode()))
    data = bytearray()
    for us, cs, fl in blocks:
        data += decomp(b[i:i+cs], fl, us); i += cs
    return {name: bytes(data[off:off+sz]) for off, sz, name in nodes}
