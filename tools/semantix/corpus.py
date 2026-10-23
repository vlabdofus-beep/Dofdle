import json, re, unicodedata, collections
texts=json.load(open('fr.json'))
seen=set(); docs=[]
for t in texts.values():
    t=t.strip()
    if not t or t in seen: continue
    seen.add(t)
    t=re.sub(r'<[^>]+>',' ',t)          # balises
    t=re.sub(r'\{[^}]*\}|%\d+|#\d+|\[[^\]]*\]',' ',t)  # variables
    low=t.lower()
    if re.search(r'https?:|www\.|\.com|\.fr\b|\.png|_|\\n', low): continue
    en=len(re.findall(r"\b(the|and|you|your|of|to|is|this|with|for|are|not|have|will)\b", low))
    if en>=2: continue
    docs.append(t)
print('docs uniques',len(docs))
WORD=re.compile(r"[a-zA-ZÀ-ÖØ-öø-ÿœŒæÆ]+(?:-[a-zA-ZÀ-ÖØ-öø-ÿœŒæÆ]+)*")
def toks(t):
    t=t.replace('’',"'")
    out=[]
    for w in WORD.findall(t):
        w=w.lower()
        out.append(w)
    return out
sents=[toks(d) for d in docs]
c=collections.Counter(w for s in sents for w in s)
print('tokens',sum(c.values()),'types',len(c),'>=5',sum(1 for v in c.values() if v>=5))
json.dump(sents,open('sents.json','w'),ensure_ascii=False)
json.dump(c.most_common(),open('counts.json','w'),ensure_ascii=False)
for w in ['bouftou','iop','frigost','dragodinde','kamas','laine','sram','tofu','abraknyde','dofus','percepteur','koalak','incarnam','astrub','bonta','brâkmar','bworks','bwork','arakne','sacrieur','pandawa']:
    print(w,c.get(w))
