(() => {
const C = window.IV;
const nf = (o) => new Intl.NumberFormat(C.loc, o);
const F = {
  brl: (v) => nf({ style: 'currency', currency: C.cur }).format(v),
  int: (v) => nf({ maximumFractionDigits: 0 }).format(v),
  dec: (v) => nf({ maximumFractionDigits: 1 }).format(v),
  pct: (v) => nf({ style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v),
  cbrl: (v) => nf({ style: 'currency', currency: C.cur, notation: 'compact', maximumFractionDigits: 1 }).format(v),
  cint: (v) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v)
};
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
const inRange = (r) => { const [a, b] = range(); const d = String(r.data).slice(0, 10); return d >= a && d <= b; };
const rowsOf = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data.filter(inRange) : null; };
const sum = (rows, k) => rows.reduce((a, r) => a + Number(r[k] || 0), 0);
const totals = () => {
  const rows = rowsOf('diario'); if (!rows) return null;
  const inv = sum(rows, 'investimento'), imp = sum(rows, 'impressoes'), cli = sum(rows, 'cliques'), conv = sum(rows, 'conversoes');
  return { inv, imp, cli, conv, ctr: imp ? cli / imp : null, cpa: conv ? inv / conv : null, cpc: cli ? inv / cli : null, dias: rows.length };
};
const campaigns = () => {
  const rows = rowsOf('campanhas_dia'); if (!rows) return null;
  const m = new Map();
  rows.forEach((r) => {
    const o = m.get(r.campanha) || { campanha: r.campanha, tipo: r.tipo, status: r.status, inv: 0, imp: 0, cli: 0, conv: 0 };
    o.inv += Number(r.investimento || 0); o.imp += Number(r.impressoes || 0); o.cli += Number(r.cliques || 0); o.conv += Number(r.conversoes || 0);
    m.set(r.campanha, o);
  });
  return [...m.values()].filter((c) => c.inv > 0 || c.imp > 0).sort((a, b) => b.inv - a.inv);
};

/* controls */
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => setPreset(b.dataset.preset)));
document.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => dash.setParams({ m: b.dataset.metric })));
dash.onData(() => {
  const p = dash.params();
  document.querySelectorAll('[data-preset]').forEach((b) => { const on = p.preset === b.dataset.preset; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const m = p.m || 'investimento';
  document.querySelectorAll('[data-metric]').forEach((b) => { const on = m === b.dataset.metric; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const t = totals();
  document.querySelectorAll('.iv-empty').forEach((e) => { e.hidden = !(t && t.inv === 0 && t.imp === 0); });
  ['diario', 'campanhas_dia'].forEach((id) => {
    const st = dash.data(id).status;
    document.querySelectorAll('[data-source="' + id + '"]').forEach((el) => { if (st !== 'loading') el.classList.remove('dash-skeleton'); });
  });
});

/* custom range */
document.querySelectorAll('.iv-apply').forEach((btn) => btn.addEventListener('click', () => {
  const box = btn.closest('.iv-custom'); if (!box) return;
  const i1 = box.querySelector('.iv-d1'), i2 = box.querySelector('.iv-d2');
  let s = i1 && i1.value, e = i2 && i2.value;
  if (!s || !e) return;
  if (s > e) [s, e] = [e, s];
  dash.setParams({ start: s, end: e, preset: 'custom' });
}));
dash.onData(() => {
  const open = dash.params().preset === 'custom';
  document.querySelectorAll('.iv-custom').forEach((p) => { p.hidden = !open; });
  const [a, b] = range();
  document.querySelectorAll('.iv-d1').forEach((i) => { if (i !== document.activeElement) i.value = a; });
  document.querySelectorAll('.iv-d2').forEach((i) => { if (i !== document.activeElement) i.value = b; });
});

dash.draw('periodo', (el) => { const [a, b] = range(); el.textContent = fmtDate(a) + ' – ' + fmtDate(b); });

dash.draw('kpi', (el) => {
  const t = totals();
  if (!t) { el.textContent = '—'; return; }
  const k = el.dataset.k;
  const map = { inv: ['inv', 'brl'], imp: ['imp', 'int'], cli: ['cli', 'int'], conv: ['conv', 'dec'], ctr: ['ctr', 'pct'], cpa: ['cpa', 'brl'], cpc: ['cpc', 'brl'] };
  const [f, fm] = map[k]; const v = t[f];
  el.textContent = v == null ? '—' : F[fm](v);
});

/* trend chart */
dash.draw('trend', (el) => {
  el.replaceChildren();
  const d = dash.data('diario');
  if (d.status === 'error') { const f = document.createElement('div'); f.className = 'iv-fail'; f.textContent = C.t.fail; el.appendChild(f); return; }
  const rows0 = rowsOf('diario'); if (!rows0 || !rows0.length) return;
  const m = dash.params().m || 'investimento';
  const meta = C.metrics[m];
  const rows = rows0.map((r) => ({ t: new Date(String(r.data).slice(0, 10) + 'T12:00:00Z'), v: Number(r[m] || 0) })).sort((a, b) => a.t - b.t);
  const W = Math.max(280, el.clientWidth), H = 260;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => r.v) || 1], [H - 28, 12]).nice();
  const tf = meta.fmt === 'brl' ? F.cbrl : F.cint;
  const yt = y.ticks(4);
  const probe = svg.append('text').attr('font-size', 11);
  let ml = 0; yt.forEach((t) => { probe.text(tf(t)); ml = Math.max(ml, probe.node().getComputedTextLength()); }); probe.remove();
  ml = Math.ceil(ml) + 12;
  const bars = rows.length <= 45;
  const x = bars ? d3.scaleBand(rows.map((r) => +r.t), [ml, W - 8]).padding(0.28) : d3.scaleUtc(d3.extent(rows, (r) => r.t), [ml, W - 8]);
  const xp = (r) => bars ? x(+r.t) + x.bandwidth() / 2 : x(r.t);
  const g = svg.append('g');
  g.selectAll('line.g').data(yt).join('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y).attr('y2', y).attr('stroke', 'var(--iv-grid)');
  g.selectAll('text.y').data(yt).join('text').attr('x', ml - 8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'var(--iv-muted)').text(tf);
  const nX = Math.max(2, Math.min(7, Math.floor((W - ml) / 72)));
  const xt = [...new Set(d3.ticks(0, rows.length - 1, nX).map(Math.round))].map((i) => rows[i]).filter(Boolean);
  const dfm = (t) => t.toLocaleDateString(C.loc, { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  g.selectAll('text.x').data(xt).join('text').attr('x', xp).attr('y', H - 6).attr('font-size', 11).attr('fill', 'var(--iv-muted)')
    .attr('text-anchor', (r, i) => i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle').text((r) => dfm(r.t));
  let marks;
  if (bars) {
    marks = g.selectAll('rect.b').data(rows).join('rect').attr('x', (r) => x(+r.t)).attr('width', x.bandwidth())
      .attr('y', (r) => y(r.v)).attr('height', (r) => Math.max(0, y(0) - y(r.v))).attr('rx', Math.min(4, x.bandwidth() / 2)).attr('fill', meta.color).attr('opacity', 0.9);
  } else {
    const gid = 'ivg-' + m;
    const gr = svg.append('defs').append('linearGradient').attr('id', gid).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
    [[0, .35], [.5, .12], [1, 0]].forEach(([o, a]) => gr.append('stop').attr('offset', o).attr('style', `stop-color:${meta.color};stop-opacity:${a}`));
    g.append('path').datum(rows).attr('fill', `url(#${gid})`).attr('d', d3.area().x(xp).y0(y(0)).y1((r) => y(r.v)));
    g.append('path').datum(rows).attr('fill', 'none').attr('stroke', meta.color).attr('stroke-width', 2.2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('d', d3.line().x(xp).y((r) => y(r.v)));
  }
  g.append('line').attr('x1', ml).attr('x2', W - 8).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--iv-axis)');
  const dot = g.append('circle').attr('r', 4.5).attr('fill', meta.color).attr('stroke', 'var(--iv-card)').attr('stroke-width', 2).style('display', 'none');
  const tip = document.createElement('div'); tip.className = 'iv-tip'; tip.hidden = true;
  const t1 = document.createElement('div'); t1.className = 'd'; const t2 = document.createElement('div'); t2.className = 'v'; tip.append(t1, t2); el.appendChild(tip);
  const show = (ev) => {
    const rect = svg.node().getBoundingClientRect(); const sc = rect.width / W;
    const [mx] = d3.pointer(ev, svg.node());
    const r = rows[d3.leastIndex(rows, (q) => Math.abs(xp(q) - mx))];
    t1.textContent = r.t.toLocaleDateString(C.loc, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
    t2.textContent = meta.label + ': ' + F[meta.fmt](r.v);
    if (bars) marks.attr('opacity', (q) => q === r ? 1 : 0.4); else dot.style('display', null).attr('cx', xp(r)).attr('cy', y(r.v));
    tip.hidden = false;
    const tw = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(el.clientWidth - tw, xp(r) * sc - tw / 2)) + 'px';
    tip.style.top = Math.max(0, y(r.v) * sc - tip.offsetHeight - 12) + 'px';
  };
  const hide = () => { tip.hidden = true; dot.style('display', 'none'); if (bars) marks.attr('opacity', 0.9); };
  svg.append('rect').attr('x', ml).attr('y', 0).attr('width', W - ml).attr('height', H).attr('fill', 'transparent').on('pointermove', show).on('pointerdown', show).on('pointerleave', hide);
});

/* campaigns table */
dash.draw('tabela', (tb) => {
  tb.replaceChildren();
  const cs = campaigns(); if (!cs) return;
  const totImp = cs.reduce((a, c) => a + c.imp, 0);
  cs.forEach((c) => {
    const tr = document.createElement('tr');
    const td0 = document.createElement('td');
    const chip = document.createElement('span'); chip.className = 'iv-chip'; chip.textContent = c.tipo || '';
    const nm = document.createElement('span'); nm.className = 'iv-cname'; nm.textContent = c.campanha;
    const st = document.createElement('span'); st.className = 'iv-st' + (/ativ|activ/i.test(c.status || '') ? ' on' : ''); st.textContent = c.status || '';
    td0.append(chip, nm, st); tr.appendChild(td0);
    const vals = [[F.brl(c.inv)], [F.int(c.imp), 'h'], [F.int(c.cli)], [F.dec(c.conv)], [c.conv ? F.brl(c.inv / c.conv) : '—'], [totImp ? F.pct(c.imp / totImp).replace(/,00|\.00/, '') : '—', 'h']];
    vals.forEach(([v, h]) => { const td = document.createElement('td'); td.textContent = v; if (h) td.className = 'iv-hide-sm'; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  if (!cs.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 7; td.className = 'iv-none'; td.textContent = C.t.none; tr.appendChild(td); tb.appendChild(tr); }
});
dash.draw('tot', (el) => {
  const cs = campaigns(); if (!cs) { el.textContent = '—'; return; }
  const s = (k) => cs.reduce((a, c) => a + c[k], 0);
  const k = el.dataset.k;
  const v = { inv: F.brl(s('inv')), imp: F.int(s('imp')), cli: F.int(s('cli')), conv: F.dec(s('conv')), cpa: s('conv') ? F.brl(s('inv') / s('conv')) : '—', pct: cs.length ? '100%' : '—' }[k];
  el.textContent = v;
});

/* horizontal bars by campaign */
dash.draw('cbars', (el) => {
  el.replaceChildren();
  const cs0 = campaigns(); if (!cs0) return;
  const key = el.dataset.k, fmt = el.dataset.fmt;
  const cs = cs0.filter((c) => c[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 8);
  if (!cs.length) { const p = document.createElement('div'); p.className = 'iv-none'; p.textContent = C.t.none; el.appendChild(p); return; }
  const max = cs[0][key];
  cs.forEach((c, i) => {
    const row = document.createElement('div'); row.className = 'iv-hb';
    const lab = document.createElement('div'); lab.className = 'iv-hb-l'; lab.textContent = c.campanha;
    const track = document.createElement('div'); track.className = 'iv-hb-t';
    const bar = document.createElement('div'); bar.className = 'iv-hb-b'; bar.style.width = Math.max(2, c[key] / max * 100) + '%'; bar.style.background = C.palette[i % C.palette.length];
    const val = document.createElement('div'); val.className = 'iv-hb-v'; val.textContent = F[fmt](c[key]);
    track.appendChild(bar); row.append(lab, track, val); el.appendChild(row);
  });
});

/* insights */
dash.draw('ins', (el) => {
  const cs = campaigns();
  const k = el.dataset.k;
  if (!cs || !cs.length) { el.textContent = '—'; return; }
  const by = (f) => cs.slice().sort((a, b) => f(b) - f(a))[0];
  const withConv = cs.filter((c) => c.conv > 0);
  const best = withConv.length ? withConv.slice().sort((a, b) => a.inv / a.conv - b.inv / b.conv)[0] : null;
  const top = by((c) => c.inv), most = withConv.length ? by((c) => c.conv) : null;
  const v = {
    inv_n: top.campanha, inv_v: F.brl(top.inv),
    conv_n: most ? most.campanha : '—', conv_v: most ? F.dec(most.conv) : '—',
    cpa_n: best ? best.campanha : '—', cpa_v: best ? F.brl(best.inv / best.conv) : '—'
  }[k];
  el.textContent = v;
});

const reset = document.querySelectorAll('.iv-reset');
reset.forEach((b) => b.addEventListener('click', () => { dash.resetParams(); setDefaults(); }));
})();
