import json,sys
sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from tabnet import *
p='../raw/pop.htm'; a,s=form(p)
arq=['projuf%02d.dbf'%(y%100) for y in range(2010,2026)]
kf=find(s,'SFaixa_Et')[0]
v60=[v for v,l in s[kf] if l[:2].isdigit() and int(l[:2])>=60]
print([l for v,l in s[kf] if v in v60])
out={'total':query(p,'Unidade da Federação','Ano','População residente',arq),
     '60+':query(p,'Unidade da Federação','Ano','População residente',arq,{kf:v60})}
json.dump(out,open('../raw/pop.json','w',encoding='utf8'),ensure_ascii=False)
for k in out: [print(r[:4],r[-2:]) for r in out[k][:2]+out[k][-2:]]
