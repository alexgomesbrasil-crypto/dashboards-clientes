"""Acrescenta os dados do Google Analytics 4 ao <cliente>/data.json (rode depois de build_data.py).

Uso:
  python3 scripts/build_ga.py --property 558741151 --start AAAA-MM-DD --end AAAA-MM-DD \\
      --canal canal.json --leads leads.json --local local.json --leads-local leads_local.json --paginas paginas.json

Cada arquivo é a resposta do Windsor.ai get_data (connector googleanalytics4) com os campos:
  --canal        date, session_default_channel_group, devicecategory, country, sessions, engaged_sessions, user_engagement_duration, screen_page_views
  --leads        date, event_name, session_default_channel_group, devicecategory, event_count
  --local        date, country, region, city, sessions, engaged_sessions, conversions
  --leads-local  date, event_name, session_default_channel_group, country, region, city, event_count
  --paginas      date, landing_page, sessions, engaged_sessions, conversions
"Leads" = evento form_submit (formulário enviado). Só o cliente com essa propriedade em clients.json é alterado.
"""
import argparse, json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS = json.load(open(os.path.join(ROOT, 'scripts', 'clients.json'), encoding='utf-8'))
LEAD = 'form_submit'

def load(path):
    j = json.load(open(path, encoding='utf-8'))
    if isinstance(j, list) and j and isinstance(j[0], dict) and 'text' in j[0]: j = json.loads(j[0]['text'])
    if isinstance(j, dict): j = j.get('data', j)
    if isinstance(j, str): j = json.loads(j)
    return j

def agg(rows, keys, vals, a, src_keys, src_vals, keep=lambda r: True):
    out = collections.OrderedDict()
    for r in rows:
        d = str(r.get('date', ''))[:10]
        if not (a.start <= d <= a.end) or not keep(r): continue
        k = (d,) + tuple(r.get(s) or '(not set)' for s in src_keys)
        o = out.setdefault(k, dict(zip(['data'] + keys, k), **{v: 0 for v in vals}))
        for v, s in zip(vals, src_vals): o[v] += float(r.get(s) or 0)
    res = []
    for o in out.values():
        if not any(o[v] for v in vals): continue
        for v in vals: o[v] = round(o[v]) if v != 'tempo' else round(o[v], 1)
        res.append(o)
    return sorted(res, key=lambda o: o['data'])

def main():
    ap = argparse.ArgumentParser()
    for f in ('property', 'start', 'end', 'canal', 'leads', 'local', 'leads-local', 'paginas'): ap.add_argument('--' + f, required=True)
    a = ap.parse_args()
    slug = next(s for s, c in CLIENTS.items() if c.get('ga', {}).get('property') == a.property)
    path = os.path.join(ROOT, slug, 'data.json')
    out = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    is_lead = lambda r: r.get('event_name') == LEAD
    out['ga_canal_dia'] = agg(load(a.canal), ['canal'], ['sessoes', 'engajadas', 'tempo', 'views'], a,
                              ['session_default_channel_group'], ['sessions', 'engaged_sessions', 'user_engagement_duration', 'screen_page_views'])
    out['ga_leads_dia'] = agg(load(a.leads), ['canal'], ['leads'], a, ['session_default_channel_group'], ['event_count'], is_lead)
    out['ga_local_dia'] = agg(load(a.local), ['pais', 'regiao', 'cidade'], ['sessoes', 'engajadas'], a, ['country', 'region', 'city'], ['sessions', 'engaged_sessions'])
    out['ga_leads_local'] = agg(load(getattr(a, 'leads_local')), ['pais', 'regiao', 'cidade', 'canal'], ['leads'], a,
                                ['country', 'region', 'city', 'session_default_channel_group'], ['event_count'], is_lead)
    out['ga_pagina_dia'] = agg(load(a.paginas), ['pagina'], ['sessoes', 'engajadas'], a, ['landing_page'], ['sessions', 'engaged_sessions'])
    out['ga_periodo'] = [a.start, a.end]
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    S = lambda k, v: sum(r[v] for r in out[k])
    print(f"{slug} [GA4 {a.property}]: sessões {S('ga_canal_dia', 'sessoes')} | engajadas {S('ga_canal_dia', 'engajadas')} | "
          f"leads (form_submit) {S('ga_leads_dia', 'leads')} | leads com localização {S('ga_leads_local', 'leads')} | "
          f"último dia com dados {max((r['data'] for r in out['ga_canal_dia']), default='—')}")

if __name__ == '__main__':
    main()
