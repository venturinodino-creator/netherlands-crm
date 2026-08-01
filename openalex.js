/* openalex.js — adds OpenAlex column to the subscription matrix */
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
