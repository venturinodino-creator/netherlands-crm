/* openalex.js -- icon fixes + OpenAlex columns for NL Research CRM */
(function () {
  'use strict';

  /* -- CSS ---------------------------------------------------------------- */
  var style = document.createElement('style');
  style.textContent = [
    '.stat-card[onclick`*="pipeline"]{display:none!important}',
    'table.sub-matrix td:first-child,table.sub-matrix th.uni-header{position:sticky;left:0;z-index:2;background:rgba(12,19,32,.97)}',
    'table.sub-matrix thead tr:first-child th:first-child{position:sticky;left:0;z-index:3;background:rgba(12,19,32,.97)}',
    'table.sub-matrix th{font-size:11px!important}',
    'table.sub-matrix td{font-size:12px!important}',
    'table.sub-matrix .sub-row td:first-child span:last-child{font-size:14px!important}',
    'table.sub-matrix thead tr:first-child th{border-right:1px solid rgba(255,255,255,.15)!important}',
    'table.sub-matrix .sub-row:hover td{background:rgba(255,255,255,.055)!important}',
    '.stat-icon-box svg{width:20px;height:20px;display:block}',
    '.oa-evidence{font-size:10px;color:#94a3b8;line-height:1.7;text-align:left;padding:5px 10px;max-width:200px}',
    '.oa-evidence a{color:#4ade80;text-decoration:none}',
    '.oa-badge{display:inline-block;background:rgba(34,197,94,.12);color:#4ade80;border:1px solid rgba(34,197,94,.3);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;letter-spacing:.4px}',
    '.oa-badge.oa-ror{background:rgba(99,102,241,.12);color:#a5b4fc;border-color:rgba(99,102,241,.3)}',
    '.ic-icon svg{display:block}',
  ].join('');
  document.head.appendChild(style);

  /* -- SVG helpers -------------------------------------------------------- */
  function stroke(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">' + p + '</svg>';
  }
  function filled(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">' + p + '</svg>';
  }

  /* -- Nav icon map ------------------------------------------------------- */
  var NAV = {
    dashboard:     stroke('<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>'),
    institutions:  stroke('<path d="M3 21h18M3 10h18M5 10V21M19 10V21M9 10V21M15 10V21M12 3L3 10h12L12 3z"/>'),
    contacts:      stroke('<path d="M17 21v-2a4 4 0 00-4-AH5`4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'),
    map:           stroke('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
    news:          stroke('<path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a4 4 0 01-4-4V6a2 2 0 012-2"/><path d="M18 14h-8M15 18h-5"/><rect x="10" y="6" width="8" height="4"/>'),
    subscriptions: stroke('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>'),
    syncContacts:  stroke('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    exportCSV:     stroke('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  };

  /* -- Stat icon map ------------------------------------------------------ */
  var STAT = {
    purple: filled('<path d="M12 2L2 7v2h20V7L12 2z"/><path d="M4 10v10h6v-7h4v7h6V10"/>'),
    teal:   filled('<path d="M19 3H5v18h14V3zm-2 16H7V5h10v14z"/><path d="M10 8h4v3h-4z"/><path d="M11 2v3h2V2z"/><path d="M12 14v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 16h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
    blue:   filled('<path d="M9 3L7 17h10L15 3H9z"/><path d="M8 17v3h8v-3"/><path d="M10 21v2h4v-2"/><path d="M10.5 7h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 10h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'),
    orange: filled('<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>'),
  };
  /* -- Institution card icon map ----------------------------------------- */
  var INST_ICON = {
    university: stroke('<path d="M3 21h18M3 10h18M5 10V21M19 10V21M9 10V21M15 10V21M12 3L3 10h18L12 3z"/>'),
    medical:    stroke('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
    research:   stroke('<path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11l3 3 3-3V3M3 9h18"/>'),
    ngo:        stroke('<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>'),
    hospital:   stroke('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
    institute:  stroke('<path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v11l3 3 3-3V3M3 9h18"/>'),
  };


  /* -- Fix corrupt UTF-8-as-Latin1 text nodes -------------------------------- */
  /* index.html chars stored as raw UTF-8 bytes misread as Latin-1:            */
  /* \u00E2\u009C\u0093 = U+2713 checkmark (E2 9C 93 in UTF-8)              */
  /* \u00E2\u0080\u0094 = U+2014 em-dash (E2 80 94 in UTF-8)               */
  /* \u00C2\u00B7       = U+00B7 middle-dot (C2 B7 in UTF-8)                */
  function fixCorruptText(root) {
    var reChk = /\u00E2\u009C\u0093/g;
    var reEm  = /\u00E2\u0080\u0094/g;
    var reDot = /\u00C2\u00B7/g;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      var t = node.nodeValue;
      if (t.indexOf('\u00E2') === -1 && t.indexOf('\u00C2') === -1) continue;
      var fixed = t
        .replace(reChk, '\u2713')
        .replace(reEm,  '\u2014')
        .replace(reDot, '\u00B7');
      if (fixed !== t) node.nodeValue = fixed;
    }
  }

  /* -- Fix nav + stat icons ----------------------------------------------- */
  function fixIcons() {
    document.querySelectorAll('.nav-icon-box').forEach(function (box) {
      if (box.querySelector('svg')) return;
      var parent = box.closest('[onclick]');
      var oc = parent ? parent.getAttribute('onclick') : '';
      var m = oc.match(/\('([^']+)'\)/);
      var key = m ? m[1] : oc.split('(')[0];
      if (NAV[key]) box.innerHTML = NAV[key];
    });
    document.querySelectorAll('.stat-icon-box').forEach(function (box) {
      if (box.querySelector('svg')) return;
      var cls = box.className.split(' ').find(function (c) { return c !== 'stat-icon-box'; }) || '';
      if (STAT[cls]) box.innerHTML = STAT[cls];
    });
    /* institution card icons */
    document.querySelectorAll('.ic-icon').forEach(function (box) {
      if (box.querySelector('svg')) return;
      var type = Array.from(box.classList).find(function (c) { return c !== 'ic-icon'; }) || 'university';
      var svg = INST_ICON[type] || INST_ICON.university;
      box.innerHTML = svg;
    });
  }

  /* -- OpenAlex data ------------------------------------------------------ */
  var DB = {
    'Erasmus University Rotterdam':        { oa: 'I114027177', ror: '03h7bdz00', works: '121K' },
    'Leiden University':                   { oa: 'I165104084', ror: '027bh9e22', works: '229K' },
    'Radboud University':                  { oa: 'I145872427', ror: '016xsfp80', works: '163K' },
    'Maastricht University':               { oa: 'I107981792', ror: '02jz4aj89', works: '91K'  },
    'University of Groningen':             { oa: 'I114526713', ror: '012p63287', works: '211K' },
    'University of Amsterdam':             { oa: 'I865915315', ror: '04dkp9463', works: '279K' },
    'Eindhoven University of Technology':  { oa: 'I59714227',  ror: '000b6qs89', works: '111K' },
    'Tilburg University':                  { oa: 'I41510801',  ror: '04b8v1s79', works: '53K'  },
    'Wageningen University & Research':    { oa: 'I887414861', ror: '024jd2p48', works: '184K' },
    'Open Universiteit':                   { oa: 'I154530485', ror: '031m71144', works: '17K'  },
    'VU Amsterdam':                        { oa: 'I865747412', ror: '008xxew50', works: '176K' },
    'Utrecht University':                  { oa: 'I151185163', ror: '04pp8hn57', works: '290K' },
    'TU Delft':                            { oa: 'I95457486',  ror: '02e2c7k09', works: '155K' },
    'University of Twente':                { oa: 'I33779607',  ror: '006hf6230', works: '77K'  },
  };

  /* -- Observer + init ---------------------------------------------------- */
  var content = document.getElementById('content');
  if (!content) return;
  var matrixApplied = false;

  function tryApply() {
    fixIcons();
    if (matrixApplied) return;
    var titleEl = document.getElementById('page-title');
    if (!titleEl || !titleEl.textContent.includes('Subscription')) return;
    var table = content.querySelector('table');
    if (!table || table.classList.contains('sub-matrix')) return;
    matrixApplied = true;
    fixCorruptText(table);
    addColumns(table);
  }

  var obs = new MutationObserver(function () {
    matrixApplied = false;
    setTimeout(tryApply, 80);
  });
  obs.observe(content, { childList: true, subtree: true });
  setTimeout(tryApply, 300);
  var _pi = setInterval(fixIcons, 600); setTimeout(function(){ clearInterval(_pi); }, 12000);

  /* -- Add OpenAlex + Evidence columns ------------------------------------ */
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
        var sp = row.querySelectorAll('td:first-child span');
        name = sp.length > 1 ? sp[sp.length - 1].textContent.trim() : null;
      }
      var info = name ? DB[name] : null;

      var oaTd = document.createElement('td');
      oaTd.style.cssText = 'text-align:center;padding:9px 5px;border-bottom:1px solid rgba(255,255,255,.04);border-left:2px solid rgba(34,197,94,.2);vertical-align:middle';

      var evTd = document.createElement('td');
      evTd.className = 'oa-evidence';
      evTd.style.cssText = 'border-bottom:1px solid rgba(255,255,255,.04);border-left:1px solid rgba(255,255,255,.06);vertical-align:middle';

      if (info) {
        oaTd.innerHTML = '<a href="https://openalex.org/institutions/' + info.oa + '" target="_blank" style="color:#4ade80;text-decoration:none;font-size:16px;font-weight:700" title="View on OpenAlex">&#10003;</a>';
        oaTd.style.background = 'rgba(34,197,94,.07)';
        evTd.innerHTML = '<span class="oa-badge">Education &middot; NL</span><br><span style="color:#cbd5e1">' + info.works + ' works</span><br><a class="oa-badge oa-ror" href="https://ror.org/' + info.ror + '" target="_blank">ROR &#8599;</a>';
      } else {
        oaTd.innerHTML = '<span style="font-size:13px;opacity:.3">&#x2014;</span>';
        evTd.innerHTML = '<span style="color:#475569;font-size:11px">Not in OpenAlex</span>';
      }

      row.appendChild(oaTd);
      row.appendChild(evTd);
    });
  }
})();


// ── Auto-load discovery.js (contact discovery + render override) ──────────
(function loadDiscovery() {
  if (document.querySelector('script[src*="discovery.js"]')) return; // already loaded
  var s = document.createElement('script');
  s.src = '/netherlands-crm/discovery.js?v=' + Date.now();
  s.onerror = function() { console.warn('[NL CRM] discovery.js failed to load'); };
  document.head.appendChild(s);
})();


// Auto-load discovery.js for the New Contacts page
(function loadDiscovery(){
  if(document.querySelector('script[src*="discovery.js"]'))return;
  var s=document.createElement('script');
  s.src='/netherlands-crm/discovery.js?v='+Date.now();
  document.head.appendChild(s);
})();
