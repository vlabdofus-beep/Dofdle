import json, numpy as np, sys
E=np.load('emb.npy'); vocab=json.load(open('vocab.json')); idx={w:i for i,w in enumerate(vocab)}
for w in sys.argv[1].split(','):
    if w not in idx: print(w,'??'); continue
    s=E@E[idx[w]]; o=np.argsort(-s)
    print(f"{w}: "+', '.join(f"{vocab[i]}({s[i]:.2f})" for i in o[1:16]), '| #100:',f"{s[o[100]]:.2f}",'#1000:',f"{s[o[1000]]:.2f}")
