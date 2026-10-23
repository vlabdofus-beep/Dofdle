import sys, os, json, hashlib, subprocess, glob, collections
sys.path.insert(0, '/home/claude/ext/python-fsb5'); sys.path.insert(0, '/home/claude/tools/audio')
from pick import pick
D='/mnt/user-data/uploads/Dofus-dofus3/Dofus_Data/StreamingAssets/Content/Audio/Banks/Desktop/'
OUT=sys.argv[1]; os.makedirs(OUT, exist_ok=True)
ids=open('bones.txt').read().split()+['563','4907','556','634']
groups=collections.OrderedDict(); stats=collections.Counter(); tmp='/home/claude/tools/audio/tmp'; os.makedirs(tmp,exist_ok=True)
for b in ids:
    r=pick(b)
    if not r: stats['none']+=1; continue
    f,s,sc=r; stats[sc]+=1
    key=s.name.strip()
    if key not in groups:
        h=hashlib.sha1(('dofusle-cri|'+key).encode()).hexdigest()[:12]
        src=os.path.join(tmp,h+'.src.ogg'); open(src,'wb').write(f.rebuild_sample(s))
        dst=os.path.join(OUT,h+'.mp3')
        subprocess.run(['ffmpeg','-v','error','-y','-i',src,'-t','4','-ac','1','-ar','32000','-af','loudnorm=I=-16:TP=-1.5,afade=t=out:st=3.7:d=0.3','-c:a','libmp3lame','-b:a','64k',dst],check=True)
        groups[key]={'f':h+'.mp3','b':[],'s':sc,'d':round(s.samples/s.frequency,2)}
    groups[key]['b'].append(int(b))
json.dump({'v':1,'cris':[{'f':g['f'],'b':g['b'],'q':g['s']} for g in groups.values()]},open(os.path.join(OUT,'..','cris.json') if False else '/home/claude/tools/audio/cris.json','w'))
print(stats, 'groups',len(groups))
tot=sum(os.path.getsize(p) for p in glob.glob(OUT+'/*.ogg')); print('size MB',tot/1e6)
