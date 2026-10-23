import sys, os, unityfs, serialized as S
from PIL import Image
FMT = {25: 7, 12: 3, 10: 1, 29: None}
def extract(path, out):
    os.makedirs(out, exist_ok=True)
    fs = unityfs.unityfs_files(open(path,'rb').read())
    names = []
    for k, b in fs.items():
        if k.endswith('.resS') or k.endswith('.resource'): continue
        try: uv, objs, e = S.parse(b)
        except Exception as ex: print('skip', k, ex); continue
        for o in objs:
            if o['cid'] != 28: continue
            t = S.read_obj(b, o, e)
            data = t['image data']
            sd = t.get('m_StreamData')
            if not data and sd and sd['size']:
                res = fs[sd['path'].split('/')[-1]]; data = res[sd['offset']:sd['offset']+sd['size']]
            w, h, f = t['m_Width'], t['m_Height'], t['m_TextureFormat']
            try:
                if f == 25: im = Image.frombytes('RGBA', (w, h), data, 'bcn', 7)
                elif f == 12: im = Image.frombytes('RGBA', (w, h), data, 'bcn', 3)
                elif f == 10: im = Image.frombytes('RGBA', (w, h), data, 'bcn', 1)
                elif f == 4: im = Image.frombytes('RGBA', (w, h), data)
                elif f == 3: im = Image.frombytes('RGB', (w, h), data)
                else: print('fmt', f, t['m_Name']); continue
            except Exception as ex: print('err', t['m_Name'], f, ex); continue
            im = im.transpose(Image.FLIP_TOP_BOTTOM)
            fn = os.path.join(out, t['m_Name'].replace('/','_') + '.png'); im.save(fn); names.append(fn)
    return names
if __name__ == '__main__':
    for p in sys.argv[2:]:
        n = extract(p, os.path.join(sys.argv[1], os.path.basename(p).split('_assets')[0]))
        print(os.path.basename(p), len(n))
