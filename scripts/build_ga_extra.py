"""Acrescenta ao <cliente>/data.json as tabelas extras do Google Analytics 4 (rode depois de build_ga.py).

Uso:
  python3 scripts/build_ga_extra.py --property 562081470 --start AAAA-MM-DD --end AAAA-MM-DD \\
      --dispositivo f.json --usuario f.json --hora f.json --hora-leads f.json
(com ga.ads_only, todas as consultas precisam de session_source_medium e landing_page)

Campos de cada arquivo (Windsor.ai get_data, connector googleanalytics4):
  --dispositivo  date, devicecategory, sessions, engaged_sessions, user_engagement_duration, screen_page_views
  --usuario      date, new_vs_returning, sessions, engaged_sessions, user_engagement_duration
  --hora         date, hour, sessions, engaged_sessions
  --hora-leads   date, hour, event_name, link_domain, event_count   (o 'lead' vem de clients.json > ga.lead)
  --fonte        date, session_source_medium, sessions, engaged_sessions, user_engagement_duration
  --eventos      date, event_name, event_count
Tabelas gravadas: ga_dispositivo_dia, ga_usuario_dia, ga_hora_dia, ga_hora_leads, ga_fonte_dia, ga_evento_dia.
"""
import argparse, json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENTS = json.load(open(os.path.join(ROOT, 'scripts', 'clients.json'), encoding='utf-8'))

def load(path):
    j = json.load(open(path, encoding='utf-8'))
    if isinstance(j, list) and j and isinstance(j[0], dict) and 'text' in j[0]: j = json.loads(j[0]['text'])
    if isinstance(j, dict): j = j.get('data', j)
    if isinstance(j, str): j = json.loads(j)
    return j

def agg(rows, a, dim_name, dim_src, vals, keep=lambda r: True, cast=lambda v: v):
    out = collections.OrderedDict()
    for r in rows:
        d = str(r.get('date', ''))[:10]
        if not (a.start <= d <= a.end) or not keep(r): continue
        dv = cast(r.get(dim_src) or '(not set)')
        o = out.setdefault((d, dv), {'data': d, dim_name: dv, **{k: 0 for k, _ in vals}})
        for k, s in vals: o[k] += float(r.get(s) or 0)
    res = sorted(out.values(), key=lambda o: (o['data'], str(o[dim_name])))
    for o in res:
        for k, _ in vals: o[k] = round(o[k], 2) if k == 'tempo' else int(round(o[k]))
    return res

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--property', required=True); ap.add_argument('--start', required=True); ap.add_argument('--end', required=True)
    for n in ('dispositivo', 'usuario', 'hora', 'hora-leads'): ap.add_argument('--' + n, required=True)
    a = ap.parse_args()
    slug, cfg = next(((s, c) for s, c in CLIENTS.items() if str((c.get('ga') or {}).get('property')) == a.property), (None, None))
    if not slug: raise SystemExit('propriedade GA4 não encontrada em clients.json: ' + a.property)
    lead = cfg['ga'].get('lead') or {'event': 'form_submit'}
    path = os.path.join(ROOT, slug, 'data.json')
    out = json.load(open(path, encoding='utf-8'))
    ads = cfg['ga'].get('ads_only')
    norm = lambda x: '/' + str(x or '').split('?')[0].split('#')[0].strip('/').lower()
    def anuncio(r):  # mesmo filtro do build_ga.py: só visitas dos anúncios
        if not ads: return True
        if 'session_source_medium' not in r or 'landing_page' not in r:
            raise SystemExit(f"{slug}: ga.ads_only exige session_source_medium e landing_page em todas as consultas do GA4")
        return r['session_source_medium'] == ads['source_medium'] and norm(r['landing_page']) in {norm(p) for p in ads['landing_pages']}
    S = [('sessoes', 'sessions'), ('engajadas', 'engaged_sessions')]
    ST = S + [('tempo', 'user_engagement_duration')]
    hr = lambda v: int(v) if str(v).isdigit() else -1
    out['ga_dispositivo_dia'] = agg(load(a.dispositivo), a, 'dispositivo', 'devicecategory', ST + [('views', 'screen_page_views')], keep=anuncio, cast=str.lower)
    out['ga_usuario_dia'] = agg(load(a.usuario), a, 'tipo', 'new_vs_returning', ST + [('views', 'screen_page_views')], keep=anuncio, cast=str.lower)
    out['ga_hora_dia'] = agg(load(a.hora), a, 'hora', 'hour', S, keep=anuncio, cast=hr)
    ok = lambda r: r.get('event_name') == lead.get('event', 'form_submit') and (not lead.get('link_domain') or r.get('link_domain') == lead['link_domain']) and anuncio(r)
    out['ga_hora_leads'] = agg(load(a.hora_leads), a, 'hora', 'hour', [('leads', 'event_count')], keep=ok, cast=hr)
    json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f"{slug} [GA4 extra]: " + ' | '.join(f"{k} {len(out[k])}" for k in ('ga_dispositivo_dia', 'ga_usuario_dia', 'ga_hora_dia', 'ga_hora_leads')))

if __name__ == '__main__':
    main()
