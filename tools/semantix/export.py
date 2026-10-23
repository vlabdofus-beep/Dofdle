import json, numpy as np, hashlib, os, shutil
E=np.load('emb.npy'); vocab=json.load(open('vocab.json'))
pool=[w for w in json.load(open('pool.json')) if w not in ('chat',)]
OUT='/home/claude/dofdle/data/semantix'
shutil.rmtree(OUT,ignore_errors=True); os.makedirs(OUT)
# Vocabulaire trié (ordre alphabétique : ne révèle rien)
order=sorted(range(len(vocab)), key=lambda i: vocab[i])
vocab_sorted=[vocab[i] for i in order]; E=E[order]
idx={w:i for i,w in enumerate(vocab_sorted)}
json.dump(vocab_sorted, open(f'{OUT}/vocab.json','w'), ensure_ascii=False, separators=(',',':'))
ids=[]
for w in pool:
    s=E@E[idx[w]]
    q=np.clip(np.round(s*10000),-10000,10000).astype('<i2')
    h=hashlib.sha1(f'semantix|{w}'.encode()).hexdigest()[:10]
    q.tofile(f'{OUT}/{h}.bin'); ids.append(h)
json.dump({'v':1,'size':len(vocab_sorted),'pool':ids}, open(f'{OUT}/pool.json','w'))
print(len(ids),'secrets', os.path.getsize(f'{OUT}/vocab.json')//1024,'Ko vocab', sum(os.path.getsize(f'{OUT}/{h}.bin') for h in ids)//1024//1024,'Mo total bins')
