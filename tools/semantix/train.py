import json, numpy as np, scipy.sparse as sp, collections, time, sys
from scipy.sparse.linalg import svds
STOP=set("""a à au aux avec ce ces c ça cet cette d dans de des du elle elles en et eux il ils je j la le les leur leurs lui l m ma mais me même mes moi mon n ne nos notre nous on ou où par pas pour qu que qui s sa se ses son sur t ta te tes toi ton tu un une vos votre vous y est sont été être ai as avons avez ont avait était sera fait faire plus moins très bien aussi alors donc car si comme tout tous toute toutes rien peu peut ici là cela ceci celui celle ceux quoi quand comment pourquoi oui non dont lors puis encore déjà après avant jamais toujours vers chez sans sous entre contre depuis pendant ni soit sont es suis êtes était étaient serait avoir eu fois autre autres beaucoup trop assez chaque quelque quelques mon ma votre leur ils elles lequel laquelle sinon ainsi tant tel telle point va vais vont allez aller doit dois devez pouvez peux veux voulez faut fera ferai sera seront serez as ah oh eh hé bon bah euh hein voici voilà afin selon jusqu lorsque tandis certes cet qu'il là-bas peut-être""".split())
sents=json.load(open('sents.json'))
cnt=collections.Counter(w for s in sents for w in s)
MIN=int(sys.argv[1]) if len(sys.argv)>1 else 5
BLACK=set('tooltip unity release quantity games nok copyright gamescom reserved rights sas beta alpha debug test todo null undefined npc id ui'.split())
vocab=[w for w,c in cnt.items() if c>=MIN and w not in STOP and w not in BLACK and len(w)>=2]
idx={w:i for i,w in enumerate(vocab)}; V=len(vocab); print('V',V)
W=6; rows=collections.Counter()
t=time.time()
for s in sents:
    ids=[idx[w] for w in s if w in idx]
    for i,a in enumerate(ids):
        for d in range(1,W+1):
            j=i+d
            if j>=len(ids): break
            b=ids[j]
            if a!=b:
                wgt=1.0/d
                rows[(a,b)]+=wgt; rows[(b,a)]+=wgt
print('pairs',len(rows), time.time()-t)
r=np.fromiter((k[0] for k in rows),np.int32,len(rows)); c=np.fromiter((k[1] for k in rows),np.int32,len(rows)); v=np.fromiter(rows.values(),np.float64,len(rows))
M=sp.csr_matrix((v,(r,c)),shape=(V,V))
tot=M.sum(); wsum=np.asarray(M.sum(1)).ravel(); csum=np.asarray(M.sum(0)).ravel()**0.75; csum/=csum.sum()
M=M.tocoo()
pmi=np.log(M.data*1.0/ (wsum[M.row]/tot) / csum[M.col] / tot)
keep=pmi>0
P=sp.csr_matrix((pmi[keep],(M.row[keep],M.col[keep])),shape=(V,V))
print('ppmi nnz',P.nnz)
K=int(sys.argv[2]) if len(sys.argv)>2 else 200
U,S,Vt=svds(P,k=K)
E=U*np.sqrt(S)
E/=np.linalg.norm(E,axis=1,keepdims=True)+1e-9
np.save('emb.npy',E.astype(np.float32)); json.dump(vocab,open('vocab.json','w'),ensure_ascii=False)
print('done',time.time()-t)
