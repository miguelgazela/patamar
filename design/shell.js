/* Injeta navegação (inferior no telemóvel, lateral no desktop) e ícones SVG.
   Uso: <body data-page="inicio" data-role="admin|condomino"> + <script src="shell.js"></script> */
(function () {
  const P = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    coins: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 010 3h-3a1.5 1.5 0 000 3h4"/>',
    bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    drop: '<path d="M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z"/>',
    broom: '<path d="M14 3l5 5-6 6-5-5z"/><path d="M8 9l-4 4 7 7 4-4M8 13l4 4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    dl: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    chev: '<path d="M9 5l7 7-7 7"/>'
  };
  window.ico = (n, extra) => '<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" ' + (extra || '') + '>' + P[n] + '</svg>';
  document.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = window.ico(el.dataset.ico) + el.innerHTML; });

  const logo = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1D4E89"/><path d="M7 22h6v-5h6v-5h6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const body = document.body, page = body.dataset.page, role = body.dataset.role || 'admin';
  const items = role === 'admin'
    ? [['inicio', 'inicio.html', 'home', 'Início'], ['despesa', 'despesa.html', 'cam', 'Despesa'], ['quotas', 'quotas.html', 'coins', 'Quotas'], ['extrato', 'extrato.html', 'bank', 'Extrato']]
    : [['portal', 'portal.html', 'home', 'O meu saldo']];
  const nav = '<nav class="nav" aria-label="Principal"><span class="side-only">' + logo.replace('<svg', '<svg width="28" height="28"') + 'Patamar</span>' +
    items.map(i => '<a href="' + i[1] + '"' + (i[0] === page ? ' aria-current="page"' : '') + '>' + window.ico(i[2]) + '<span>' + i[3] + '</span>' +
      (i[0] === 'extrato' ? '<span class="nav-badge" aria-label="6 movimentos por confirmar">6</span>' : '') + '</a>').join('') + '</nav>';
  const who = role === 'admin' ? '<b>Rua das Flores, 24</b>Administrador · Ana Ferreira' : '<b>Eva Rocha</b>Fração E · 2.º Esq.';
  const top = '<header class="topbar"><a class="brand" href="index.html">' + logo + 'Patamar</a><span class="spacer"></span><div class="who">' + who + '</div></header>';
  const main = document.querySelector('main');
  const wrap = document.createElement('div'); wrap.className = 'shell';
  wrap.innerHTML = nav; const col = document.createElement('div');
  col.innerHTML = top; col.appendChild(main);
  wrap.appendChild(col); body.appendChild(wrap);
  main.id = 'conteudo'; main.className = (main.className + ' main').trim();
  const sk = document.createElement('a'); sk.className = 'skip'; sk.href = '#conteudo'; sk.textContent = 'Saltar para o conteúdo'; body.prepend(sk);
})();
