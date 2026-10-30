# dashboards-clientes

Relatórios de mídia paga (Meta Ads e Google Ads) dos clientes de Alex Furtado, publicados no GitHub Pages.

- Cada cliente tem uma pasta com `index.html` (página) e `data.json` (dados dos últimos 90 dias).
- `assets/` contém o visual (`style.css`), o comportamento da página (`app.js`, `shim.js`) e a biblioteca de gráficos (`d3.min.js`).
- `scripts/build_data.py` gera os `data.json` a partir das respostas brutas do Windsor.ai (Google Ads) e do Meta Ads; `scripts/clients.json` lista os clientes.
- Os dados são atualizados todo dia de madrugada por uma tarefa agendada no Claude.
