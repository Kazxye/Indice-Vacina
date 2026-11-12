import json,re,html
from pathlib import Path

AQUI = Path(__file__).resolve().parent
R = AQUI.parent / 'raw'
SAIDA = AQUI / 'data.json'
UF={11:('RO','Rondônia','N'),12:('AC','Acre','N'),13:('AM','Amazonas','N'),14:('RR','Roraima','N'),15:('PA','Pará','N'),16:('AP','Amapá','N'),17:('TO','Tocantins','N'),
21:('MA','Maranhão','NE'),22:('PI','Piauí','NE'),23:('CE','Ceará','NE'),24:('RN','Rio Grande do Norte','NE'),25:('PB','Paraíba','NE'),26:('PE','Pernambuco','NE'),27:('AL','Alagoas','NE'),28:('SE','Sergipe','NE'),29:('BA','Bahia','NE'),
31:('MG','Minas Gerais','SE'),32:('ES','Espírito Santo','SE'),33:('RJ','Rio de Janeiro','SE'),35:('SP','São Paulo','SE'),
41:('PR','Paraná','S'),42:('SC','Santa Catarina','S'),43:('RS','Rio Grande do Sul','S'),
50:('MS','Mato Grosso do Sul','CO'),51:('MT','Mato Grosso','CO'),52:('GO','Goiás','CO'),53:('DF','Distrito Federal','CO')}
SIG={v[0]:k for k,v in UF.items()}
YEARS=[str(y) for y in range(2010,2026)]
def key(label):
    label=label.strip()
    if label.lower().startswith('total') or label.upper()=='BRASIL': return 'BR'
    m=re.match(r'(\d\d)\s',label)
    if m and int(m.group(1)) in UF: return UF[int(m.group(1))][0]
    return None
def num(s):
    s=(s or '').strip().replace('.','').replace(',','.')
    try: return float(s)
    except ValueError: return None
D={k:{} for k in ['pop','pop60','obitos','obitos60','intern','intern60']}
def tab(rows,name):
    hdr=rows[0]
    for r in rows[1:]:
        k=key(r[0])
        if not k or len(r)<len(hdr): continue
        D[name][k]={h:int(v) if v.isdigit() else 0 for h,v in zip(hdr[1:],r[1:]) if h in YEARS}
sim=json.load(open(R/'sim.json',encoding='utf8')); tab(sim['total'],'obitos'); tab(sim['60+'],'obitos60')
pop=json.load(open(R/'pop.json',encoding='utf8')); tab(pop['total'],'pop'); tab(pop['60+'],'pop60')
sih=json.load(open(R/'sih.json',encoding='utf8'))
for src,name in (('total','intern'),('60+','intern60')):
    for lab,v in sih[src].items():
        k=key(lab)
        if k: D[name][k]={y:v.get(y,0) for y in YEARS}
rot={}
for vac,rows in json.load(open(R/'pni.json',encoding='utf8')).items():
    hdr=rows[0]; d={}
    for r in rows[1:]:
        k=key(r[0])
        if k: d[k]={h:(round(v,2) if v else None) for h,v in zip(hdr[1:],r[1:]) if h in YEARS}
    rot[vac]=d
flu={}; flu_abs={}
def cells(path,enc):
    t=open(path,encoding=enc,errors='replace').read(); t=re.sub(r'<script.*?</script>','',t,flags=re.S|re.I); out=[]
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',t,re.S|re.I):
        c=[re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',tr,re.S|re.I)]
        if c: out.append(c)
    return out
for y in (11,12,13,14):
    rows=cells(R/f'cob_{y}.htm','latin1'); yy=str(2000+y)
    h=[r for r in rows if r and r[0]=='UF'][0]; gi=[i for i,g in enumerate(h[1:]) if g.startswith('Idosos')][0]
    for r in rows:
        s=r[0].upper()
        k='BR' if s=='BRASIL' else (s if s in SIG else None)
        if k and len(r)>=1+3*gi+3:
            meta,doses,cob=[num(x) for x in r[1+3*gi:4+3*gi]]
            flu.setdefault(k,{})[yy]=cob; flu_abs.setdefault(k,{})[yy]=[meta,doses]
for y in range(2015,2021):
    rows=json.load(open(R/f'sipni_{y}.json',encoding='utf8')); yy=str(y)
    hi=[i for i,r in enumerate(rows) if 'Sigla' in r][0]; groups=rows[hi][rows[hi].index('Sigla')+1:]; sub=rows[hi+1]
    pos=0; idx=None
    for g in groups:
        if sub[pos]=='Categoria': pos+=1
        if g.startswith('Idosos'): idx=pos
        pos+=3
        if pos<len(sub) and sub[pos]=='Categoria': pos+=1
    assert idx is not None and sub[idx+2].startswith('Cobertura'),(y,sub[idx:idx+3])
    for r in rows[hi+2:]:
        if len(r)<=5: continue
        k=None
        if r[4] in SIG: k=r[4]
        else:
            m=re.match(r'(\d\d) - ',r[3])
            if m and int(m.group(1)) in UF: k=UF[int(m.group(1))][0]
            elif 'TOTAL' in (r[2],r[3]): k='BR'
        if not k: continue
        meta,doses,cob=[num(x) for x in r[5:][idx:idx+3]]
        flu.setdefault(k,{})[yy]=cob; flu_abs.setdefault(k,{})[yy]=[meta,doses]
rn=json.load(open(R/'gripe_rnds.json',encoding='utf8'))
for yy in ('2024','2025'):
    tn=td=0
    for k,(n_,d_,c_) in rn[yy].items():
        assert k in SIG
        n_,d_=num(n_),num(d_); tn+=n_; td+=d_
        flu.setdefault(k,{})[yy]=round(100*n_/d_,2); flu_abs.setdefault(k,{})[yy]=[d_,n_]
        assert abs(flu[k][yy]-num(c_.replace('%','')))<0.02,(k,yy)
    assert len(rn[yy])==27
    flu['BR'][yy]=round(100*tn/td,2); flu_abs['BR'][yy]=[td,tn]
raw="Totais;523.820.185;185.891.240;167.933.541;8.449.477|AC;1.764.301;715.347;598.072;20.478|AL;6.889.318;2.692.802;2.342.454;72.404|AM;9.116.394;3.602.534;3.059.371;138.086|AP;1.650.166;670.998;550.027;20.681|BA;36.300.305;12.886.936;11.409.299;361.059|CE;23.872.595;8.480.246;7.329.291;260.010|DF;7.497.672;2.637.308;2.438.415;140.988|ES;9.851.870;3.526.595;3.147.866;121.035|GO;15.783.494;6.036.696;5.271.648;222.219|MA;13.382.434;5.366.990;4.502.032;151.666|MG;53.408.493;18.762.380;17.175.266;746.332|MS;6.203.924;2.336.083;2.065.658;208.882|MT;7.156.559;2.898.534;2.484.780;116.726|PA;16.132.644;6.640.093;5.537.554;215.724|PB;10.132.329;3.660.492;3.329.059;77.431|PE;23.451.163;8.561.116;7.575.923;246.028|PI;9.274.668;3.106.669;2.836.474;103.959|PR;30.142.895;10.675.391;9.713.503;452.408|RJ;42.564.971;14.939.079;13.541.084;1.064.598|RN;8.827.571;3.042.717;2.714.619;72.845|RO;3.314.724;1.351.428;1.154.478;48.567|RR;1.155.278;530.713;390.074;28.113|RS;28.765.641;10.033.844;9.256.826;576.054|SC;16.877.529;6.414.336;5.808.899;308.990|SE;5.858.724;2.051.108;1.850.023;50.762|SP;131.533.430;43.066.135;40.831.539;2.577.249"
cov={}
for part in raw.split('|'):
    c=part.split(';'); cov['BR' if c[0]=='Totais' else c[0]]=[int(x.replace('.','')) for x in c[1:]]
cov['TO']=[cov['BR'][i]-sum(v[i] for k,v in cov.items() if k!='BR') for i in range(4)]
covid={k:{'total':v[0],'d1':v[1],'d2':v[2],'unica':v[3]} for k,v in cov.items()}
out={'years':YEARS,'ufs':[{'cod':c,'sigla':s,'nome':n,'reg':r} for c,(s,n,r) in UF.items()],'base':D,'flu':flu,'flu_abs':flu_abs,'rotina':rot,'covid':covid}
with SAIDA.open('w', encoding='utf8') as arquivo:
    json.dump(out, arquivo, ensure_ascii=False, separators=(',', ':'))
print('keys',{k:len(v) for k,v in D.items()})
print('flu BR',flu['BR']); print('flu SP',flu['SP']); print('flu por ano',{y:sum(1 for k in flu if y in flu[k]) for y in YEARS})
print('TO covid',covid['TO'],'pop TO 2022',D['pop']['TO']['2022'])
print('rotina',list(rot)); print('BCG BR',rot[list(rot)[0]].get('BR'))
b=D; print('taxa obitos BR 2019',round(1e5*b['obitos']['BR']['2019']/b['pop']['BR']['2019'],1),'intern',round(1e5*b['intern']['BR']['2019']/b['pop']['BR']['2019'],1))
print('soma UFs obitos 2019',sum(b['obitos'][k]['2019'] for k in b['obitos'] if k!='BR'),b['obitos']['BR']['2019'])
print(SAIDA.stat().st_size)
