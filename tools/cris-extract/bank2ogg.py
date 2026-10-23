import sys, os
sys.path.insert(0, '/home/claude/ext/python-fsb5')
import fsb5
def extract(bank_path, out_dir):
    b = open(bank_path, 'rb').read()
    i = b.find(b'FSB5')
    fsb = fsb5.FSB5(b[i:])
    os.makedirs(out_dir, exist_ok=True)
    res = []
    for s in fsb.samples:
        data = fsb.rebuild_sample(s)
        p = os.path.join(out_dir, f'{s.name}.{fsb.get_sample_extension()}')
        open(p, 'wb').write(data); res.append((s.name, s.frequency, s.channels, s.samples, len(data)))
    return res
if __name__ == '__main__':
    for r in extract(sys.argv[1], sys.argv[2]): print(r)
