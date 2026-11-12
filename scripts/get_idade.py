import json, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tabnet import form, query, filt, find

RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'raw')
alvo = sys.argv[1:] or ['sim', 'pop', 'sih']
ANOS = range(2010, 2026)


def tabela(rows):
    hdr = rows[0]
    return {r[0]: dict(zip(hdr[1:], r[1:])) for r in rows[1:] if len(r) == len(hdr)}


if 'sim' in alvo:
    p = os.path.join(RAW, 'sim.htm'); a, s = form(p)
    kc, vc = filt(s, 'SCategoria_CID', lambda l: l.startswith('I21') or l.startswith('I22'))
    out = {}
    for y in ANOS:
        out[str(y)] = tabela(query(p, 'Unidade da Federação', 'Faixa Etária', 'Óbitos p/Residênc', ['obtuf%02d.dbf' % (y % 100)], {kc: vc}))
        print('sim', y, len(out[str(y)]), flush=True)
    json.dump(out, open(os.path.join(RAW, 'idade_sim.json'), 'w', encoding='utf8'), ensure_ascii=False)

if 'pop' in alvo:
    p = os.path.join(RAW, 'pop.htm'); a, s = form(p)
    out = {}
    for y in ANOS:
        out[str(y)] = tabela(query(p, 'Unidade da Federação', 'Faixa Etária 1', 'População residente', ['projuf%02d.dbf' % (y % 100)]))
        print('pop', y, len(out[str(y)]), flush=True)
    json.dump(out, open(os.path.join(RAW, 'idade_pop.json'), 'w', encoding='utf8'), ensure_ascii=False)

if 'sih' in alvo or 'sih60' in alvo:
    p = os.path.join(RAW, 'sih.htm'); a, s = form(p)
    km, vm = filt(s, 'SLista_Morb', lambda l: 'infarto agudo do mioc' in l.lower())
    kf = find(s, 'SFaixa_Et')[0]
    files = [v for v, l in s['Arquivos'] if 1001 <= int(v[4:8]) <= 2608]
    so60 = 'sih60' in alvo
    so_faixa = next((x.split('=')[1] for x in alvo if x.startswith('faixa=')), None)
    dest = os.path.join(RAW, 'idade_sih_%s.json' % so_faixa if so_faixa else 'idade_sih_60.json' if so60 else 'idade_sih.json')
    out = json.load(open(dest, encoding='utf8')) if os.path.exists(dest) else {}
    for v, label in s[kf]:
        if v.startswith('TODAS') or label in out:
            continue
        if so60 and label[:2] not in ('60', '70', '80'):
            continue
        if so_faixa and not label.startswith(so_faixa):
            continue
        acc = collections.defaultdict(lambda: collections.defaultdict(int))
        for i in range(0, len(files), 48):
            try:
                rows = query(p, 'Unidade da Federação', 'Ano atendimento', 'Internações', files[i:i + 48], {km: vm, kf: [v]})
            except RuntimeError as e:
                if 'nenhum' in str(e).lower():
                    continue
                raise
            hdr = rows[0]
            for r in rows[1:]:
                if len(r) < len(hdr):
                    continue
                for h, c in zip(hdr[1:], r[1:]):
                    acc[r[0]][h] += int(c) if c.isdigit() else 0
        out[label] = {k: dict(x) for k, x in acc.items()}
        print('sih', label, len(out[label]), flush=True)
        json.dump(out, open(dest, 'w', encoding='utf8'), ensure_ascii=False)
