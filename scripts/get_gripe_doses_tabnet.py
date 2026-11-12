import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tabnetbd import load, query
RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'raw')
p = load(os.path.join(RAW, 'dpni.htm'))
idoso = lambda o: o.split('|')[0][:2].isdigit() and int(o.split('|')[0][:2]) >= 60
ch = {'Linha': lambda o: o.startswith('Unidade da Fed'), 'Coluna': lambda o: o.startswith('Ano|'),
      'PAno': lambda o: o[:4] in ('2010', '2013'),
      'SImunobiológicos': lambda o: o.split('|')[0] == 'Influenza (Campanha) (INF)',
      'SFaixa_Etária': idoso}
print([o.split('|')[0] for o in p.sel['SFaixa_Etária']['opts'] if idoso(o)])
rows = query(p, 'bd_pni/dpnibr.def', ch)
json.dump(rows, open(os.path.join(RAW, 'gripe_doses_tabnet.json'), 'w', encoding='utf8'), ensure_ascii=False)
for r in rows: print(r)
