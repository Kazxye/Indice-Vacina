import json,sys
sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from tabnet import *
p='../raw/sim.htm'; a,s=form(p)
arq=['obtuf%02d.dbf'%(y%100) for y in range(2010,2026)]
kc,vc=filt(s,'SCategoria_CID',lambda l:l.startswith('I21') or l.startswith('I22'))
ki=[k for k in s if k.startswith('SFaixa_Et') and len(s[k])==14][0]
print(kc,vc,ki,[l for v,l in s[ki]])
v60=[v for v,l in s[ki] if l[:2] in('60','70','80')]
out={}
out['total']=query(p,'Unidade da Federação','Ano do Óbito','Óbitos p/Residênc',arq,{kc:vc})
out['60+']=query(p,'Unidade da Federação','Ano do Óbito','Óbitos p/Residênc',arq,{kc:vc,ki:v60})
json.dump(out,open('../raw/sim.json','w',encoding='utf8'),ensure_ascii=False)
for k in out:
    print(k); [print(r) for r in out[k][:3]+out[k][-2:]]
