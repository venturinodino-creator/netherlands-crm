(function () {
  'use strict';

  var contentEl = document.getElementById('content');
  if (contentEl) {
    var observer = new MutationObserver(function() {
      contentEl.classList.remove('page-enter');
      void contentEl.offsetWidth;
      contentEl.classList.add('page-enter');
      contentEl.addEventListener('animationend', function() {
        contentEl.classList.remove('page-enter');
        staggerCards(contentEl);
      }, { once: true });
    });
    observer.observe(contentEl, { childList: true, subtree: false });
  }

  function staggerCards(root) {
    var selectors = ['.ic','.news-card','.pipeline-card','.stat-card','.dash-widget'];
    selectors.forEach(function(sel) {
      var cards = root.querySelectorAll(sel);
      cards.forEach(function(card, i) {
        for (var n = 1; n <= 12; n++) card.classList.remove('stagger-' + n);
        card.classList.add('stagger-' + Math.min(i + 1, 12));
      });
    });
  }

  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var icon = item.querySelector('.nav-icon-box');
      if (!icon) return;
      icon.style.transition = 'transform .12s';
      icon.style.transform = 'scale(1.25)';
      setTimeout(function() { icon.style.transform = ''; }, 180);
    });
  });

  var statObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      var el = m.target.closest('.stat-value,.stat-num,h2,.text-2xl');
      if (el) {
        el.style.transition = 'transform .18s, color .18s';
        el.style.transform = 'scale(1.08)';
        el.style.color = 'var(--text2)';
        setTimeout(function() { el.style.transform = ''; el.style.color = ''; }, 250);
      }
    });
  });
  document.querySelectorAll('.stat-card').forEach(function(card) {
    statObserver.observe(card, { characterData: true, subtree: true, childList: true });
  });

  document.querySelectorAll('.overlay').forEach(function(overlay) {
    var innerObs = new MutationObserver(function() {
      if (overlay.classList.contains('open')) {
        var modal = overlay.querySelector('.modal');
        if (modal) { modal.style.animation = 'none'; void modal.offsetWidth; modal.style.animation = ''; }
      }
    });
    innerObs.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  });

  setTimeout(function() { if (contentEl) staggerCards(contentEl); }, 120);

})();

/* PENDING CONTACTS RENDERER v3 â data-attribute event delegation, no inline onclick */
(function () {
  'use strict';
  if (window._nlNavWrapped || window._oaNLWrapped) { return; }
  window._oaNLWrapped = true;

  var _curSection = '';

  var INST = {
    cwi:       { name: 'Centrum Wiskunde & Informatica',        type: 'research'   },
    esc:       { name: 'Netherlands eScience Center',            type: 'research'   },
    nwo:       { name: 'NWO - Dutch Research Council',          type: 'research'   },
    knaw:      { name: 'Royal Netherlands Academy',              type: 'research'   },
    nikhef:    { name: 'Nikhef',                                 type: 'research'   },
    deltares:  { name: 'Deltares',                               type: 'research'   },
    tno:       { name: 'TNO',                                    type: 'research'   },
    rathenau:  { name: 'Rathenau Instituut',                     type: 'research'   },
    nivel:     { name: 'NIVEL',                                  type: 'research'   },
    nioo:      { name: 'NIOO-KNAW',                              type: 'ngo'        },
    naturalis: { name: 'Naturalis Biodiversity Center',          type: 'ngo'        },
    uu:        { name: 'Utrecht University',                     type: 'university' },
    uva:       { name: 'University of Amsterdam',                type: 'university' },
    tue:       { name: 'Eindhoven University of Technology',     type: 'university' },
    rug:       { name: 'University of Groningen',                type: 'university' },
    ru:        { name: 'Radboud University',                     type: 'university' },
    vu:        { name: 'Vrije Universiteit Amsterdam',           type: 'university' },
    utwente:   { name: 'University of Twente',                   type: 'university' },
    wur:       { name: 'Wageningen University & Research',       type: 'university' },
    um:        { name: 'Maastricht University',                  type: 'university' },
    lu:        { name: 'Leiden University',                      type: 'university' },
    tud:       { name: 'Delft University of Technology',         type: 'university' },
    umcu:      { name: 'UMC Utrecht',                            type: 'medical'    },
    amc:       { name: 'Amsterdam UMC',                          type: 'medical'    },
    radboudumc:{ name: 'Radboud UMC',                            type: 'medical'    },
    erasmusumc:{ name: 'Erasmus MC',                             type: 'medical'    },
    mumc:      { name: 'Maastricht UMC+',                        type: 'medical'    },
    umcg:      { name: 'UMC Groningen',                          type: 'medical'    },
    lumc:      { name: 'Leiden UMC',                             type: 'medical'    }
  };

  var TM = {
    university: { label: 'University',       color: '#8b5cf6', bg: '#1e1b4b' },
    medical:    { label: 'Medical Center',   color: '#ef4444', bg: '#1f1010' },
    research:   { label: 'Research',         color: '#06b6d4', bg: '#0c1a1f' },
    ngo:        { label: 'NGO / Foundation', color: '#10b981', bg: '#0d1f18' }
  };
  var typeOrder = ['university', 'medical', 'research', 'ngo'];

  function getP() { try { return JSON.parse(localStorage.getItem('nl_crm_pending') || '[]'); } catch(e) { return []; } }
  function getC() { try { return JSON.parse(localStorage.getItem('nl_crm_contacts') || '[]'); } catch(e) { return []; } }
  function getT() { try { return JSON.parse(localStorage.getItem('nl_crm_filter_types') || '["research","university","medical","ngo"]'); } catch(e) { return ['research','university','medical','ngo']; } }
  function saveP(l) { localStorage.setItem('nl_crm_pending', JSON.stringify(l)); }
  function saveC(l) { localStorage.setItem('nl_crm_contacts', JSON.stringify(l)); }
  function saveT(t) { localStorage.setItem('nl_crm_filter_types', JSON.stringify(t)); }

  window._nlAccept = function(id) {
    var p = getP(), c = getC();
    var idx = p.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return;
    var contact = p.splice(idx, 1)[0];
    var inst = INST[contact.instId] || { name: contact.instId || 'Unknown', type: 'research' };
    contact.institution = inst.name; contact.type = inst.type;
    if (!c.find(function(x) { return x.id === contact.id; })) c.push(contact);
    saveP(p); saveC(c); render();
  };

  window._nlDiscard = function(id) {
    saveP(getP().filter(function(c) { return c.id !== id; }));
    render();
  };

  window._nlAcceptAll = function() {
    var p = getP(), c = getC();
    p.forEach(function(contact) {
      var inst = INST[contact.instId] || { name: contact.instId || 'Unknown', type: 'research' };
      contact.institution = inst.name; contact.type = inst.type;
      if (!c.find(function(x) { return x.id === contact.id; })) c.push(contact);
    });
    saveP([]); saveC(c); render();
  };

  window._nlToggleT = function(t) {
    var a = getT(), i = a.indexOf(t);
    if (i === -1) a.push(t); else a.splice(i, 1);
    saveT(a); render();
  };

  function render() {
    if (_curSection !== 'pending') return;
    var content = document.getElementById('content');
    if (!content) return;

    var pending = getP(), active = getT();
    var filtered = pending.filter(function(c) {
      var inst = INST[c.instId] || {};
      return active.indexOf(inst.type || 'research') !== -1;
    });

    var html = '<div style="padding:24px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    html += '<h2 style="margin:0;color:var(--text1,#f1f5f9);font-size:1.3rem">New Contacts ';
    html += '<span style="background:#334155;color:#94a3b8;border-radius:99px;padding:2px 10px;font-size:.8rem;margin-left:8px">' + pending.length + '</span></h2>';
    if (pending.length > 0) {
      html += '<button data-action="accept-all" style="background:#6366f1;color:#fff;border:none;border-radius:8px;padding:8px 18px;cursor:pointer;font-weight:600">Accept All</button>';
    }
    html += '</div>';

    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">';
    typeOrder.forEach(function(t) {
      var tm = TM[t], on = active.indexOf(t) !== -1;
      html += '<button data-toggle="' + t + '" style="border-radius:99px;padding:5px 14px;font-size:.82rem;font-weight:600;cursor:pointer;';
      html += 'border:2px solid ' + tm.color + ';background:' + (on ? tm.color : 'transparent') + ';color:' + (on ? '#fff' : tm.color) + '">' + tm.label + '</button>';
    });
    html += '</div>';

    if (filtered.length === 0) {
      var msg = pending.length > 0 ? 'No contacts match the active filters.' : 'No pending contacts. Click Find contacts now to discover new ones.';
      html += '<div style="text-align:center;padding:48px;color:#64748b">' + msg + '</div>';
    } else {
      html += '<div style="display:grid;gap:12px">';
      filtered.forEach(function(c) {
        var inst = INST[c.instId] || { name: c.instId || 'Unknown', type: 'research' };
        var tm = TM[inst.type] || TM.research;
        html += '<div style="background:var(--surface2,#1e293b);border-radius:12px;padding:16px 20px;display:flex;align-items:center;gap:16px;border:1px solid #334155">';
        html += '<div style="flex:1">';
        html += '<div style="font-weight:700;color:var(--text1,#f1f5f9)">' + (c.first || '') + ' ' + (c.last || '') + '</div>';
        html += '<div style="color:#94a3b8;font-size:.85rem">' + (c.title || '') + '</div>';
        html += '<div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">';
        html += '<span style="background:' + tm.bg + ';color:' + tm.color + ';border-radius:99px;padding:2px 10px;font-size:.75rem;font-weight:700;border:1px solid ' + tm.color + '">' + tm.label + '</span>';
        html += '<span style="color:#cbd5e1;font-size:.85rem">' + inst.name + '</span>';
        html += '</div></div>';
        html += '<div style="display:flex;gap:8px">';
        html += '<button data-accept="' + c.id + '" style="background:#10b981;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:.85rem">Accept</button>';
        html += '<button data-discard="' + c.id + '" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:6px 14px;cursor:pointer;font-weight:600;font-size:.85rem">Discard</button>';
        html += '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    content.innerHTML = html;

    content.addEventListener('click', function(e) {
      var tgt = e.target;
      if (tgt.dataset.action === 'accept-all') { window._nlAcceptAll(); }
      else if (tgt.dataset.accept)  { window._nlAccept(tgt.dataset.accept); }
      else if (tgt.dataset.discard) { window._nlDiscard(tgt.dataset.discard); }
      else if (tgt.dataset.toggle)  { window._nlToggleT(tgt.dataset.toggle); }
    });
  }

  function wrapNav() {
    if (!window.nav || window._nlNavWrapped) return;
    var orig = window.nav;
    window.nav = function(section, extra) {
      _curSection = section;
      orig(section, extra);
      if (section === 'pending') setTimeout(render, 350);
    };
    window._nlNavWrapped = true;
  }

  function init() {
    var header = document.querySelector('h1,h2,.page-title');
    if (header && header.textContent.indexOf('New Contact') !== -1) _curSection = 'pending';
    wrapNav();
    if (_curSection === 'pending') render();
  }

  if (window.nav) { init(); }
  else {
    var _at = 0;
    var _pi = setInterval(function() {
      if (window.nav || ++_at > 30) { clearInterval(_pi); init(); }
    }, 150);
  }

  console.log('[NL CRM] animations.js renderer v3 loaded');
})();
