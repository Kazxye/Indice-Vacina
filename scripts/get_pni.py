import re,json,sys,html,time,urllib.request,urllib.parse
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True); s.sel={}; s.cur=None; s.inputs=[]
    def handle_starttag(s,tag,attrs):
        a=dict(attrs)
        if tag=='select': s.cur=a.get('name'); s.sel[s.cur]={'multi':'multiple' in a,'opts':[]}
        elif tag=='option' and s.cur is not None: s.sel[s.cur]['opts'].append([a.get('value'),'selected' in a])
        elif tag=='input': s.inputs.append(a)
    def handle_endtag(s,tag):
        if tag=='select': s.cur=None
t=open('../raw/pni.htm',encoding='latin1').read()
p=P(); p.feed(t)
if len(sys.argv)>1 and sys.argv[1]=='info':
    for k,v in p.sel.items(): print(repr(k),v['multi'],len(v['opts']),[o[0][:40] for o in v['opts'] if o[1]][:3])
    for a in p.inputs:
        if a.get('type','').lower()!='button': print(a)
    sys.exit()
def q(incr,anos):
    body=[]
    for k,v in p.sel.items():
        if not k or not v['opts']: continue
        if k=='Linha': vals=[o[0] for o in v['opts'] if o[0].startswith('Unidade da Fed')]
        elif k=='Coluna': vals=[o[0] for o in v['opts'] if o[0].startswith('Ano|')]
        elif k=='Incremento': vals=[o[0] for o in v['opts'] if o[0].split('|')[0]==incr]
        elif k=='PAno': vals=[o[0] for o in v['opts'] if int(o[0][:4]) in anos]
        else: vals=[v['opts'][0][0]]
        body+=[(k,x) for x in vals]
    for a in p.inputs:
        ty=a.get('type','').lower()
        if ty=='hidden' or (ty in('radio','checkbox') and 'checked' in a): body.append((a.get('name'),a.get('value','')))
    body=[(k,v) for k,v in body if not(k=='formato')]+[('formato','prn')]
    data='&'.join(urllib.parse.quote(k.encode('latin1'),safe='')+'='+urllib.parse.quote(v.encode('latin1'),safe='') for k,v in body).encode()
    r=urllib.request.urlopen(urllib.request.Request('http://tabnet.datasus.gov.br/cgi/webtabx.exe?bd_pni/cpnibr.def',data=data,headers={'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0'}),timeout=300).read().decode('latin1')
    return r
names=[o[0].split('|')[0] for o in p.sel['Incremento']['opts']]
if sys.argv[1]=='test':
    r=q(names[0],range(2010,2023)); open('../raw/pni_test.htm','w',encoding='latin1').write(r)
    m=re.search(r'<pre>(.*?)</pre>',r,re.I|re.S); print(len(r)); print((m.group(1) if m else re.sub(r'<[^>]+>',' ',r))[:1500])
else:
    out={}
    for n in names:
        for i in range(3):
            try:
                r=q(n,range(2010,2023))
                cols=re.findall(r"addColumn\('number','(\d{4})'\)",r)
                rows=[]
                for ln in r.splitlines():
                    mm=re.match(r'\s*,?\s*\["\s*([^"]+)"\s*(.*)',ln)
                    if mm:
                        cells=[c.strip() for c in re.split(r',(?=\s*(?:\{|null))',mm.group(2).rstrip(' ]'))[1:]] if False else re.findall(r'\{v:\s*([-\d.]+)[^}]*\}|(null)',mm.group(2))
                        rows.append([mm.group(1)]+[ (float(a) if a else None) for a,b in cells])
                assert cols and rows
                out[n]=[['UF']+cols]+rows
                print(n,len(out[n]),out[n][-1][:5],flush=True); break
            except Exception as e: print('ERR',n,e,flush=True); time.sleep(5)
    json.dump(out,open('../raw/pni.json','w',encoding='utf8'),ensure_ascii=False)
