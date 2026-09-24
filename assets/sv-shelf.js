/* ═══════════════════════════════════════════════════════════════════════
   SAHASRA VASTRA · PRODUCT SHELVES
   "You may also like" (sv-recommendations) and "Recently viewed"
   (sv-recently-viewed), plus the arrows both share.

   Recommendations are Shopify's own: the section renders itself through
   /recommendations/products?section_id=…, the pattern Shopify documents
   and the reason lillywhale's links carry pr_* tracking parameters — the
   recommendation engine learns from those clicks. Nothing here guesses.

   Recently viewed reads localStorage `sv_recent` (written by
   sv-product.js), newest first, and asks /products/{handle}.js for each.
   A product that has since been unpublished simply 404s and drops out.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  const root = window.Shopify?.routes?.root || '/';

  function init(scope) {
    scope.querySelectorAll('[data-sv-recs]').forEach(loadRecs);
    scope.querySelectorAll('[data-sv-recent]').forEach(loadRecent);
    scope.querySelectorAll('[data-sv-shelf]').forEach(bindArrows);
  }

  document.addEventListener('shopify:section:load', (e) => init(e.target));
  init(document);


  /* ── ranking ────────────────────────────────────────────────────────
     Shopify's engine answers "what else do people look at with this?",
     which is a good question and the wrong order: the first card should
     be something this shopper can actually buy, in the size they are
     shopping for. So the returned set is re-ordered here, never
     truncated — a shelf that hides everything is worse than one that
     shows the right things first.

     What it scores on, in the order it matters:
       · the chosen size, IN STOCK        (+4)   — the whole point
       · the chosen size, sold out        (+1)   — right garment, wrong day
       · same type: sleepsuit ↔ sleepsuit (+2)
       · a shared gender tag              (+1.5) — only when both carry one
       · a shared type-* tag              (+1)
       · price within 40% either way      (+0.5) — a ₹249 shopper is not
                                                   answered with ₹2,000
       · nothing available at all         (−4)   — last, never removed

     The size comes from the stepper on this page first (what they are
     looking at now) and from the stored answer second (what they told
     the age picker). Neither existing is fine: the shelf then keeps
     Shopify's own order, which is what it always was.
  ── */
  const SIZE_KEY = 'sv_age';

  const readSize = () => {
    try {
      return localStorage.getItem(SIZE_KEY) || '';
    } catch {
      return '';
    }
  };

  /* "6–9 m", "6-9m", "6–9 M" are one size. Compared on digits and the
     unit alone so a label typed either way still matches a variant. */
  const sizeKey = (text) =>
    String(text || '')
      .toLowerCase()
      .replace(/[–—]/g, '-')
      .replace(/\s+/g, '')
      .replace(/months?|mos?\b/g, 'm')
      .replace(/years?|yrs?\b/g, 'y');

  const listOf = (value) =>
    String(value || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

  const genderOf = (tags) => tags.find((t) => t.toLowerCase().startsWith('gender-')) || '';

  function currentSize(shelf) {
    /* What the stepper says, if this page has one. */
    const on = document.querySelector('[data-sv-size].is-on');
    const live = on ? (on.dataset.title || on.textContent) : '';
    return sizeKey(live) || sizeKey(readSize());
  }

  function rankShelf(shelf) {
    const row = shelf.querySelector('[data-sv-shelf-row]');
    if (!row) return;
    const cards = Array.from(row.querySelectorAll('[data-sv-card]'));
    if (cards.length < 2) return;

    const want = currentSize(shelf);
    const ctxType = (shelf.dataset.ctxType || '').toLowerCase();
    const ctxTags = listOf(shelf.dataset.ctxTags);
    const ctxGender = genderOf(ctxTags);
    const ctxTypeTags = ctxTags.filter((t) => t.toLowerCase().startsWith('type-'));
    const ctxPrice = Number(shelf.dataset.ctxPrice || 0);

    const scored = cards.map((card, i) => {
      const tags = listOf(card.dataset.tags);
      const all = listOf(card.dataset.sizes).map(sizeKey);
      const live = listOf(card.dataset.sizesLive).map(sizeKey);
      let score = 0;

      if (want) {
        if (live.includes(want)) score += 4;
        else if (all.includes(want)) score += 1;
      }
      if (ctxType && (card.dataset.type || '').toLowerCase() === ctxType) score += 2;

      const gender = genderOf(tags);
      if (ctxGender && gender && gender.toLowerCase() === ctxGender.toLowerCase()) score += 1.5;

      if (ctxTypeTags.some((t) => tags.includes(t))) score += 1;

      const price = Number(card.dataset.price || 0);
      if (ctxPrice && price && Math.abs(price - ctxPrice) <= ctxPrice * 0.4) score += 0.5;

      if (!live.length) score -= 4;

      /* Shopify's order is the tie-breaker: it knows what sells beside
         what, and this only claims to know about size and kind. */
      return { card, score, i };
    });

    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    scored.forEach(({ card }) => row.appendChild(card));
  }

  /* Changing the size on the page re-ranks the shelves under it. */
  document.addEventListener('sv:size-change', () => {
    document.querySelectorAll('[data-sv-shelf]').forEach(rankShelf);
  });

  /* ── arrows ─────────────────────────────────────────────────────── */
  function bindArrows(shelf) {
    if (shelf.dataset.svArrows) return;
    shelf.dataset.svArrows = '1';
    shelf.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sv-shelf-step]');
      if (!btn) return;
      const row = shelf.querySelector('[data-sv-shelf-row]');
      if (!row) return;
      row.scrollBy({ left: row.clientWidth * Number(btn.dataset.svShelfStep), behavior: 'smooth' });
    });
  }

  /* ── you may also like ──────────────────────────────────────────── */
  async function loadRecs(el) {
    if (el.dataset.svLoaded) return;
    el.dataset.svLoaded = '1';
    try {
      const res = await fetch(el.dataset.url);
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-sv-recs]');
      if (!fresh || !fresh.querySelector('.sv-card')) return;
      el.innerHTML = fresh.innerHTML;
      el.hidden = false;
      bindArrows(el);
      rankShelf(el);
    } catch {
      /* no shelf rather than a broken one */
    }
  }

  /* ── recently viewed ────────────────────────────────────────────── */
  function readList(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  /* /products/{handle}.js returns prices in paise; the Liquid cards use
     the money filter, so this mirrors its "₹449.00" shape. */
  function money(cents) {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: window.Shopify?.currency?.active || 'INR',
        minimumFractionDigits: 2,
      }).format(cents / 100);
    } catch {
      return `₹${(cents / 100).toFixed(2)}`;
    }
  }

  function card(p) {
    const li = document.createElement('li');
    li.className = 'sv-card';
    const a = document.createElement('a');
    a.className = 'sv-card__link';
    a.href = p.url;

    const frame = document.createElement('span');
    frame.className = 'im r-product sv-card__frame';
    if (p.featured_image) {
      const img = document.createElement('img');
      const src = p.featured_image.startsWith('//') ? `https:${p.featured_image}` : p.featured_image;
      const sized = (w) => `${src}${src.includes('?') ? '&' : '?'}width=${w}`;
      img.src = sized(600);
      img.srcset = `${sized(300)} 300w, ${sized(450)} 450w, ${sized(600)} 600w`;
      img.sizes = '(max-width: 760px) 62vw, 300px';
      img.loading = 'lazy';
      img.alt = p.title;
      frame.append(img);
    }

    const name = document.createElement('span');
    name.className = 'sv-card__name';
    name.textContent = p.title;

    const price = document.createElement('span');
    price.className = 'sv-card__price';
    if (p.compare_at_price > p.price) {
      const was = document.createElement('s');
      was.textContent = money(p.compare_at_price);
      price.append(was);
    }
    price.append(money(p.price));

    a.append(frame, name, price);
    li.append(a);
    return li;
  }

  async function loadRecent(el) {
    if (el.dataset.svLoaded) return;
    el.dataset.svLoaded = '1';
    const current = el.dataset.current;
    const max = Number(el.dataset.max) || 8;
    const handles = readList('sv_recent').filter((h) => h && h !== current).slice(0, max);
    if (!handles.length) return;

    const products = await Promise.all(
      handles.map((h) =>
        fetch(`${root}products/${encodeURIComponent(h)}.js`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    );
    const found = products.filter(Boolean);
    if (!found.length) return;

    const row = el.querySelector('[data-sv-shelf-row]');
    if (!row) return;
    found.forEach((p) => row.append(card(p)));
    el.hidden = false;
    bindArrows(el);
  }
})();
