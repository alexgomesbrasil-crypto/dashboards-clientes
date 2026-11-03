"""Acrescenta palavras-chave e termos de pesquisa do Google Ads ao <cliente>/data.json (rode depois de build_data.py).

Uso:
  python3 scripts/build_keywords.py --start AAAA-MM-DD --end AAAA-MM-DD --kw kw.json --termos termos.json

Arquivos = respostas do Windsor.ai get_data (connector google_ads), contas juntas:
  --kw      date, account_name, campaign, keyword_text, keyword_match_type, impressions, clicks, spend, conversions
  --termos  date, account_name, campaign, search_term, impressions, clicks, spend, conversions
Só clientes com "keywords": true em clients.json são alterados.
"""
import argparse, json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS = json.load(open(os.path.join(ROOT, 'scripts', 'clients.json'), encoding='utf-8'))
MATCH = {'BROAD': 'Ampla', 'PHRASE': 'Frase', 'EXACT': 'Exata'}

def load(path):
    j = json.load(open(path, encoding='utf-8'))
    if isinstance(j, list) and j and isinstance(j[0], dict) and 'text' in j[0]: j = json.loads(j[0]['text'])
    if isinstance(j, dict): j = j.get('data', j)
    if isinstance(j, str): j = json.loads(j)
    return j

def rows(src, acc, a, key, extra):
    out = collections.OrderedDict()
    for r in src:
        d = str(r.get('date', ''))[:10]
        if r.get('account_name') != acc or not (a.start <= d <= a.end) or not r.get(key): continue
        k = (d, r.get('campaign') or '', r[key].strip().strip('"')) + tuple(extra(r))
        o = out.setdefault(k, {'data': d, 'campanha': k[1], 'texto': k[2], **({'corresp': k[3]} if len(k) > 3 else {}),
                               'impressoes': 0, 'cliques': 0, 'investimento': 0.0, 'conversoes': 0.0})
        o['impressoes'] += int(float(r.get('impressions') or 0)); o['cliques'] += int(float(r.get('clicks') or 0))
        o['investimento'] += float(r.get('spend') or 0); o['conversoes'] += float(r.get('conversions') or 0)
    res = [dict(o, investimento=round(o['investimento'], 2), conversoes=round(o['conversoes'], 2)) for o in out.values() if o['impressoes'] or o['cliques']]
    return sorted(res, key=lambda o: o['data'])

def main():
    ap = argparse.ArgumentParser()
    for f in ('start', 'end', 'kw', 'termos'): ap.add_argument('--' + f, required=True)
    a = ap.parse_args()
    kw, tm = load(a.kw), load(a.termos)
    for slug, c in CLIENTS.items():
        if not c.get('keywords') or 'google' not in c: continue
        acc = c['google']['account_name']
        path = os.path.join(ROOT, slug, 'data.json')
        out = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
        out['kw_palavras_dia'] = rows(kw, acc, a, 'keyword_text', lambda r: [MATCH.get(r.get('keyword_match_type'), r.get('keyword_match_type') or '')])
        out['kw_termos_dia'] = rows(tm, acc, a, 'search_term', lambda r: [])
        json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        S = lambda k, v: round(sum(r[v] for r in out[k]), 1)
        print(f"{slug} [palavras-chave]: {len({r['texto'] for r in out['kw_palavras_dia']})} palavras, {len({r['texto'] for r in out['kw_termos_dia']})} termos | "
              f"cliques {S('kw_palavras_dia', 'cliques')} | conversões (palavras) {S('kw_palavras_dia', 'conversoes')} | conversões (termos) {S('kw_termos_dia', 'conversoes')}")

if __name__ == '__main__':
    main()
