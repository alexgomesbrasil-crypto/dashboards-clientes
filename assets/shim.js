/* Mini runtime: carrega data.json e redesenha a página quando os dados ou o período mudam. */
window.dash = (() => {
  let params = {}, DATA = {}, status = 'loading';
  const onFns = [], draws = [];
  const each = (n, fn) => document.querySelectorAll('[data-draw="' + n + '"]').forEach((el) => { try { fn(el); } catch (e) { console.error(e); } });
  const render = () => { onFns.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); draws.forEach(([n, fn]) => each(n, fn)); };
  let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(render, 150); });
  return {
    params: () => ({ ...params }),
    setParams: (p) => { params = { ...params, ...p }; render(); },
    resetParams: () => { params = {}; render(); },
    data: (id) => status === 'ok' ? { status: 'ok', data: DATA[id] || [] } : { status, data: [] },
    onData: (fn) => { onFns.push(fn); try { fn(); } catch (e) { console.error(e); } },
    draw: (n, fn) => { draws.push([n, fn]); each(n, fn); },
    load: (url) => fetch(url + '?v=' + Date.now(), { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((d) => { DATA = d; status = 'ok'; render(); })
      .catch(() => { status = 'error'; render(); }),
    meta: () => DATA
  };
})();
