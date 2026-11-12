import csv, json, math, os, re, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
RAW = os.path.join(RAIZ, 'raw')
SAIDA = os.path.join(RAIZ, 'public', 'data')
os.makedirs(SAIDA, exist_ok=True)

d = json.load(open(os.path.join(AQUI, 'data.json'), encoding='utf8'))
ANOS = d['years']
B = d['base']
UFS = {u['sigla']: u for u in d['ufs']}
COD = {u['cod']: u['sigla'] for u in d['ufs']}
CHAVES = ['BR'] + list(UFS)
DATA_EXTRACAO = '2026-11-11'


def carrega(nome):
    p = os.path.join(RAW, nome)
    return json.load(open(p, encoding='utf8')) if os.path.exists(p) else None


def uf_de(rotulo):
    rotulo = rotulo.strip()
    if rotulo.lower().startswith('total'):
        return 'BR'
    m = re.match(r'(\d\d)\s', rotulo)
    return COD.get(int(m.group(1))) if m else None


def inteiro(v):
    if isinstance(v, (int, float)):
        return int(v)
    v = str(v).replace('.', '').strip()
    return int(v) if v.isdigit() else 0


FAIXAS = ['0 a 4', '5 a 9', '10 a 14', '15 a 19', '20 a 29', '30 a 39', '40 a 49', '50 a 59', '60 a 69', '70 a 79', '80 e mais']
FAIXAS60 = FAIXAS[-3:]


def faixa_evento(rotulo):
    r = rotulo.lower()
    if r.startswith('menor 1') or r.startswith('1 a 4'):
        return '0 a 4'
    if r.startswith('80'):
        return '80 e mais'
    m = re.match(r'(\d+) a (\d+) anos', r)
    return '%s a %s' % m.groups() if m and '%s a %s' % m.groups() in FAIXAS else None


def faixa_pop(rotulo):
    m = re.match(r'(\d+)', rotulo)
    if not m:
        return None
    i = int(m.group(1))
    if i >= 80:
        return '80 e mais'
    if i < 20:
        return FAIXAS[i // 5]
    return FAIXAS[4 + (i - 20) // 10]


def por_idade_ano(bruto, faixa_fn):
    out = {}
    for ano, tab in (bruto or {}).items():
        for rot, cols in tab.items():
            uf = uf_de(rot)
            if not uf:
                continue
            acc = out.setdefault((uf, ano), {})
            for col, v in cols.items():
                f = faixa_fn(col)
                if f:
                    acc[f] = acc.get(f, 0) + inteiro(v)
    return out


POP_ID = por_idade_ano(carrega('idade_pop.json'), faixa_pop)
OBI_ID = por_idade_ano(carrega('idade_sim.json'), faixa_evento)

INT_ID = {}
sih = {}
for _arq in sorted(f for f in os.listdir(RAW) if f.startswith('idade_sih') and f.endswith('.json')):
    sih.update(carrega(_arq) or {})
faixas_sih = set()
for rot_faixa, tab in sih.items():
    f = faixa_evento(rot_faixa)
    if not f:
        continue
    faixas_sih.add(rot_faixa)
    for rot, cols in tab.items():
        uf = uf_de(rot)
        if not uf:
            continue
        for ano, v in cols.items():
            if ano in ANOS:
                acc = INT_ID.setdefault((uf, ano), {})
                acc[f] = acc.get(f, 0) + inteiro(v)
SIH_COBRE = {faixa_evento(r) for r in faixas_sih}
SIH_TEM_MENOR5 = any(r.lower().startswith('menor 1') for r in faixas_sih) and any(r.lower().startswith('1 a 4') for r in faixas_sih)
SIH_OK_TODAS = SIH_TEM_MENOR5 and all(f in SIH_COBRE for f in FAIXAS)
SIH_OK_60 = all(f in SIH_COBRE for f in FAIXAS60)

ANO_PADRAO = '2022'
PADRAO = POP_ID.get(('BR', ANO_PADRAO), {})


def padronizada(eventos, pop, faixas):
    if not eventos or not pop or not PADRAO:
        return None
    total_w = sum(PADRAO.get(f, 0) for f in faixas)
    if not total_w:
        return None
    s = 0.0
    for f in faixas:
        if not pop.get(f):
            return None
        s += PADRAO[f] / total_w * (eventos.get(f, 0) / pop[f])
    return round(1e5 * s, 1)


def taxa(n, p):
    return round(1e5 * n / p, 1) if p else None


infarto = []
I = {}
for uf in CHAVES:
    for ano in ANOS:
        pop, pop60 = B['pop'][uf][ano], B['pop60'][uf][ano]
        o, o60, i, i60 = B['obitos'][uf][ano], B['obitos60'][uf][ano], B['intern'][uf][ano], B['intern60'][uf][ano]
        pid, oid, iid = POP_ID.get((uf, ano)), OBI_ID.get((uf, ano)), INT_ID.get((uf, ano))
        r = {
            'uf': uf, 'ano': int(ano), 'pop': pop, 'pop60': pop60,
            'obitos': o, 'obitos60': o60, 'intern': i, 'intern60': i60,
            'tx_obitos': taxa(o, pop), 'tx_obitos60': taxa(o60, pop60),
            'tx_intern': taxa(i, pop), 'tx_intern60': taxa(i60, pop60),
            'txp_obitos': padronizada(oid, pid, FAIXAS), 'txp_obitos60': padronizada(oid, pid, FAIXAS60),
            'txp_intern': padronizada(iid, pid, FAIXAS) if SIH_OK_TODAS else None,
            'txp_intern60': padronizada(iid, pid, FAIXAS60) if SIH_OK_60 else None,
            'preliminar': ano == '2025',
        }
        infarto.append(r)
        I[(uf, int(ano))] = r

FONTES_GRIPE = {
    'pni': {'fonte': 'PNI/DATASUS (consulta de campanhas)', 'metodo': 'consolidado', 'geo': 'UF de registro da dose (ocorrência)', 'data_ref': 'encerramento da campanha do ano', 'catalogo': 'pni-campanhas'},
    'sipni': {'fonte': 'SI-PNI Web', 'metodo': 'consolidado', 'geo': 'UF de registro da dose (ocorrência)', 'data_ref': 'consolidado final da campanha do ano', 'catalogo': 'sipni-web'},
    'rnds': {'fonte': 'Painel do Ministério da Saúde (RNDS)', 'metodo': 'nominal', 'geo': 'UF de residência', 'data_ref': 'painel atualizado em 10/11/2026', 'catalogo': 'painel-rnds'},
    'tabnet': {'fonte': 'TabNet/DATASUS, doses aplicadas', 'metodo': 'consolidado', 'geo': 'UF de registro da dose (ocorrência)', 'data_ref': 'base encerrada (dados até 2022)', 'catalogo': 'tabnet-doses'},
    'ms_camara': {'fonte': 'Ministério da Saúde, apresentação à Câmara dos Deputados (11/06/2025)', 'metodo': None, 'geo': 'Brasil', 'data_ref': 'dados de junho de 2025, sujeitos a alterações', 'catalogo': 'ms-camara-2025'},
}
SERIE_MS = {2012: 82.1, 2013: 88.0, 2014: 86.1, 2015: 89.1, 2016: 97.1, 2017: 94.6, 2018: 97.2, 2019: 99.4, 2020: 120.7, 2021: 70.9, 2022: 70.2, 2023: 63.3, 2024: 48.4}

doses_tabnet = {}
for linha in (carrega('gripe_doses_tabnet.json') or [])[1:]:
    uf = uf_de(linha[0])
    if uf:
        doses_tabnet[uf] = {'2010': linha[1], '2013': linha[2]}

gripe = []
G = {}
for uf in CHAVES:
    for ano in ANOS:
        a = int(ano)
        cob = d['flu'].get(uf, {}).get(ano)
        meta, doses = d['flu_abs'].get(uf, {}).get(ano, [None, None])
        r = {'uf': uf, 'ano': a, 'cobertura': None, 'doses': None, 'pop_alvo': None, 'origem': None, 'metodo': None, 'situacao': 'ausente', 'nota': None}
        if cob is not None:
            origem = 'pni' if a <= 2014 else 'sipni' if a <= 2020 else 'rnds'
            r.update(cobertura=round(cob, 1), doses=int(doses), pop_alvo=int(meta), origem=origem, metodo=FONTES_GRIPE[origem]['metodo'], situacao='oficial')
        elif a == 2010 and uf in doses_tabnet:
            r.update(doses=int(doses_tabnet[uf]['2010']), origem='tabnet', metodo='consolidado', situacao='parcial',
                     nota='Só o número de doses em pessoas de 60+ está publicado; a população-alvo de 2010 não consta na fonte, então a cobertura fica em branco.')
        elif uf == 'BR' and a in (2021, 2022, 2023):
            r.update(cobertura=SERIE_MS[a], origem='ms_camara', metodo='consolidado' if a <= 2022 else 'nominal', situacao='nacional',
                     nota='Valor nacional publicado pelo Ministério da Saúde, sem doses nem população-alvo. Não existe valor por UF nas fontes consultadas.')
        elif a in (2021, 2022, 2023):
            r.update(situacao='pendente', nota='Sem valor oficial por UF localizado para o grupo de 60+ neste ano.')
        gripe.append(r)
        G[(uf, a)] = r

def pearson(xs, ys):
    n = len(xs)
    if n < 8:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sx = sum((x - mx) ** 2 for x in xs); sy = sum((y - my) ** 2 for y in ys)
    if sx == 0 or sy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / math.sqrt(sx * sy)


PERIODOS = {
    'principal': {'rotulo': '2011–2019 (período comparável)', 'de': 2011, 'ate': 2019, 'metodo': 'consolidado',
                  'regra': 'Cobertura de campanha do SI-PNI/PNI (método consolidado) de 2011 a 2019, antes da pandemia.'},
    'sensibilidade': {'rotulo': '2011–2020 (sensibilidade, inclui 2020)', 'de': 2011, 'ate': 2020, 'metodo': 'consolidado',
                      'regra': 'Mesmo método do período principal, acrescentando 2020, primeiro ano da pandemia e com cobertura acima de 100% em vários estados.'},
    'recente': {'rotulo': '2024–2025 (série recente, RNDS)', 'de': 2024, 'ate': 2025, 'metodo': 'nominal',
                'regra': 'Cobertura por registro nominal na RNDS em 2024 e 2025. Apresentada à parte porque o método e a população-alvo são outros.'},
}
associacoes = []
for pid, per in PERIODOS.items():
    anos = list(range(per['de'], per['ate'] + 1))
    for desfecho in ('obitos', 'intern'):
        for tipo, col in (('padronizada', 'txp_%s60' % desfecho), ('bruta', 'tx_%s60' % desfecho)):
            for modo in ('nivel', 'variacao'):
                xs, ys, ufs_usadas = [], [], set()
                for uf in UFS:
                    for a in anos:
                        g, t = G[(uf, a)], I[(uf, a)][col]
                        if g['cobertura'] is None or g['metodo'] != per['metodo'] or t is None:
                            continue
                        if modo == 'nivel':
                            xs.append(g['cobertura']); ys.append(t); ufs_usadas.add(uf)
                        elif a > per['de']:
                            g0, t0 = G[(uf, a - 1)], I[(uf, a - 1)][col]
                            if g0['cobertura'] is None or g0['metodo'] != per['metodo'] or t0 is None:
                                continue
                            xs.append(g['cobertura'] - g0['cobertura']); ys.append(t - t0); ufs_usadas.add(uf)
                r = pearson(xs, ys)
                associacoes.append({'periodo': pid, 'desfecho': desfecho, 'taxa': tipo, 'modo': modo,
                                    'r': None if r is None else round(r, 2), 'n_obs': len(xs), 'n_ufs': len(ufs_usadas),
                                    'disponivel': r is not None})

validacoes = []
for a, v in SERIE_MS.items():
    meu = G[('BR', a)]
    if meu['origem'] in ('pni', 'sipni', 'rnds'):
        validacoes.append({'indicador': 'Cobertura de influenza em 60+, Brasil', 'ano': a, 'valor_painel': meu['cobertura'], 'fonte_painel': FONTES_GRIPE[meu['origem']]['fonte'],
                           'valor_outro': v, 'fonte_outro': FONTES_GRIPE['ms_camara']['fonte'] + ', ' + FONTES_GRIPE['ms_camara']['data_ref'],
                           'diferenca': round(meu['cobertura'] - v, 1),
                           'leitura': 'Coincide.' if abs(meu['cobertura'] - v) < 0.15 else 'Diverge: o painel da RNDS foi lido em 11/11/2026 e segue recebendo registros; a apresentação usa dados de junho de 2025.'})
if 'SP' in doses_tabnet:
    validacoes.append({'indicador': 'Doses de influenza em 60+, São Paulo', 'ano': 2010, 'valor_painel': int(doses_tabnet['SP']['2010']), 'fonte_painel': FONTES_GRIPE['tabnet']['fonte'],
                       'valor_outro': 3399539, 'fonte_outro': 'CVE/SES-SP, informe da campanha de 2011 (cobertura de 74,95% ao final da Campanha do Idoso de 2010)',
                       'diferenca': int(doses_tabnet['SP']['2010']) - 3399539, 'leitura': 'Diferença de 430 doses (0,01%), compatível com datas de fechamento diferentes.'})
    br13 = G[('BR', 2013)]
    validacoes.append({'indicador': 'Doses de influenza em 60+, Brasil', 'ano': 2013, 'valor_painel': br13['doses'], 'fonte_painel': FONTES_GRIPE['pni']['fonte'],
                       'valor_outro': int(doses_tabnet['BR']['2013']), 'fonte_outro': FONTES_GRIPE['tabnet']['fonte'],
                       'diferenca': br13['doses'] - int(doses_tabnet['BR']['2013']), 'leitura': 'Diverge: em 2013 o TabNet de doses não traz as faixas de 80 anos ou mais, por isso soma menos que o consolidado da campanha. Em 2010 as faixas estão completas.'})
validacoes.append({'indicador': 'Cobertura de influenza em 60+, Paraíba', 'ano': 2024, 'valor_painel': G[('PB', 2024)]['cobertura'], 'fonte_painel': FONTES_GRIPE['rnds']['fonte'] + ', lido em 11/11/2026',
                   'valor_outro': 46.9, 'fonte_outro': 'SES-PB, Nota Informativa Influenza nº 18, de 17/06/2024 (288.680 doses sobre 615.328 idosos)',
                   'diferenca': round(G[('PB', 2024)]['cobertura'] - 46.9, 1), 'leitura': 'Mesma população-alvo (615.328). O boletim estadual é parcial, de junho de 2024; o painel federal inclui doses registradas depois.'})

painel = {
    'gerado_em': datetime.date.today().isoformat(),
    'data_extracao': DATA_EXTRACAO,
    'anos': [int(a) for a in ANOS],
    'ufs': [{'sigla': 'BR', 'nome': 'Brasil', 'regiao': ''}] + [{'sigla': s, 'nome': u['nome'], 'regiao': u['reg']} for s, u in UFS.items()],
    'padronizacao': {'metodo': 'direta', 'populacao_padrao': 'Brasil, %s (IBGE, projeção edição 2024)' % ANO_PADRAO, 'faixas': FAIXAS, 'faixas60': FAIXAS60,
                     'obitos': bool(OBI_ID), 'intern60': bool(INT_ID) and SIH_OK_60, 'intern_todas': bool(INT_ID) and SIH_OK_TODAS},
    'qualidade': {
        'obitos_preliminar': {'ano': 2025, 'texto': 'Óbitos de 2025 são preliminares (SIM, extração do Ministério em 28/07/2026) e ainda podem aumentar.'},
        'sih': 'O SIH/SUS registra internações financiadas pelo SUS, inclusive em hospitais privados conveniados. Internações pagas exclusivamente por planos de saúde ou particulares ficam de fora.',
    },
    'fontes_gripe': FONTES_GRIPE,
    'periodos': PERIODOS,
    'infarto': infarto,
    'gripe': gripe,
    'associacoes': associacoes,
    'validacoes': validacoes,
}
json.dump(painel, open(os.path.join(SAIDA, 'painel.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))

with open(os.path.join(SAIDA, 'rotina.csv'), 'w', newline='', encoding='utf8') as f:
    w = csv.writer(f); w.writerow(['vacina', 'uf', 'ano', 'cobertura'])
    for vac, dd in d['rotina'].items():
        nome = ' '.join(vac.split())
        for uf in CHAVES:
            for ano in ANOS:
                v = dd.get(uf, {}).get(ano)
                if v is not None:
                    w.writerow([nome, uf, ano, round(v, 1)])
with open(os.path.join(SAIDA, 'covid.csv'), 'w', newline='', encoding='utf8') as f:
    w = csv.writer(f); w.writerow(['uf', 'nome', 'doses_total', 'dose1', 'dose2', 'dose_unica', 'esquema_por100', 'derivado'])
    for uf in CHAVES:
        c = d['covid'][uf]
        w.writerow([uf, 'Brasil' if uf == 'BR' else UFS[uf]['nome'], c['total'], c['d1'], c['d2'], c['unica'], round(100 * (c['d2'] + c['unica']) / B['pop'][uf]['2022'], 1), 'sim' if uf == 'TO' else 'nao'])

print('painel.json', os.path.getsize(os.path.join(SAIDA, 'painel.json')), 'bytes')
print('padronizacao', painel['padronizacao'])
print('BR 2019', I[('BR', 2019)])
print('gripe BR', [(g['ano'], g['cobertura'], g['situacao']) for g in gripe if g['uf'] == 'BR'])
for a in associacoes:
    if a['modo'] == 'variacao':
        print(a)
for v in validacoes:
    print(v['indicador'], v['ano'], v['valor_painel'], v['valor_outro'], v['diferenca'])
