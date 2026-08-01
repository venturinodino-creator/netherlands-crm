/* openalex.js — OpenAlex column + readability improvements for subscription matrix */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent = [
    'table.sub-matrix td:first-child, table.sub-matrix th.uni-header { position:sticky;left:0;z-index:2;background:rgba(12,19,32,.97); }',
    'table.sub-matrix thead tr:first-child th:first-child { position:sticky;left:0;z-index:3;background:rgba(12,19,32,.97); }',
    'table.sub-matrix th { font-size:11px !important; }',
    'table.sub-matrix td { font-size:12px !important; }',
    'table.sub-matrix .sub-row td:first-child span:last-child { font-size:14px !important; }',
    'table.sub-matrix thead tr:first-child th { border-right:1px solid rgba(255,255,255,.15) !important; }',
    'table.sub-matrix .sub-row:hover td { background:rgba(255,255,255,.055) !important; }',
    '.oa-evidence { font-size:10px;color:#94a3b8;line-height:1.5;text-align:left;padding:6px 10px;max-width:190px; }',
    '.oa-evidence a { color:#4ade80;text-decoration:none; }',
    '.oa-badge { display:inline-block;background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.3);border-radius:4px;padding:1px 5px;font-size:9px;font-weight:700;letter-spacing:.4px; }',
    '.oa-badge.oa-ror { background:rgba(99,102,241,.12);color:#a5b4fc;border-color:rgba(99,102,241,.3); }',
  ].join('');
  document.head.appendChild(style);

  var content = document.getElementById('content');
  if (!content) return;
  var applied = false;

  function tryApply() {
    if (applied) return;
    var titleEl = document.getElementById('page-title');
    if (!titleEl || !titleEl.textContent.includes('Subscription')) return;
    var table = content.querySelector('table');
    if (!table || table.classList.contains('sub-matrix')) return;
    applied = true;
    addColumns(table);
  }

  var obs = new MutationObserver(function () { applied = false; setTimeout(tryApply, 80); });
  obs.observe(content, { childList: true });
  setTimeout(tryApply, 200);

  function addColumns(table) {
    table.classList.add('sub-matrix');
    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    var uniTh = thead.rows[0] && thead.rows[0].cells[0];
    if (uniTh) uniTh.classList.add('uni-header');

    var oaGroupTh = document.createElement('th');
    oaGroupTh.setAttribute('data-oa','1');
    oaGroupTh.colSpan = 2;
    oaGroupTh.style.cssText = 'background:rgba(34,197,94,.13);color:#4ade80;text-align:center;font-size:11px;font-weight:700;padding:7px 8px;letter-spacing:.6px;text-transform:uppercase;border-left:2px solid rgba(34,197,94,.3);white-space:nowrap';
    oaGroupTh.textContent = 'Open Access DB';
    thead.rows[0].appendChild(oaGroupTh);

    var oaTh = document.createElement('th');
    oaTh.style.cssText = 'background:rgba(255,255,255,.04);color:#4ade80;font-size:11px;font-weight:600;padding:8px 6px;text-align:center;vertical-align:bottom;white-space:nowrap;letter-spacing:.3px;border-left:2px solid rgba(34,197,94,.3)';
    oaTh.textContent = 'OpenAlex';
    thead.rows[1].appendChild(oaTh);

    var evTh = document.createElement('th');
    evTh.style.cssText = 'background:rgba(255,255,255,.04);color:#94a3b8;font-size:11px;font-weight:600;padding:8px 10px;text-align:left;vertical-align:bottom;white-space:nowrap;letter-spacing:.3px;border-left:1px solid rgba(255,255,255,.06)';
    evTh.textContent = 'Evidence';
    thead.rows[1].appendChild(evTh);

    var unis = [];
    tbody.querySelectorAll('tr.sub-row').forEach(function (row, idx) {
      var oaTd = document.createElement('td');
      oaTd.id = 'oa-' + idx;
      oaTd.style.cssText = 'text-align:center;padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.04);border-left:2px solid rgba(34,197,94,.2);vertical-align:middle';
      oaTd.innerHTML = '<span style="font-size:12px;color:#475569">⋯</span>';
      row.appendChild(oaTd);

      var evTd = document.createElement('td');
      evTd.id = 'oa-ev-' + idx;
      evTd.className = 'oa-evidence';
      evTd.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.04);border-left:1px solid rgba(255,255,255,.06);vertical-align:middle';
      evTd.innerHTML = '<span style="color:#334155">—</span>';
      row.appendChild(evTd);

      var m = (row.getAttribute('title') || '').match(/^Open (.+) profile$/);
      var name = m ? m[1] : null;
      if (!name) { var sp = row.querySelectorAll('td:first-child span'); name = sp.length > 1 ? sp[sp.length-1].textContent.trim() : null; }
      if (name) unis.push({ idx: idx, name: name });
    });

    fetchOpenAlexData(unis);
  }

  async function fetchOpenAlexData(unis) {
    for (var i = 0; i < unis.length; i++) {
      var u = unis[i];
      var oaCell = document.getElementById('oa-' + u.idx);
      var evCell = document.getElementById('oa-ev-' + u.idx);
      if (!oaCell || !evCell) continue;
      try {
        var url = new URL('https://api.openalex.org/institutions');
        url.searchParams.set('search', u.name);
        url.searchParams.set('per_page', '1');
        url.searchParams.set('mailto', 'venturino.dino@gmail.com');
        var r = await fetch(url.toString());
        var d = await r.json();
        var inst = d.results && d.results[0];
        if (inst) {
          oaCell.innerHTML = '<a href="' + inst.id + '" target="_blank" style="color:#4ade80;text-decoration:none;font-size:15px;font-weight:700" title="View on OpenAlex">✓</a>';
          oaCell.style.background = 'rgba(34,197,94,.07)';
          var lines = [];
          if (inst.type || inst.country_code) lines.push('<span class="oa-badge">' + [inst.type ? cap(inst.type) : '', inst.country_code || ''].filter(Boolean).join(' · ') + '</span>');
          if (inst.works_count) lines.push('<span style="color:#cbd5e1">' + fmtNum(inst.works_count) + ' works</span>');
          if (inst.ror) lines.push('<a class="oa-badge oa-ror" href="' + inst.ror + '" target="_blank" title="ROR — persistent institutional ID">ROR ✓</a>');
          evCell.innerHTML = lines.join('<br>');
        } else {
          oaCell.innerHTML = '<span style="font-size:13px;opacity:.3">—</span>';
          evCell.innerHTML = '<span style="color:#334155;font-size:11px">Not indexed</span>';
        }
      } catch (e) {
        oaCell.innerHTML = '<span style="font-size:11px;color:#94a3b8">?</span>';
      }
    }
  }

  function fmtNum(n) { return n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1000 ? Math.round(n/1000)+'K' : String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
})();/* openalex.js — OpenAlex column + readability improvements for subscription matrix */
(function () {
  'use strict';

  /* ── Readability CSS ───────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    /* Sticky institution column */
    'table.sub-matrix td:first-child, table.sub-matrix th.uni-header {',
    '  position:sticky;left:0;z-index:2;',
    '  background:rgba(12,19,32,.97);',
    '}',
    'table.sub-matrix thead tr:first-child th:first-child {',
    '  position:sticky;left:0;z-index:3;',
    '  background:rgba(12,19,32,.97);',
    '}',
    /* Slightly larger text throughout */
    'table.sub-matrix th { font-size:11px !important; }',
    'table.sub-matrix td { font-size:12px !important; }',
    'table.sub-matrix .sub-row td:first-child span { font-size:11px !important; }',
    'table.sub-matrix .sub-row td:first-child span:last-child { font-size:14px !important; }',
    /* Stronger group separator borders */
    'table.sub-matrix thead tr:first-child th { border-right:1px solid rgba(255,255,255,.15) !important; }',
    /* Row hover highlight */
    'table.sub-matrix .sub-row:hover td { background:rgba(255,255,255,.055) !important; }',
    /* Evidence cell */
    '.oa-evidence { font-size:10px; color:#94a3b8; line-height:1.4; text-align:left; padding:6px 10px; max-width:180px; }',
    '.oa-evidence a { color:#4ade80; text-decoration:none; }',
    '.oa-evidence a:hover { text-decoration:underline; }',
    '.oa-badge { display:inline-block; background:rgba(34,197,94,.12); color:#4ade80;',
    '  border:1px solid rgba(34,197,94,.3); border-radius:4px; padding:1px 5px;',
    '  font-size:9px; font-weight:700; letter-spacing:.4px; margin-right:3px; }',
    '.oa-badge.oa-ror { background:rgba(99,102,241,.12); color:#a5b4fc;',
    '  border-color:rgba(99,102,241,.3); }',
  ].join('\n');
  document.head.appendChild(style);

  var content = document.getElementById('content');
  if (!content) return;

  var applied = false;

  function tryApply() {
    if (applied) return;
    var titleEl = document.getElementById('page-title');
    if (!titleEl || !titleEl.textContent.includes('Subscription')) return;
    var table = content.querySelector('table');
    if (!table) return;
    if (table.classList.contains('sub-matrix')) return;
    applied = true;
    addColumns(table);
  }

  var obs = new MutationObserver(function () {
    applied = false;
    setTimeout(tryApply, 80);
  });
  obs.observe(content, { childList: true });
  setTimeout(tryApply, 200);

  function addColumns(table) {
    table.classList.add('sub-matrix');
    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    var uniTh = thead.rows[0] && thead.rows[0].cells[0];
    if (uniTh) uniTh.classList.add('uni-header');

    var groupRow = thead.rows[0];
    var oaGroupTh = document.createElement('th');
    oaGroupTh.setAttribute('data-oa', '1');
    oaGroupTh.colSpan = 2;
    oaGroupTh.style.cssText = 'background:rgba(34,197,94,.13);color:#4ade80;text-align:center;font-size:11px;font-weight:700;padding:7px 8px;letter-spacing:.6px;text-transform:uppercase;border-left:2px solid rgba(34,197,94,.3);white-space:nowrap';
    oaGroupTh.textContent = 'Open Access DB';
    groupRow.appendChild(oaGroupTh);

    var colRow = thead.rows[1];
    var oaTh = document.createElement('th');
    oaTh.style.cssText = 'background:rgba(255,255,255,.04);color:#4ade80;font-size:11px;font-weight:600;padding:8px 6px;text-align:center;vertical-align:bottom;white-space:nowrap;letter-spacing:.3px;border-left:2px solid rgba(34,197,94,.3)';
    oaTh.textContent = 'OpenAlex';
    colRow.appendChild(oaTh);

    var evTh = document.createElement('th');
    evTh.style.cssText = 'background:rgba(255,255,255,.04);color:#94a3b8;font-size:11px;font-weight:600;padding:8px 10px;text-align:left;vertical-align:bottom;white-space:nowrap;letter-spacing:.3px;border-left:1px solid rgba(255,255,255,.06)';
    evTh.textContent = 'Evidence';
    colRow.appendChild(evTh);

    var unis = [];
    var rows = tbody.querySelectorAll('tr.sub-row');
    rows.forEach(function (row, idx) {
      var oaTd = document.createElement('td');
      oaTd.id = 'oa-' + idx;
      oaTd.style.cssText = 'text-align:center;padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.04);border-left:2px solid rgba(34,197,94,.2);vertical-align:middle';
      oaTd.innerHTML = '<span style="font-size:12px;color:#475569">⋯</span>';
      row.appendChild(oaTd);

      var evTd = document.createElement('td');
      evTd.id = 'oa-ev-' + idx;
      evTd.className = 'oa-evidence';
      evTd.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.04);border-left:1px solid rgba(255,255,255,.06);vertical-align:middle';
      evTd.innerHTML = '<span style="color:#334155">—</span>';
      row.appendChild(evTd);

      var titleAttr = row.getAttribute('title') || '';
      var m = titleAttr.match(/^Open (.+) profile$/);
      var name = m ? m[1] : null;
      if (!name) {
        var spans = row.querySelectorAll('td:first-child span');
        name = spans.length > 1 ? spans[spans.length - 1].textContent.trim() : null;
      }
      if (name) unis.push({ idx: idx, name: name });
    });

    fetchOpenAlexData(unis);
  }

  async function fetchOpenAlexData(unis) {
    for (var i = 0; i < unis.length; i++) {
      var u = unis[i];
      var oaCell = document.getElementById('oa-' + u.idx);
      var evCell = document.getElementById('oa-ev-' + u.idx);
      if (!oaCell || !evCell) continue;
      try {
        var url = new URL('https://api.openalex.org/institutions');
        url.searchParams.set('search', u.name);
        url.searchParams.set('per_page', '1');
        url.searchParams.set('mailto', 'venturino.dino@gmail.com');
        var r = await fetch(url.toString());
        var d = await r.json();
        var inst = d.results && d.results[0];
        if (inst) {
          oaCell.innerHTML = '<a href="' + inst.id + '" target="_blank" style="color:#4ade80;text-decoration:none;font-size:15px;font-weight:700" title="View ' + inst.display_name + ' on OpenAlex">✓</a>';
          oaCell.style.background = 'rgba(34,197,94,.07)';
          var works = inst.works_count ? fmtNum(inst.works_count) + ' works' : '';
          var typeStr = inst.type ? cap(inst.type) : '';
          var ctry = inst.country_code ? inst.country_code : '';
          var rorId = inst.ror ? inst.ror.replace('https://ror.org/', '') : null;
          var lines = [];
          if (typeStr || ctry) lines.push('<span class="oa-badge">' + [typeStr, ctry].filter(Boolean).join(' · ') + '</span>');
          if (works) lines.push('<span style="color:#cbd5e1">' + works + '</span>');
          if (rorId) lines.push('<a class="oa-badge oa-ror" href="https://ror.org/' + rorId + '" target="_blank" title="ROR — persistent institutional ID">ROR ✓</a>');
          evCell.innerHTML = lines.join('<br>');
        } else {
          oaCell.innerHTML = '<span style="font-size:13px;opacity:.3">—</span>';
          evCell.innerHTML = '<span style="color:#334155;font-size:11px">Not indexed</span>';
        }
      } catch (e) {
        oaCell.innerHTML = '<span style="font-size:11px;color:#94a3b8">?</span>';
        evCell.innerHTML = '<span style="color:#334155;font-size:11px">Error</span>';
      }
    }
  }

  function fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return Math.round(n / 1000) + 'K';
    return String(n);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
})();/* openalex.js — adds OpenAlex column to the subscription matrix */
(function () {
  'use strict';

  var content = document.getElementById('content');
  if (!content) return;

  var applied = false;

  function tryApply() {
    if (applied) return;
    var titleEl = document.getElementById('page-title');
    if (!titleEl || !titleEl.textContent.includes('Subscription')) return;
    var table = content.querySelector('table');
    if (!table) return;
    if (content.querySelector('th[data-oa]')) return;
    applied = true;
    addColumn(table);
  }

  /* Watch for page switches */
  var obs = new MutationObserver(function () {
    applied = false;
    setTimeout(tryApply, 80);
  });
  obs.observe(content, { childList: true });

  /* Also catch initial load */
  setTimeout(tryApply, 200);

  function addColumn(table) {
    var thead = table.querySelector('thead');
    var tbody = table.querySelector('tbody');
    if (!thead || !tbody) return;

    /* Group header row */
    var groupRow = thead.rows[0];
    var gTh = document.createElement('th');
    gTh.setAttribute('data-oa', '1');
    gTh.style.cssText = [
      'background:rgba(34,197,94,.13)',
      'color:#4ade80',
      'text-align:center',
      'font-size:10px',
      'font-weight:700',
      'padding:7px 8px',
      'letter-spacing:.6px',
      'text-transform:uppercase',
      'border-left:1px solid rgba(255,255,255,.1)',
      'white-space:nowrap',
    ].join(';');
    gTh.textContent = 'Open Access DB';
    groupRow.appendChild(gTh);

    /* Column header row */
    var colRow = thead.rows[1];
    var cTh = document.createElement('th');
    cTh.style.cssText = [
      'background:rgba(255,255,255,.04)',
      'color:#4ade80',
      'font-size:10px',
      'font-weight:600',
      'padding:8px 6px',
      'text-align:center',
      'vertical-align:bottom',
      'white-space:nowrap',
      'letter-spacing:.3px',
      'border-left:1px solid rgba(255,255,255,.1)',
    ].join(';');
    cTh.textContent = 'OpenAlex';
    colRow.appendChild(cTh);

    /* Add a placeholder cell to each university row */
    var unis = [];
    var rows = tbody.querySelectorAll('tr.sub-row');
    rows.forEach(function (row, idx) {
      var td = document.createElement('td');
      td.id = 'oa-' + idx;
      td.style.cssText = [
        'text-align:center',
        'padding:9px 5px',
        'border-bottom:1px solid rgba(255,255,255,.04)',
        'border-left:1px solid rgba(255,255,255,.08)',
      ].join(';');
      td.innerHTML = '<span style="font-size:13px;color:#64748b">⋯</span>';
      row.appendChild(td);

      /* Extract full institution name from title attr: "Open {Name} profile" */
      var titleAttr = row.getAttribute('title') || '';
      var m = titleAttr.match(/^Open (.+) profile$/);
      var name = m ? m[1] : null;

      /* Fallback: read visible name from first td spans */
      if (!name) {
        var spans = row.querySelectorAll('td:first-child span');
        name = spans.length > 1 ? spans[spans.length - 1].textContent.trim() : null;
      }

      if (name) unis.push({ idx: idx, name: name });
    });

    fetchOpenAlexData(unis);
  }

  async function fetchOpenAlexData(unis) {
    for (var i = 0; i < unis.length; i++) {
      var u = unis[i];
      var cell = document.getElementById('oa-' + u.idx);
      if (!cell) continue;
      try {
        var url = new URL('https://api.openalex.org/institutions');
        url.searchParams.set('search', u.name);
        url.searchParams.set('per_page', '1');
        url.searchParams.set('mailto', 'venturino.dino@gmail.com');
        var r = await fetch(url.toString());
        var d = await r.json();
        var result = d.results && d.results[0];
        if (result) {
          cell.innerHTML =
            '<a href="' + result.id + '" target="_blank" ' +
            'style="color:#4ade80;text-decoration:none;font-size:14px;font-weight:700" ' +
            'title="' + result.display_name + ' — found in OpenAlex">' +
            '✓</a>';
          cell.style.background = 'rgba(34,197,94,.08)';
        } else {
          cell.innerHTML = '<span style="font-size:13px;opacity:.3">—</span>';
        }
      } catch (e) {
        cell.innerHTML = '<span style="font-size:11px;color:#94a3b8">?</span>';
      }
    }
  }
})();
