"""Gera <cliente>/data.json a partir das respostas brutas das APIs.

Uso:
  python3 scripts/build_data.py --start AAAA-MM-DD --end AAAA-MM-DD \
      [--google google.json] [--meta CONTA=meta.json ...]

--google: resposta do Windsor.ai get_data (connector google_ads) com os campos
  date, account_name, campaign, campaign_type, campaign_status, spend, impressions, clicks, conversions
  (pode trazer as várias contas juntas; o script separa por account_name).
--meta: uma por conta de anúncios do Meta, no formato CONTA=arquivo, ex.:
  --meta 891199770704631=/tmp/meta_imperial.json --meta 1501891061337822=/tmp/meta_debora.json
  Cada arquivo é a resposta de ads_get_ad_entities (level=campaign, time_increment=1) com
  name, effective_status, objective, amount_spent, impressions, link_click e lead e/ou results.
  Um caminho sem "CONTA=" vale para a conta do Imperial Ville (compatibilidade).

Clientes com as duas plataformas: se só uma fonte for informada, os dados da outra
são mantidos do data.json atual. Só clientes com alguma fonte informada são regravados.
"""
import argparse, json, datetime, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS = json.load(open(os.path.join(ROOT, 'scripts', 'clients.json'), encoding='utf-8'))
DEFAULT_META = '891199770704631'

TYPE = {'pt': {'SEARCH': 'Pesquisa', 'PERFORMANCE_MAX': 'Performance Max', 'DISPLAY': 'Display', 'VIDEO': 'Vídeo (YouTube)', 'DEMAND_GEN': 'Demand Gen', 'SHOPPING': 'Shopping'},
        'en': {'SEARCH': 'Search', 'PERFORMANCE_MAX': 'Performance Max', 'DISPLAY': 'Display', 'VIDEO': 'Video (YouTube)', 'DEMAND_GEN': 'Demand Gen', 'SHOPPING': 'Shopping'}}
STATUS = {'pt': {'ENABLED': 'Ativa', 'ACTIVE': 'Ativa', 'PAUSED': 'Pausada', 'CAMPAIGN_PAUSED': 'Pausada', 'REMOVED': 'Removida'},
          'en': {'ENABLED': 'Active', 'ACTIVE': 'Active', 'PAUSED': 'Paused', 'CAMPAIGN_PAUSED': 'Paused', 'REMOVED': 'Removed'}}
OBJ = {'OUTCOME_LEADS': 'Cadastros', 'OUTCOME_ENGAGEMENT': 'Engajamento', 'OUTCOME_TRAFFIC': 'Tráfego', 'OUTCOME_AWARENESS': 'Reconhecimento', 'OUTCOME_SALES': 'Vendas', 'MESSAGES': 'Mensagens'}
PLAT = {'google': 'Google Ads', 'meta': 'Meta Ads'}

def num(x):
    if isinstance(x, dict):
        if 'values' in x:
            vals = x.get('values') or []
            return num(vals[0].get('value')) if vals else 0.0
        x = x.get('value', 0)
    try: return float(x or 0)
    except (TypeError, ValueError): return 0.0

def load(path, key):
    j = json.load(open(path, encoding='utf-8'))
    if isinstance(j, list) and j and isinstance(j[0], dict) and 'text' in j[0]: j = json.loads(j[0]['text'])
    if isinstance(j, dict):
        j = j.get(key, j.get('data', j))
        if isinstance(j, str): j = json.loads(j)
    return j

def google_rows(g, c, lang, a):
    return [{'plataforma': 'Google Ads', 'data': r['date'][:10], 'campanha': r['campaign'],
             'tipo': TYPE[lang].get(r.get('campaign_type'), (r.get('campaign_type') or '').title()),
             'status': STATUS[lang].get(r.get('campaign_status'), r.get('campaign_status')),
             'investimento': num(r['spend']), 'impressoes': num(r['impressions']), 'cliques': num(r['clicks']), 'conversoes': num(r['conversions'])}
            for r in g if r.get('account_name') == c['account_name'] and a.start <= r['date'][:10] <= a.end]

def meta_rows(m, c, lang, a):
    field = c.get('result', 'lead')
    return [{'plataforma': 'Meta Ads', 'data': r['date_start'][:10], 'campanha': r['name'], 'tipo': OBJ.get(r.get('objective'), r.get('objective') or ''),
             'status': STATUS[lang].get(r.get('effective_status'), r.get('effective_status')), 'investimento': num(r.get('amount_spent')),
             'impressoes': num(r.get('impressions')), 'cliques': num(r.get('link_click')), 'conversoes': num(r.get(field))}
            for r in m if r.get('name') and a.start <= r['date_start'][:10] <= a.end]

def tidy(rows):
    agg = collections.OrderedDict()
    for r in rows:
        k = (r['plataforma'], r['data'], r['campanha'])
        o = agg.setdefault(k, {**{x: r[x] for x in ('plataforma', 'data', 'campanha', 'tipo', 'status')}, 'investimento': 0, 'impressoes': 0, 'cliques': 0, 'conversoes': 0})
        for m in ('investimento', 'impressoes', 'cliques', 'conversoes'): o[m] += r[m]
    camp = []
    for o in agg.values():
        if o['investimento'] <= 0 and o['impressoes'] <= 0: continue
        o['investimento'] = round(o['investimento'], 2); o['impressoes'] = int(o['impressoes']); o['cliques'] = int(o['cliques']); o['conversoes'] = round(o['conversoes'], 2)
        camp.append(o)
    last = {}
    for o in sorted(camp, key=lambda o: o['data']): last[(o['plataforma'], o['campanha'])] = o['status']
    for o in camp: o['status'] = last[(o['plataforma'], o['campanha'])]
    return sorted(camp, key=lambda o: (o['data'], o['plataforma'], o['campanha']))

def daily(camp, days):
    by = collections.defaultdict(lambda: [0, 0, 0, 0])
    for o in camp:
        b = by[o['data']]; b[0] += o['investimento']; b[1] += o['impressoes']; b[2] += o['cliques']; b[3] += o['conversoes']
    return [{'data': d, 'investimento': round(by[d][0], 2), 'impressoes': int(by[d][1]), 'cliques': int(by[d][2]), 'conversoes': round(by[d][3], 2)} for d in days]

def write(slug, camp, days, plats):
    out = {'atualizado': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'inicio': days[0], 'fim': days[-1],
           'diario': daily(camp, days), 'campanhas_dia': camp}
    if len(plats) > 1:
        out['plataformas'] = [PLAT[p] for p in plats]
        out['diario_plataforma'] = {PLAT[p]: daily([o for o in camp if o['plataforma'] == PLAT[p]], days) for p in plats}
    os.makedirs(os.path.join(ROOT, slug), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, slug, 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    for label, rows in [('total', out['diario'])] + [(k, v) for k, v in out.get('diario_plataforma', {}).items()]:
        l30 = rows[-30:]
        print(f"{slug} [{label}]: 90d investimento {round(sum(r['investimento'] for r in rows), 2)} conversões {round(sum(r['conversoes'] for r in rows), 1)} | "
              f"30d investimento {round(sum(r['investimento'] for r in l30), 2)} conversões {round(sum(r['conversoes'] for r in l30), 1)} | últimos 3 dias investimento {round(sum(r['investimento'] for r in rows[-3:]), 2)}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', required=True); ap.add_argument('--end', required=True)
    ap.add_argument('--google'); ap.add_argument('--meta', action='append', default=[])
    a = ap.parse_args()
    s, e = datetime.date.fromisoformat(a.start), datetime.date.fromisoformat(a.end)
    days = [(s + datetime.timedelta(i)).isoformat() for i in range((e - s).days + 1)]
    g = load(a.google, 'data') if a.google else None
    metas = {}
    for item in a.meta:
        acc, _, path = item.partition('=') if '=' in item else (DEFAULT_META, '', item)
        metas[acc] = load(path, 'ad_entities')
    for slug, c in CLIENTS.items():
        lang = c.get('lang', 'pt')
        plats = [p for p in ('google', 'meta') if p in c]
        have = {'google': 'google' in c and g is not None, 'meta': 'meta' in c and c['meta']['account'] in metas}
        if not any(have.values()): continue
        old = []
        path = os.path.join(ROOT, slug, 'data.json')
        if os.path.exists(path):
            prev = json.load(open(path, encoding='utf-8'))
            single = PLAT[plats[0]] if len(plats) == 1 else None
            old = [dict(r, plataforma=r.get('plataforma') or single) for r in prev.get('campanhas_dia', [])]
        rows = []
        for p in plats:
            if have[p]:
                rows += google_rows(g, c['google'], lang, a) if p == 'google' else meta_rows(metas[c['meta']['account']], c['meta'], lang, a)
            else:
                kept = [r for r in old if r.get('plataforma') == PLAT[p] and a.start <= r['data'] <= a.end]
                print(f"{slug}: sem dados novos de {PLAT[p]} — mantendo {len(kept)} linhas anteriores")
                rows += kept
        write(slug, tidy(rows), days, plats)

if __name__ == '__main__':
    main()
