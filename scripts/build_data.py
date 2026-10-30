"""Gera <cliente>/data.json a partir das respostas brutas das APIs.

Uso:
  python3 scripts/build_data.py --start AAAA-MM-DD --end AAAA-MM-DD \
      [--google google.json] [--meta meta.json]

google.json: resposta do Windsor.ai get_data (objeto com "data" ou lista de linhas) com os campos
  date, account_name, campaign, campaign_type, campaign_status, spend, impressions, clicks, conversions
meta.json: resposta do Meta Ads ads_get_ad_entities (level=campaign, time_increment=1) — objeto com
  "ad_entities" (texto JSON) ou lista de linhas com date_start, name, objective, effective_status,
  amount_spent, impressions, link_click, lead
Só os clientes cuja fonte foi informada são regravados.
"""
import argparse, json, datetime, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS = json.load(open(os.path.join(ROOT, 'scripts', 'clients.json'), encoding='utf-8'))

TYPE = {'pt': {'SEARCH': 'Pesquisa', 'PERFORMANCE_MAX': 'Performance Max', 'DISPLAY': 'Display', 'VIDEO': 'Vídeo (YouTube)', 'DEMAND_GEN': 'Demand Gen', 'SHOPPING': 'Shopping'},
        'en': {'SEARCH': 'Search', 'PERFORMANCE_MAX': 'Performance Max', 'DISPLAY': 'Display', 'VIDEO': 'Video (YouTube)', 'DEMAND_GEN': 'Demand Gen', 'SHOPPING': 'Shopping'}}
STATUS = {'pt': {'ENABLED': 'Ativa', 'ACTIVE': 'Ativa', 'PAUSED': 'Pausada', 'CAMPAIGN_PAUSED': 'Pausada', 'REMOVED': 'Removida'},
          'en': {'ENABLED': 'Active', 'ACTIVE': 'Active', 'PAUSED': 'Paused', 'CAMPAIGN_PAUSED': 'Paused', 'REMOVED': 'Removed'}}
OBJ = {'OUTCOME_LEADS': 'Cadastros', 'OUTCOME_ENGAGEMENT': 'Engajamento', 'OUTCOME_TRAFFIC': 'Tráfego', 'OUTCOME_AWARENESS': 'Reconhecimento', 'OUTCOME_SALES': 'Vendas', 'MESSAGES': 'Mensagens'}

def num(x):
    if isinstance(x, dict): x = x.get('value', 0)
    try: return float(x or 0)
    except (TypeError, ValueError): return 0.0

def load(path, key):
    j = json.load(open(path, encoding='utf-8'))
    if isinstance(j, list) and j and isinstance(j[0], dict) and 'text' in j[0]: j = json.loads(j[0]['text'])
    if isinstance(j, dict):
        j = j.get(key, j.get('data', j))
        if isinstance(j, str): j = json.loads(j)
    return j

def write(slug, rows, days, lang):
    agg = collections.OrderedDict()
    for r in rows:
        k = (r['data'], r['campanha'])
        o = agg.setdefault(k, {'data': r['data'], 'campanha': r['campanha'], 'tipo': r['tipo'], 'status': r['status'], 'investimento': 0, 'impressoes': 0, 'cliques': 0, 'conversoes': 0})
        for m in ('investimento', 'impressoes', 'cliques', 'conversoes'): o[m] += r[m]
    camp = []
    for o in agg.values():
        if o['investimento'] <= 0 and o['impressoes'] <= 0: continue
        o['investimento'] = round(o['investimento'], 2); o['impressoes'] = int(o['impressoes']); o['cliques'] = int(o['cliques']); o['conversoes'] = round(o['conversoes'], 2)
        camp.append(o)
    # status mais recente de cada campanha vale para todas as linhas
    last = {}
    for o in sorted(camp, key=lambda o: o['data']): last[o['campanha']] = o['status']
    for o in camp: o['status'] = last[o['campanha']]
    by = collections.defaultdict(lambda: [0, 0, 0, 0])
    for o in camp:
        b = by[o['data']]; b[0] += o['investimento']; b[1] += o['impressoes']; b[2] += o['cliques']; b[3] += o['conversoes']
    diario = [{'data': d, 'investimento': round(by[d][0], 2), 'impressoes': int(by[d][1]), 'cliques': int(by[d][2]), 'conversoes': round(by[d][3], 2)} for d in days]
    out = {'atualizado': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='minutes'), 'inicio': days[0], 'fim': days[-1], 'diario': diario, 'campanhas_dia': camp}
    os.makedirs(os.path.join(ROOT, slug), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, slug, 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    inv = round(sum(r['investimento'] for r in diario), 2); conv = round(sum(r['conversoes'] for r in diario), 1)
    last30 = diario[-30:]
    print(f"{slug}: {len(camp)} linhas de campanha | 90d investimento {inv} conversões {conv} | 30d investimento {round(sum(r['investimento'] for r in last30), 2)} conversões {round(sum(r['conversoes'] for r in last30), 1)} | últimos 3 dias investimento {round(sum(r['investimento'] for r in diario[-3:]), 2)}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--start', required=True); ap.add_argument('--end', required=True)
    ap.add_argument('--google'); ap.add_argument('--meta')
    a = ap.parse_args()
    s, e = datetime.date.fromisoformat(a.start), datetime.date.fromisoformat(a.end)
    days = [(s + datetime.timedelta(i)).isoformat() for i in range((e - s).days + 1)]
    g = load(a.google, 'data') if a.google else None
    m = load(a.meta, 'ad_entities') if a.meta else None
    for slug, c in CLIENTS.items():
        lang = c.get('lang', 'pt')
        if c['platform'] == 'google' and g is not None:
            rows = [{'data': r['date'][:10], 'campanha': r['campaign'], 'tipo': TYPE[lang].get(r.get('campaign_type'), (r.get('campaign_type') or '').title()),
                     'status': STATUS[lang].get(r.get('campaign_status'), r.get('campaign_status')), 'investimento': num(r['spend']), 'impressoes': num(r['impressions']),
                     'cliques': num(r['clicks']), 'conversoes': num(r['conversions'])}
                    for r in g if r.get('account_name') == c['account_name'] and a.start <= r['date'][:10] <= a.end]
            write(slug, rows, days, lang)
        if c['platform'] == 'meta' and m is not None:
            rows = [{'data': r['date_start'][:10], 'campanha': r['name'], 'tipo': OBJ.get(r.get('objective'), r.get('objective') or ''),
                     'status': STATUS[lang].get(r.get('effective_status'), r.get('effective_status')), 'investimento': num(r.get('amount_spent')),
                     'impressoes': num(r.get('impressions')), 'cliques': num(r.get('link_click')), 'conversoes': num(r.get('lead'))}
                    for r in m if r.get('name') and a.start <= r['date_start'][:10] <= a.end]
            write(slug, rows, days, lang)

if __name__ == '__main__':
    main()
