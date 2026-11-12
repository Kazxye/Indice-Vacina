import re,urllib.request,urllib.parse,html,time
def form(path):
    t=open(path,encoding='latin1').read()
    action=re.search(r'<form\s+action="([^"]+)"',t,re.I).group(1)
    sels={}
    for m in re.finditer(r'<select[^>]*name="?([^" >]+)"?[^>]*>(.*?)</select>',t,re.I|re.S):
        sels[m.group(1)]=[(v,html.unescape(l).strip()) for v,l in re.findall(r'<option\s+value="([^"]*)"[^>]*>([^<\r\n]*)',m.group(2),re.I)]
    return action,sels
def find(sels,name_sub):
    return [k for k in sels if name_sub.lower() in k.lower()]
def query(path,linha,coluna,incr,arquivos,filtros={},host='http://tabnet.datasus.gov.br',retries=4):
    action,sels=form(path)
    def pick(sel,sub):
        for v,l in sels[sel]:
            if v.replace('_',' ').lower()==sub.lower() or l.lower()==sub.lower(): return v
        raise KeyError((sel,sub,[l for v,l in sels[sel]]))
    body=[('Linha',pick('Linha',linha)),('Coluna',pick('Coluna',coluna)),('Incremento',pick('Incremento',incr))]
    body+=[('Arquivos',a) for a in arquivos]
    for k in sels:
        if k.startswith('S'):
            vals=filtros.get(k,['TODAS_AS_CATEGORIAS__'])
            body+=[(k,v) for v in vals]
    body+=[('formato','prn'),('mostre','Mostra')]
    data='&'.join(urllib.parse.quote(k.encode('latin1'),safe='')+'='+urllib.parse.quote(str(v).encode('latin1'),safe='') for k,v in body).encode()
    for i in range(retries):
        try:
            r=urllib.request.urlopen(urllib.request.Request(host+action,data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0'}),timeout=180).read().decode('latin1')
            m=re.search(r'<pre>(.*?)</pre>',r,re.I|re.S)
            if m: break
            err=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',r)))[:1500]
        except Exception as e: err=str(e)
        time.sleep(5)
    else: raise RuntimeError(err)
    rows=[[c.strip().strip('"') for c in ln.split(';')] for ln in html.unescape(m.group(1)).strip().splitlines() if ln.strip()]
    return rows
def filt(sels,key_sub,pred):
    k=find(sels,key_sub)[0]
    return k,[v for v,l in sels[k] if pred(l)]
