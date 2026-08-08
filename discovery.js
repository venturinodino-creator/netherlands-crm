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
  function getT()  { try { return JSON.parse(localStorage.getItem('nl_crm_stype')     || '["research"]'); } catch(e) { return ['research']; } }
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
          if (el && sets.emails.has(el)) return;
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

    var pending  = getP();
    var selTypes = getT();
    var allTypes = ['university','medical','research','ngo'];

    var pills = allTypes.map(function(t) {
      var m = TM[t], active = selTypes.indexOf(t) !== -1;
      return '<button onclick="window._nlToggleT(\'' + t + '\')" style="border:2px solid ' +
        (active ? m.color : 'rgba(255,255,255,0.15)') + ';background:' +
        (active ? m.bg : 'transparent') + ';color:' +
        (active ? m.color : '#94a3b8') +
        ';border-radius:20px;padding:6px 16px;cursor:pointer;font-size:13px;font-weight:600;margin:0 8px 8px 0">' +
        m.label + '</button>';
    }).join('');

    var filterBar = '<div style="margin-bottom:20px"><p style="color:#94a3b8;font-size:13px;margin:0 0 10px">' +
      'Filter next scrape by institution type:</p><div style="display:flex;flex-wrap:wrap;align-items:center">' +
      pills +
      '<button onclick="window._nlSaveCfg()" style="background:rgba(16,185,129,0.15);color:#10b981;' +
      'border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:6px 16px;cursor:pointer;' +
      'font-size:13px;font-weight:600;margin-bottom:8px">Save to scraper</button></div></div>';

    if (!pending.length) {
      content.innerHTML = '<div style="padding:24px">' + filterBar +
        '<p style="color:#94a3b8">No pending contacts. Next scrape runs at 07:00 UTC.</p></div>';
      return;
    }

    var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">' +
      '<h2 style="color:#e2e8f0;margin:0">' + pending.length + ' New Contact' + (pending.length !== 1 ? 's' : '') + '</h2>' +
      '<button onclick="window._nlAcceptAll()" style="background:linear-gradient(135deg,#10b981,#059669);' +
      'color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:14px;' +
      'font-weight:700;box-shadow:0 4px 15px rgba(16,185,129,0.3)">Accept All (' + pending.length + ')</button></div>';

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
    }));
    saveC(contacts); saveP(p);
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e){}
    render();
  };

  window._nlDiscard = function(id) {
    saveP(getP().filter(function(c){ return c.id !== id; }));
    render();
  };

  window._nlAcceptAll = function() {
    var p = getP();
    if (!p.length) return;
    var contacts = getC();
    var emails = new Set(contacts.map(function(c){ return (c.email||'').toLowerCase(); }).filter(Boolean));
    var names  = new Set(contacts.map(function(c){ return (c.first+' '+c.last).toLowerCase().trim(); }).filter(Boolean));
    p.forEach(function(c) {
      var el = (c.email||'').toLowerCase().trim();
      var nl = (c.first+' '+c.last).toLowerCase().trim();
      if (el && emails.has(el)) return;
      if (names.has(nl)) return;
      var inst = INST[c.instId] || {};
      contacts.push(Object.assign({}, c, {
        institution: inst.name || c.instId || '',
        addedAt: new Date().toISOString(),
      }));
      emails.add(el); names.add(nl);
    });
    saveC(contacts); saveP([]);
    try { if (typeof loadPendingCount==='function') loadPendingCount(); } catch(e){}
    render();
  };

  window._nlToggleT = function(t) {
    var types = getT();
    var idx = types.indexOf(t);
    if (idx === -1) { types.push(t); }
    else if (types.length > 1) { types.splice(idx, 1); }
    saveT(types);
    render();
  };

  window._nlSaveCfg = function() {
    var t = getT();
    try { if (typeof toast==='function') toast('Scraper will target: '+t.join(', '),'ok'); } catch(e){}
    console.log('[NL CRM] Scrape config saved:', t);
  };

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
