import re,urllib.request,urllib.parse,time
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.sel={}; s.cur=None; s.inputs=[]
    def handle_starttag(s,tag,attrs):
        a=dict(attrs)
        if tag=='select': s.cur=a.get('name'); s.sel[s.cur]={'opts':[]}
        elif tag=='option' and s.cur is not None: s.sel[s.cur]['opts'].append(a.get('value'))
        elif tag=='input': s.inputs.append(a)
    def handle_endtag(s,tag):
        if tag=='select': s.cur=None
def load(path):
    p=P(); p.feed(open(path,encoding='latin1').read()); return p
def query(p,defn,choose,retries=3):
    body=[]
    for k,v in p.sel.items():
        if not k or not v['opts']: continue
        vals=[o for o in v['opts'] if choose[k](o)] if k in choose else [v['opts'][0]]
        assert vals,k
        body+=[(k,x) for x in vals]
    for a in p.inputs:
        ty=a.get('type','').lower()
        if ty=='hidden' or (ty in('radio','checkbox') and 'checked' in a): body.append((a.get('name'),a.get('value','')))
    data='&'.join(urllib.parse.quote(k.encode('latin1'),safe='')+'='+urllib.parse.quote(v.encode('latin1'),safe='') for k,v in body).encode()
    for i in range(retries):
        try:
            r=urllib.request.urlopen(urllib.request.Request('http://tabnet.datasus.gov.br/cgi/webtabx.exe?'+defn,data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0'}),timeout=400).read().decode('latin1')
            cols=re.findall(r"addColumn\('number','([^']+)'\)",r); rows=[]
            for ln in r.splitlines():
                mm=re.match(r'\s*,?\s*\["\s*([^"]+)"\s*(.*)',ln)
                if mm: rows.append([mm.group(1)]+[(float(a) if a else None) for a,b in re.findall(r'\{v:\s*([-\d.]+)[^}]*\}|(null)',mm.group(2))])
            if cols and rows: return [['UF']+cols]+rows
            err='sem dados: '+re.sub(r'<[^>]+>|\s+',' ',r)[-300:]
        except Exception as e: err=str(e)
        time.sleep(6)
    raise RuntimeError(err)
