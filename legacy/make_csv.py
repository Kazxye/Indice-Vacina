import json,csv,math,os
d=json.load(open('data.json',encoding='utf8'))
os.makedirs('../data',exist_ok=True)
Y=d['years']; B=d['base']; ufs={u['sigla']:u for u in d['ufs']}; keys=['BR']+list(ufs)
def rate(n,p): return round(1e5*n/p,1) if p else None
P={}
with open('../data/painel.csv','w',newline='',encoding='utf8') as f:
    w=csv.writer(f); w.writerow(['uf','nome','regiao','ano','pop','pop60','obitos','obitos60','intern','intern60','tx_obitos','tx_obitos60','tx_intern','tx_intern60','gripe_idosos','gripe_meta','gripe_doses','gripe_fonte'])
    for k in keys:
        for y in Y:
            pop,p60=B['pop'][k][y],B['pop60'][k][y]; o,o60,i,i60=B['obitos'][k][y],B['obitos60'][k][y],B['intern'][k][y],B['intern60'][k][y]
            g=d['flu'].get(k,{}).get(y); ga=d['flu_abs'].get(k,{}).get(y,[None,None])
            r={'tx_obitos':rate(o,pop),'tx_obitos60':rate(o60,p60),'tx_intern':rate(i,pop),'tx_intern60':rate(i60,p60),'gripe':round(g,1) if g is not None else None}
            P[(k,y)]=r
            w.writerow([k,'Brasil' if k=='BR' else ufs[k]['nome'],'' if k=='BR' else ufs[k]['reg'],y,pop,p60,o,o60,i,i60,r['tx_obitos'],r['tx_obitos60'],r['tx_intern'],r['tx_intern60'],'' if r['gripe'] is None else r['gripe'],'' if ga[0] is None else int(ga[0]),'' if ga[1] is None else int(ga[1]),'' if g is None else ('SI-PNI consolidado' if int(y)<=2020 else 'RNDS nominal')])
V={'Gripe (idosos, campanha)':{k:{y:P[(k,y)]['gripe'] for y in Y} for k in keys}}
with open('../data/rotina.csv','w',newline='',encoding='utf8') as f:
    w=csv.writer(f); w.writerow(['vacina','uf','ano','cobertura'])
    for vac,dd in d['rotina'].items():
        vn=' '.join(vac.split()); V[vn]={k:{y:dd.get(k,{}).get(y) for y in Y} for k in keys}
        for k in keys:
            for y in Y:
                v=dd.get(k,{}).get(y)
                if v is not None: w.writerow([vn,k,y,round(v,1)])
def pearson(xs,ys):
    n=len(xs)
    if n<8: return None
    mx,my=sum(xs)/n,sum(ys)/n; sx=sum((x-mx)**2 for x in xs); sy=sum((y-my)**2 for y in ys)
    if sx==0 or sy==0: return None
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/math.sqrt(sx*sy)
PAND={'2020','2021','2022'}
with open('../data/correlacoes.csv','w',newline='',encoding='utf8') as f:
    w=csv.writer(f); w.writerow(['chave','vacina','desfecho','faixa','modo','pandemia','r','n'])
    for vn,cov in V.items():
        for des in ('obitos','intern'):
            for fx in ('todas','60'):
                col='tx_'+des+('60' if fx=='60' else '')
                for modo in ('nivel','variacao'):
                    for pand in ('com','sem'):
                        xs=[];ys=[]
                        for k in ufs:
                            for j,y in enumerate(Y):
                                if pand=='sem' and y in PAND: continue
                                c=cov[k][y]; t=P[(k,y)][col]
                                if modo=='nivel' and vn.startswith('Gripe') and int(y)>2020: continue
                                if c is None or t is None: continue
                                if modo=='nivel': xs.append(c); ys.append(t)
                                elif j>0:
                                    y0=Y[j-1]
                                    if pand=='sem' and y0 in PAND: continue
                                    c0=cov[k][y0]; t0=P[(k,y0)][col]
                                    if c0 is None or t0 is None: continue
                                    xs.append(c-c0); ys.append(t-t0)
                        r=pearson(xs,ys)
                        w.writerow(['|'.join([vn,des,fx,modo,pand]),vn,des,fx,modo,pand,'' if r is None else round(r,2),len(xs)])
def mean(k,col,ys): return sum(P[(k,y)][col] for y in ys)/len(ys)
pre=['2015','2016','2017','2018','2019']; pos=['2022','2023','2024','2025']
rows=[]
with open('../data/covid.csv','w',newline='',encoding='utf8') as f:
    w=csv.writer(f); w.writerow(['uf','nome','doses_total','dose1','dose2','dose_unica','esquema_por100','var_obitos','var_obitos60','var_intern','var_intern60'])
    for k in keys:
        c=d['covid'][k]; e=round(100*(c['d2']+c['unica'])/B['pop'][k]['2022'],1)
        var=[round(100*(mean(k,col,pos)/mean(k,col,pre)-1),1) for col in ('tx_obitos','tx_obitos60','tx_intern','tx_intern60')]
        rows.append((k,e,var))
        w.writerow([k,'Brasil' if k=='BR' else ufs[k]['nome'],c['total'],c['d1'],c['d2'],c['unica'],e]+var)
with open('../data/correlacoes.csv','a',newline='',encoding='utf8') as f:
    w=csv.writer(f)
    for i,(des,fx) in enumerate((('obitos','todas'),('obitos','60'),('intern','todas'),('intern','60'))):
        xs=[e for k,e,v in rows if k!='BR']; ys=[v[i] for k,e,v in rows if k!='BR']
        w.writerow(['|'.join(['COVID-19',des,fx,'transversal','-']),'COVID-19',des,fx,'transversal','-',round(pearson(xs,ys),2),len(xs)])
for fn in os.listdir('../data'): print(fn,os.path.getsize('../data/'+fn))
import itertools
for ln in open('../data/correlacoes.csv',encoding='utf8').read().splitlines()[:9]: print(ln)
print(open('../data/correlacoes.csv',encoding='utf8').read().splitlines()[-4:])
print([r for r in rows if r[0] in('BR','SP','TO','RR')])
print(P[('BR','2011')],P[('BR','2020')],P[('BR','2025')])
