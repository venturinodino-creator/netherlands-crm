/* openalex.js — OpenAlex columns + dashboard icon fixes for NL Research CRM */
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
    '.oa-evidence{font-size:10px;color:#94a3b8;line-height:1.7;text-align:left;padding:5px 10px;max-width:200px}',
    '.oa-evidence a{color:#4ade80;text-decoration:none}',
    '.oa-badge{display:inline-block;background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.3);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;letter-spacing:.4px}',
    '.oa-badge.oa-ror{background:rgba(99,102,241,.12);color:#a5b4fc;border-color:rgba(99,102,241,.3)}',
  ].join('');
  document.head.appendChild(style);

  var INST_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">'
    + '<path d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6z"/>'
    + '<path fill-rule="evenodd" d="M20.25 10.332v9.918H21a.75.75 0 010 1.5H3a.75.75 0 010-1.5h.75v-9.918a.75.75 0 01.634-.74A49.109 49.109 0 0112 9c2.59 0 5.134.202 7.616.592a.75.75 0 01.634.74zm-7.5 2.418a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75zm3-.75a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0v-6.75a.75.75 0 01.75-.75zM9 12.75a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75z" clip-rule="evenodd"/>'
    + '<path d="M12 7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z"/></svg>';

  function fixIcons() {
    document.querySelectorAll('.stat-card').forEach(function(card) {
      var box = card.querySelector('.stat-icon-box');
      if (!box || box.querySelector('svg')) return;
      var onclick = card.getAttribute('onclick') || '';
      if (onclick.includes('institutions')) box.innerHTML = INST_SVG;
    });
  }

  var DB = {
    'Erasmus University Rotterdam':        { oa:'I114027177', ror:'03h7bdz00', works:'121K' },
    'Leiden University':                   { oa:'I165104084', ror:'027bh9e22', works:'229K' },
    'Radboud University':                  { oa:'I145872427', ror:'016xsfp80', works:'163K' },
    'Maastricht University':               { oa:'I107981792', ror:'02jz4aj89', works:'91K'  },
    'University of Groningen':             { oa:'I114526713', ror:'012p63287', works:'211K' },
    'University of Amsterdam':             { oa:'I865915315', ror:'04dkp9463', works:'279K' },
    'Eindhoven University of Technology':  { oa:'I59714227',  ror:'000b6qs89', works:'111K' },
    'Tilburg University':                  { oa:'I41510801',  ror:'04b8v1s79', works:'53K'  },
    'Wageningen University & Research':    { oa:'I887414861', ror:'024jd2p48', works:'184K' },
    'Open Universiteit':                   { oa:'I154530485', ror:'031m71144', works:'17K'  },
    'VU Amsterdam':                        { oa:'I865747412', ror:'008xxew50', works:'176K' },
    'Utrecht University':                  { oa:'I151185163', ror:'04pp8hn57', works:'290K' },
    'TU Delft':                            { oa:'I95457486',  ror:'02e2c7k09', works:'155K' },
    'University of Twente':               { oa:'I33779607',  ror:'006hf6230', works:'77K'  },
  };

  var content = document.getElementById('content');
  if (!content) return;
  var applied = false;

  function tryApply() {
    fixIcons();
    if (applied) return;
    var titleEl = document.getElementById('page-title');
    if (!titleEl || !titleEl.textContent.includes('Subscription')) return;
    var table = content.querySelector('table');
    if (!table || table.classList.contains('sub-matrix')) return;
    applied = true;
    addColumns(table);
  }

  /* subtree:true so we catch dashboard card renders too */
  var obs = new MutationObserver(function () { applied = false; setTimeout(tryApply, 80); });
  obs.observe(content, { childList: true, subtree: true });
  setTimeout(tryApply, 300);

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

    tbody.querySelectorAll('tr.sub-row').forEach(function (row) {
      var m = (row.getAttribute('title') || '').match(/^Open (.+) profile$/);
      var name = m ? m[1] : null;
      if (!name) {
        var spans = row.querySelectorAll('td:first-child span');
        name = spans.length > 1 ? spans[spans.length-1].textContent.trim() : null;
      }
      var info = name ? DB[name] : null;

      var oaTd = document.createElement('td');
      oaTd.style.cssText = 'text-align:center;padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.04);border-left:2px solid rgba(34,197,94,.2);vertical-align:middle';

      var evTd = document.createElement('td');
      evTd.className = 'oa-evidence';
      evTd.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.04);border-left:1px solid rgba(255,255,255,.06);vertical-align:middle';

      if (info) {
        var oaUrl = 'https://openalex.org/institutions/' + info.oa;
        oaTd.innerHTML = '<a href="' + oaUrl + '" target="_blank" style="color:#4ade80;text-decoration:none;font-size:16px;font-weight:700" title="View on OpenAlex">\u2713</a>';
        oaTd.style.background = 'rgba(34,197,94,.07)';
        evTd.innerHTML =
          '<span class="oa-badge">Education \u00b7 NL</span><br>' +
          '<span style="color:#cbd5e1">' + info.works + ' works</span><br>' +
          '<a class="oa-badge oa-ror" href="https://ror.org/' + info.ror + '" target="_blank" title="ROR persistent ID">ROR \u2713</a>';
      } else {
        oaTd.innerHTML = '<span style="font-size:13px;opacity:.3">\u2014</span>';
        evTd.innerHTML = '<span style="color:#475569;font-size:11px">Not in OpenAlex</span>';
      }
      row.appendChild(oaTd);
      row.appendChild(evTd);
    });
  }
})();
