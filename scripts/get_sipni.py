import re,html,sys,json,urllib.request,urllib.parse,http.cookiejar,time
U='http://sipni.datasus.gov.br/si-pni-web/faces/relatorio/consolidado/coberturaVacinalCampanhaInfluenza.jsf'
def run(ano):
    cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)); op.addheaders=[('User-Agent','Mozilla/5.0')]
    t=op.open(U,timeout=90).read().decode('latin1')
    fm=re.search(r'<form id="relatorioEnvioForm".*?</form>',t,re.S).group(0)
    vs=re.search(r'name="javax.faces.ViewState"[^>]*value="([^"]+)"',fm).group(1)
    body={'javax.faces.partial.ajax':'true','javax.faces.source':'relatorioEnvioForm:pesquisar','javax.faces.partial.execute':'relatorioEnvioForm',
          'javax.faces.partial.render':'relatorioEnvioForm:listaCobertura errorMessage','relatorioEnvioForm:pesquisar':'relatorioEnvioForm:pesquisar',
          'relatorioEnvioForm':'relatorioEnvioForm','relatorioEnvioForm:ano_input':str(ano),'relatorioEnvioForm:console2':'ESTADO',
          'relatorioEnvioForm:regiao_input':'','relatorioEnvioForm:estadual_input':'','relatorioEnvioForm:tipoEas_input':'','javax.faces.ViewState':vs}
    r=op.open(urllib.request.Request(U,data=urllib.parse.urlencode(body).encode(),headers={'Faces-Request':'partial/ajax','X-Requested-With':'XMLHttpRequest','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'}),timeout=300).read().decode('utf8','replace')
    open(f'../raw/sipni_{ano}.xml','w',encoding='utf8').write(r)
    rows=[]
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',r,re.S):
        c=[re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>','',x))).strip() for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>',tr,re.S)]
        if any(c): rows.append(c)
    return rows,len(r)
for ano in [int(a) for a in sys.argv[1:]]:
    try:
        rows,n=run(ano); print(ano,n,len(rows))
        for r in rows[:5]: print('  ',r[:26])
        json.dump(rows,open(f'../raw/sipni_{ano}.json','w',encoding='utf8'),ensure_ascii=False)
    except Exception as e: print(ano,'ERR',e)
