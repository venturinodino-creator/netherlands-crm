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
