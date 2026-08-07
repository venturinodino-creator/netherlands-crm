/* openalex.js — icon fixes + OpenAlex columns for NL Research CRM */
(function () {
  'use strict';

  /* ── CSS ──────────────────────────────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    '.stat-card[onclick*="pipeline"]{display:none!important}',
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

  /* ── SVG icon helpers ──────────────────────────────────────────────── */
  function stroke(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">' + p + '</svg>';
  }
  function filled(p) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22">' + p + '</svg>';
  }

  /* ── Nav icon map ──────────────────────────────────────────────────── */
  var NAV = {
    dashboard:     stroke('<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>'),
    institutions:  stroke('<path d="M3 21h18M3 10h18M5 10V21M19 10V21M9 10V21M15 10V21M12 3L3 10h18L12 3z"/>'),
    contacts:      stroke('<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>'),
    map:           stroke('<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>'),
    news:          stroke('<path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a4 4 0 01-4-4V6a2 2 0 012-2"/><path d="M18 14h-8M15 18h-5"/><rect x="10" y="6" width="8" height="4"/>'),
    subscriptions: stroke('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>'),
    syncContacts:  stroke('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
    exportCSV:     stroke('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  };

  /* ── Stat icon map ─────────────────────────────────────────────────── */
  var STAT = {
    purple: filled('<path d="M11.584 2.376a.75.75 0 01.832 0l9 6a.75.75 0 11-.832 1.248L12 3.901 3.416 9.624a.75.75 0 01-.832-1.248l9-6z"/><path fill-rule="evenodd" d="M20.25 10.332v9.918H21a.75.75 0 010 1.5H3a.75.75 0 010-1.5h.75v-9.918a.75.75 0 01.634-.74A49.109 49.109 0 0112 9c2.59 0 5.134.202 7.616.592a.75.75 0 01.634.74zm-7.5 2.418a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75zm3-.75a.75.75 0 01.75.75v6.75a.75.75 0 01-1.5 0v-6.75a.75.75 0 01.75-.75zM9 12.75a.75.75 0 00-1.5 0v6.75a.75.75 0 001.5 0v-6.75z" clip-rule="evenodd"/><path d="M12 7.875a1.125 1.125 0 100-2.25 1.125 1.125 0 000 2.25z"/>'),
    teal:   filled('<path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>'),
  };

  /* ── Fix icons on every page ───────────────────────────────────────── */
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
  }

  /* ── OpenAlex hardcoded data ───────────────────────────────────────── */
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
    'University of Twente':               { oa: 'I33779607',  ror: '006hf6230', works: '77K'  },
  };

  /* ── Observer + init ─────────────────────────────────────────────── */
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
    addColumns(table);
  }

  var obs = new MutationObserver(function () {
    matrixApplied = false;
    setTimeout(tryApply, 80);
  });
  obs.observe(content, { childList: true, subtree: true });
  setTimeout(tryApply, 300);

  /* ── Add OpenAlex + Evidence columns ──────────────────────────────── */
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
        oaTd.innerHTML = '<a href="https://openalex.org/institutions/' + info.oa + '" target="_blank" style="color:#4ade80;text-decoration:none;font-size:16px;font-weight:700" title="View on OpenAlex">✓</a>';
        oaTd.style.background = 'rgba(34,197,94,.07)';
        evTd.innerHTML = '<span class="oa-badge">Education · NL</span><br><span style="color:#cbd5e1">' + info.works + ' works</span><br><a class="oa-badge oa-ror" href="https://ror.org/' + info.ror + '" target="_blank">ROR →</a>';
      } else {
        oaTd.innerHTML = '<span style="font-size:13px;opacity:.3">✗</span>';
        evTd.innerHTML = '<span style="color:#475569;font-size:11px">Not in OpenAlex</span>';
      }

      row.appendChild(oaTd);
      row.appendChild(evTd);
    });
  }
})();

/* ── CONTACT DISCOVERY PATCH v2 ─────────────────────────────────────────
   Fixes: filter default (all-on), runContactDiscovery (real CWI scraper),
   and exposes window.__crmDiscovery API for the scheduled task.
──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var INST_TYPES = {
    cwi:'research', esc:'research', hubrecht:'research', nin:'research',
    nioz:'research', astron:'research', sron:'research', rivm:'research',
    deltares:'research', tno:'research', knaw:'research', naturalis:'research',
    pbl:'research', nlr:'research', rathenau:'research', nwo:'research',
    nki:'medical', lumc:'medical', amc:'medical', radboud:'medical',
    umcu:'medical', erasmusmc:'medical', vumc:'medical',
    vu:'university', uva:'university', tudelft:'university', rug:'university',
    leiden:'university', tilburg:'university', maastricht:'university',
    greenpeace:'ngo', wwf:'ngo', oxfam:'ngo', care:'ngo'
  };

  /* ── __crmDiscovery API (used by scheduled task SKILL.md) ── */
  function addPendingContacts(contacts) {
    var existing = JSON.parse(localStorage.getItem('nl_crm_contacts') || '[]');
    var pending  = JSON.parse(localStorage.getItem('nl_crm_pending')  || '[]');
    var allEmails = existing.concat(pending).map(function(c) { return (c.email||'').toLowerCase(); });
    var allNames  = existing.concat(pending).map(function(c) { return ((c.first||'')+(c.last||'')).toLowerCase().replace(/\s/g,''); });
    var added = 0, skipped = 0;
    contacts.forEach(function(c) {
      var el = (c.email||'').toLowerCase();
      var nl = ((c.first||'')+(c.last||'')).toLowerCase().replace(/\s/g,'');
      if (allEmails.indexOf(el) !== -1 || allNames.indexOf(nl) !== -1) { skipped++; return; }
      if (!c.type && c.instId) c.type = INST_TYPES[c.instId] || 'research';
      c.id      = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      c.addedAt = new Date().toISOString();
      c.quality = c.quality || 'seed';
      pending.push(c);
      allEmails.push(el);
      allNames.push(nl);
      added++;
    });
    localStorage.setItem('nl_crm_pending', JSON.stringify(pending));
    return { added: added, skipped: skipped };
  }

  function markScraped(instId, pageUrl) {
    var state = JSON.parse(localStorage.getItem('nl_crm_discovery_state') || '{}');
    if (!state.scraped) state.scraped = {};
    state.scraped[instId] = { url: pageUrl, at: new Date().toISOString() };
    localStorage.setItem('nl_crm_discovery_state', JSON.stringify(state));
  }

  window.__crmDiscovery = { addPendingContacts: addPendingContacts, markScraped: markScraped };

  /* ── Filter fix: enable all types when pending section renders ── */
  function enableAllFiltersIfNeeded() {
    if (!window._nlToggleT) return;
    var content = document.getElementById('content');
    if (!content) return;
    var pending = JSON.parse(localStorage.getItem('nl_crm_pending') || '[]');
    if (pending.length > 0 && content.innerText.indexOf('No contacts match') !== -1) {
      ['university', 'medical', 'research', 'ngo'].forEach(function(t) {
        window._nlToggleT(t);
      });
    }
  }

  function patchNavForFilters() {
    if (!window.nav || window._oaNavPatch2) return;
    var orig = window.nav;
    window.nav = function(section) {
      orig(section);
      if (section === 'pending') {
        setTimeout(enableAllFiltersIfNeeded, 500);
      }
    };
    window._oaNavPatch2 = true;
  }

  function initFilterPatch() {
    patchNavForFilters();
    /* also handle initial page load on pending section */
    setTimeout(enableAllFiltersIfNeeded, 700);
  }

  if (window.nav) { initFilterPatch(); }
  else {
    var _fiv = setInterval(function() {
      if (window.nav) { clearInterval(_fiv); initFilterPatch(); }
    }, 150);
  }

  /* ── Real runContactDiscovery: scrapes CWI in-browser ── */
  async function scrapeCWIProfile(slug) {
    try {
      var r = await fetch('https://www.cwi.nl/en/people/' + slug + '/');
      var html = await r.text();
      var doc  = new DOMParser().parseFromString(html, 'text/html');
      var main = doc.querySelector('main');
      if (!main) return null;
      var lines = main.innerText.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
      function field(label) {
        var i = lines.indexOf(label);
        return i >= 0 ? (lines[i + 1] || '') : '';
      }
      var email = field('Email');
      if (!email || email === 'info@cwi.nl' || email.indexOf('@') === -1) return null;
      var dept  = field('Department(s)');
      var func  = field('Function(s)');
      var title = func ? func.split(',')[0].replace(/ - .+$/, '').trim() : 'Researcher';
      var prefs = ['van', 'de', 'der', 'den', 'ter', 'op', 'het'];
      var parts = slug.split('-');
      var first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      var last  = parts.slice(1).map(function(p) {
        return prefs.indexOf(p) !== -1 ? p : p.charAt(0).toUpperCase() + p.slice(1);
      }).join(' ');
      return { first: first, last: last, email: email, phone: field('Phone'),
               title: title, dept: dept, instId: 'cwi', type: 'research',
               source: 'https://www.cwi.nl/en/people/' + slug + '/' };
    } catch(e) { return null; }
  }

  window.runContactDiscovery = async function() {
    if (window.toast) window.toast('Scanning CWI for new contacts…', 'ok');
    try {
      var listResp = await fetch('https://www.cwi.nl/en/people/');
      var listHtml = await listResp.text();
      var listDoc  = new DOMParser().parseFromString(listHtml, 'text/html');
      var slugs = Array.from(listDoc.querySelectorAll('a[href*="/en/people/"]'))
        .map(function(a) {
          var m = a.href.match(/\/en\/people\/([a-z][a-z0-9-]+)$/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      slugs = slugs.filter(function(v, i, a) { return a.indexOf(v) === i; });

      var existing = JSON.parse(localStorage.getItem('nl_crm_contacts') || '[]');
      var pending  = JSON.parse(localStorage.getItem('nl_crm_pending')  || '[]');
      var knownEmails = existing.concat(pending)
        .map(function(c) { return (c.email || '').toLowerCase(); });

      var collected = [];
      for (var i = 0; i < slugs.length && collected.length < 20; i += 8) {
        var batch   = slugs.slice(i, i + 8);
        var results = await Promise.all(batch.map(scrapeCWIProfile));
        results.forEach(function(c) {
          if (c && c.email && knownEmails.indexOf(c.email.toLowerCase()) === -1) {
            collected.push(c);
            knownEmails.push(c.email.toLowerCase());
          }
        });
      }

      var result = addPendingContacts(collected.slice(0, 20));

      /* Re-render and enable filters */
      if (typeof nav === 'function') {
        nav('contacts');
        setTimeout(function() {
          nav('pending');
          setTimeout(enableAllFiltersIfNeeded, 600);
        }, 250);
      }

      var msg = result.added > 0
        ? 'Found ' + result.added + ' new contacts from CWI!'
        : 'No new contacts found (all already in CRM)';
      if (window.toast) window.toast(msg, result.added > 0 ? 'ok' : 'info');
    } catch(e) {
      if (window.toast) window.toast('Discovery error: ' + e.message, 'err');
      console.error('[NL CRM] runContactDiscovery error:', e);
    }
  };

  console.log('[NL CRM] openalex.js patch v2 loaded');
})();
