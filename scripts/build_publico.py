"""Acrescenta o perfil do público do Google Ads (idade, gênero, renda, dispositivo, cidade) ao <cliente>/data.json.
Rode depois de build_data.py. Só clientes com "publico": true em clients.json são alterados.

Uso:
  python3 scripts/build_publico.py --start AAAA-MM-DD --end AAAA-MM-DD \\
      --idade idade.json --genero genero.json --renda renda.json --dispositivo disp.json --cidade cidade.json [--only SLUG]

Cada arquivo é a resposta do Windsor.ai get_data (connector google_ads) com date, account_name, impressions, clicks, spend, conversions e:
  --idade age_range_type · --genero gender_type · --renda income_range_type · --dispositivo device · --cidade city, region
"""
import argparse, json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS = json.load(open(os.path.join(ROOT, 'scripts', 'clients.json'), encoding='utf-8'))
LBL = {
 'idade': {'AGE_RANGE_18_24': '18 a 24', 'AGE_RANGE_25_34': '25 a 34', 'AGE_RANGE_35_44': '35 a 44', 'AGE_RANGE_45_54': '45 a 54', 'AGE_RANGE_55_64': '55 a 64', 'AGE_RANGE_65_UP': '65+', 'AGE_RANGE_UNDETERMINED': 'Não identificada'},
 'genero': {'MALE': 'Masculino', 'FEMALE': 'Feminino', 'UNDETERMINED': 'Não identificado'},
 'renda': {'INCOME_RANGE_90_UP': '10% com maior renda', 'INCOME_RANGE_80_90': '11–20%', 'INCOME_RANGE_70_80': '21–30%', 'INCOME_RANGE_60_70': '31–40%', 'INCOME_RANGE_50_60': '41–50%', 'INCOME_RANGE_0_50': '50% com menor renda', 'INCOME_RANGE_UNDETERMINED': 'Desconhecida'},
 'dispositivo': {'MOBILE': 'Smartphone', 'DESKTOP': 'Computador', 'TABLET': 'Tablet', 'CONNECTED_TV': 'TV conectada', 'OTHER': 'Outros'}}
SRC = {'idade': 'age_range_type', 'genero': 'gender_type', 'renda': 'income_range_type', 'dispositivo': 'device', 'cidade': 'city'}

def load(path):
    j = json.load(open(path, encoding='utf-8'))
    if isinstance(j, list) and j and isinstance(j[0], dict) and 'text' in j[0]: j = json.loads(j[0]['text'])
    if isinstance(j, dict): j = j.get('data', j)
    if isinstance(j, str): j = json.loads(j)
    return j

def rows(src, acc, a, kind):
    out = collections.OrderedDict()
    for r in src:
        d = str(r.get('date', ''))[:10]
        if r.get('account_name') != acc or not (a.start <= d <= a.end): continue
        raw = r.get(SRC[kind]) or ''
        if kind == 'cidade' and not raw: raw = 'Não identificada'
        k = (d, LBL.get(kind, {}).get(raw, raw.title() if kind == 'dispositivo' else raw))
        o = out.setdefault(k, {'data': d, 'grupo': k[1], 'impressoes': 0, 'cliques': 0, 'investimento': 0.0, 'conversoes': 0.0})
        o['impressoes'] += int(float(r.get('impressions') or 0)); o['cliques'] += int(float(r.get('clicks') or 0))
        o['investimento'] += float(r.get('spend') or 0); o['conversoes'] += float(r.get('conversions') or 0)
    return [dict(o, investimento=round(o['investimento'], 2), conversoes=round(o['conversoes'], 2)) for o in out.values() if o['impressoes'] or o['cliques']]

def main():
    ap = argparse.ArgumentParser()
    for f in ('start', 'end', 'idade', 'genero', 'renda', 'dispositivo', 'cidade'): ap.add_argument('--' + f, required=True)
    ap.add_argument('--only', action='append', default=[])
    a = ap.parse_args()
    data = {k: load(getattr(a, k)) for k in SRC}
    for slug, c in CLIENTS.items():
        if not c.get('publico') or 'google' not in c or (a.only and slug not in a.only): continue
        path = os.path.join(ROOT, slug, 'data.json')
        out = json.load(open(path, encoding='utf-8'))
        for k in SRC: out['pub_' + k + '_dia'] = rows(data[k], c['google']['account_name'], a, k)
        json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        tot = lambda k: sum(r['impressoes'] for r in out['pub_' + k + '_dia'])
        print(f"{slug} [público]: impressões idade {tot('idade')} · gênero {tot('genero')} · renda {tot('renda')} · dispositivo {tot('dispositivo')} · cidade {tot('cidade')}")

if __name__ == '__main__':
    main()
