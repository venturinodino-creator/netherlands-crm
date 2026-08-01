/* openalex.js — OpenAlex + Evidence columns for NL Research CRM subscription matrix */
(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent = [
    'table.sub-matrix td:first-child,table.sub-matrix th.uni-header{position:sticky;left:0;z-index:2;background:rgba(12,19,32,.97)}',
    'table.sub-matrix thead tr:first-child th:first-child{position:sticky;left:0;z-index:3;background:rgba(12,19,32,.97)}',
    'table.sub-matrix th{font-size:11px!important}',
    'table.sub-matrix td{font-size:12px!important}',
    'table.sub-matrix .sub-row td:first-child span:last-child{font-size:14px!important}',
    'table.sub-matrix thead tr:first-child th{border-right:1px solid rgba(255,255,255,.15)!important}',
    'table.sub-matrix .sub-row:hover td{background:rgba(255,255,255,.055)!important}',
    '.oa-evidence{font-size:10px;color:#94a3b8;line-height:1.6;text-align:left;padding:6px 10px;max-width:200px}',
    '.oa-evidence a{color:#4ade80;text-decoration:none}',
    '.oa-badge{display:inline-block;background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.3);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;letter-spacing:.4px}',
    '.oa-badge.oa-ror{background:rgba(99,102,241,.12);color:#a5b4fc;border-color:rgba(99,102,241,.3)}',
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

    var oaGroup = document.createElement('th');
    oaGroup.colSpan = 2;
    oaGroup.style.cssText = 'background:rgba(34,197,94,.13);color:#4ade80;text-align:center;font-size:11px;font-weight:700;padding:7px 8px;letter-spacing:.6px;text-transform:uppercase;border-left:2px solid rgba(34,197,94,.3);white-space:nowrap';
    oaGroup.textContent = 'Open Access DB';
    thead.rows[0].appendChild(oaGroup);

    var oaTh = document.createElement('th');
    oaTh.style.cssText = 'background:rgba(255,255,255,.04);color:#4ade80;font-size:11px;font-weight:600;padding:8px 6px;text-align:center;vertical-align:bottom;white-space:nowrap;border-left:2px solid rgba(34,197,94,.3)';
    oaTh.textContent = 'OpenAlex';
    thead.rows[1].appendChild(oaTh);

    var evTh = document.createElement('th');
    evTh.style.cssText = 'background:rgba(255,255,255,.04);color:#94a3b8;font-size:11px;font-weight:600;padding:8px 10px;text-align:left;vertical-align:bottom;white-space:nowrap;border-left:1px solid rgba(255,255,255,.06)';
    evTh.textContent = 'Evidence';
    thead.rows[1].appendChild(evTh);

    var unis = [];
    tbody.querySelectorAll('tr.sub-row').forEach(function (row, idx) {
      var oaTd = document.createElement('td');
      oaTd.id = 'oa-' + idx;
      oaTd.style.cssText = 'text-align:center;padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.04);border-left:2px solid rgba(34,197,94,.2);vertical-align:middle';
      oaTd.innerHTML = '<span style="font-size:12px;color:#475569">\u22ef</span>';
      row.appendChild(oaTd);

      var evTd = document.createElement('td');
      evTd.id = 'oa-ev-' + idx;
      evTd.className = 'oa-evidence';
      evTd.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.04);border-left:1px solid rgba(255,255,255,.06);vertical-align:middle';
      evTd.innerHTML = '<span style="color:#475569;font-size:11px">loading\u2026</span>';
      row.appendChild(evTd);

      var m = (row.getAttribute('title') || '').match(/^Open (.+) profile$/);
      var name = m ? m[1] : null;
      if (!name) {
        var spans = row.querySelectorAll('td:first-child span');
        name = spans.length > 1 ? spans[spans.length-1].textContent.trim() : null;
      }
      if (name) unis.push({ idx: idx, name: name });
    });

    fetchAll(unis);
  }

  async function fetchAll(unis) {
    var catalog = [];
    try {
      var u1 = new URL('https://api.openalex.org/institutions');
      u1.searchParams.set('filter', 'country_code:NL,type:education');
      u1.searchParams.set('per_page', '50');
      u1.searchParams.set('mailto', 'venturino.dino@gmail.com');
      var r1 = await fetch(u1.toString());
      if (!r1.ok) throw new Error('HTTP ' + r1.status);
      var d1 = await r1.json();
      if (d1.results) catalog = catalog.concat(d1.results);
      if (d1.meta && d1.meta.count > 50) {
        var u2 = new URL('https://api.openalex.org/institutions');
        u2.searchParams.set('filter', 'country_code:NL,type:education');
        u2.searchParams.set('per_page', '50');
        u2.searchParams.set('page', '2');
        u2.searchParams.set('mailto', 'venturino.dino@gmail.com');
        var r2 = await fetch(u2.toString());
        var d2 = await r2.json();
        if (d2.results) catalog = catalog.concat(d2.results);
      }
    } catch (e) {
      unis.forEach(function(u) { setError(u.idx); });
      return;
    }
    unis.forEach(function (u) { populate(u.idx, findBestMatch(u.name, catalog)); });
  }

  function normalize(s) {
    return s.toLowerCase()
      .replace(/\bthe\b|universiteit|university of|university|hogeschool|technische universiteit/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function findBestMatch(name, catalog) {
    var norm = normalize(name);
    var exact = catalog.find(function(i) { return normalize(i.display_name) === norm; });
    if (exact) return exact;
    var partial = catalog.find(function(i) {
      var n = normalize(i.display_name);
      return n.includes(norm) || norm.includes(n);
    });
    return partial || null;
  }

  function populate(idx, inst) {
    var oaCell = document.getElementById('oa-' + idx);
    var evCell = document.getElementById('oa-ev-' + idx);
    if (!oaCell || !evCell) return;
    if (inst) {
      oaCell.innerHTML = '<a href="' + inst.id + '" target="_blank" style="color:#4ade80;text-decoration:none;font-size:16px;font-weight:700" title="' + inst.display_name + ' on OpenAlex">\u2713</a>';
      oaCell.style.background = 'rgba(34,197,94,.07)';
      var lines = [];
      if (inst.type || inst.country_code) lines.push('<span class="oa-badge">' + [inst.type ? cap(inst.type) : '', inst.country_code || ''].filter(Boolean).join(' \u00b7 ') + '</span>');
      if (inst.works_count) lines.push('<span style="color:#cbd5e1">' + fmtNum(inst.works_count) + ' works</span>');
      if (inst.ror) lines.push('<a class="oa-badge oa-ror" href="' + inst.ror + '" target="_blank" title="Persistent ROR identifier">ROR \u2713</a>');
      evCell.innerHTML = lines.join('<br>');
    } else {
      oaCell.innerHTML = '<span style="font-size:13px;opacity:.3">\u2014</span>';
      evCell.innerHTML = '<span style="color:#475569;font-size:11px">Not in OpenAlex</span>';
    }
  }

  function setError(idx) {
    var c = document.getElementById('oa-' + idx);
    var e = document.getElementById('oa-ev-' + idx);
    if (c) c.innerHTML = '<span style="color:#94a3b8;font-size:11px">?</span>';
    if (e) e.innerHTML = '<span style="color:#475569;font-size:11px">API error</span>';
  }

  function fmtNum(n) { return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1000?Math.round(n/1000)+'K':String(n); }
  function cap(s) { return s.charAt(0).toUpperCase()+s.slice(1); }
})();
