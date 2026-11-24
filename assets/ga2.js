/* Extra Google Analytics 4 blocks: quality KPIs, devices, new vs returning, weekday and hour of day, auto insights.
   Same period as the rest of the page. Tables: ga_dispositivo_dia, ga_usuario_dia, ga_hora_dia, ga_hora_leads (+ ga_canal_dia, ga_leads_dia). */
(() => {
const C = window.IV, T = (window.GA2 || {}).t || {};
const nf = (o) => new Intl.NumberFormat(C.loc, o);
const F = { int: (v) => nf({ maximumFractionDigits: 0 }).format(v), d1: (v) => nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v),
  pct: (v) => nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v),
  dur: (s) => { s = Math.round(s); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; } };
const pad = (n) => String(n).padStart(2, '0');
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const yesterday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const range = () => { const p = dash.params(); return [p.start || addDays(yesterday(), -29), p.end || yesterday()]; };
const rowsOf = (id) => { const d = dash.data(id); if (d.status !== 'ok') return null; const [a, b] = range(); return d.data.filter((r) => r.data >= a && r.data <= b); };
const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
const group = (rows, keyFn, vals) => { const m = new Map(); rows.forEach((r) => { const k = keyFn(r); const o = m.get(k) || Object.assign({ key: k }, ...vals.map((v) => ({ [v]: 0 }))); vals.forEach((v) => { o[v] += Number(r[v] || 0); }); m.set(k, o); }); return [...m.values()]; };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const none = (box) => box.appendChild(el('div', 'iv-none', C.t.none));
const DEV = { desktop: 'Computador', mobile: 'Celular', tablet: 'Tablet', 'smart tv': 'Smart TV' };
const COL = { desktop: '#60a5fa', mobile: '#a78bfa', tablet: '#34d399' };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WDL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const wday = (s) => new Date(s + 'T12:00:00Z').getUTCDay();

const calc = () => {
  const d = rowsOf('ga_dispositivo_dia'), u = rowsOf('ga_usuario_dia'); if (!d || !u) return null;
  const ses = sum(d, 'sessoes'), eng = sum(d, 'engajadas');
  const nu = u.filter((r) => r.tipo === 'new'); const nses = sum(nu, 'sessoes');
  return { ses, eng, views: sum(d, 'views'), tempo: sum(d, 'tempo'), nshare: sum(u, 'sessoes') ? nses / sum(u, 'sessoes') : null };
};
dash.draw('ga2-kpi', (node) => {
  const t = calc(), k = node.dataset.k; node.classList.remove('dash-skeleton');
  if (!t || !t.ses) { node.textContent = '—'; return; }
  node.textContent = ({ ppv: F.d1(t.views / t.ses), bounce: F.pct(1 - t.eng / t.ses), tengaged: t.eng ? F.dur(t.tempo / t.eng) : '—', newshare: t.nshare == null ? '—' : F.pct(t.nshare) })[k];
});

const bars = (box, items, colorOf) => {
  box.replaceChildren(); if (!items.length) return none(box);
  const max = Math.max(...items.map((o) => o.sessoes));
  items.forEach((o) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', o.label), track = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b');
    bar.style.width = Math.max(2, o.sessoes / max * 100) + '%'; bar.style.background = colorOf(o); track.appendChild(bar);
    const v = el('div', 'iv-hb-v', F.int(o.sessoes) + ' (' + F.pct(o.share) + ')'); v.appendChild(el('span', 'ga-sub', ' · ' + F.pct(o.engajadas / o.sessoes) + ' engajadas · ' + F.dur(o.tempo / o.sessoes)));
    row.append(lab, track, v); box.appendChild(row);
  });
};
dash.draw('ga2-dispositivo', (box) => {
  const d = rowsOf('ga_dispositivo_dia'); if (!d) return;
  const g = group(d, (r) => r.dispositivo, ['sessoes', 'engajadas', 'tempo']).filter((o) => o.sessoes > 0).sort((a, b) => b.sessoes - a.sessoes), tot = sum(g, 'sessoes');
  g.forEach((o) => { o.label = DEV[o.key] || o.key; o.share = o.sessoes / tot; });
  bars(box, g, (o) => COL[o.key] || '#94a3b8');
});
dash.draw('ga2-usuario', (box) => {
  const d = rowsOf('ga_usuario_dia'); if (!d) return;
  const g = group(d, (r) => r.tipo, ['sessoes', 'engajadas', 'tempo']).filter((o) => o.sessoes > 0).sort((a, b) => b.sessoes - a.sessoes), tot = sum(g, 'sessoes');
  g.forEach((o) => { o.label = o.key === 'new' ? 'Visitantes novos' : o.key === 'returning' ? 'Visitantes recorrentes' : o.key === '(not set)' ? '(não identificado)' : o.key; o.share = o.sessoes / tot; });
  bars(box, g, (o) => o.key === 'new' ? '#60a5fa' : '#34d399');
});

/* column chart: visits (bars) with leads written above columns */
const columns = (box, labels, vis, leads, tip) => {
  box.replaceChildren(); const max = Math.max(1, ...vis); if (!vis.some((v) => v > 0)) return none(box);
  const wrap = el('div', 'ga2-cols');
  labels.forEach((lb, i) => {
    const c = el('div', 'ga2-col'); c.title = tip(i);
    const n = el('div', 'ga2-n', leads[i] ? String(leads[i]) : ''); const b = el('div', 'ga2-bar'); b.style.height = Math.max(vis[i] ? 3 : 0, vis[i] / max * 100) + '%';
    if (leads[i]) b.classList.add('ga2-has');
    c.append(n, b, el('div', 'ga2-x', lb)); wrap.appendChild(c);
  });
  box.appendChild(wrap);
};
dash.draw('ga2-semana', (box) => {
  const c = rowsOf('ga_canal_dia'), l = rowsOf('ga_leads_dia'); if (!c || !l) return;
  const v = Array(7).fill(0), ld = Array(7).fill(0), days = Array(7).fill(0), seen = new Set();
  c.forEach((r) => { v[wday(r.data)] += r.sessoes; });
  l.forEach((r) => { ld[wday(r.data)] += r.leads; });
  const [a, b] = range(); for (let x = a; x <= b; x = addDays(x, 1)) days[wday(x)]++;
  const order = [1, 2, 3, 4, 5, 6, 0];
  columns(box, order.map((i) => WD[i]), order.map((i) => days[i] ? v[i] / days[i] : 0), order.map((i) => ld[i]),
    (j) => { const i = order[j]; return WD[i] + ': ' + F.d1(days[i] ? v[i] / days[i] : 0) + ' visitas/dia, ' + ld[i] + ' contatos'; });
});
dash.draw('ga2-hora', (box) => {
  const h = rowsOf('ga_hora_dia'), l = rowsOf('ga_hora_leads'); if (!h || !l) return;
  const v = Array(24).fill(0), ld = Array(24).fill(0);
  h.forEach((r) => { if (r.hora >= 0 && r.hora < 24) v[r.hora] += r.sessoes; }); l.forEach((r) => { if (r.hora >= 0 && r.hora < 24) ld[r.hora] += r.leads; });
  const idx = [...Array(24).keys()];
  columns(box, idx.map((i) => (i % 3 === 0 ? pad(i) : '')), v, ld, (i) => pad(i) + ':00 – ' + F.int(v[i]) + ' visitas, ' + ld[i] + ' contatos');
});

dash.draw('ga2-insights', (box) => {
  box.replaceChildren();
  const d = rowsOf('ga_dispositivo_dia'), c = rowsOf('ga_canal_dia'), l = rowsOf('ga_leads_dia'), h = rowsOf('ga_hora_dia'), hl = rowsOf('ga_hora_leads'), u = rowsOf('ga_usuario_dia');
  if (!d || !c || !l || !h || !hl || !u) return;
  const out = [];
  const dv = group(d, (r) => r.dispositivo, ['sessoes', 'engajadas']).filter((o) => o.sessoes >= 20);
  if (dv.length > 1) { dv.sort((a, b) => b.engajadas / b.sessoes - a.engajadas / a.sessoes); const a = dv[0], z = dv[dv.length - 1];
    out.push('Visitantes de ' + (DEV[a.key] || a.key).toLowerCase() + ' engajam mais (' + F.pct(a.engajadas / a.sessoes) + ') e os de ' + (DEV[z.key] || z.key).toLowerCase() + ' engajam menos (' + F.pct(z.engajadas / z.sessoes) + ').'); }
  const dall = group(d, (r) => r.dispositivo, ['sessoes']), dt = sum(dall, 'sessoes'); if (dt) { const m = dall.find((o) => o.key === 'mobile'); if (m) out.push(F.pct(m.sessoes / dt) + ' das visitas vêm de celulares, então a experiência das páginas no celular é a que mais importa.'); }
  const wv = Array(7).fill(0); c.forEach((r) => { wv[wday(r.data)] += r.sessoes; }); if (sum(c, 'sessoes') >= 20) { const bi = wv.indexOf(Math.max(...wv)); out.push('O dia com mais visitas é ' + WDL[bi] + ' (' + F.int(wv[bi]) + ' de ' + F.int(sum(c, 'sessoes')) + ').'); }
  const hv = Array(24).fill(0), hld = Array(24).fill(0); h.forEach((r) => { if (r.hora >= 0) hv[r.hora] += r.sessoes; }); hl.forEach((r) => { if (r.hora >= 0) hld[r.hora] += r.leads; });
  const tl = sum(hl, 'leads'); if (tl >= 5) { const bi = hld.indexOf(Math.max(...hld)); out.push('A maioria dos formulários é enviada por volta das ' + pad(bi) + 'h (' + hld[bi] + ' de ' + tl + ' contatos).'); }
  const wl = Array(7).fill(0); l.forEach((r) => { wl[wday(r.data)] += r.leads; }); const tw = sum(l, 'leads');
  if (tw >= 5) { const bi = wl.indexOf(Math.max(...wl)); out.push('O melhor dia para contatos é ' + WDL[bi] + ' (' + wl[bi] + ' de ' + tw + ').'); }
  const us = sum(u, 'sessoes'); if (us) { const nu = sum(u.filter((r) => r.tipo === 'new'), 'sessoes') / us; out.push(F.pct(nu) + ' das visitas são de pessoas que nunca tinham visitado o site.'); }
  if (!out.length) return none(box);
  const ul = el('ul', 'ga2-ins'); out.forEach((t) => ul.appendChild(el('li', null, t))); box.appendChild(ul);
});
})();
