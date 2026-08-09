/* discovery.js — NL Research CRM contact discovery
 * Loads contacts from pending-contacts.json into localStorage,
 * wraps window.nav to render the New Contacts page with:
 *   - Institution name + type badge on each card
 *   - Accept / Discard per contact
 *   - Accept All button
 *   - Type filter pills (affects next scrape)
 */
(function () {
  'use strict';

  const JSON_URL = '/netherlands-crm/data/pending-contacts.json';

  /* ── Institution map ─────────────────────────────────────────────────── */
  var INST = {
    cwi:        { name: 'Centrum Wiskunde & Informatica', type: 'research' },
    esc:        { name: 'Netherlands eScience Center', type: 'research' },
    pbl:        { name: 'PBL Netherlands Environmental Assessment Agency', type: 'research' },
    rathenau:   { name: 'Rathenau Instituut', type: 'research' },
    uva:        { name: 'University of Amsterdam', type: 'university' },
    vu:         { name: 'VU Amsterdam', type: 'university' },
    uu:         { name: 'Utrecht University', type: 'university' },
    tue:        { name: 'Eindhoven University of Technology', type: 'university' },
    tud:        { name: 'TU Delft', type: 'university' },
    rug:        { name: 'University of Groningen', type: 'university' },
    um:         { name: 'Maastricht University', type: 'university' },
    lei:        { name: 'Leiden University', type: 'university' },
    eur:        { name: 'Erasmus University Rotterdam', type: 'university' },
    utwente:    { name: 'University of Twente', type: 'university' },
    wur:        { name: 'Wageningen University & Research', type: 'university' },
    ou:         { name: 'Open Universiteit', type: 'university' },
    tilburg:    { name: 'Tilburg University', type: 'university' },
    amc:        { name: 'Amsterdam UMC', type: 'medical' },
    erasmusmc:  { name: 'Erasmus MC', type: 'medical' },
    umcg:       { name: 'UMCG', type: 'medical' },
    umcutrecht: { name: 'UMC Utrecht', type: 'medical' },
    mumc:       { name: 'Maastricht UMC+', type: 'medical' },
    radboudumc: { name: 'Radboud UMC', type: 'medical' },
    lumc:       { name: 'Leiden UMC', type: 'medical' },
    knaw:       { name: 'Royal Netherlands Academy of Arts and Sciences (KNAW)', type: 'ngo' },
    nwo:        { name: 'Netherlands Organisation for Scientific Research (NWO)', type: 'ngo' },
    zonmw:      { name: 'ZonMw', type: 'ngo' },
  };

  var TM = {
    university: { label: 'University',       color: '#8b5cf6', bg: '#1e1b4b' },
    medical:    { label: 'Medical Center',   color: '#ef4444', bg: '#1f1010' },
    research:   { label: 'Research',         color: '#06b6d4', bg: '#0c1a1f' },
    ngo:        { label: 'NGO / Foundation', color: '#10b981', bg: '#0d1f18' },
  };

  /* ── Storage helpers ─────────────────────────────────────────────────── */
  function getP()  { try { return JSON.parse(localStorage.getItem('nl_crm_pending')   || '[]'); } catch(e) { return []; } }
  function getC()  { try { return JSON.parse(localStorage.getItem('nl_crm_contacts')  || '[]'); } catch(e) { return []; } }
  function getT()  { try { var v = JSON.parse(localStorage.getItem('nl_crm_stype') || '["research"]'); return Array.isArray(v) && v.length ? [v[0]] : ['research']; } catch(e) { return ['research']; } }
  function saveP(l){ localStorage.setItem('nl_crm_pending',  JSON.stringify(l)); }
  function saveC(l){ localStorage.setItem('nl_crm_contacts', JSON.stringify(l)); }
  function saveT(t){ localStorage.setItem('nl_crm_stype',    JSON.stringify(t)); }

  /* ── Sync from JSON file ─────────────────────────────────────────────── */
  function buildSets() {
    var all = [].concat(getC(), getP());
    return {
      emails: new Set(all.map(function(c){ return (c.email||'').toLowerCase().trim(); }).filter(Boolean)),
      names:  new Set(all.map(function(c){ return ((c.first||'')+' '+(c.last||'')).toLowerCase().trim(); }).filter(Boolean)),
    };
  }

  function syncFromFile() {
    return fetch(JSON_URL + '?t=' + Date.now())
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(remote) {
        if (!Array.isArray(remote) || !remote.length) return 0;
        var sets = buildSets(), pending = getP(), added = 0;
        remote.forEach(function(c) {
          var el = (c.email||'').toLowerCase().trim();
          var nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
          if (!el) return; // skip contacts with no email
          if (sets.emails.has(el)) return;
          if (sets.names.has(nl)) return;
          var id = 'disc_'+(c.instId||'xx')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
          pending.push({
            id:id, instId:c.instId||'', first:(c.first||'').trim(), last:(c.last||'').trim(),
            title:(c.title||'').trim(), dept:(c.dept||'').trim(), email:el,
            phone:'', linkedin:'', research:'',
            status:'prospect', priority:'medium', quality:'seed', lastContact:'',
            notes:'Source: '+(c.source||'web-scrape')+' | Discovered: '+new Date().toISOString().slice(0,10),
            source:c.source||'web-scrape',
          });
          sets.emails.add(el); sets.names.add(nl); added++;
        });
        if (added > 0) {
          saveP(pending);
          try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e){}
        }
        return added;
      })
      .catch(function(){ return 0; });
  }

  /* ── Render the New Contacts page ───────────────────────────────────── */
  function render() {
    var title = document.getElementById('page-title');
    if (!title || !title.textContent.includes('New Contact')) return;
    var content = document.getElementById('content');
    if (!content) return;

    var allPending = getP();
    var selType  = getT()[0] || 'all';
    var allTypes = ['university','medical','research','ngo'];

    // Filter pending by selected type (or show all)
    var pending = selType === 'all'
      ? allPending
      : allPending.filter(function(c) {
          var inst = INST[c.instId] || {};
          return inst.type === selType;
        });

    var pills = [{ key:'all', label:'All', color:'#f1f5f9', bg:'rgba(241,245,249,0.08)' }]
      .concat(allTypes.map(function(t){ return { key:t, label:TM[t].label, color:TM[t].color, bg:TM[t].bg }; }))
      .map(function(item) {
        var active = (item.key === selType);
        return '<button onclick="window._nlSelectT(\'' + item.key + '\')" style="' +
          'border:2px solid ' + (active ? item.color : 'rgba(255,255,255,0.12)') + ';' +
          'background:' + (active ? item.bg : 'transparent') + ';' +
          'color:' + (active ? item.color : '#64748b') + ';' +
          'border-radius:20px;padding:6px 18px;cursor:pointer;font-size:13px;font-weight:700;' +
          'margin:0 4px 0 0;transition:all .15s;' +
          (active ? 'box-shadow:0 0 0 1px ' + item.color + '40;' : '') +
          '">' + item.label + (active && item.key !== 'all' ? ' (' + pending.length + ')' : '') + '</button>';
      }).join('');

    var filterBar = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;' +
      'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:12px;padding:12px 16px">' +
      '<div style="font-size:11px;color:#64748b;font-weight:600;white-space:nowrap;text-transform:uppercase;letter-spacing:.05em">Filter</div>' +
      '<div style="display:flex;gap:4px;flex-wrap:wrap">' + pills + '</div>' +
      '</div>';

    if (!allPending.length) {
      content.innerHTML = '<div style="padding:24px">' + filterBar +
        '<p style="color:#94a3b8">No pending contacts. Next scrape runs at 07:00 UTC.</p></div>';
      return;
    }

    var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
      '<h2 style="color:#e2e8f0;margin:0">' + pending.length + ' New Contact' + (pending.length !== 1 ? 's' : '') +
      (selType !== 'all' ? ' <span style="font-size:14px;font-weight:400;color:#64748b">(' + selType + ')</span>' : '') + '</h2>' +
      (pending.length ? '<button onclick="window._nlAcceptAll()" style="background:linear-gradient(135deg,#10b981,#059669);' +
      'color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:14px;' +
      'font-weight:700;box-shadow:0 4px 15px rgba(16,185,129,0.3)">Accept All (' + pending.length + ')</button>' : '') +
      '</div>';

    var cards = pending.map(function(c) {
      var inst  = INST[c.instId] || {};
      var tm    = TM[inst.type]  || { label:'Unknown', color:'#94a3b8', bg:'#1a1a1a' };
      var iname = inst.name || c.instId || 'Unknown Institution';
      return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
        'border-radius:12px;padding:18px;margin-bottom:14px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">' +
        '<div><div style="color:#e2e8f0;font-size:16px;font-weight:600">' + c.first + ' ' + c.last + '</div>' +
        '<div style="color:#94a3b8;font-size:13px;margin-top:3px">' + (c.title||'') + (c.dept ? ' - '+c.dept : '') + '</div></div>' +
        '<div style="background:' + tm.bg + ';border:1px solid ' + tm.color + '40;border-radius:6px;' +
        'padding:4px 10px;text-align:right">' +
        '<div style="color:' + tm.color + ';font-size:10px;font-weight:700;text-transform:uppercase">' + tm.label + '</div>' +
        '<div style="color:#e2e8f0;font-size:12px;font-weight:600;margin-top:2px">' + iname + '</div></div></div>' +
        (c.email ? '<div style="color:#6ee7b7;font-size:13px;margin-bottom:10px">✉ ' + c.email + '</div>' : '') +
        '<div style="display:flex;gap:10px">' +
        '<button onclick="window._nlAccept(\'' + c.id + '\')" style="background:#10b981;color:white;' +
        'border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">✓ Accept</button>' +
        '<button onclick="window._nlDiscard(\'' + c.id + '\')" style="background:rgba(239,68,68,0.15);' +
        'color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:7px 16px;cursor:pointer;' +
        'font-size:13px">✕ Discard</button></div></div>';
    }).join('');

    content.innerHTML = '<div style="padding:24px">' + header + filterBar + cards + '</div>';
  }

  /* ── Action handlers ──────────────────────────────────────────────────── */
  window._nlAccept = function(id) {
    var p = getP(), idx = p.findIndex(function(c){ return c.id === id; });
    if (idx === -1) return;
    var contact = p.splice(idx, 1)[0];
    var inst = INST[contact.instId] || {};
    var contacts = getC();
    contacts.push(Object.assign({}, contact, {
      institution: inst.name || contact.instId || '',
      addedAt: new Date().toISOString(),
      status: 'active',
      quality: 'verified',
    }));
    saveC(contacts); saveP(p);
    // Update live state so Contacts view refreshes immediately
    try {
      if (window.state && Array.isArray(window.state.contacts)) {
        window.state.contacts = contacts.filter(function(c){ return c.quality === 'verified'; });
      }
    } catch(e){}
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e){}
    render();
  };

  window._nlDiscard = function(id) {
    saveP(getP().filter(function(c){ return c.id !== id; }));
    render();
  };

  window._nlAcceptAll = function() {
    // Accept only the currently-visible (filtered) contacts
    var selType = getT()[0] || 'all';
    var allP = getP();
    var p = selType === 'all' ? allP : allP.filter(function(c) {
      var inst = INST[c.instId] || {};
      return inst.type === selType;
    });
    if (!p.length) return;
    var acceptIds = new Set(p.map(function(c){ return c.id; }));
    var contacts = getC();
    var emails = new Set(contacts.map(function(c){ return (c.email||'').toLowerCase(); }).filter(Boolean));
    var names  = new Set(contacts.map(function(c){ return (c.first+' '+c.last).toLowerCase().trim(); }).filter(Boolean));
    var added = 0;
    p.forEach(function(c) {
      var el = (c.email||'').toLowerCase().trim();
      var nl = (c.first+' '+c.last).toLowerCase().trim();
      if (el && emails.has(el)) return;
      if (names.has(nl)) return;
      var inst = INST[c.instId] || {};
      contacts.push(Object.assign({}, c, {
        institution: inst.name || c.instId || '',
        addedAt: new Date().toISOString(),
        status: 'active',
        quality: 'verified',
      }));
      emails.add(el); names.add(nl);
      added++;
    });
    // Remove only the accepted contacts from pending (keep others)
    var remaining = allP.filter(function(c){ return !acceptIds.has(c.id); });
    saveC(contacts); saveP(remaining);
    // Update live state so Contacts view refreshes immediately without reload
    try {
      if (window.state && Array.isArray(window.state.contacts)) {
        window.state.contacts = contacts.filter(function(c){ return c.quality === 'verified'; });
      }
    } catch(e){}
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e){}
    try { if (typeof toast==='function') toast(added + ' contact' + (added!==1?'s':'') + ' added to CRM!', 'ok'); } catch(e){}
    render();
  };

  // Filter the pending list by institution type
  window._nlSelectT = function(t) {
    saveT([t]);
    render();
  };

  var GH_OWNER = 'venturinodino-creator';
  var GH_REPO  = 'netherlands-crm';
  var GH_PATH  = 'data/scrape-config.json';

  function getGhToken() {
    return localStorage.getItem('nl_crm_gh_token') || '';
  }

  window._nlSetGhToken = function() {
    var t = prompt('Paste your GitHub Personal Access Token (needs Contents: read+write):\n\nCreate one at: github.com/settings/tokens/new\nScopes needed: repo → Contents (read and write)', getGhToken() || '');
    if (t && t.trim()) {
      localStorage.setItem('nl_crm_gh_token', t.trim());
      try { if (typeof toast==='function') toast('GitHub token saved!', 'ok'); } catch(e){}
    }
  };

  function pushScrapeConfig(types) {
    var token = getGhToken();
    if (!token) {
      try {
        if (typeof toast==='function') toast('Set a GitHub token to save scrape preference — click "Set token" below', 'ok');
      } catch(e){}
      render(); // re-render to show the set-token button
      return;
    }
    var content = JSON.stringify({ types: types, updatedAt: new Date().toISOString().slice(0,10) }, null, 2);
    var b64 = btoa(unescape(encodeURIComponent(content)));
    var api = 'https://api.github.com/repos/' + GH_OWNER + '/' + GH_REPO + '/contents/' + GH_PATH;
    // Get current SHA first, then commit
    fetch(api, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(meta) {
        var body = { message: 'scrape config: target ' + types.join(','), content: b64 };
        if (meta && meta.sha) body.sha = meta.sha;
        return fetch(api, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      })
      .then(function(r) {
        if (r && r.ok) {
          try { if (typeof toast==='function') toast('Saved! Agent will scrape ' + (TM[types[0]] ? TM[types[0]].label : types[0]) + ' contacts tomorrow.', 'ok'); } catch(e){}
        } else {
          try { if (typeof toast==='function') toast('Could not save to GitHub — check your token', 'ok'); } catch(e){}
        }
      })
      .catch(function() {
        try { if (typeof toast==='function') toast('Network error saving preference', 'ok'); } catch(e){}
      });
  }

  /* ── Nav wrap ────────────────────────────────────────────────────────── */
  function wrapNav() {
    if (!window.nav || window._nlNavWrapped) return;
    window._nlNavWrapped = true;
    var origNav = window.nav;
    window.nav = function(section) {
      origNav(section);
      if (section === 'pending') setTimeout(render, 350);
    };
    console.log('[NL CRM] nav() wrapped');
  }

  /* ── Init ────────────────────────────────────────────────────────────── */
  window.runContactDiscovery = function() {
    try { if (typeof toast==='function') toast('Checking for new contacts...','ok'); } catch(e){}
    syncFromFile().then(function(n) {
      var msg = n > 0 ? n+' new contacts loaded!' : 'No new contacts yet.';
      try { if (typeof toast==='function') toast(msg,'ok'); } catch(e){}
      // Always re-render the pending page so newly loaded contacts appear
      if (typeof window.nav === 'function') {
        setTimeout(function() { window.nav('pending'); }, 100);
      }
    });
  };

  function init() {
    syncFromFile().then(function(n) {
      if (n > 0) {
        console.log('[NL CRM] Auto-loaded', n, 'contacts');
        render();
      }
    });
    wrapNav();
    render();
  }

  if (window.nav) {
    init();
  } else {
    var attempts = 0;
    var poll = setInterval(function() {
      if (window.nav || ++attempts > 30) {
        clearInterval(poll);
        init();
      }
    }, 150);
  }

  window.__crmDiscovery = {
    syncFromFile: syncFromFile,
    getPending: getP,
    buildExistingSets: buildSets,
  };

  console.log('[NL CRM] discovery.js v3 loaded');
})();
