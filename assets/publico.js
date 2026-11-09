/* Perfil do público do Google Ads (idade, gênero, renda, dispositivo, cidade) + comparativo de campanhas.
   Lê pub_*_dia e campanhas_dia do data.json e segue o mesmo período (params start/end). */
(() => {
const C = window.IV;
const nf = (o) => new Intl.NumberFormat(C.loc, o);
const F = {
  brl: (v) => nf({ style: 'currency', currency: C.cur }).format(v),
  int: (v) => nf({ maximumFractionDigits: 0 }).format(v),
  dec: (v) => nf({ maximumFractionDigits: 1 }).format(v),
  pct: (v) => nf({ style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v),
  cint: (v) => nf({ notation: 'compact', maximumFractionDigits: 1 }).format(v)
};
const MET = { impressoes: ['Impressões', 'int'], cliques: ['Cliques', 'int'], conversoes: ['Conversões', 'dec'], investimento: ['Investimento', 'brl'] };
const pad = (n) => String(n).padStart(2, '0');
const yesterday = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const range = () => { const p = dash.params(); return [p.start || addDays(yesterday(), -29), p.end || yesterday()]; };
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const met = () => dash.params().pm || 'impressoes';
const ORDER = {
  idade: ['18 a 24', '25 a 34', '35 a 44', '45 a 54', '55 a 64', '65+', 'Não identificada'],
  renda: ['10% com maior renda', '11–20%', '21–30%', '31–40%', '41–50%', '50% com menor renda', 'Desconhecida'],
  genero: ['Feminino', 'Masculino', 'Não identificado']
};
const UNK = /^(Não identificad|Desconhecida)/;
const group = (kind) => {
  const d = dash.data('pub_' + kind + '_dia'); if (d.status !== 'ok') return null;
  const [a, b] = range(), m = new Map();
  d.data.filter((r) => r.data >= a && r.data <= b).forEach((r) => {
    const o = m.get(r.grupo) || { k: r.grupo, impressoes: 0, cliques: 0, conversoes: 0, investimento: 0 };
    ['impressoes', 'cliques', 'conversoes', 'investimento'].forEach((x) => { o[x] += Number(r[x] || 0); });
    m.set(r.grupo, o);
  });
  let rows = [...m.values()];
  if (ORDER[kind]) rows.sort((x, y) => ORDER[kind].indexOf(x.k) - ORDER[kind].indexOf(y.k)); else rows.sort((x, y) => y[met()] - x[met()] || y.impressoes - x.impressoes);
  return rows;
};
const none = (box) => box.appendChild(el('div', 'iv-none', C.t.none));
const fmtv = (v) => F[MET[met()][1]](v);

dash.onData(() => {
  document.querySelectorAll('[data-pm]').forEach((b) => { const on = met() === b.dataset.pm; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-pub-lbl]').forEach((e) => { e.textContent = MET[met()][0].toLowerCase(); });
});
document.querySelectorAll('[data-pm]').forEach((b) => b.addEventListener('click', () => dash.setParams({ pm: b.dataset.pm })));

/* barras verticais por faixa etária */
dash.draw('pub-idade', (box) => {
  box.replaceChildren();
  const rows = group('idade'); if (!rows) return;
  const k = met(), tot = rows.reduce((s, r) => s + r[k], 0);
  if (!tot) return none(box);
  const known = rows.filter((r) => !UNK.test(r.k));
  const top = known.length ? known.reduce((a, b) => (b[k] > a[k] ? b : a)) : null;
  const W = Math.max(280, box.clientWidth), H = 250, ml = 36, mt = 34;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);
  const x = d3.scaleBand(rows.map((r) => r.k), [ml, W - 6]).padding(0.28);
  const y = d3.scaleLinear([0, d3.max(rows, (r) => r[k]) * 1.1 || 1], [H - 26, mt]).nice();
  const g = svg.append('g');
  g.selectAll('line').data(y.ticks(4)).join('line').attr('x1', ml).attr('x2', W - 6).attr('y1', y).attr('y2', y).attr('stroke', 'var(--iv-grid)');
  g.selectAll('text.y').data(y.ticks(4)).join('text').attr('x', ml - 6).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').attr('font-size', 10.5).attr('fill', 'var(--iv-muted)').text((v) => k === 'investimento' ? F.cint(v) : F.cint(v));
  g.selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.k)).attr('width', x.bandwidth()).attr('y', (r) => y(r[k])).attr('height', (r) => y(0) - y(r[k]))
    .attr('rx', 5).attr('fill', (r) => r === top ? '#3b82f6' : UNK.test(r.k) ? '#475569' : '#1d4ed8').attr('opacity', (r) => r === top ? 1 : 0.85);
  g.selectAll('text.v').data(rows).join('text').attr('x', (r) => x(r.k) + x.bandwidth() / 2).attr('y', (r) => y(r[k]) - 16).attr('text-anchor', 'middle').attr('font-size', 11).attr('font-weight', 700).attr('fill', 'var(--iv-fg)').text((r) => fmtv(r[k]));
  g.selectAll('text.p').data(rows).join('text').attr('x', (r) => x(r.k) + x.bandwidth() / 2).attr('y', (r) => y(r[k]) - 4).attr('text-anchor', 'middle').attr('font-size', 9.5).attr('fill', 'var(--iv-muted)').text((r) => '(' + F.pct(r[k] / tot) + ')');
  g.selectAll('text.x').data(rows).join('text').attr('x', (r) => x(r.k) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').attr('font-size', 10.5).attr('fill', 'var(--iv-muted)').attr('font-size', x.bandwidth() < 42 ? 9.5 : 10.5).text((r) => r.k === 'Não identificada' ? 'N/I' : x.bandwidth() < 42 ? r.k.replace(' a ', '–') : r.k);
  if (top) {
    const cx = x(top.k) + x.bandwidth() / 2, ty = Math.max(2, y(top[k]) - 40);
    const lab = g.append('g').attr('transform', `translate(${cx},${ty})`);
    lab.append('rect').attr('x', -50).attr('y', -9).attr('width', 100).attr('height', 18).attr('rx', 9).attr('fill', '#1e3a8a').attr('stroke', '#3b82f6');
    lab.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').attr('font-size', 10).attr('font-weight', 700).attr('fill', '#bfdbfe').text('Principal público');
  }
});

/* rosca genérica */
const donut = (box, rows, colors, center) => {
  box.replaceChildren();
  const k = met(), tot = rows.reduce((s, r) => s + r[k], 0);
  if (!tot) return none(box);
  const wrap = el('div', 'pub-donut'), chart = el('div', 'pub-donut-c'), leg = el('div', 'pub-leg');
  wrap.append(chart, leg); box.appendChild(wrap);
  const S = 170, R = S / 2;
  const svg = d3.select(chart).append('svg').attr('width', S).attr('height', S).attr('viewBox', `0 0 ${S} ${S}`);
  const arcs = d3.pie().sort(null).value((r) => r[k])(rows.filter((r) => r[k] > 0));
  svg.append('g').attr('transform', `translate(${R},${R})`).selectAll('path').data(arcs).join('path')
    .attr('d', d3.arc().innerRadius(R * 0.58).outerRadius(R - 2).padAngle(0.015).cornerRadius(3)).attr('fill', (a) => colors(a.data.k, a.index));
  if (center) {
    const t = svg.append('text').attr('x', R).attr('y', R).attr('text-anchor', 'middle');
    t.append('tspan').attr('x', R).attr('dy', '-0.1em').attr('font-size', 17).attr('font-weight', 700).attr('fill', 'var(--iv-fg)').text(center[0]);
    t.append('tspan').attr('x', R).attr('dy', '1.3em').attr('font-size', 10).attr('fill', 'var(--iv-muted)').text(center[1]);
  }
  rows.forEach((r, i) => {
    const it = el('div', 'pub-li'), dot = el('span', 'pub-dot'); dot.style.background = colors(r.k, i);
    const nm = el('div', 'pub-ln'); nm.append(el('span', null, r.k), el('b', null, fmtv(r[k])), el('em', null, F.pct(r[k] / tot)));
    it.append(dot, nm); leg.appendChild(it);
  });
};
const GEN = { Feminino: '#ec4899', Masculino: '#3b82f6', 'Não identificado': '#64748b' };
dash.draw('pub-genero', (box) => { const r = group('genero'); if (r) donut(box, r, (k) => GEN[k] || '#64748b'); });
const DEVC = { Smartphone: '#2dd4bf', Computador: '#3b82f6', Tablet: '#f59e0b', 'TV conectada': '#a78bfa', Outros: '#64748b' };
dash.draw('pub-disp', (box) => { const r = group('dispositivo'); if (r) { const k = met(), t = r.reduce((s, x) => s + x[k], 0); r.sort((a, b) => b[k] - a[k]); donut(box, r, (n) => DEVC[n] || '#64748b', [F.cint(t), MET[k][0].toLowerCase()]); } });
const PAL = ['#2dd4bf', '#3b82f6', '#f59e0b', '#a78bfa', '#ec4899', '#22c55e', '#38bdf8', '#f97316'];
dash.draw('pub-cidade-donut', (box) => {
  const r = group('cidade'); if (!r) return;
  const k = met(), top = r.filter((x) => x[k] > 0).slice(0, 6), rest = r.slice(6).reduce((o, x) => { Object.keys(MET).forEach((m) => { o[m] += x[m]; }); return o; }, { k: 'Outras cidades', impressoes: 0, cliques: 0, conversoes: 0, investimento: 0 });
  const rows = rest[k] > 0 ? top.concat([rest]) : top;
  donut(box, rows, (n, i) => n === 'Outras cidades' ? '#64748b' : PAL[i % PAL.length], [String(r.filter((x) => x[k] > 0).length), 'cidades']);
});

/* barras horizontais por renda */
const RENDA = ['#22c55e', '#2dd4bf', '#38bdf8', '#3b82f6', '#a78bfa', '#ec4899', '#64748b'];
dash.draw('pub-renda', (box) => {
  box.replaceChildren();
  const rows = group('renda'); if (!rows) return;
  const k = met(), tot = rows.reduce((s, r) => s + r[k], 0); if (!tot) return none(box);
  const max = d3.max(rows, (r) => r[k]);
  rows.forEach((r) => {
    const row = el('div', 'pub-rrow'), top = el('div', 'pub-rtop'); top.append(el('span', null, r.k), el('b', null, F.pct(r[k] / tot)));
    const tr = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(1.5, r[k] / max * 100) + '%'; bar.style.background = RENDA[ORDER.renda.indexOf(r.k)] || '#64748b'; tr.appendChild(bar);
    row.append(top, tr); box.appendChild(row);
  });
});

/* tabela por cidade */
dash.draw('pub-cidade-tab', (tb) => {
  tb.replaceChildren();
  const rows = group('cidade'); if (!rows) return;
  const tot = rows.reduce((s, r) => s + r.impressoes, 0);
  rows.slice(0, 12).forEach((r) => {
    const tr = el('tr'); const td0 = el('td'); td0.appendChild(el('span', 'iv-cname', r.k)); tr.appendChild(td0);
    [[F.brl(r.investimento)], [F.int(r.impressoes)], [F.int(r.cliques), 'iv-hide-sm'], [F.dec(r.conversoes), r.conversoes ? 'ga-pos' : null], [tot ? F.pct(r.impressoes / tot) : '—', 'iv-hide-sm']]
      .forEach(([v, c]) => tr.appendChild(el('td', c || null, v)));
    tb.appendChild(tr);
  });
  if (!rows.length) { const tr = el('tr'), td = el('td', 'iv-none', C.t.none); td.colSpan = 6; tr.appendChild(td); tb.appendChild(tr); }
});

/* cartões: público principal, melhor campanha, melhor custo */
const camps = () => {
  const d = dash.data('campanhas_dia'); if (d.status !== 'ok') return null;
  const [a, b] = range(), m = new Map();
  d.data.filter((r) => r.data >= a && r.data <= b).forEach((r) => {
    const o = m.get(r.campanha) || { k: r.campanha, inv: 0, imp: 0, cli: 0, conv: 0 };
    o.inv += r.investimento; o.imp += r.impressoes; o.cli += r.cliques; o.conv += r.conversoes; m.set(r.campanha, o);
  });
  return [...m.values()].filter((c) => c.inv > 0 || c.imp > 0);
};
const topOf = (kind) => { const r = group(kind); if (!r) return null; const k = met(); const kn = r.filter((x) => !UNK.test(x.k) && x[k] > 0); if (!kn.length) return null; const t = kn.reduce((a, b) => (b[k] > a[k] ? b : a)); return { ...t, share: t[k] / r.reduce((s, x) => s + x[k], 0) }; };
dash.draw('pub-card', (e) => {
  const f = e.dataset.k;
  const g = topOf('genero'), i = topOf('idade'), c = topOf('cidade'), cs = camps() || [];
  const best = cs.filter((x) => x.conv > 0).sort((a, b) => b.conv - a.conv)[0];
  const cheap = cs.filter((x) => x.conv > 0).sort((a, b) => a.inv / a.conv - b.inv / b.conv)[0];
  const v = {
    gen: g ? (g.k === 'Feminino' ? 'Mulheres' : 'Homens') : '—', genp: g ? F.pct(g.share) : '—',
    age: i ? 'Faixa ' + i.k + ' anos' : '—', city: c ? c.k : '—',
    best: best ? best.k : '—', bestv: best ? F.dec(best.conv) : '—',
    cheap: cheap ? cheap.k : '—', cheapv: cheap ? F.brl(cheap.inv / cheap.conv) : '—'
  }[f];
  e.textContent = v;
});

/* insights automáticos (só fatos dos dados) */
dash.draw('pub-ins', (ul) => {
  ul.replaceChildren();
  const g = topOf('genero'), i = topOf('idade'), c = topOf('cidade'), r = topOf('renda'), d = topOf('dispositivo');
  const lbl = MET[met()][0].toLowerCase();
  const items = [];
  if (g && i) items.push(`O principal público são ${g.k === 'Feminino' ? 'as mulheres' : 'os homens'} de ${i.k} anos${c ? ', principalmente em ' + c.k : ''}.`);
  if (r) items.push(`A maior parte do público classificado está na faixa de renda "${r.k}" (${F.pct(r.share)} das ${lbl}).`);
  if (d) items.push(`${F.pct(d.share)} das ${lbl} vieram de ${d.k === 'Smartphone' ? 'smartphones' : d.k.toLowerCase()}.`);
  const ci = group('cidade'), cs = ci ? ci.filter((x) => x.conversoes > 0).map((x) => x.k) : [];
  if (cs.length) items.push(`Cidades que geraram conversão no período: ${cs.join(', ')}.`);
  if (!items.length) items.push(C.t.none);
  items.forEach((t) => { const li = el('li'); li.textContent = t; ul.appendChild(li); });
});

/* comparativo de campanhas: 4 gráficos + tabela */
const CMP = { inv: ['Investimento', 'brl', '#2dd4bf'], imp: ['Impressões', 'int', '#ec4899'], conv: ['Conversões', 'dec', '#3b82f6'], ctr: ['CTR (%)', 'pct', '#f59e0b'] };
dash.draw('cmp-bars', (box) => {
  box.replaceChildren();
  const cs = camps(); if (!cs) return;
  const k = box.dataset.k, [, fmt, color] = CMP[k];
  const rows = cs.map((c) => ({ ...c, ctr: c.imp ? c.cli / c.imp : 0 })).filter((c) => c[k] > 0).sort((a, b) => b[k] - a[k]);
  if (!rows.length) return none(box);
  const max = rows[0][k];
  rows.forEach((c) => {
    const row = el('div', 'iv-hb'), lab = el('div', 'iv-hb-l', c.k); lab.title = c.k;
    const tr = el('div', 'iv-hb-t'), bar = el('div', 'iv-hb-b'); bar.style.width = Math.max(2, c[k] / max * 100) + '%'; bar.style.background = color; tr.appendChild(bar);
    row.append(lab, tr, el('div', 'iv-hb-v', F[fmt](c[k]))); box.appendChild(row);
  });
});
dash.draw('cmp-tab', (tb) => {
  tb.replaceChildren();
  const cs = camps(); if (!cs) return;
  cs.sort((a, b) => b.inv - a.inv).forEach((c) => {
    const tr = el('tr'); const td0 = el('td'); td0.appendChild(el('span', 'iv-cname', c.k)); tr.appendChild(td0);
    [[F.brl(c.inv)], [F.int(c.imp), 'iv-hide-sm'], [F.int(c.cli)], [F.dec(c.conv)], [c.imp ? F.pct(c.cli / c.imp) : '—'], [c.cli ? F.brl(c.inv / c.cli) : '—'], [c.conv ? F.brl(c.inv / c.conv) : '—', 'iv-hide-sm']]
      .forEach(([v, cl]) => tr.appendChild(el('td', cl || null, v)));
    tb.appendChild(tr);
  });
  if (!cs.length) { const tr = el('tr'), td = el('td', 'iv-none', C.t.none); td.colSpan = 8; tr.appendChild(td); tb.appendChild(tr); }
});
dash.draw('cmp-dest', (e) => {
  const cs = camps(); if (!cs || !cs.length) { e.textContent = '—'; return; }
  const by = (f, asc) => cs.filter((c) => f(c) != null).sort((a, b) => asc ? f(a) - f(b) : f(b) - f(a))[0];
  const f = e.dataset.k, a = by((c) => c.imp), b = by((c) => c.imp ? c.cli / c.imp : null), d = by((c) => c.cli ? c.inv / c.cli : null, true), m = by((c) => c.conv);
  e.textContent = { imp_n: a.k, imp_v: F.int(a.imp) + ' impressões', ctr_n: b.k, ctr_v: F.pct(b.cli / b.imp) + ' de cliques', cpc_n: d ? d.k : '—', cpc_v: d ? F.brl(d.inv / d.cli) + ' por clique' : '—', conv_n: m.conv ? m.k : '—', conv_v: m.conv ? F.dec(m.conv) + ' conversões' : '—' }[f];
});
})();
