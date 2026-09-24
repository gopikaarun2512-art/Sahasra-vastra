/* ═══════════════════════════════════════════════════════════════════════
   SAHASRA VASTRA · MOTION
   One file. Every page consumes it. No page defines its own behaviour.

   NO SCROLL LISTENERS ANYWHERE. Scroll events fire dozens of times a
   second on the main thread, and that is exactly what INP measures.
   Everything below is IntersectionObserver.

   Markup contract — a page opts in with attributes, never with new JS:
     .rv                       reveal once
     .ln > span                line reveal (by LINE only)
     .mask                     masked image reveal, one per page
     .tilt                     pointer tilt, desktop only
     [data-pin]                pinned sequence root
       [data-pin-vis="n"]        visual for step n
       [data-pin-step="n"]       copy for step n
       [data-pin-sentinel="n"]   full-viewport sentinel for step n
       .pin__bar i               progress ticks
     [data-wardrobe]           CSS 3D doors, opens once after paint
     [data-carousel]           perspective carousel
       .card3                    cards
       [data-carousel-prev/next] controls
       .pips i                   indicators
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* ── reveals · fire once, then stop observing ───────────────────────── */
  const revealer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      revealer.unobserve(entry.target);
    });
  }, { threshold: .14, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.rv, .ln, .mask').forEach(el => revealer.observe(el));

  /* ── header scroll state · sentinel, never a scroll listener ────────── */
  const header = document.querySelector('[data-header]');
  const headerSentinel = document.querySelector('[data-header-sentinel]');
  if (header && headerSentinel) {
    new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-solid', !entry.isIntersecting);
    }, { rootMargin: '-40px 0px 0px 0px' }).observe(headerSentinel);
  }

  /* ── pinned sequences · one observer per root ───────────────────────── */
  document.querySelectorAll('[data-pin]').forEach(root => {
    const visuals   = [...root.querySelectorAll('[data-pin-vis]')];
    const steps     = [...root.querySelectorAll('[data-pin-step]')];
    const ticks     = [...root.querySelectorAll('.pin__bar i')];
    const sentinels = [...root.querySelectorAll('[data-pin-sentinel]')];
    if (!sentinels.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const i = +entry.target.dataset.pinSentinel;
        visuals.forEach((el, n) => el.classList.toggle('on', n === i));
        steps.forEach((el, n)   => el.classList.toggle('on', n === i));
        ticks.forEach((el, n)   => el.classList.toggle('on', n <= i));
      });
    }, { rootMargin: '-50% 0px -50% 0px' });

    sentinels.forEach(el => observer.observe(el));
  });

  /* ── wardrobe · opens once, AFTER the hero image has painted ─────────
     The hero is the LCP element. Animating its arrival delays the metric
     Google measures, so the doors wait for paint before moving. */
  document.querySelectorAll('[data-wardrobe]').forEach(el => {
    if (reduced) { el.classList.add('is-open'); return; }
    const delay = +(el.dataset.wardrobe || 450);
    requestAnimationFrame(() => setTimeout(() => el.classList.add('is-open'), delay));
  });

  /* ── pointer tilt · desktop only, capped, transform-only ─────────────── */
  if (finePointer && !reduced) {
    const CAP = 3;
    document.querySelectorAll('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.classList.add('is-live');
        el.style.setProperty('--ry', (((e.clientX - r.left) / r.width  - .5) *  CAP).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (((e.clientY - r.top)  / r.height - .5) * -CAP).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-live');
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ── perspective carousel · manual only, never auto-advancing ───────── */
  document.querySelectorAll('[data-carousel]').forEach(root => {
    const cards = [...root.querySelectorAll('.card3')];
    const pips  = [...root.querySelectorAll('.pips i')];
    const prev  = root.querySelector('[data-carousel-prev]');
    const next  = root.querySelector('[data-carousel-next]');
    if (cards.length < 2) return;
    let current = Math.min(1, cards.length - 1);

    const place = () => {
      cards.forEach((card, i) => {
        const offset = i - current;
        card.dataset.pos = offset === 0 ? '0' : offset === -1 ? '-1' : offset === 1 ? '1' : 'hide';
        /* off-centre cards are hidden from screen readers, or all three
           are announced as one run-on paragraph */
        card.setAttribute('aria-hidden', offset === 0 ? 'false' : 'true');
      });
      pips.forEach((pip, i) => pip.classList.toggle('on', i === current));
    };

    const step = dir => { current = (current + dir + cards.length) % cards.length; place(); };
    place();
    prev && prev.addEventListener('click', () => step(-1));
    next && next.addEventListener('click', () => step(1));
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft')  step(-1);
    });
  });
})();
