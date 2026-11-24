#!/usr/bin/env python3
"""Baixa do Windsor.ai (API REST) os dados dos 90 dias terminando ontem (America/Fortaleza).
Chave em WINDSOR_API_KEY. Saída em --out (padrão /tmp/wd). Sai com erro se QUALQUER consulta falhar,
para nunca publicar dados parciais. Imperial Ville (Meta via MCP do Claude) NÃO é buscada aqui."""
import os, sys, json, time, argparse, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timedelta, timezone

GADS = "499-341-7595,989-161-7833,750-879-3396,139-072-8707"
MARI = "139-072-8707"
DALE, MARIGA, DEBGA = "558741151", "562081470", "500740125"
GA_CANAL = "date,session_default_channel_group,devicecategory,country,sessions,engaged_sessions,user_engagement_duration,screen_page_views"
GA_LEADS = "date,event_name,session_default_channel_group,devicecategory,event_count"
GA_LOCAL = "date,country,region,city,sessions,engaged_sessions,conversions"
GA_LEADS_LOCAL = "date,event_name,session_default_channel_group,country,region,city,event_count"
GA_PAG = "date,landing_page,sessions,engaged_sessions,conversions"
WA_LEADS = "date,event_name,link_domain,session_default_channel_group,devicecategory,event_count"
WA_LEADS_LOCAL = "date,event_name,link_domain,session_default_channel_group,country,region,city,event_count"
# D'Alessio: o GA4 não está vinculado ao Google Ads, então as visitas dos anúncios são
# separadas por origem/mídia + página de destino (ver clients.json > ga.ads_only)
ADS = lambda campos: campos.replace("date,", "date,session_source_medium,landing_page,", 1)
PUB = lambda campo: f"date,account_name,{campo},impressions,clicks,spend,conversions"

JOBS = {
 "google":       ("google_ads", GADS, "date,account_name,campaign,campaign_type,campaign_status,device,ad_group_name,spend,impressions,clicks,conversions"),
 "kw":           ("google_ads", GADS, "date,account_name,campaign,keyword_text,keyword_match_type,impressions,clicks,spend,conversions"),
 "termos":       ("google_ads", GADS, "date,account_name,campaign,search_term,impressions,clicks,spend,conversions"),
 "pub_idade":    ("google_ads", MARI, PUB("age_range_type")),
 "pub_genero":   ("google_ads", MARI, PUB("gender_type")),
 "pub_renda":    ("google_ads", MARI, PUB("income_range_type")),
 "pub_disp":     ("google_ads", MARI, PUB("device")),
 "pub_cidade":   ("google_ads", MARI, PUB("city,region")),
 "meta_debora":  ("facebook", "1501891061337822", "date,account_name,campaign,campaign_effective_status,campaign_objective,ad_name,spend,impressions,link_clicks,actions_onsite_conversion_messaging_conversation_started_7d"),
 "ga_canal":     ("googleanalytics4", DALE, ADS(GA_CANAL)), "ga_leads": ("googleanalytics4", DALE, ADS(GA_LEADS)),
 "ga_local":     ("googleanalytics4", DALE, ADS(GA_LOCAL)), "ga_leads_local": ("googleanalytics4", DALE, ADS(GA_LEADS_LOCAL)),
 "ga_paginas":   ("googleanalytics4", DALE, "date,session_source_medium,landing_page,sessions,engaged_sessions,conversions"),
 "ga_disp":      ("googleanalytics4", DALE, ADS("date,devicecategory,sessions,engaged_sessions,user_engagement_duration,screen_page_views")),
 "ga_usuario":   ("googleanalytics4", DALE, ADS("date,new_vs_returning,sessions,engaged_sessions,user_engagement_duration,screen_page_views")),
 "ga_hora":      ("googleanalytics4", DALE, ADS("date,hour,sessions,engaged_sessions")),
 "ga_hora_leads": ("googleanalytics4", DALE, ADS("date,hour,event_name,event_count")),
 "gam_canal":    ("googleanalytics4", MARIGA, GA_CANAL), "gam_leads": ("googleanalytics4", MARIGA, WA_LEADS),
 "gam_local":    ("googleanalytics4", MARIGA, GA_LOCAL), "gam_leads_local": ("googleanalytics4", MARIGA, WA_LEADS_LOCAL),
 "gam_paginas":  ("googleanalytics4", MARIGA, GA_PAG),
 "gad_canal":    ("googleanalytics4", DEBGA, "date,session_default_channel_group,devicecategory,country,region,sessions,engaged_sessions,user_engagement_duration,screen_page_views"),
 "gad_leads":    ("googleanalytics4", DEBGA, WA_LEADS), "gad_local": ("googleanalytics4", DEBGA, GA_LOCAL),
 "gad_leads_local": ("googleanalytics4", DEBGA, WA_LEADS_LOCAL),
}

def periodo():
    hoje = datetime.now(timezone(timedelta(hours=-3))).date()
    end = hoje - timedelta(days=1)
    return (end - timedelta(days=89)).isoformat(), end.isoformat()

def baixar(conn, contas, campos, start, end, key, tentativas=4):
    q = urllib.parse.urlencode({"api_key": key, "date_from": start, "date_to": end, "fields": campos,
                                "select_accounts": contas, "_renderer": "json"})
    url = f"https://connectors.windsor.ai/{conn}?{q}"
    ultimo = None
    for i in range(tentativas):
        try:
            with urllib.request.urlopen(urllib.request.Request(url), timeout=600) as r:
                j = json.loads(r.read().decode("utf-8"))
            if isinstance(j, list): j = {"data": j}
            if not isinstance(j.get("data"), list): raise ValueError("resposta sem 'data': " + str(j)[:200].replace(key, "***"))
            return j
        except Exception as e:  # nunca imprimir a URL (tem a chave)
            ultimo = str(e).replace(key, "***")
            time.sleep(20 * (i + 1))
    raise RuntimeError(ultimo)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", default="/tmp/wd"); ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    start, end = periodo()
    print(f"START={start} END={end}")
    if a.dry: return
    key = os.environ.get("WINDSOR_API_KEY", "").strip()
    if not key: sys.exit("WINDSOR_API_KEY não definida (Settings > Secrets and variables > Actions).")
    os.makedirs(a.out, exist_ok=True)
    falhas = []
    for nome, (conn, contas, campos) in JOBS.items():
        try:
            j = baixar(conn, contas, campos, start, end, key)
            json.dump(j, open(os.path.join(a.out, nome + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
            print(f"ok   {nome}: {len(j['data'])} linhas")
        except Exception as e:
            falhas.append(nome); print(f"FALHA {nome}: {e}")
    open(os.path.join(a.out, "period.env"), "w").write(f"START={start}\nEND={end}\n")
    if falhas: sys.exit("Consultas com falha: " + ", ".join(falhas))

if __name__ == "__main__":
    main()
