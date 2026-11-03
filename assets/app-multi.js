/* Dashboard com mais de uma plataforma (Google Ads + Meta Ads). Usa o mesmo visual de app.js. */
(() => {
const C = window.IV;
const nf = (o) => new Intl.NumberFormat(C.loc, o);
const F = {
  brl: (v) => nf({ style: 'currency', currency: C.cur }).format(v),
  int: (v) => nf({ maximumFractionDigits: 0 }).format(v),
  dec: (v) => nf({ maximumFractionDigits: 1 }).format(v),
  pct: (v) => nf({ style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
  pct0: (v) => nf({ style: 'percent', maximumFractionDigits: 0 }).format(v),
  cbrl: (v) => nf({ style: 'currency', currency: C.cur, notation: 'compact', maximumFractionDigits: 1 }).format(v),
  cint: (v) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v)
};
const PCOL = C.platformColors; // {"Google Ads": "#..", "Meta Ads": "#.."}
const pad = (n) => String(n).padStart(2, '0');
const yesterday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtDate = (s) => s ? new Date(s + 'T12:00:00Z').toLocaleDateString(C.loc, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';
const PRESETS = {
  '7': (e) => [addDays(e, -6), e], '14': (e) => [addDays(e, -13), e], '30': (e) => [addDays(e, -29), e], '90': (e) => [addDays(e, -89), e],
  'mes': (e) => [e.slice(0, 8) + '01', e],
  'mesant': (e) => { const end = addDays(e.slice(0, 8) + '01', -1); return [end.slice(0, 8) + '01', end]; }
};
const setPreset = (k) => { if (k === 'custom') { dash.setParams({ preset: 'custom' }); return; } const [start, end] = PRESETS[k](yesterday()); dash.setParams({ start, end, preset: k }); };
const setDefaults = () => setPreset('30');
setDefaults();

const range = () => { const p = dash.params(); return [p.start || addDays(yesterday(), -29), p.end || yesterday()]; };
const plat = () => dash.params().plat || 'all';
const allPlats = () => (dash.meta().plataformas || Object.keys(PCOL));
const selPlats = () => plat() === 'all' ? allPlats() : [plat()];
const inRange = (r) => { const [a, b] = range(); const d = String(r.data).slice(0, 10); return d >= a && d <= b; };
const ok = () => dash.data('campanhas_dia').status === 'ok';
const campRows = () => ok() ? dash.data('campanhas_dia').data.filter((r) => inRange(r) && selPlats().includes(r.plataforma)) : null;
const sumUp = (rows) => {
  const t = { inv: 0, imp: 0, cli: 0, conv: 0 };
  rows.forEach((r) => { t.inv += Number(r.investimento || 0); t.imp += Number(r.impressoes || 0); t.cli += Number(r.cliques || 0); t.conv += Number(r.conversoes || 0); });
  t.ctr = t.imp ? t.cli / t.imp : null; t.cpc = t.cli ? t.inv / t.cli : null; t.cpa = t.conv ? t.inv / t.conv : null; t.cpm = t.imp ? t.inv / t.imp * 1000 : null;
  return t;
};
const totals = () => { const rows = campRows(); return rows ? sumUp(rows) : null; };
const byPlatform = () => {
  if (!ok()) return null;
  const rows = dash.data('campanhas_dia').data.filter(inRange);
  return allPlats().map((p) => ({ p, ...sumUp(rows.filter((r) => r.plataforma === p)) }));
};
const campaigns = () => {
  const rows = campRows(); if (!rows) return null;
  const m = new Map();
  rows.forEach((r) => {
    const k = r.plataforma + '|' + r.campanha;
    const o = m.get(k) || { plataforma: r.plataforma, campanha: r.campanha, tipo: r.tipo, status: r.status, inv: 0, imp: 0, cli: 0, conv: 0 };
    o.inv += Number(r.investimento || 0); o.imp += Number(r.impressoes || 0); o.cli += Number(r.cliques || 0); o.conv += Number(r.conversoes || 0);
    m.set(k, o);
  });
  return [...m.values()].filter((c) => c.inv > 0 || c.imp > 0).sort((a, b) => b.inv - a.inv);
};

/* controls */
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => setPreset(b.dataset.preset)));
document.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => dash.setParams({ m: b.dataset.metric })));
document.querySelectorAll('[data-plat]').forEach((b) => b.addEventListener('click', () => dash.setParams({ plat: b.dataset.plat })));
document.querySelectorAll('.iv-apply').forEach((btn) => btn.addEventListener('click', () => {
  const box = btn.closest('.iv-custom'); if (!box) return;
  const i1 = box.querySelector('.iv-d1'), i2 = box.querySelector('.iv-d2');
  let s = i1 && i1.value, e = i2 && i2.value;
  if (!s || !e) return;
  if (s > e) [s, e] = [e, s];
  dash.setParams({ start: s, end: e, preset: 'custom' });
}));
const press = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => { const on = b.dataset[attr] === val; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
dash.onData(() => {
  const p = dash.params();
  press('[data-preset]', 'preset', p.preset);
  press('[data-metric]', 'metric', p.m || 'investimento');
  press('[data-plat]', 'plat', plat());
  document.querySelectorAll('.iv-custom').forEach((x) => { x.hidden = p.preset !== 'custom'; });
  const [a, b] = range();
  document.querySelectorAll('.iv-d1').forEach((i) => { if (i !== document.activeElement) i.value = a; });
  document.querySelectorAll('.iv-d2').forEach((i) => { if (i !== document.activeElement) i.value = b; });
  const t = totals();
  document.querySelectorAll('.iv-empty').forEach((e) => { e.hidden = !(t && t.inv === 0 && t.imp === 0); });
  const st = dash.data('campanhas_dia').status;
  document.querySelectorAll('.dash-skeleton').forEach((el) => { if (st !== 'loading') el.classList.remove('dash-skeleton'); });
});

dash.draw('periodo', (el) => { const [a, b] = range(); el.textContent = fmtDate(a) + ' – ' + fmtDate(b); });
dash.draw('platname', (el) => { el.textContent = plat() === 'all' ? C.t.allPlats : plat(); });

dash.draw('kpi', (el) => {
  const t = totals();
  if (!t) { el.textContent = '—'; return; }
  const map = { inv: ['inv', 'brl'], imp: ['imp', 'int'], cli: ['cli', 'int'], conv: ['conv', 'dec'], ctr: ['ctr', 'pct'], cpa: ['cpa', 'brl'], cpc: ['cpc', 'brl'], cpm: ['cpm', 'brl'] };
  const [f, fm] = map[el.dataset.k]; const v = t[f];
  el.textContent = v == null ? '—' : F[fm](v);
});

/* platform comparison */
dash.draw('platcmp', (tb) => {
  tb.replaceChildren();
  const ps = byPlatform(); if (!ps) return;
  const totInv = ps.reduce((a, x) => a + x.inv, 0);
  ps.forEach((x) => {
    const tr = document.createElement('tr');
    if (plat() !== 'all' && plat() !== x.p) tr.className = 'iv-dim';
    const td0 = document.createElement('td');
    const dot = document.createElement('span'); dot.className = 'iv-dot'; dot.style.background = PCOL[x.p];
    const nm = document.createElement('span'); nm.className = 'iv-cname'; nm.textContent = x.p;
    const sub = document.createElement('span'); sub.className = 'iv-pres'; sub.textContent = C.resultName[x.p];
    td0.append(dot, nm, sub); tr.appendChild(td0);
    const vals = [[F.brl(x.inv)], [totInv ? F.pct0(x.inv / totInv) : '—', 'h'], [F.int(x.imp), 'h'], [x.cpm == null ? '—' : F.brl(x.cpm), 'h'], [F.int(x.cli)], [x.ctr == null ? '—' : F.pct(x.ctr), 'h'], [x.cpc == null ? '—' : F.brl(x.cpc), 'h'], [F.dec(x.conv)], [x.cpa == null ? '—' : F.brl(x.cpa)]];
    vals.forEach(([v, h]) => { const td = document.createElement('td'); td.textContent = v; if (h) td.className = 'iv-hide-sm'; tr.appendChild(td); });
    tb.appendChild(tr);
  });
});

/* share bars: investment and contacts by platform */
dash.draw('share', (el) => {
  el.replaceChildren();
  const ps = byPlatform(); if (!ps) return;
  const k = el.dataset.k, fmt = el.dataset.fmt;
  const tot = ps.reduce((a, x) => a + x[k], 0);
  const bar = document.createElement('div'); bar.className = 'iv-split';
  ps.forEach((x) => { const s = document.createElement('div'); s.style.width = (tot ? x[k] / tot * 100 : 0) + '%'; s.style.background = PCOL[x.p]; bar.appendChild(s); });
  el.appendChild(bar);
  const leg = document.createElement('div'); leg.className = 'iv-split-leg';
  ps.forEach((x) => {
    const it = document.createElement('div');
    const d = document.createElement('span'); d.className = 'iv-dot'; d.style.background = PCOL[x.p];
    const n = document.createElement('span'); n.textContent = x.p + ' ';
    const v = document.createElement('b'); v.textContent = F[fmt](x[k]) + (tot ? ' · ' + F.pct0(x[k] / tot) : '');
    it.append(d, n, v); leg.appendChild(it);
  });
  el.appendChild(leg);
});

/* trend: stacked bars by platform */
dash.draw('trend', (el) => {
  el.replaceChildren();
  const d = dash.data('campanhas_dia');
  if (d.status === 'error') { const f = document.createElement('div'); f.className = 'iv-fail'; f.textContent = C.t.fail; el.appendChild(f); return; }
  if (!ok()) return;
  const dp = dash.meta().diario_plataforma || {};
  const m = dash.params().m || 'investimento';
  const meta = C.metrics[m];
  const ps = selPlats();
  const [a, b] = range();
  const days = []; for (let s = a; s <= b; s = addDays(s, 1)) days.push(s);
  if (!days.length) return;
  const idx = {}; ps.forEach((p) => { idx[p] = new Map((dp[p] || []).map((r) => [r.data, Number(r[m] || 0)])); });
  const rows = days.map((s) => { const o = { t: new Date(s + 'T12:00:00Z') }; let acc = 0; ps.forEach((p) => { const v = idx[p].get(s) || 0; o[p] = [acc, acc + v]; acc += v; }); o.total = acc; return o; });
  const W = Math.max(280, el.clientWidth), H = 260;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => r.total) || 1], [H - 28, 12]).nice();
  const tf = meta.fmt === 'brl' ? F.cbrl : F.cint;
  const yt = y.ticks(4);
  const probe = svg.append('text').attr('font-size', 11);
  let ml = 0; yt.forEach((t) => { probe.text(tf(t)); ml = Math.max(ml, probe.node().getComputedTextLength()); }); probe.remove();
  ml = Math.ceil(ml) + 12;
  const x = d3.scaleBand(rows.map((r) => +r.t), [ml, W - 8]).padding(rows.length > 45 ? 0.15 : 0.28);
  const g = svg.append('g');
  g.selectAll('line.g').data(yt).join('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y).attr('y2', y).attr('stroke', 'var(--iv-grid)');
  g.selectAll('text.y').data(yt).join('text').attr('x', ml - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--iv-muted)').text(tf);
  const nX = Math.max(2, Math.min(7, Math.floor((W - ml) / 72)));
  const xt = [...new Set(d3.ticks(0, rows.length - 1, nX).map(Math.round))].map((i) => rows[i]).filter(Boolean);
  const dfm = (t) => t.toLocaleDateString(C.loc, { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  g.selectAll('text.x').data(xt).join('text').attr('x', (r) => x(+r.t) + x.bandwidth() / 2).attr('y', H - 6).attr('font-size', 11).attr('fill', 'var(--iv-muted)')
    .attr('text-anchor', (r, i) => i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle').text((r) => dfm(r.t));
  const cols = g.selectAll('g.c').data(rows).join('g').attr('class', 'c');
  ps.forEach((p, i) => {
    cols.append('rect').attr('x', (r) => x(+r.t)).attr('width', x.bandwidth())
      .attr('y', (r) => y(r[p][1])).attr('height', (r) => Math.max(0, y(r[p][0]) - y(r[p][1])))
      .attr('fill', PCOL[p]).attr('rx', i === ps.length - 1 ? Math.min(3, x.bandwidth() / 2) : 0);
  });
  g.append('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--iv-axis)');
  const tip = document.createElement('div'); tip.className = 'iv-tip'; tip.hidden = true; el.appendChild(tip);
  const show = (ev) => {
    const rect = svg.node().getBoundingClientRect(); const sc = rect.width / W;
    const [mx] = d3.pointer(ev, svg.node());
    const r = rows[d3.leastIndex(rows, (q) => Math.abs(x(+q.t) + x.bandwidth() / 2 - mx))];
    tip.replaceChildren();
    const t1 = document.createElement('div'); t1.className = 'd'; t1.textContent = r.t.toLocaleDateString(C.loc, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }); tip.appendChild(t1);
    ps.forEach((p) => { const l = document.createElement('div'); l.className = 'v'; const dt = document.createElement('span'); dt.className = 'iv-dot'; dt.style.background = PCOL[p]; l.append(dt, document.createTextNode(p + ': ' + F[meta.fmt](r[p][1] - r[p][0]))); tip.appendChild(l); });
    if (ps.length > 1) { const l = document.createElement('div'); l.className = 'v'; l.textContent = 'Total: ' + F[meta.fmt](r.total); tip.appendChild(l); }
    cols.attr('opacity', (q) => q === r ? 1 : 0.45);
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(el.clientWidth - tw, (x(+r.t) + x.bandwidth() / 2) * sc - tw / 2)) + 'px';
    tip.style.top = Math.max(0, y(r.total) * sc - tip.offsetHeight - 12) + 'px';
  };
  const hide = () => { tip.hidden = true; cols.attr('opacity', 1); };
  svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml).attr('height', H).attr('fill', 'transparent').on('pointermove', show).on('pointerdown', show).on('pointerleave', hide);
});
dash.draw('legend', (el) => {
  el.replaceChildren();
  selPlats().forEach((p) => { const it = document.createElement('span'); const d = document.createElement('span'); d.className = 'iv-dot'; d.style.background = PCOL[p]; it.append(d, document.createTextNode(p)); el.appendChild(it); });
});

/* campaigns table */
dash.draw('tabela', (tb) => {
  tb.replaceChildren();
  const cs = campaigns(); if (!cs) return;
  const totImp = cs.reduce((a, c) => a + c.imp, 0);
  cs.forEach((c) => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    const pc = document.createElement('span'); pc.className = 'iv-chip iv-pchip'; pc.textContent = c.plataforma.replace(' Ads', ''); pc.style.color = PCOL[c.plataforma]; pc.style.borderColor = PCOL[c.plataforma];
    const chip = document.createElement('span'); chip.className = 'iv-chip'; chip.textContent = c.tipo || '';
    const nm = document.createElement('span'); nm.className = 'iv-cname'; nm.textContent = c.campanha;
    const st = document.createElement('span'); st.className = 'iv-st' + (/ativ|activ/i.test(c.status || '') ? ' on' : ''); st.textContent = c.status || '';
    td0.append(pc, chip, nm, st); tr.appendChild(td0);
    const vals = [[F.brl(c.inv)], [F.int(c.imp), 'h'], [F.int(c.cli)], [F.dec(c.conv)], [c.conv ? F.brl(c.inv / c.conv) : '—'], [totImp ? F.pct(c.imp / totImp).replace(/,00|\.00/, '') : '—', 'h']];
    vals.forEach(([v, h]) => { const td = document.createElement('td'); td.textContent = v; if (h) td.className = 'iv-hide-sm'; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  if (!cs.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 7; td.className = 'iv-none'; td.textContent = C.t.none; tr.appendChild(td); tb.appendChild(tr); }
});
dash.draw('tot', (el) => {
  const cs = campaigns(); if (!cs) { el.textContent = '—'; return; }
  const s = (k) => cs.reduce((a, c) => a + c[k], 0);
  el.textContent = { inv: F.brl(s('inv')), imp: F.int(s('imp')), cli: F.int(s('cli')), conv: F.dec(s('conv')), cpa: s('conv') ? F.brl(s('inv') / s('conv')) : '—', pct: cs.length ? '100%' : '—' }[el.dataset.k];
});

/* horizontal bars by campaign, colored by platform */
dash.draw('cbars', (el) => {
  el.replaceChildren();
  const cs0 = campaigns(); if (!cs0) return;
  const key = el.dataset.k, fmt = el.dataset.fmt;
  const cs = cs0.filter((c) => c[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 8);
  if (!cs.length) { const p = document.createElement('div'); p.className = 'iv-none'; p.textContent = C.t.none; el.appendChild(p); return; }
  const max = cs[0][key];
  cs.forEach((c) => {
    const row = document.createElement('div'); row.className = 'iv-hb';
    const lab = document.createElement('div'); lab.className = 'iv-hb-l'; lab.textContent = c.campanha; lab.title = c.plataforma + ' · ' + c.campanha;
    const track = document.createElement('div'); track.className = 'iv-hb-t';
    const bar = document.createElement('div'); bar.className = 'iv-hb-b'; bar.style.width = Math.max(2, c[key] / max * 100) + '%'; bar.style.background = PCOL[c.plataforma];
    const val = document.createElement('div'); val.className = 'iv-hb-v'; val.textContent = F[fmt](c[key]);
    track.appendChild(bar); row.append(lab, track, val); el.appendChild(row);
  });
});

/* insights */
dash.draw('ins', (el) => {
  const cs = campaigns();
  if (!cs || !cs.length) { el.textContent = '—'; return; }
  const withConv = cs.filter((c) => c.conv > 0);
  const best = withConv.length ? withConv.slice().sort((a, b) => a.inv / a.conv - b.inv / b.conv)[0] : null;
  const most = withConv.length ? withConv.slice().sort((a, b) => b.conv - a.conv)[0] : null;
  const top = cs[0];
  const nm = (c) => c ? c.campanha + ' (' + c.plataforma.replace(' Ads', '') + ')' : '—';
  el.textContent = {
    inv_n: nm(top), inv_v: F.brl(top.inv),
    conv_n: nm(most), conv_v: most ? F.dec(most.conv) : '—',
    cpa_n: nm(best), cpa_v: best ? F.brl(best.inv / best.conv) : '—'
  }[el.dataset.k];
});

document.querySelectorAll('.iv-reset').forEach((b) => b.addEventListener('click', () => { dash.resetParams(); setDefaults(); }));
})();
