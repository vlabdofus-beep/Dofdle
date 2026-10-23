import sys, os, re, json
sys.path.insert(0, '/home/claude/ext/python-fsb5')
import fsb5
D='/mnt/user-data/uploads/Dofus-dofus3/Dofus_Data/StreamingAssets/Content/Audio/Banks/Desktop/'
GENERIC=re.compile(r'(^|_)(Gen|hits|NPC_Foleys|Foley|Step|Fsp|Marche|Course|Saut|Footstep|Pas)(_|$)|hits_dofus', re.I)
def score(name):
    n=name
    if GENERIC.search(n): return None
    if re.search(r'Voix', n, re.I):
        if re.search(r'Attaque|Attack', n, re.I): return 0
        if re.search(r'Mort|Death', n, re.I): return 1
        if re.search(r'Hit', n, re.I): return 2
        return 3
    if re.search(r'AnimAttaque|Attaque', n, re.I): return 4
    if re.search(r'AnimFun', n, re.I): return 6
    if re.search(r'Mort', n, re.I): return 5
    return 7
def pick(bones):
    p=D+f'{bones}.bank'
    if not os.path.exists(p): return None
    b=open(p,'rb').read(); i=b.find(b'FSB5')
    if i<0: return None
    f=fsb5.FSB5(b[i:])
    cands=[]
    for s in f.samples:
        sc=score(s.name)
        dur=s.samples/s.frequency
        if sc is None or dur<0.35 or dur>6: continue
        cands.append((sc, abs(dur-1.6), s.name, s))
    if not cands: return None
    cands.sort(key=lambda c:(c[0],c[1],c[2]))
    sc,_,name,s=cands[0]
    return f, s, sc
if __name__=='__main__':
    ids=sys.argv[1:]
    stats={}
    for b in ids:
        r=pick(b)
        if not r: print(b,'-'); continue
        f,s,sc=r; stats[sc]=stats.get(sc,0)+1
        print(b, sc, s.name, round(s.samples/s.frequency,2))
    print(stats)
