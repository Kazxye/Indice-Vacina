import json,sys,collections
sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from tabnet import *
p='../raw/sih.htm'; a,s=form(p)
km,vm=filt(s,'SLista_Morb',lambda l:'infarto agudo do mioc' in l.lower())
print(km,vm,[l for v,l in s[km] if 'nfarto' in l])
kf=find(s,'SFaixa_Et')[0]; print(kf,[l for v,l in s[kf]])
v60=[v for v,l in s[kf] if l[:2] in('60','70','80')]
files=[v for v,l in s['Arquivos'] if 1001<=int(v[4:8])<=2608]
out={}
for name,f in (('total',{km:vm}),('60+',{km:vm,kf:v60})):
    acc=collections.defaultdict(lambda:collections.defaultdict(int))
    for i in range(0,len(files),48):
        rows=query(p,'Unidade da Federação','Ano atendimento','Internações',files[i:i+48],f)
        hdr=rows[0]
        for r in rows[1:]:
            if len(r)<len(hdr): continue
            for h,c in zip(hdr[1:],r[1:]):
                acc[r[0]][h]+=int(c) if c.isdigit() else 0
        print(name,i,hdr[:6],flush=True)
    out[name]={k:dict(v) for k,v in acc.items()}
json.dump(out,open('../raw/sih.json','w',encoding='utf8'),ensure_ascii=False)
t=out['total']['Total']; print(sorted(t.items()))
t=out['60+']['Total']; print(sorted(t.items()))
