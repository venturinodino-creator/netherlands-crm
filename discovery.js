(function () {
  'use strict';
  const JSON_URL = '/netherlands-crm/data/pending-contacts.json';

  function getPending() { try { return JSON.parse(localStorage.getItem('nl_crm_pending') || '[]'); } catch { return []; } }
  function getContacts() { try { return JSON.parse(localStorage.getItem('nl_crm_contacts') || '[]'); } catch { return []; } }
  function savePending(list) { localStorage.setItem('nl_crm_pending', JSON.stringify(list)); }

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
        phone: '', linkedin: '', research: '',
        status: 'prospect', priority: 'medium', quality: 'seed', lastContact: '',
        notes: 'Source: '+(c.source||'web-scrape')+' | Discovered: '+new Date().toISOString().slice(0,10),
        source: c.source||'web-scrape',
      });
      emails.add(el); names.add(nl); added++;
    }
    if (added > 0) {
      savePending(pending);
      if (typeof loadPendingCount === 'function') { try { loadPendingCount(); } catch {} }
    }
    return added;
  }

  window.runContactDiscovery = async function() {
    if (typeof toast==='function') toast('Checking for new contacts...','ok');
    const n = await syncFromFile();
    if (typeof toast==='function') toast(n > 0 ? n+' new contacts loaded' : 'No new contacts yet','ok');
  };

  syncFromFile().then(n => { if (n > 0) console.log('[NL CRM] Auto-loaded', n, 'contacts'); });

  function addPendingContacts(contacts) {
    const { emails, names } = buildExistingSets();
    const pending = getPending();
    let added = 0, skipped = 0;
    for (const c of contacts) {
      const el = (c.email||'').toLowerCase().trim();
      const nl = ((c.first||'')+' '+(c.last||'')).toLowerCase().trim();
      if (el && emails.has(el)) { skipped++; continue; }
      if (names.has(nl)) { skipped++; continue; }
      const id = 'disc_'+(c.instId||'xx')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
      pending.push({...c, id, status:'prospect', priority:'medium', quality:'seed', lastContact:''});
      emails.add(el); names.add(nl); added++;
    }
    if (added > 0) { savePending(pending); if (typeof loadPendingCount==='function'){try{loadPendingCount();}catch{}} }
    return { added, skipped };
  }

  window.__crmDiscovery = { addPendingContacts, syncFromFile, getPending, buildExistingSets };
  console.log('[NL CRM] discovery.js — reading from', JSON_URL);
})();
