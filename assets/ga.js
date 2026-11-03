/* Google Analytics 4 section: KPIs, channels, map of visitor and lead locations, landing pages.
   Reads the ga_* tables of data.json and follows the same period (start/end params) as the ads section. */
(() => {
const C = window.IV, T = (window.GA || {}).t || {};
const nf = (o) => new Intl.NumberFormat(C.loc, o);
const F = {
  int: (v) => nf({ maximumFractionDigits: 0 }).format(v),
  pct: (v) => nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v),
  cint: (v) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v),
  dur: (s) => { s = Math.round(s); return Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's'; }
};
const pad = (n) => String(n).padStart(2, '0');
const yesterday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (s) => new Date(s + 'T12:00:00Z').toLocaleDateString(C.loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const range = () => { const p = dash.params(); return [p.start || addDays(yesterday(), -29), p.end || yesterday()]; };
const rowsOf = (id) => { const d = dash.data(id); if (d.status !== 'ok') return null; const [a, b] = range(); return d.data.filter((r) => r.data >= a && r.data <= b); };
const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
const group = (rows, keyFn, vals) => {
  const m = new Map();
  rows.forEach((r) => { const k = keyFn(r); const o = m.get(k) || Object.assign({ key: k, r }, ...vals.map((v) => ({ [v]: 0 }))); vals.forEach((v) => { o[v] += Number(r[v] || 0); }); m.set(k, o); });
  return [...m.values()];
};
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const none = (box) => box.appendChild(el('div', 'iv-none', C.t.none));
const NOTSET = '(not set)';
const COUNTRY = { 'United States': 'United States of America', 'Dominican Republic': 'Dominican Rep.', 'Kyrgyz Republic': 'Kyrgyzstan', 'North Macedonia': 'Macedonia', 'Türkiye': 'Turkey',
  'Bosnia & Herzegovina': 'Bosnia and Herz.', 'Czechia': 'Czechia', 'Côte d’Ivoire': "Côte d'Ivoire", 'Central African Republic': 'Central African Rep.', 'South Sudan': 'S. Sudan',
  'Congo - Kinshasa': 'Dem. Rep. Congo', 'Congo - Brazzaville': 'Congo', 'Equatorial Guinea': 'Eq. Guinea', 'Eswatini': 'eSwatini', 'Solomon Islands': 'Solomon Is.' };
const SMALL = { Singapore: [103.82, 1.35], 'Hong Kong': [114.17, 22.32], Macau: [113.55, 22.2], Monaco: [7.42, 43.74], Seychelles: [55.45, -4.68], 'Antigua and Barbuda': [-61.8, 17.07],
  'Isle of Man': [-4.55, 54.23], Bahrain: [50.55, 26.07], Malta: [14.4, 35.9], Mauritius: [57.55, -20.25], Barbados: [-59.55, 13.17], Maldives: [73.5, 4.17], Andorra: [1.52, 42.5],
  Liechtenstein: [9.55, 47.16], 'San Marino': [12.45, 43.94], Luxembourg: [6.13, 49.82], 'Trinidad and Tobago': [-61.22, 10.65], Bermuda: [-64.75, 32.3], 'Cayman Islands': [-81.25, 19.31] };

/* totals for KPIs */
const tot = () => {
  const c = rowsOf('ga_canal_dia'), l = rowsOf('ga_leads_dia'); if (!c || !l) return null;
  const ses = sum(c, 'sessoes'), eng = sum(c, 'engajadas'), leads = sum(l, 'leads');
  return { ses, eng: ses ? eng / ses : null, tempo: ses ? sum(c, 'tempo') / ses : null, views: sum(c, 'views'), leads, lrate: ses ? leads / ses : null };
};
dash.draw('ga-kpi', (e) => {
  const t = tot(); if (!t) { e.textContent = '—'; return; }
  const v = t[e.dataset.k], f = { ses: F.int, eng: F.pct, tempo: F.dur, views: F.int, leads: F.int, lrate: F.pct }[e.dataset.k];
  e.textContent = v == null ? '—' : f(v);
});
dash.draw('ga-note', (e) => {
  const d = dash.data('ga_canal_dia'); if (d.status !== 'ok' || !d.data.length) { e.hidden = true; return; }
  const first = d.data[0].data, [a] = range();
  e.hidden = a >= first;
  e.textContent = (T.since || 'Analytics data available from') + ' ' + fmtDate(first) + '.';
});
dash.onData(() => {
  document.querySelectorAll('[data-ga-src]').forEach((x) => { if (dash.data('ga_canal_dia').status !== 'loading') x.classList.remove('dash-skeleton'); });
  const p = dash.params();
  document.querySelectorAll('[data-gmap]').forEach((b) => { const on = (p.gmap || 'world') === b.dataset.gmap; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-gmet]').forEach((b) => { const on = (p.gmet || 'leads') === b.dataset.gmet; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
});
document.querySelectorAll('[data-gmap]').forEach((b) => b.addEventListener('click', () => dash.setParams({ gmap: b.dataset.gmap })));
document.querySelectorAll('[data-gmet]').forEach((b) => b.addEventListener('click', () => dash.setParams({ gmet: b.dataset.gmet })));

/* daily sessions (bars) with form submissions marked on top */
dash.draw('ga-trend', (box) => {
  box.replaceChildren();
  const c = rowsOf('ga_canal_dia'), l = rowsOf('ga_leads_dia'); if (!c || !l) return;
  const [a, b] = range(); const first = (dash.data('ga_canal_dia').data[0] || {}).data || a;
  const days = []; for (let d = a < first ? first : a; d <= b; d = addDays(d, 1)) days.push(d);
  if (!days.length) return none(box);
  const S = new Map(group(c, (r) => r.data, ['sessoes']).map((o) => [o.key, o.sessoes]));
  const L = new Map(group(l, (r) => r.data, ['leads']).map((o) => [o.key, o.leads]));
  const rows = days.map((d) => ({ d, s: S.get(d) || 0, l: L.get(d) || 0 }));
  const W = Math.max(280, box.clientWidth), H = 240, ml = 40;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleBand(days, [ml, W - 8]).padding(0.25);
  const y = d3.scaleLinear([0, (d3.max(rows, (r) => r.s) || 1) * 1.15], [H - 28, 14]).nice();
  const g = svg.append('g');
  g.selectAll('line').data(y.ticks(4)).join('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y).attr('y2', y).attr('stroke', 'var(--iv-grid)');
  g.selectAll('text.y').data(y.ticks(4)).join('text').attr('x', ml - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--iv-muted)').text(F.cint);
  const nX = Math.max(2, Math.min(7, Math.floor((W - ml) / 72)));
  const xt = [...new Set(d3.ticks(0, rows.length - 1, nX).map(Math.round))].map((i) => rows[i]).filter(Boolean);
  g.selectAll('text.x').data(xt).join('text').attr('x', (r) => x(r.d) + x.bandwidth() / 2).attr('y', H - 6).attr('font-size', 11).attr('fill', 'var(--iv-muted)')
    .attr('text-anchor', (r, i) => i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle').text((r) => new Date(r.d + 'T12:00:00Z').toLocaleDateString(C.loc, { day: '2-digit', month: '2-digit', timeZone: 'UTC' }));
  const bars = g.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.d)).attr('width', x.bandwidth()).attr('y', (r) => y(r.s)).attr('height', (r) => y(0) - y(r.s))
    .attr('rx', Math.min(4, x.bandwidth() / 2)).attr('fill', '#38bdf8').attr('opacity', 0.85);
  const lr = rows.filter((r) => r.l > 0);
  const rad = Math.max(7, Math.min(10, x.bandwidth() / 2));
  g.selectAll('circle').data(lr).join('circle').attr('cx', (r) => x(r.d) + x.bandwidth() / 2).attr('cy', (r) => y(r.s) - rad - 3).attr('r', rad).attr('fill', '#22c55e');
  g.selectAll('text.l').data(lr).join('text').attr('x', (r) => x(r.d) + x.bandwidth() / 2).attr('y', (r) => y(r.s) - rad - 3).attr('dy', '0.35em').attr('text-anchor', 'middle')
    .attr('font-size', 10).attr('font-weight', 700).attr('fill', '#05210f').text((r) => r.l);
  g.append('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--iv-axis)');
  const tip = el('div', 'iv-tip'); tip.hidden = true; const t1 = el('div', 'd'), t2 = el('div', 'v'), t3 = el('div', 'v'); tip.append(t1, t2, t3); box.appendChild(tip);
  const show = (ev) => {
    const sc = svg.node().getBoundingClientRect().width / W, [mx] = d3.pointer(ev, svg.node());
    const r = rows[d3.leastIndex(rows, (q) => Math.abs(x(q.d) + x.bandwidth() / 2 - mx))];
    t1.textContent = new Date(r.d + 'T12:00:00Z').toLocaleDateString(C.loc, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
    t2.textContent = (T.sessions || 'Sessions') + ': ' + F.int(r.s); t3.textContent = (T.leads || 'Form submissions') + ': ' + F.int(r.l);
    bars.attr('opacity', (q) => q === r ? 1 : 0.4); tip.hidden = false;
    tip.style.left = Math.max(0, Math.min(box.clientWidth - tip.offsetWidth, (x(r.d) + x.bandwidth() / 2) * sc - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(0, y(r.s) * sc - tip.offsetHeight - 30) + 'px';
  };
  svg.append('rect').attr('x', ml).attr('width', W - ml).attr('height', H).attr('fill', 'transparent').on('pointermove', show).on('pointerdown', show)
    .on('pointerleave', () => { tip.hidden = true; bars.attr('opacity', 0.85); });
});

/* channels */
dash.draw('ga-canais', (tb) => {
  tb.replaceChildren();
  const c = rowsOf('ga_canal_dia'), l = rowsOf('ga_leads_dia'); if (!c || !l) return;
  const L = new Map(group(l, (r) => r.canal, ['leads']).map((o) => [o.key, o.leads]));
  const ch = group(c, (r) => r.canal, ['sessoes', 'engajadas']).filter((o) => o.sessoes > 0).sort((a, b) => b.sessoes - a.sessoes);
  const max = ch.length ? ch[0].sessoes : 1;
  ch.forEach((o) => {
    const tr = el('tr'), td0 = el('td');
    const nm = el('div', 'iv-cname', o.key);
    const track = el('div', 'iv-hb-t ga-mini'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, o.sessoes / max * 100) + '%'; bar.style.background = '#38bdf8'; track.appendChild(bar);
    td0.append(nm, track); tr.appendChild(td0);
    const lv = L.get(o.key) || 0;
    [F.int(o.sessoes), F.pct(o.engajadas / o.sessoes), F.int(lv), o.sessoes ? F.pct(lv / o.sessoes) : '—'].forEach((v, i) => { const td = el('td', i === 1 || i === 3 ? 'iv-hide-sm' : null, v); if (i === 2 && lv) td.classList.add('ga-pos'); tr.appendChild(td); });
    tb.appendChild(tr);
  });
  if (!ch.length) { const tr = el('tr'), td = el('td', 'iv-none', C.t.none); td.colSpan = 5; tr.appendChild(td); tb.appendChild(tr); }
});

/* landing pages */
dash.draw('ga-paginas', (box) => {
  box.replaceChildren();
  const p = rowsOf('ga_pagina_dia'); if (!p) return;
  const pg = group(p.filter((r) => r.pagina !== NOTSET), (r) => r.pagina, ['sessoes', 'engajadas']).sort((a, b) => b.sessoes - a.sessoes).slice(0, 8);
  if (!pg.length) return none(box);
  const max = pg[0].sessoes;
  pg.forEach((o) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', o.key === '/' ? (T.home || 'Home page') + ' (/)' : o.key); lab.title = o.key;
    const track = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, o.sessoes / max * 100) + '%'; bar.style.background = '#a78bfa'; track.appendChild(bar);
    const v = el('div', 'iv-hb-v', F.int(o.sessoes)); const s = el('span', 'ga-sub', ' · ' + F.pct(o.engajadas / o.sessoes) + ' ' + (T.engaged || 'engaged')); v.appendChild(s);
    row.append(lab, track, v); box.appendChild(row);
  });
});

/* map */
let GEO = null, geoErr = false;
const geo = () => {
  if (GEO || geoErr) return;
  GEO = 'loading';
  Promise.all(['../assets/maps/world-110m.json', '../assets/maps/us-states.json'].map((u) => fetch(u).then((r) => r.json())))
    .then(([w, u]) => {
      GEO = { world: topojson.feature(w, w.objects.countries).features, us: topojson.feature(u, u.objects.states).features, usNation: topojson.mesh(u, u.objects.nation) };
      dash.setParams({});
    }).catch(() => { geoErr = true; GEO = null; dash.setParams({}); });
};
const mapData = () => {
  const p = dash.params(), view = p.gmap || 'world', met = p.gmet || 'leads';
  const src = met === 'leads' ? rowsOf('ga_leads_local') : rowsOf('ga_local_dia'); if (!src) return null;
  const k = met === 'leads' ? 'leads' : 'sessoes';
  const rows = view === 'us' ? src.filter((r) => r.pais === 'United States') : src;
  const areas = group(rows, (r) => view === 'us' ? r.regiao : r.pais, [k]).filter((o) => o.key !== NOTSET && o[k] > 0).sort((a, b) => b[k] - a[k]);
  return { view, met, k, areas, total: sum(rows, k), rows };
};
dash.draw('ga-map', (box) => {
  box.replaceChildren();
  if (geoErr) { box.appendChild(el('div', 'iv-fail', C.t.fail)); return; }
  if (!GEO || GEO === 'loading') { geo(); return; }
  const md = mapData(); if (!md) return;
  const W = Math.max(280, box.clientWidth), H = md.view === 'us' ? Math.round(W * 0.62) : Math.round(W * 0.5);
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const feats = md.view === 'us' ? GEO.us : GEO.world.filter((f) => f.properties.name !== 'Antarctica');
  const proj = md.view === 'us' ? d3.geoIdentity().fitSize([W, H], { type: 'FeatureCollection', features: feats }) : d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'FeatureCollection', features: feats });
  const path = d3.geoPath(proj);
  const val = new Map(md.areas.map((o) => [md.view === 'us' ? o.key : (COUNTRY[o.key] || o.key), o]));
  const max = md.areas.length ? md.areas[0][md.k] : 1;
  const hue = md.met === 'leads' ? '#22c55e' : '#38bdf8';
  const col = d3.scaleSequentialSqrt([0, max], d3.interpolateRgb('#16304a', hue));
  const tip = el('div', 'iv-tip'); tip.hidden = true; const t1 = el('div', 'd'), t2 = el('div', 'v'); tip.append(t1, t2);
  const label = md.met === 'leads' ? (T.leads || 'Form submissions') : (T.sessions || 'Sessions');
  const show = (ev, name, o) => {
    t1.textContent = name; t2.textContent = label + ': ' + F.int(o ? o[md.k] : 0) + (o && md.total ? ' (' + F.pct(o[md.k] / md.total) + ')' : '');
    tip.hidden = false; const r = box.getBoundingClientRect();
    tip.style.left = Math.max(0, Math.min(box.clientWidth - tip.offsetWidth, ev.clientX - r.left - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(0, ev.clientY - r.top - tip.offsetHeight - 14) + 'px';
  };
  const hide = () => { tip.hidden = true; };
  svg.append('g').selectAll('path').data(feats).join('path').attr('d', path)
    .attr('fill', (f) => { const o = val.get(f.properties.name); return o ? col(o[md.k]) : '#152038'; })
    .attr('stroke', '#0a1020').attr('stroke-width', 0.6)
    .on('pointermove pointerdown', function (ev, f) { const o = val.get(f.properties.name); d3.select(this).attr('stroke', '#e8edf7').attr('stroke-width', 1.2).raise(); show(ev, f.properties.name === 'United States of America' ? 'United States' : f.properties.name, o); })
    .on('pointerleave', function () { d3.select(this).attr('stroke', '#0a1020').attr('stroke-width', 0.6); hide(); });
  if (md.view === 'world') {
    const small = md.areas.filter((o) => SMALL[o.key]);
    svg.append('g').selectAll('circle').data(small).join('circle').attr('cx', (o) => proj(SMALL[o.key])[0]).attr('cy', (o) => proj(SMALL[o.key])[1])
      .attr('r', (o) => 3 + 6 * Math.sqrt(o[md.k] / max)).attr('fill', (o) => col(o[md.k])).attr('stroke', '#e8edf7').attr('stroke-width', 1)
      .on('pointermove pointerdown', (ev, o) => show(ev, o.key, o)).on('pointerleave', hide);
  }
  box.appendChild(tip);
  const leg = el('div', 'ga-leg'); leg.append(el('span', null, '0'));
  const ramp = el('span', 'ga-ramp'); ramp.style.background = `linear-gradient(90deg, #16304a, ${hue})`; leg.append(ramp, el('span', null, F.int(max) + ' ' + label.toLowerCase()));
  box.appendChild(leg);
});
dash.draw('ga-areas', (box) => {
  box.replaceChildren();
  const md = mapData(); if (!md) return;
  const top = md.areas.slice(0, 8);
  if (!top.length) return none(box);
  const max = top[0][md.k], hue = md.met === 'leads' ? '#22c55e' : '#38bdf8';
  top.forEach((o) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', o.key);
    const track = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, o[md.k] / max * 100) + '%'; bar.style.background = hue; track.appendChild(bar);
    const v = el('div', 'iv-hb-v', F.int(o[md.k])); v.appendChild(el('span', 'ga-sub', ' · ' + F.pct(o[md.k] / md.total)));
    row.append(lab, track, v); box.appendChild(row);
  });
});
dash.draw('ga-areas-title', (e) => { const p = dash.params(); const us = (p.gmap || 'world') === 'us', leads = (p.gmet || 'leads') === 'leads';
  e.textContent = (us ? (T.topStates || 'Top U.S. states') : (T.topCountries || 'Top countries')) + ' · ' + (leads ? (T.leads || 'Form submissions') : (T.sessions || 'Sessions')).toLowerCase(); });

/* leads by city */
dash.draw('ga-cidades', (tb) => {
  tb.replaceChildren();
  const l = rowsOf('ga_leads_local'); if (!l) return;
  const cs = group(l, (r) => [r.cidade, r.regiao, r.pais].join('|'), ['leads']).sort((a, b) => b.leads - a.leads || a.key.localeCompare(b.key));
  cs.slice(0, 12).forEach((o) => {
    const ch = [...new Set(l.filter((r) => [r.cidade, r.regiao, r.pais].join('|') === o.key).map((r) => r.canal))].join(', ');
    const tr = el('tr');
    const city = o.r.cidade === NOTSET ? (T.unknown || 'Unknown city') : o.r.cidade;
    const reg = o.r.regiao === NOTSET ? '' : o.r.regiao;
    const td0 = el('td'); td0.append(el('span', 'iv-cname', city), el('span', 'ga-sub', [reg, o.r.pais].filter(Boolean).join(', ')));
    tr.append(td0, el('td', 'iv-hide-sm ga-ch', ch), el('td', 'ga-pos', F.int(o.leads)));
    tb.appendChild(tr);
  });
  if (!cs.length) { const tr = el('tr'), td = el('td', 'iv-none', C.t.none); td.colSpan = 3; tr.appendChild(td); tb.appendChild(tr); }
});
dash.draw('ga-cidades-n', (e) => { const l = rowsOf('ga_leads_local'); e.textContent = l ? F.int(group(l, (r) => [r.cidade, r.regiao, r.pais].join('|'), ['leads']).length) : '—'; });
})();
