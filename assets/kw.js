/* Palavras-chave e termos de pesquisa do Google Ads (kw_palavras_dia / kw_termos_dia do data.json), no período escolhido. */
(() => {
const C = window.IV, T = (window.KW || {}).t || {};
const PAL = C.palette || ['#2dd4bf', '#3b82f6', '#f59e0b', '#a78bfa', '#ec4899', '#22c55e', '#38bdf8', '#f97316'];
const nf = (o) => new Intl.NumberFormat(C.loc, o);
const F = {
  brl: (v) => nf({ style: 'currency', currency: C.cur }).format(v),
  int: (v) => nf({ maximumFractionDigits: 0 }).format(v),
  dec: (v) => nf({ maximumFractionDigits: 1 }).format(v),
  pct: (v) => nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)
};
const pad = (n) => String(n).padStart(2, '0');
const yesterday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const range = () => { const p = dash.params(); return [p.start || addDays(yesterday(), -29), p.end || yesterday()]; };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const agg = (id) => {
  const d = dash.data(id); if (d.status !== 'ok') return null;
  const [a, b] = range(), m = new Map();
  d.data.filter((r) => r.data >= a && r.data <= b).forEach((r) => {
    const k = r.texto + '|' + (r.corresp || '');
    const o = m.get(k) || { texto: r.texto, corresp: r.corresp, imp: 0, cli: 0, inv: 0, conv: 0 };
    o.imp += r.impressoes; o.cli += r.cliques; o.inv += r.investimento; o.conv += r.conversoes; m.set(k, o);
  });
  return [...m.values()].sort((x, y) => y.conv - x.conv || y.cli - x.cli || y.imp - x.imp);
};
const empty = (tb, cols, msg) => { const tr = el('tr'), td = el('td', 'iv-none', msg || C.t.none); td.colSpan = cols; tr.appendChild(td); tb.appendChild(tr); };
const cells = (tr, vals) => vals.forEach(([v, cls]) => tr.appendChild(el('td', cls || null, v)));

dash.draw('kw-palavras', (tb) => {
  tb.replaceChildren();
  const ks = agg('kw_palavras_dia'); if (!ks) return;
  ks.slice(0, 15).forEach((k) => {
    const tr = el('tr'), td0 = el('td');
    if (k.corresp) td0.appendChild(el('span', 'iv-chip', k.corresp));
    td0.appendChild(el('span', 'iv-cname', k.texto)); tr.appendChild(td0);
    cells(tr, [[F.int(k.imp), 'iv-hide-sm'], [F.int(k.cli)], [k.imp ? F.pct(k.cli / k.imp) : '—', 'iv-hide-sm'], [F.brl(k.inv)], [F.dec(k.conv), k.conv ? 'ga-pos' : null], [k.conv ? F.brl(k.inv / k.conv) : '—']]);
    tb.appendChild(tr);
  });
  if (!ks.length) empty(tb, 7);
});

dash.draw('kw-termos', (tb) => {
  tb.replaceChildren();
  const ts = agg('kw_termos_dia'); if (!ts) return;
  ts.filter((t) => t.cli > 0 || t.conv > 0).slice(0, 15).forEach((t) => {
    const tr = el('tr'); const td0 = el('td'); td0.appendChild(el('span', 'iv-cname', t.texto)); tr.appendChild(td0);
    cells(tr, [[F.int(t.cli)], [F.brl(t.inv)], [F.dec(t.conv), t.conv ? 'ga-pos' : null]]);
    tb.appendChild(tr);
  });
  if (!ts.some((t) => t.cli > 0 || t.conv > 0)) empty(tb, 4);
});

dash.draw('kw-conv', (box) => {
  box.replaceChildren();
  const ts = agg('kw_termos_dia'); if (!ts) return;
  const cs = ts.filter((t) => t.conv > 0).slice(0, 8);
  if (!cs.length) { box.appendChild(el('div', 'iv-none', T.noconv || C.t.none)); return; }
  const max = cs[0].conv;
  cs.forEach((t, i) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', t.texto); lab.title = t.texto;
    const track = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, t.conv / max * 100) + '%'; bar.style.background = PAL[i % PAL.length]; track.appendChild(bar);
    const v = el('div', 'iv-hb-v', F.dec(t.conv)); v.appendChild(el('span', 'ga-sub', ' · ' + F.brl(t.inv / t.conv)));
    row.append(lab, track, v); box.appendChild(row);
  });
});

dash.draw('kw-n', (e) => { const ts = agg(e.dataset.src); e.textContent = ts ? F.int(ts.filter((t) => e.dataset.k === 'conv' ? t.conv > 0 : t.imp > 0).length) : '—'; });
/* palavras-chave mais acionadas (impressões) — barras */
dash.draw('kw-top', (box) => {
  box.replaceChildren();
  const ks = agg('kw_palavras_dia'); if (!ks) return;
  const top = ks.filter((k) => k.imp > 0).sort((a, b) => b.imp - a.imp).slice(0, 8);
  if (!top.length) { box.appendChild(el('div', 'iv-none', C.t.none)); return; }
  const max = top[0].imp, tot = ks.reduce((a, k) => a + k.imp, 0);
  top.forEach((k, i) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', k.texto); lab.title = k.texto + (k.corresp ? ' (' + k.corresp + ')' : '');
    const track = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, k.imp / max * 100) + '%'; bar.style.background = PAL[i % PAL.length]; track.appendChild(bar);
    const v = el('div', 'iv-hb-v', F.int(k.imp)); v.appendChild(el('span', 'ga-sub', ' · ' + F.pct(k.imp / tot)));
    row.append(lab, track, v); box.appendChild(row);
  });
});

/* tabela completa: impressões, cliques, conversões, CPC, CPM, CPA */
const kwRows = () => { const ks = agg('kw_palavras_dia'); return ks ? ks.filter((k) => k.imp > 0).sort((a, b) => b.imp - a.imp) : null; };
dash.draw('kw-tabela', (tb) => {
  tb.replaceChildren();
  const ks = kwRows(); if (!ks) return;
  ks.forEach((k) => {
    const tr = el('tr'), td0 = el('td');
    if (k.corresp) td0.appendChild(el('span', 'iv-chip', k.corresp));
    td0.appendChild(el('span', 'iv-cname', k.texto)); tr.appendChild(td0);
    cells(tr, [[F.int(k.imp)], [F.int(k.cli)], [F.brl(k.inv), 'kw-inv'], [F.dec(k.conv), k.conv ? 'ga-pos' : null], [k.cli ? F.brl(k.inv / k.cli) : '—'],
      [k.imp ? F.brl(k.inv / k.imp * 1000) : '—', 'iv-hide-sm'], [k.conv ? F.brl(k.inv / k.conv) : '—']]);
    tb.appendChild(tr);
  });
  if (!ks.length) empty(tb, 8);
});
/* investimento por palavra-chave — barras */
dash.draw('kw-inv', (box) => {
  box.replaceChildren();
  const ks = agg('kw_palavras_dia'); if (!ks) return;
  const top = ks.filter((k) => k.inv > 0).sort((a, b) => b.inv - a.inv).slice(0, 8);
  if (!top.length) { box.appendChild(el('div', 'iv-none', C.t.none)); return; }
  const max = top[0].inv, tot = ks.reduce((a, k) => a + k.inv, 0);
  top.forEach((k, i) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', k.texto); lab.title = k.texto + (k.corresp ? ' (' + k.corresp + ')' : '');
    const track = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, k.inv / max * 100) + '%'; bar.style.background = PAL[i % PAL.length]; track.appendChild(bar);
    const v = el('div', 'iv-hb-v', F.brl(k.inv)); v.appendChild(el('span', 'ga-sub', ' · ' + F.pct(k.inv / tot)));
    row.append(lab, track, v); box.appendChild(row);
  });
});
dash.draw('kw-tot', (e) => {
  const ks = kwRows(); if (!ks) { e.textContent = '—'; return; }
  const S = (f) => ks.reduce((a, k) => a + k[f], 0), imp = S('imp'), cli = S('cli'), conv = S('conv'), inv = S('inv');
  e.textContent = { imp: F.int(imp), cli: F.int(cli), conv: F.dec(conv), cpc: cli ? F.brl(inv / cli) : '—', cpm: imp ? F.brl(inv / imp * 1000) : '—', cpa: conv ? F.brl(inv / conv) : '—', inv: F.brl(inv) }[e.dataset.k];
});
})();
