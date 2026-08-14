/* discovery.js v10 — NL Research CRM contact discovery */
(function () {
  'use strict';

  var JSON_URL = '/netherlands-crm/data/pending-contacts.json';

  var INST = {
    cwi:        { name: 'Centrum Wiskunde & Informatica',                      type: 'research'   },
    esc:        { name: 'Netherlands eScience Center',                         type: 'research'   },
    pbl:        { name: 'PBL Netherlands Environmental Assessment Agency',     type: 'research'   },
    rathenau:   { name: 'Rathenau Instituut',                                  type: 'research'   },
    uva:        { name: 'University of Amsterdam',                             type: 'university' },
    vu:         { name: 'VU Amsterdam',                                        type: 'university' },
    uu:         { name: 'Utrecht University',                                  type: 'university' },
    tue:        { name: 'Eindhoven University of Technology',                  type: 'university' },
    tud:        { name: 'TU Delft',                                            type: 'university' },
    rug:        { name: 'University of Groningen',                             type: 'university' },
    um:         { name: 'Maastricht University',                               type: 'university' },
    lei:        { name: 'Leiden University',                                   type: 'university' },
    eur:        { name: 'Erasmus University Rotterdam',                        type: 'university' },
    utwente:    { name: 'University of Twente',                                type: 'university' },
    wur:        { name: 'Wageningen University & Research',                    type: 'university' },
    ou:         { name: 'Open Universiteit',                                   type: 'university' },
    tilburg:    { name: 'Tilburg University',                                  type: 'university' },
    amc:        { name: 'Amsterdam UMC',                                       type: 'medical'    },
    erasmusmc:  { name: 'Erasmus MC',                                          type: 'medical'    },
    umcg:       { name: 'UMCG',                                                type: 'medical'    },
    umcutrecht: { name: 'UMC Utrecht',                                         type: 'medical'    },
    mumc:       { name: 'Maastricht UMC+',                                     type: 'medical'    },
    radboudumc: { name: 'Radboud UMC',                                         type: 'medical'    },
    lumc:       { name: 'Leiden UMC',                                          type: 'medical'    },
    knaw:       { name: 'Royal Netherlands Academy of Arts and Sciences',      type: 'ngo'        },
    nwo:        { name: 'Netherlands Organisation for Scientific Research',    type: 'ngo'        },
    zonmw:      { name: 'ZonMw',                                               type: 'ngo'        },
  };

  var TM = {
    university: { label: 'University',       color: '#8b5cf6', bg: '#1e1b4b' },
    medical:    { label: 'Medical Center',   color: '#ef4444', bg: '#1f1010' },
    research:   { label: 'Research',         color: '#06b6d4', bg: '#0c1a1f' },
    ngo:        { label: 'NGO / Foundation', color: '#10b981', bg: '#0d1f18' },
  };

  /* ── Storage ──────────────────────────────────────────────────────────── */
  function getP()  { try { return JSON.parse(localStorage.getItem('nl_crm_pending')  || '[]'); } catch(e) { return []; } }
  function getC()  { try { return JSON.parse(localStorage.getItem('nl_crm_contacts') || '[]'); } catch(e) { return []; } }
  function getT()  {
    try {
      var v = localStorage.getItem('nl_crm_stype') || 'all';
      // Handle old array format: '["university"]' → 'university'
      if (v.charAt(0) === '[') { var a = JSON.parse(v); return (Array.isArray(a) && a[0]) ? a[0] : 'all'; }
      return v;
    } catch(e) { return 'all'; }
  }
  function saveP(l){ localStorage.setItem('nl_crm_pending',  JSON.stringify(l)); }
  function saveC(l){ localStorage.setItem('nl_crm_contacts', JSON.stringify(l)); }
  function saveT(t){ localStorage.setItem('nl_crm_stype', t); }

  /* ── Sync from pending-contacts.json ─────────────────────────────────── */
  function syncFromFile() {
    return fetch(JSON_URL + '?t=' + Date.now())
      .then(function(r) { return r.ok ? r.json() : []; })
      .then(function(remote) {
        if (!Array.isArray(remote) || !remote.length) return 0;

        var contacts = getC();
        var pending  = getP();

        // Against accepted contacts: only skip by email (names not unique enough across scrapes)
        var acceptedEmails = new Set(
          contacts.map(function(c){ return (c.email||'').toLowerCase().trim(); }).filter(Boolean)
        );
        // Against current pending: skip by both name and email (no exact dupes in queue)
        var pendingEmails = new Set(
          pending.map(function(c){ return (c.email||'').toLowerCase().trim(); }).filter(Boolean)
        );
        var pendingNames = new Set(
          pending.map(function(c){ return ((c.first||'')+' '+(c.last||'')).toLowerCase().trim(); })
        );

        var added = 0;
        remote.forEach(function(c) {
          var el = (c.email||'').toLowerCase().trim();
          var nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
          if (!nl || nl.trim() === '') return;                    // blank name
          if (el && acceptedEmails.has(el)) return;              // already accepted (by email)
          if (el && pendingEmails.has(el)) return;               // already queued (by email)
          if (pendingNames.has(nl)) return;                      // already queued (by name)
          var id = 'disc_' + (c.instId||'xx') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
          pending.push({
            id: id, instId: c.instId||'', first: (c.first||'').trim(), last: (c.last||'').trim(),
            title: (c.title||'').trim(), dept: (c.dept||'').trim(), email: el,
            source: c.source||'', research: c.research||'',
            status: 'prospect', priority: 'medium', quality: 'seed', lastContact: '',
            notes: 'Discovered: ' + new Date().toISOString().slice(0,10),
          });
          if (el) pendingEmails.add(el);
          pendingNames.add(nl);
          added++;
        });

        if (added > 0) {
          saveP(pending);
          try { if (typeof loadPendingCount === 'function') loadPendingCount(); } catch(e) {}
        }
        return added;
      })
      .catch(function() { return 0; });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */
  function render() {
    var content = document.getElementById('content');
    var title   = document.getElementById('page-title');
    if (!content || !title || !title.textContent.includes('New Contact')) return;

    var allPending = getP();
    var selType    = getT();
    var allTypes   = ['university', 'medical', 'research', 'ngo'];

    var filtered = selType === 'all'
      ? allPending
      : allPending.filter(function(c) { return (INST[c.instId] || {}).type === selType; });

    /* pills */
    var pillDefs = [{ key:'all', label:'All (' + allPending.length + ')', color:'#f1f5f9', bg:'rgba(255,255,255,0.07)' }]
      .concat(allTypes.map(function(t) {
        var count = allPending.filter(function(c){ return (INST[c.instId]||{}).type === t; }).length;
        return { key:t, label:(TM[t]||{label:t}).label + (count ? ' (' + count + ')' : ''), color:(TM[t]||{}).color||'#94a3b8', bg:(TM[t]||{}).bg||'#111' };
      }));

    var pills = pillDefs.map(function(p) {
      var active = p.key === selType;
      return '<button onclick="window._nlSelectT(\'' + p.key + '\')" style="' +
        'border:2px solid ' + (active ? p.color : 'rgba(255,255,255,0.08)') + ';' +
        'background:' + (active ? p.bg : 'transparent') + ';' +
        'color:' + (active ? p.color : 'rgba(255,255,255,0.2)') + ';' +
        'border-radius:20px;padding:5px 14px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;' +
        'transition:all 0.15s;' +
        (active ? 'box-shadow:0 0 8px ' + p.color + '44;' : 'filter:grayscale(100%);') + '">' + p.label + '</button>';
    }).join('');

    var filterBar = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap;' +
      'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);' +
      'border-radius:10px;padding:10px 14px">' + pills + '</div>';

    /* empty state */
    if (!allPending.length) {
      content.innerHTML = '<div style="padding:24px;max-width:860px">' + filterBar +
        '<div style="text-align:center;padding:60px 20px;color:#64748b">' +
        '<div style="font-size:40px;margin-bottom:12px">📭</div>' +
        '<div style="font-size:16px;font-weight:600;color:#94a3b8;margin-bottom:6px">No pending contacts</div>' +
        '<div style="font-size:13px">The agent scrapes daily at 07:00 UTC — or click <b>Find contacts now</b> above.</div></div></div>';
      return;
    }

    if (!filtered.length) {
      content.innerHTML = '<div style="padding:24px;max-width:860px">' + filterBar +
        '<div style="text-align:center;padding:40px 20px;color:#64748b">' +
        '<div style="font-size:13px">No <b>' + selType + '</b> contacts pending. Try another filter.</div></div></div>';
      return;
    }

    /* cards */
    var cards = filtered.map(function(c) {
      var inst  = INST[c.instId] || {};
      var tm    = TM[inst.type] || { label:'Unknown', color:'#94a3b8', bg:'#1a1a1a' };
      var iname = inst.name || c.instId || '—';
      return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
        'border-radius:12px;padding:16px 18px;margin-bottom:12px;display:flex;align-items:center;gap:16px">' +
        '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:600;font-size:15px;color:#e2e8f0">' + (c.first||'') + ' ' + (c.last||'') + '</div>' +
        '<div style="color:#94a3b8;font-size:13px;margin-top:2px">' + (c.title||'Researcher') + (c.dept ? ' · ' + c.dept : '') + '</div>' +
        '<div style="display:inline-block;margin-top:6px;background:' + tm.bg + ';border:1px solid ' + tm.color + '55;' +
        'border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700;color:' + tm.color + ';text-transform:uppercase">' +
        tm.label + ' · ' + iname + '</div>' +
        (c.email ? '<div style="color:#6ee7b7;font-size:12px;margin-top:4px">✉ ' + c.email + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-shrink:0" data-admin-only>' +
        '<button onclick="window._nlAccept(\'' + c.id + '\')" style="background:#10b981;color:#fff;' +
        'border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">Accept</button>' +
        '<button onclick="window._nlDiscard(\'' + c.id + '\')" style="background:rgba(239,68,68,0.12);' +
        'color:#f87171;border:1px solid rgba(239,68,68,0.25);border-radius:6px;padding:7px 14px;cursor:pointer;font-size:13px">Discard</button>' +
        '</div></div>';
    }).join('');

    var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<div><h2 style="color:#e2e8f0;margin:0;font-size:20px">' + filtered.length + ' Contact' + (filtered.length !== 1 ? 's' : '') + '</h2>' +
      (selType !== 'all' ? '<div style="font-size:12px;color:#64748b;margin-top:2px">Showing ' + (TM[selType]||{label:selType}).label + ' · ' + allPending.length + ' total pending</div>' : '') +
      '</div>' +
      '<button onclick="window._nlAcceptAll()" style="background:linear-gradient(135deg,#10b981,#059669);' +
      'color:#fff;border:none;border-radius:8px;padding:9px 22px;cursor:pointer;font-size:13px;font-weight:700;' +
      'box-shadow:0 4px 12px rgba(16,185,129,0.3)">Accept All (' + filtered.length + ')</button></div>';

    content.innerHTML = '<div style="padding:24px;max-width:860px">' + header + filterBar + cards + '</div>';
    // Re-apply admin-only visibility since this rebuilds #content outside index.html's own render()
    try { if (typeof window.applyRoleUI === 'function') window.applyRoleUI(); } catch(e) {}
  }

  /* ── Handlers ─────────────────────────────────────────────────────────── */
  // Note: this pill only filters the current view. It used to also push
  // data/scrape-config.json to GitHub via a client-side PAT stored in
  // localStorage (removed — a repo-write token pasted into the browser is a
  // credential-exposure risk). To change what the daily scraper targets,
  // edit data/scrape-config.json directly in the repo.
  window._nlSelectT = function(t) {
    saveT(t);
    render();
  };

  window._nlAccept = function(id) {
    var p = getP(), idx = -1;
    for (var i=0;i<p.length;i++) if (p[i].id===id) { idx=i; break; }
    if (idx === -1) return;
    var contact = p.splice(idx, 1)[0];
    var inst = INST[contact.instId] || {};
    var contacts = getC();
    var newContact = Object.assign({}, contact, {
      institution: inst.name || contact.instId || '',
      addedAt: new Date().toISOString(),
      status: 'active', quality: 'verified',
    });
    contacts.push(newContact);
    saveC(contacts); saveP(p);
    try { if (window.state && Array.isArray(window.state.contacts)) window.state.contacts = contacts.filter(function(c){ return c.quality==='verified'; }); } catch(e) {}
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e) {}
    try { if (typeof window.supaUpsertContact === 'function') window.supaUpsertContact(newContact).catch(function(e){ console.error(e); }); } catch(e) {}
    render();
  };

  window._nlDiscard = function(id) {
    saveP(getP().filter(function(c) { return c.id !== id; }));
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e) {}
    render();
  };

  window._nlAcceptAll = function() {
    var selType = getT();
    var allP    = getP();
    var toAccept = selType === 'all' ? allP : allP.filter(function(c) { return (INST[c.instId]||{}).type === selType; });
    if (!toAccept.length) return;
    var ids = {};
    toAccept.forEach(function(c){ ids[c.id] = true; });
    var contacts = getC();
    var seenEmails = new Set(contacts.map(function(c){ return (c.email||'').toLowerCase(); }).filter(Boolean));
    var seenNames  = new Set(contacts.map(function(c){ return ((c.first||'')+' '+(c.last||'')).toLowerCase().trim(); }));
    var added = 0;
    var addedContacts = [];
    toAccept.forEach(function(c) {
      var el = (c.email||'').toLowerCase().trim();
      var nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
      if (el && seenEmails.has(el)) return;
      if (seenNames.has(nl)) return;
      var inst = INST[c.instId] || {};
      var newContact = Object.assign({}, c, { institution: inst.name||c.instId||'', addedAt: new Date().toISOString(), status:'active', quality:'verified' });
      contacts.push(newContact);
      addedContacts.push(newContact);
      if (el) seenEmails.add(el);
      seenNames.add(nl);
      added++;
    });
    saveC(contacts);
    saveP(allP.filter(function(c){ return !ids[c.id]; }));
    try { if (window.state && Array.isArray(window.state.contacts)) window.state.contacts = contacts.filter(function(c){ return c.quality==='verified'; }); } catch(e){}
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e){}
    try { if (typeof toast==='function') toast(added + ' contact' + (added!==1?'s':'') + ' added to CRM!','ok'); } catch(e){}
    if (typeof window.supaUpsertContact === 'function') {
      addedContacts.forEach(function(nc){ window.supaUpsertContact(nc).catch(function(e){ console.error(e); }); });
    }
    render();
  };

  /* ── "Find contacts now" ──────────────────────────────────────────────── */
  window.runContactDiscovery = function() {
    try { if (typeof toast==='function') toast('Checking for new contacts…','ok'); } catch(e){}
    syncFromFile().then(function(n) {
      try { if (typeof toast==='function') toast(n > 0 ? n + ' new contacts found!' : 'No new contacts — next scrape at 07:00 UTC','ok'); } catch(e){}
      if (n > 0) render();
    });
  };

  /* ── Nav hook ─────────────────────────────────────────────────────────── */
  function hookNav() {
    if (!window.nav || window._nlNavWrapped) return;
    window._nlNavWrapped = true;
    var orig = window.nav;
    window.nav = function(section) {
      orig(section);
      if (section === 'pending') setTimeout(render, 80);
    };
  }

  function init() {
    hookNav();
    syncFromFile().then(function(n) {
      if (n > 0) { console.log('[NL CRM] loaded', n, 'new contacts'); render(); }
    });
    render();
  }

  if (window.nav) { init(); }
  else {
    var attempts = 0;
    var poll = setInterval(function() {
      if (window.nav || ++attempts > 30) { clearInterval(poll); init(); }
    }, 150);
  }

  window.__crmDiscovery = { syncFromFile: syncFromFile, getPending: getP };
  console.log('[NL CRM] discovery.js v8');
})();
