(function () {
  'use strict';
  const JSON_URL = '/netherlands-crm/data/pending-contacts.json';
  const CONFIG_URL = '/netherlands-crm/data/scrape-config.json';

  // Known institution metadata (fallback if not in nl_crm_institutions)
  const KNOWN_INST = {
    cwi:       { name: 'Centrum Wiskunde & Informatica', type: 'research' },
    esc:       { name: 'Netherlands eScience Center',   type: 'research' },
    pbl:       { name: 'PBL — Environmental Assessment Agency', type: 'research' },
    rathenau:  { name: 'Rathenau Instituut',            type: 'research' },
    uva:       { name: 'University of Amsterdam',        type: 'university' },
    vu:        { name: 'Vrije Universiteit Amsterdam',   type: 'university' },
    uu:        { name: 'Utrecht University',             type: 'university' },
    leiden:    { name: 'Leiden University',              type: 'university' },
    eur:       { name: 'Erasmus University Rotterdam',   type: 'university' },
    rug:       { name: 'University of Groningen',        type: 'university' },
    ru:        { name: 'Radboud University',             type: 'university' },
    tudelft:   { name: 'TU Delft',                      type: 'university' },
    tue:       { name: 'TU/e Eindhoven',                 type: 'university' },
    ut:        { name: 'University of Twente',           type: 'university' },
    wur:       { name: 'Wageningen University & Research', type: 'university' },
    um:        { name: 'Maastricht University',          type: 'university' },
    tiu:       { name: 'Tilburg University',             type: 'university' },
    aumc:      { name: 'Amsterdam UMC',                  type: 'medical' },
    erasmusmc: { name: 'Erasmus MC',                     type: 'medical' },
    umcutrecht:{ name: 'UMC Utrecht',                   type: 'medical' },
    lumc:      { name: 'Leiden University Medical Centre', type: 'medical' },
    umcg:      { name: 'UMCG Groningen',                 type: 'medical' },
    radboudumc:{ name: 'Radboudumc',                    type: 'medical' },
    mumc:      { name: 'Maastricht UMC+',                type: 'medical' },
    knaw:      { name: 'Royal Netherlands Academy of Arts and Sciences', type: 'ngo' },
    nwo:       { name: 'Dutch Research Council (NWO)', type: 'ngo' },
    zonmw:     { name: 'ZonMw',                          type: 'ngo' },
  };

  const TYPE_META = {
    university: { label: 'University',      color: '#8b5cf6', bg: '#1e1b4b' },
    medical:    { label: 'Medical Center',  color: '#ef4444', bg: '#1f1010' },
    research:   { label: 'Research',        color: '#06b6d4', bg: '#0c1a1f' },
    ngo:        { label: 'NGO / Foundation',color: '#10b981', bg: '#0d1f18' },
  };

  function getPending() { try { return JSON.parse(localStorage.getItem('nl_crm_pending') || '[]'); } catch { return []; } }
  function getContacts() { try { return JSON.parse(localStorage.getItem('nl_crm_contacts') || '[]'); } catch { return []; } }
  function savePending(list) { localStorage.setItem('nl_crm_pending', JSON.stringify(list)); }
  function saveContacts(list) { localStorage.setItem('nl_crm_contacts', JSON.stringify(list)); }
  function getScrapeTypes() { try { return JSON.parse(localStorage.getItem('nl_crm_scrape_types') || '["research"]'); } catch { return ['research']; } }

  function buildExistingSets() {
    const all = [...getContacts(), ...getPending()];
    return {
      emails: new Set(all.map(c => (c.email||'').toLowerCase().trim()).filter(Boolean)),
      names:  new Set(all.map(c => ((c.first||'')+' '+(c.last||'')).toLowerCase().trim()).filter(Boolean)),
    };
  }

  async function syncFromFile() {
    let remote;
    try {
      const r = await fetch(JSON_URL + '?t=' + Date.now());
      if (!r.ok) return 0;
      remote = await r.json();
    } catch { return 0; }
    if (!Array.isArray(remote) || remote.length === 0) return 0;
    const { emails, names } = buildExistingSets();
    const pending = getPending();
    let added = 0;
    for (const c of remote) {
      const el = (c.email||'').toLowerCase().trim();
      const nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
      if (el && emails.has(el)) continue;
      if (names.has(nl)) continue;
      const id = 'disc_'+(c.instId||'xx')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      pending.push({
        id, instId: c.instId||'', first: (c.first||'').trim(), last: (c.last||'').trim(),
        title: (c.title||'').trim(), dept: (c.dept||'').trim(), email: el,
        phone: '', linkedin: '', research: (c.research||'').trim(),
        status: 'prospect', priority: 'medium', quality: 'seed', lastContact: '',
        notes: 'Source: '+(c.source||'web-scrape')+' | Discovered: '+new Date().toISOString().slice(0,10),
        source: c.source||'web-scrape',
      });
      emails.add(el); names.add(nl); added++;
    }
    if (added > 0) { savePending(pending); if (typeof loadPendingCount==='function'){try{loadPendingCount();}catch{}} }
    return added;
  }

  window.runContactDiscovery = async function() {
    if (typeof toast==='function') toast('Checking for new contacts...','ok');
    const n = await syncFromFile();
    if (typeof toast==='function') toast(n > 0 ? n+' new contacts loaded' : 'No new contacts yet','ok');
    window.renderPendingContacts();
  };

  window.toggleScrapeType = function(typeId) {
    let current = getScrapeTypes();
    if (current.includes(typeId)) {
      current = current.filter(t => t !== typeId);
      if (current.length === 0) current = ['research'];
    } else {
      current.push(typeId);
    }
    localStorage.setItem('nl_crm_scrape_types', JSON.stringify(current));
    window.renderPendingContacts();
  };

  window.saveScrapeConfig = function() {
    const types = getScrapeTypes();
    const json = JSON.stringify({ types, updatedAt: new Date().toISOString().slice(0,10) }, null, 2);
    try { navigator.clipboard.writeText(json); } catch {}
    window.open('https://github.com/venturinodino-creator/netherlands-crm/edit/main/data/scrape-config.json', '_blank');
  };

  function instInfo(instId) {
    // Check nl_crm_institutions first
    try {
      const stored = JSON.parse(localStorage.getItem('nl_crm_institutions') || '[]');
      const found = stored.find(i => i.id === instId);
      if (found) return { name: found.name || instId, type: found.type || 'research' };
    } catch {}
    // Fallback to hardcoded map
    return KNOWN_INST[instId] || { name: instId || 'Unknown institution', type: 'research' };
  }

  function overrideRender() {
    window.renderPendingContacts = async function () {
      const pending = getPending();
      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = 'New Contacts';

      const topbar = document.getElementById('topbar-actions');
      if (topbar) {
        topbar.innerHTML =
          (pending.length > 0
            ? '<button onclick="window.acceptAllPending()" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-size:.875rem;font-weight:600;margin-right:8px">Accept All ('+pending.length+')</button>'
            : '')
          + '<button class="btn btn-outline" style="display:flex;align-items:center;gap:8px" onclick="window.runContactDiscovery()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Find contacts now</button>';
      }

      const content = document.getElementById('content');
      if (!content) return;

      // --- Scrape type filter ---
      const scrapeTypes = getScrapeTypes();
      const typeOrder = ['university','medical','research','ngo'];
      const typeFilter = '<div style="background:#111827;border:1px solid #1f2937;border-radius:12px;padding:16px 20px;margin-bottom:20px">'
        + '<div style="font-size:.75rem;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Next scrape — institution type filter</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
        + typeOrder.map(tid => {
            const m = TYPE_META[tid];
            const active = scrapeTypes.includes(tid);
            return '<button onclick="window.toggleScrapeType(''+tid+'')" style="border-radius:20px;padding:6px 14px;font-size:.8rem;font-weight:500;cursor:pointer;border:1.5px solid '+(active?m.color:'#374151')+';background:'+(active?m.bg:'transparent')+';color:'+(active?m.color:'#6b7280')+';transition:all .15s">'+m.label+'</button>';
          }).join('')
        + '<button onclick="window.saveScrapeConfig()" title="Copy config JSON &amp; open GitHub editor" style="margin-left:auto;background:transparent;border:1px solid #374151;border-radius:8px;padding:6px 12px;color:#6b7280;font-size:.75rem;cursor:pointer;display:flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>Save to scraper</button>'
        + '</div></div>';

      if (!pending.length) {
        content.innerHTML = '<div style="padding:24px;max-width:860px">'+typeFilter
          + '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:40vh;gap:12px;color:#6b7280">'
          + '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>'
          + '<p style="font-size:1rem;font-weight:500">No pending contacts</p>'
          + '<p style="font-size:.875rem;color:#9ca3af">The daily agent will find new contacts automatically.</p></div></div>';
        return;
      }

      const cards = pending.map(c => {
        const initials = ((c.first||'?')[0]+(c.last||'?')[0]).toUpperCase();
        const inst = instInfo(c.instId);
        const typeMeta = TYPE_META[inst.type] || TYPE_META.research;
        const bg = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#06b6d4'][Math.abs((c.first||'').charCodeAt(0)+(c.last||'').charCodeAt(0))%6];
        return '<div style="background:#1f2937;border:1px solid #374151;border-radius:12px;padding:18px 22px;display:flex;align-items:center;gap:16px;margin-bottom:10px">'
          + '<div style="width:46px;height:46px;border-radius:50%;background:'+bg+';display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:1rem;flex-shrink:0">'+initials+'</div>'
          + '<div style="flex:1;min-width:0">'
          +   '<div style="font-weight:600;font-size:.95rem;color:#f9fafb">'+c.first+' '+c.last+'</div>'
          +   '<div style="font-size:.85rem;color:#d1d5db;margin-top:3px">'+inst.name+'</div>'
          +   '<div style="display:flex;gap:8px;align-items:center;margin-top:5px;flex-wrap:wrap">'
          +     '<span style="font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:10px;border:1px solid '+typeMeta.color+';color:'+typeMeta.color+';background:'+typeMeta.bg+'">'+typeMeta.label+'</span>'
          +     (c.dept ? '<span style="font-size:.78rem;color:#6b7280">'+c.dept+'</span>' : '')
          +     (c.email ? '<span style="font-size:.78rem;color:#6b7280">'+c.email+'</span>' : '')
          +   '</div>'
          + '</div>'
          + '<div style="display:flex;gap:8px;flex-shrink:0">'
          +   '<button onclick="window.acceptPending(''+c.id+'')" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:.85rem;font-weight:500">Accept</button>'
          +   '<button onclick="window.discardPending(''+c.id+'')" style="background:#374151;color:#9ca3af;border:none;border-radius:8px;padding:7px 14px;cursor:pointer;font-size:.85rem">Discard</button>'
          + '</div></div>';
      }).join('');

      content.innerHTML = '<div style="padding:24px;max-width:860px">'
        + typeFilter
        + '<h2 style="color:#f9fafb;font-size:1.1rem;font-weight:600;margin-bottom:4px">'+pending.length+' contact'+(pending.length!==1?'s':'')+' awaiting review</h2>'
        + '<p style="color:#6b7280;font-size:.85rem;margin-bottom:16px">Accept to add to CRM &amp; assign to institution, Discard to remove</p>'
        + cards + '</div>';
    };

    window.acceptPending = function(id) {
      const pending = getPending(); const idx = pending.findIndex(c => c.id===id); if (idx===-1) return;
      const c = pending.splice(idx,1)[0]; const contacts = getContacts();
      c.status='active'; c.quality='verified'; contacts.push(c);
      saveContacts(contacts); savePending(pending);
      if (typeof loadPendingCount==='function'){try{loadPendingCount();}catch{}}
      window.renderPendingContacts();
    };

    window.acceptAllPending = function() {
      const pending = getPending(); if (!pending.length) return;
      const contacts = getContacts();
      const existingNames = new Set(contacts.map(c=>((c.first||'')+' '+(c.last||'')).toLowerCase().trim()));
      let added = 0;
      for (const c of pending) {
        const nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
        if (existingNames.has(nl)) continue;
        c.status='active'; c.quality='verified'; contacts.push(c); existingNames.add(nl); added++;
      }
      saveContacts(contacts); savePending([]);
      if (typeof loadPendingCount==='function'){try{loadPendingCount();}catch{}}
      if (typeof toast==='function') toast(added+' contact'+(added!==1?'s':'')+' added to CRM','ok');
      window.renderPendingContacts();
    };

    window.discardPending = function(id) { savePending(getPending().filter(c=>c.id!==id)); window.renderPendingContacts(); };

    console.log('[NL CRM] discovery.js ready — render override + scrape type filter active');
  }

  if (document.readyState==='loading') { document.addEventListener('DOMContentLoaded', overrideRender); }
  else { setTimeout(overrideRender, 0); }

  syncFromFile().then(n => {
    if (n>0) console.log('[NL CRM] Auto-loaded', n, 'new contacts');
    else console.log('[NL CRM] Loaded —', getPending().length, 'contacts in queue');
  });

  function addPendingContacts(contacts) {
    const { emails, names } = buildExistingSets(); const pending = getPending();
    let added=0, skipped=0;
    for (const c of contacts) {
      const el=(c.email||'').toLowerCase().trim(); const nl=((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
      if (el && emails.has(el)){skipped++;continue;} if (names.has(nl)){skipped++;continue;}
      const id='disc_'+(c.instId||'xx')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      pending.push({...c,id,status:'prospect',priority:'medium',quality:'seed',lastContact:''});
      emails.add(el); names.add(nl); added++;
    }
    if (added>0){savePending(pending);if(typeof loadPendingCount==='function'){try{loadPendingCount();}catch{}}}
    return {added,skipped};
  }

  window.__crmDiscovery = { addPendingContacts, syncFromFile, getPending, buildExistingSets };
})();
