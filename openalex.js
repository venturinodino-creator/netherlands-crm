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


// ── Inline pending contacts renderer (works regardless of discovery.js version) ──
(function() {
  var INST={cwi:{name:'Centrum Wiskunde & Informatica',type:'research'},esc:{name:'Netherlands eScience Center',type:'research'},pbl:{name:'PBL Netherlands Environmental Assessment Agency',type:'research'},rathenau:{name:'Rathenau Instituut',type:'research'},uva:{name:'University of Amsterdam',type:'university'},vu:{name:'VU Amsterdam',type:'university'},uu:{name:'Utrecht University',type:'university'},tue:{name:'Eindhoven University of Technology',type:'university'},tud:{name:'TU Delft',type:'university'},rug:{name:'University of Groningen',type:'university'},um:{name:'Maastricht University',type:'university'},lei:{name:'Leiden University',type:'university'},eur:{name:'Erasmus University Rotterdam',type:'university'},utwente:{name:'University of Twente',type:'university'},wur:{name:'Wageningen University & Research',type:'university'},ou:{name:'Open Universiteit',type:'university'},tilburg:{name:'Tilburg University',type:'university'},amc:{name:'Amsterdam UMC',type:'medical'},erasmusmc:{name:'Erasmus MC',type:'medical'},umcg:{name:'UMCG',type:'medical'},umcutrecht:{name:'UMC Utrecht',type:'medical'},mumc:{name:'Maastricht UMC+',type:'medical'},radboudumc:{name:'Radboud UMC',type:'medical'},lumc:{name:'Leiden UMC',type:'medical'},knaw:{name:'KNAW',type:'ngo'},nwo:{name:'NWO',type:'ngo'},zonmw:{name:'ZonMw',type:'ngo'}};
  var TM={university:{label:'University',color:'#8b5cf6',bg:'#1e1b4b'},medical:{label:'Medical Center',color:'#ef4444',bg:'#1f1010'},research:{label:'Research',color:'#06b6d4',bg:'#0c1a1f'},ngo:{label:'NGO / Foundation',color:'#10b981',bg:'#0d1f18'}};
  function getP(){try{return JSON.parse(localStorage.getItem('nl_crm_pending')||'[]')}catch{return[]}}
  function getC(){try{return JSON.parse(localStorage.getItem('nl_crm_contacts')||'[]')}catch{return[]}}
  function getT(){try{return JSON.parse(localStorage.getItem('nl_crm_stype')||'["research"]')}catch{return['research']}}
  function saveP(l){localStorage.setItem('nl_crm_pending',JSON.stringify(l))}
  function saveC(l){localStorage.setItem('nl_crm_contacts',JSON.stringify(l))}
  function saveT(t){localStorage.setItem('nl_crm_stype',JSON.stringify(t))}

  function render(){
    var title=document.getElementById('page-title');
    if(!title||!title.textContent.includes('New Contact'))return;
    var content=document.getElementById('content');if(!content)return;
    var pending=getP(),selTypes=getT(),allTypes=['university','medical','research','ngo'];
    var pills=allTypes.map(function(t){var m=TM[t],a=selTypes.indexOf(t)!==-1;return'<button onclick="window._oaNL.toggleT(''+t+'')" style="border:2px solid '+(a?m.color:'rgba(255,255,255,0.15)')+';background:'+(a?m.bg:'transparent')+';color:'+(a?m.color:'#94a3b8')+';border-radius:20px;padding:6px 16px;cursor:pointer;font-size:13px;font-weight:600;margin:0 8px 8px 0">'+m.label+'</button>';}).join('');
    var fbar='<div style="margin-bottom:20px"><p style="color:#94a3b8;font-size:13px;margin:0 0 10px">Filter next scrape by institution type:</p><div style="display:flex;flex-wrap:wrap;align-items:center">'+pills+'<button onclick="window._oaNL.saveCfg()" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:6px 16px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:8px">Save to scraper</button></div></div>';
    if(!pending.length){content.innerHTML='<div style="padding:24px">'+fbar+'<p style="color:#94a3b8">No pending contacts. Next scrape: 07:00 UTC.</p></div>';return;}
    var hdr='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="color:#e2e8f0;margin:0">'+pending.length+' New Contact'+(pending.length!==1?'s':'')+'</h2><button onclick="window._oaNL.acceptAll()" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:14px;font-weight:700;box-shadow:0 4px 15px rgba(16,185,129,0.3)">✓ Accept All ('+pending.length+')</button></div>';
    var cards=pending.map(function(c){var inst=INST[c.instId]||{},tm=TM[inst.type]||{label:'Unknown',color:'#94a3b8',bg:'#1a1a1a'},iname=inst.name||c.instId||'Unknown';return'<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="color:#e2e8f0;font-size:16px;font-weight:600">'+c.first+' '+c.last+'</div><div style="color:#94a3b8;font-size:13px;margin-top:3px">'+(c.title||'')+(c.dept?' · '+c.dept:'')+'</div></div><div style="background:'+tm.bg+';border:1px solid '+tm.color+'40;border-radius:6px;padding:4px 10px;text-align:right"><div style="color:'+tm.color+';font-size:10px;font-weight:700;text-transform:uppercase">'+tm.label+'</div><div style="color:#e2e8f0;font-size:12px;font-weight:600;margin-top:2px">'+iname+'</div></div></div>'+(c.email?'<div style="color:#6ee7b7;font-size:13px;margin-bottom:10px">✉ '+c.email+'</div>':'')+'<div style="display:flex;gap:10px"><button onclick="window._oaNL.accept(''+c.id+'')" style="background:#10b981;color:white;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">✓ Accept</button><button onclick="window._oaNL.discard(''+c.id+'')" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px">✕ Discard</button></div></div>';}).join('');
    content.innerHTML='<div style="padding:24px">'+hdr+fbar+cards+'</div>';
  }

  window._oaNL={
    accept:function(id){var p=getP(),idx=p.findIndex(function(c){return c.id===id;});if(idx===-1)return;var c=p.splice(idx,1)[0],inst=INST[c.instId]||{},contacts=getC();contacts.push(Object.assign({},c,{institution:inst.name||c.instId||'',addedAt:new Date().toISOString()}));saveC(contacts);saveP(p);try{if(typeof loadPendingCount==='function')loadPendingCount();}catch(_){}render();},
    discard:function(id){saveP(getP().filter(function(c){return c.id!==id;}));render();},
    acceptAll:function(){var p=getP();if(!p.length)return;var contacts=getC(),emails=new Set(contacts.map(function(c){return(c.email||'').toLowerCase();}).filter(Boolean)),names=new Set(contacts.map(function(c){return(c.first+' '+c.last).toLowerCase().trim();}).filter(Boolean));p.forEach(function(c){var el=(c.email||'').toLowerCase().trim(),nl=(c.first+' '+c.last).toLowerCase().trim();if(el&&emails.has(el))return;if(names.has(nl))return;var inst=INST[c.instId]||{};contacts.push(Object.assign({},c,{institution:inst.name||c.instId||'',addedAt:new Date().toISOString()}));emails.add(el);names.add(nl);});saveC(contacts);saveP([]);try{if(typeof loadPendingCount==='function')loadPendingCount();}catch(_){}render();},
    toggleT:function(t){var types=getT(),idx=types.indexOf(t);if(idx===-1)types.push(t);else if(types.length>1)types.splice(idx,1);saveT(types);render();},
    saveCfg:function(){try{if(typeof toast==='function')toast('Scraper will target: '+getT().join(', '),'ok');}catch(_){}},
  };

  function wrapNav(){
    if(!window.nav||window._oaNLWrapped)return;
    window._oaNLWrapped=true;
    var orig=window.nav;
    window.nav=function(s){orig(s);if(s==='pending')setTimeout(render,350);};
  }

  var attempts=0,poll=setInterval(function(){
    if(window.nav||++attempts>40){clearInterval(poll);wrapNav();render();}
  },100);
})();


// ── Pending contacts renderer (fallback when discovery.js v3 not yet deployed) ──
(function() {
  // Skip if discovery.js v3 already handled this
  if (window._nlNavWrapped) return;

  var INST = {cwi:{name:'Centrum Wiskunde & Informatica',type:'research'},esc:{name:'Netherlands eScience Center',type:'research'},pbl:{name:'PBL Netherlands Environmental Assessment Agency',type:'research'},rathenau:{name:'Rathenau Instituut',type:'research'},uva:{name:'University of Amsterdam',type:'university'},vu:{name:'VU Amsterdam',type:'university'},uu:{name:'Utrecht University',type:'university'},tue:{name:'Eindhoven University of Technology',type:'university'},tud:{name:'TU Delft',type:'university'},rug:{name:'University of Groningen',type:'university'},um:{name:'Maastricht University',type:'university'},lei:{name:'Leiden University',type:'university'},eur:{name:'Erasmus University Rotterdam',type:'university'},utwente:{name:'University of Twente',type:'university'},wur:{name:'Wageningen University & Research',type:'university'},ou:{name:'Open Universiteit',type:'university'},tilburg:{name:'Tilburg University',type:'university'},amc:{name:'Amsterdam UMC',type:'medical'},erasmusmc:{name:'Erasmus MC',type:'medical'},umcg:{name:'UMCG',type:'medical'},umcutrecht:{name:'UMC Utrecht',type:'medical'},mumc:{name:'Maastricht UMC+',type:'medical'},radboudumc:{name:'Radboud UMC',type:'medical'},lumc:{name:'Leiden UMC',type:'medical'},knaw:{name:'Royal Netherlands Academy of Arts and Sciences (KNAW)',type:'ngo'},nwo:{name:'Netherlands Organisation for Scientific Research (NWO)',type:'ngo'},zonmw:{name:'ZonMw',type:'ngo'}};
  var TM = {university:{label:'University',color:'#8b5cf6',bg:'#1e1b4b'},medical:{label:'Medical Center',color:'#ef4444',bg:'#1f1010'},research:{label:'Research',color:'#06b6d4',bg:'#0c1a1f'},ngo:{label:'NGO / Foundation',color:'#10b981',bg:'#0d1f18'}};
  function gP(){try{return JSON.parse(localStorage.getItem('nl_crm_pending')||'[]');}catch(e){return[];}}
  function gC(){try{return JSON.parse(localStorage.getItem('nl_crm_contacts')||'[]');}catch(e){return[];}}
  function gT(){try{return JSON.parse(localStorage.getItem('nl_crm_stype')||'["research"]');}catch(e){return['research'];}}
  function sP(l){localStorage.setItem('nl_crm_pending',JSON.stringify(l));}
  function sC(l){localStorage.setItem('nl_crm_contacts',JSON.stringify(l));}
  function sT(t){localStorage.setItem('nl_crm_stype',JSON.stringify(t));}
  function render(){
    var title=document.getElementById('page-title');
    if(!title||!title.textContent.includes('New Contact'))return;
    var content=document.getElementById('content');if(!content)return;
    var pending=gP(),selTypes=gT(),allTypes=['university','medical','research','ngo'];
    var pills=allTypes.map(function(t){var m=TM[t],active=selTypes.indexOf(t)!==-1;return'<button onclick="window._oaNL.toggleT(''+t+'')" style="border:2px solid '+(active?m.color:'rgba(255,255,255,0.15)')+';background:'+(active?m.bg:'transparent')+';color:'+(active?m.color:'#94a3b8')+';border-radius:20px;padding:6px 16px;cursor:pointer;font-size:13px;font-weight:600;margin:0 8px 8px 0">'+m.label+'</button>';}).join('');
    var filterBar='<div style="margin-bottom:20px"><p style="color:#94a3b8;font-size:13px;margin:0 0 10px">Filter next scrape by institution type:</p><div style="display:flex;flex-wrap:wrap;align-items:center">'+pills+'<button onclick="window._oaNL.saveCfg()" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:6px 16px;cursor:pointer;font-size:13px;font-weight:600;margin-bottom:8px">Save to scraper</button></div></div>';
    if(!pending.length){content.innerHTML='<div style="padding:24px">'+filterBar+'<p style="color:#94a3b8">No pending contacts. Next scrape runs at 07:00 UTC.</p></div>';return;}
    var header='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px"><h2 style="color:#e2e8f0;margin:0">'+pending.length+' New Contact'+(pending.length!==1?'s':'')+'</h2><button onclick="window._oaNL.acceptAll()" style="background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:14px;font-weight:700">Accept All ('+pending.length+')</button></div>';
    var cards=pending.map(function(c){var inst=INST[c.instId]||{},tm=TM[inst.type]||{label:'Unknown',color:'#94a3b8',bg:'#1a1a1a'},iname=inst.name||c.instId||'Unknown';return'<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="color:#e2e8f0;font-size:16px;font-weight:600">'+c.first+' '+c.last+'</div><div style="color:#94a3b8;font-size:13px;margin-top:3px">'+(c.title||'')+(c.dept?' - '+c.dept:'')+'</div></div><div style="background:'+tm.bg+';border:1px solid '+tm.color+'40;border-radius:6px;padding:4px 10px;text-align:right"><div style="color:'+tm.color+';font-size:10px;font-weight:700;text-transform:uppercase">'+tm.label+'</div><div style="color:#e2e8f0;font-size:12px;font-weight:600;margin-top:2px">'+iname+'</div></div></div>'+(c.email?'<div style="color:#6ee7b7;font-size:13px;margin-bottom:10px">✉ '+c.email+'</div>':'')+'<div style="display:flex;gap:10px"><button onclick="window._oaNL.accept(''+c.id+'')" style="background:#10b981;color:white;border:none;border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px;font-weight:600">✓ Accept</button><button onclick="window._oaNL.discard(''+c.id+'')" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3);border-radius:6px;padding:7px 16px;cursor:pointer;font-size:13px">✕ Discard</button></div></div>';}).join('');
    content.innerHTML='<div style="padding:24px">'+header+filterBar+cards+'</div>';
  }
  window._oaNL = {
    accept: function(id){var p=gP(),idx=p.findIndex(function(c){return c.id===id;});if(idx===-1)return;var contact=p.splice(idx,1)[0],inst=INST[contact.instId]||{},contacts=gC();contacts.push(Object.assign({},contact,{institution:inst.name||contact.instId||'',addedAt:new Date().toISOString()}));sC(contacts);sP(p);try{if(typeof loadPendingCount==='function')loadPendingCount();}catch(e){}render();},
    discard: function(id){sP(gP().filter(function(c){return c.id!==id;}));render();},
    acceptAll: function(){var p=gP();if(!p.length)return;var contacts=gC(),emails=new Set(contacts.map(function(c){return(c.email||'').toLowerCase();}).filter(Boolean)),names=new Set(contacts.map(function(c){return(c.first+' '+c.last).toLowerCase().trim();}).filter(Boolean));p.forEach(function(c){var el=(c.email||'').toLowerCase().trim(),nl=(c.first+' '+c.last).toLowerCase().trim();if(el&&emails.has(el))return;if(names.has(nl))return;var inst=INST[c.instId]||{};contacts.push(Object.assign({},c,{institution:inst.name||c.instId||'',addedAt:new Date().toISOString()}));emails.add(el);names.add(nl);});sC(contacts);sP([]);try{if(typeof loadPendingCount==='function')loadPendingCount();}catch(e){}render();},
    toggleT: function(t){var types=gT(),idx=types.indexOf(t);if(idx===-1){types.push(t);}else if(types.length>1){types.splice(idx,1);}sT(types);render();},
    saveCfg: function(){try{if(typeof toast==='function')toast('Scraper will target: '+gT().join(', '),'ok');}catch(e){}}
  };
  function wrapNav(){if(!window.nav||window._nlNavWrapped||window._oaNLWrapped)return;window._oaNLWrapped=true;var orig=window.nav;window.nav=function(s){orig(s);if(s==='pending')setTimeout(render,350);};}
  var _att=0,_poll=setInterval(function(){if(window.nav||++_att>40){clearInterval(_poll);if(!window._nlNavWrapped){wrapNav();render();}}},100);
})();
