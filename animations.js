(function () {
  'use strict';

  /* ── PAGE TRANSITION ─────────────────────────────────────────────
     Watches #content for innerHTML changes (fired by nav() / render())
     and plays a fade-up entrance on the new content.
  ──────────────────────────────────────────────────────────────────── */
  const contentEl = document.getElementById('content');
  if (contentEl) {
    const observer = new MutationObserver(() => {
      contentEl.classList.remove('page-enter');
      void contentEl.offsetWidth;
      contentEl.classList.add('page-enter');

      contentEl.addEventListener('animationend', () => {
        contentEl.classList.remove('page-enter');
        staggerCards(contentEl);
      }, { once: true });
    });

    observer.observe(contentEl, { childList: true, subtree: false });
  }

  /* ── CARD STAGGER ────────────────────────────────────────────────
     Assigns .stagger-N classes to animate cards in sequence.
  ──────────────────────────────────────────────────────────────────── */
  function staggerCards(root) {
    const selectors = [
      '.ic',
      '.news-card',
      '.pipeline-card',
      '.stat-card',
      '.dash-widget',
    ];

    selectors.forEach(sel => {
      const cards = root.querySelectorAll(sel);
      cards.forEach((card, i) => {
        for (let n = 1; n <= 12; n++) card.classList.remove('stagger-' + n);
        const idx = Math.min(i + 1, 12);
        card.classList.add('stagger-' + idx);
      });
    });
  }

  /* ── NAV ITEM PULSE ──────────────────────────────────────────────
     Brief icon scale on nav click before page transition fires.
  ──────────────────────────────────────────────────────────────────── */
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const icon = item.querySelector('.nav-icon-box');
      if (!icon) return;
      icon.style.transition = 'transform .12s';
      icon.style.transform = 'scale(1.25)';
      setTimeout(() => { icon.style.transform = ''; }, 180);
    });
  });

  /* ── STAT CARD NUMBER PULSE ──────────────────────────────────────
     When a stat card's number changes, briefly scale it up.
  ──────────────────────────────────────────────────────────────────── */
  const statObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      const el = m.target.closest('.stat-value, .stat-num, h2, .text-2xl');
      if (el) {
        el.style.transition = 'transform .18s, color .18s';
        el.style.transform = 'scale(1.08)';
        el.style.color = 'var(--text2)';
        setTimeout(() => { el.style.transform = ''; el.style.color = ''; }, 250);
      }
    });
  });

  document.querySelectorAll('.stat-card').forEach(card => {
    statObserver.observe(card, { characterData: true, subtree: true, childList: true });
  });

  /* ── MODAL ANIMATION RESET ───────────────────────────────────────
     Ensures modalIn animation replays every time a modal opens.
  ──────────────────────────────────────────────────────────────────── */
  document.querySelectorAll('.overlay').forEach(overlay => {
    const innerObserver = new MutationObserver(() => {
      if (overlay.classList.contains('open')) {
        const modal = overlay.querySelector('.modal');
        if (modal) {
          modal.style.animation = 'none';
          void modal.offsetWidth;
          modal.style.animation = '';
        }
      }
    });
    innerObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });

  /* ── INITIAL STAGGER ─────────────────────────────────────────────
     Stagger whatever is already in #content on first load.
  ──────────────────────────────────────────────────────────────────── */
  setTimeout(() => { if (contentEl) staggerCards(contentEl); }, 120);

})();


/* ── PENDING CONTACTS FALLBACK RENDERER ─────────────────────────
   Runs only when discovery.js v3 is absent (_nlNavWrapped not set).
   Renders nl_crm_pending contacts on the New Contacts page.
─────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window._nlNavWrapped || window._oaNLWrapped) { return; }
  window._oaNLWrapped = true;

  var INST = {
    cwi:       {name:'Centrum Wiskunde & Informatica',        type:'research'},
    esc:       {name:'Netherlands eScience Center',            type:'research'},
    nwo:       {name:'NWO – Dutch Research Council',         type:'research'},
    knaw:      {name:'Royal Netherlands Academy',              type:'research'},
    nikhef:    {name:'Nikhef',                                 type:'research'},
    deltares:  {name:'Deltares',                               type:'research'},
    tno:       {name:'TNO',                                    type:'research'},
    rathenau:  {name:'Rathenau Instituut',                     type:'research'},
    nivel:     {name:'NIVEL',                                  type:'research'},
    nioo:      {name:'NIOO-KNAW',                              type:'ngo'},
    naturalis: {name:'Naturalis Biodiversity Center',          type:'ngo'},
    uu:        {name:'Utrecht University',                     type:'university'},
    uva:       {name:'University of Amsterdam',                type:'university'},
    tue:       {name:'Eindhoven University of Technology',     type:'university'},
    rug:       {name:'University of Groningen',                type:'university'},
    ru:        {name:'Radboud University',                     type:'university'},
    vu:        {name:'Vrije Universiteit Amsterdam',           type:'university'},
    utwente:   {name:'University of Twente',                   type:'university'},
    wur:       {name:'Wageningen University & Research',       type:'university'},
    um:        {name:'Maastricht University',                  type:'university'},
    lu:        {name:'Leiden University',                      type:'university'},
    tud:       {name:'Delft University of Technology',         type:'university'},
    umcu:      {name:'UMC Utrecht',                            type:'medical'},
    amc:       {name:'Amsterdam UMC',                          type:'medical'},
    radboudumc:{name:'Radboud UMC',                            type:'medical'},
    erasmusumc:{name:'Erasmus MC',                             type:'medical'},
    mumc:      {name:'Maastricht UMC+',                        type:'medical'},
    umcg:      {name:'UMC Groningen',                          type:'medical'},
    lumc:      {name:'Leiden UMC',                             type:'medical'},
  };
  var TM = {
    university:{label:'University',       color:'#8b5cf6', bg:'#1e1b4b'},
    medical:   {label:'Medical Center',   color:'#ef4444', bg:'#1f1010'},
    research:  {label:'Research',         color:'#06b6d4', bg:'#0c1a1f'},
    ngo:       {label:'NGO / Foundation', color:'#10b981', bg:'#0d1f18'},
  };

  function getP(){try{return JSON.parse(localStorage.getItem('nl_crm_pending')||'[]');}catch(e){return[];}}
  function getC(){try{return JSON.parse(localStorage.getItem('nl_crm_contacts')||'[]');}catch(e){return[];}}
  function getT(){try{return JSON.parse(localStorage.getItem('nl_crm_stype')||'["research","university","medical","ngo"]');}catch(e){return['research','university','medical','ngo'];}}
  function saveP(l){localStorage.setItem('nl_crm_pending',JSON.stringify(l));}
  function saveC(l){localStorage.setItem('nl_crm_contacts',JSON.stringify(l));}
  function saveT(t){localStorage.setItem('nl_crm_stype',JSON.stringify(t));}

  function isPendingPage() {
    var t = document.title || '';
    if (t.includes('New Contact') || t.includes('Pending')) return true;
    var h = document.querySelector('#content h1, #content h2, #content .section-title');
    return h && h.textContent.includes('New Contact');
  }

  function render() {
    if (!isPendingPage()) return;
    var pending = getP();
    var active  = getT();
    var typeOrder = ['university','medical','research','ngo'];
    var filtered = pending.filter(function(c){
      var inst = INST[c.instId] || {};
      return active.indexOf(inst.type || 'research') !== -1;
    });

    var html = '<div style="padding:24px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    html += '<h2 style="margin:0;color:var(--text1,#f1f5f9);font-size:1.3rem">New Contacts <span style="background:#334155;color:#94a3b8;border-radius:99px;padding:2px 10px;font-size:.8rem;margin-left:8px">' + pending.length + '</span></h2>';
    if (pending.length > 0) {
      html += '<button onclick="window._nlAcceptAll()" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-weight:600">Accept All</button>';
    }
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">';
    typeOrder.forEach(function(t) {
      var tm = TM[t]; var on = active.indexOf(t) !== -1;
      html += '<button onclick="window._nlToggleT('' + t + '')" style="border-radius:99px;padding:5px 14px;font-size:.82rem;font-weight:600;cursor:pointer;border:2px solid ' + tm.color + ';background:' + (on ? tm.color : 'transparent') + ';color:' + (on ? '#fff' : tm.color) + '">' + tm.label + '</button>';
    });
    html += '</div>';
    if (filtered.length === 0) {
      html += '<div style="text-align:center;padding:48px;color:#64748b">' + (pending.length > 0 ? 'No contacts match the active filters.' : 'No pending contacts.') + '</div>';
    } else {
      html += '<div style="display:grid;gap:12px">';
      filtered.forEach(function(c) {
        var inst = INST[c.instId] || {name: c.instId || 'Unknown', type:'research'};
        var tm = TM[inst.type] || TM.research;
        html += '<div style="background:var(--surface2,#1e293b);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;border:1px solid #334155">';
        html += '<div style="flex:1">';
        html += '<div style="font-weight:700;color:var(--text1,#f1f5f9);font-size:1rem">' + c.first + ' ' + c.last + '</div>';
        html += '<div style="color:#94a3b8;font-size:.85rem;margin:2px 0">' + (c.title || '') + '</div>';
        html += '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
        html += '<span style="background:' + tm.bg + ';color:' + tm.color + ';border-radius:99px;padding:2px 10px;font-size:.75rem;font-weight:700;border:1px solid ' + tm.color + '">' + tm.label + '</span>';
        html += '<span style="color:#cbd5e1;font-size:.85rem">' + inst.name + '</span>';
        html += '</div></div>';
        html += '<div style="display:flex;gap:8px">';
        html += '<button onclick="window._nlAccept('' + c.id + '')" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:.85rem">Accept</button>';
        html += '<button onclick="window._nlDiscard('' + c.id + '')" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:.85rem">Discard</button>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';
    var content = document.getElementById('content');
    if (content) content.innerHTML = html;
  }

  window._nlAccept = function(id) {
    var pending = getP(), contacts = getC();
    var idx = pending.findIndex(function(c){ return c.id === id; });
    if (idx === -1) return;
    var c = pending.splice(idx, 1)[0];
    var inst = INST[c.instId] || {name: c.instId || 'Unknown', type:'research'};
    c.institution = inst.name; c.type = inst.type;
    if (!contacts.find(function(x){ return x.id === c.id; })) contacts.push(c);
    saveP(pending); saveC(contacts); render();
  };
  window._nlDiscard = function(id) {
    saveP(getP().filter(function(c){ return c.id !== id; })); render();
  };
  window._nlAcceptAll = function() {
    var pending = getP(), contacts = getC();
    pending.forEach(function(c) {
      var inst = INST[c.instId] || {name: c.instId || 'Unknown', type:'research'};
      c.institution = inst.name; c.type = inst.type;
      if (!contacts.find(function(x){ return x.id === c.id; })) contacts.push(c);
    });
    saveP([]); saveC(contacts); render();
  };
  window._nlToggleT = function(t) {
    var active = getT(), i = active.indexOf(t);
    if (i === -1) active.push(t); else active.splice(i, 1);
    saveT(active); render();
  };

  function wrapNav() {
    if (!window.nav || window._nlNavWrapped) return;
    var orig = window.nav;
    window.nav = function(section) {
      orig(section);
      if (section === 'pending') setTimeout(render, 350);
    };
  }

  function init() { wrapNav(); render(); }
  if (window.nav) { init(); }
  else {
    var _at = 0, _pi = setInterval(function(){
      if (window.nav || ++_at > 30) { clearInterval(_pi); init(); }
    }, 150);
  }
  console.log('[NL CRM] animations.js fallback renderer v1 loaded');
})();
