/* ═══════════════════════════════════════════════════════════════════════
   SAHASRA VASTRA · AGE PICKER, OFF THE PRODUCT PAGE

   The product page has asked "what size are you shopping for?" since the
   Sep 2026 rebuild, and pre-selects the answer on every design after.
   But a parent arriving from search or Instagram lands on a SHELF, not a
   garment, and was asked nothing — they scrolled past every size until
   they found their own. This asks the same question there, and answers
   it by moving them to the shelf that fits.

   One store, shared with the product page: localStorage `sv_age` holds
   the label ("6–9 m") because sv-product.js parses labels; `sv_age_tag`
   holds the tag ("age-6-9m") because URLs are built from tags. Answering
   in either place is answering once.

   ── Where the links come from ─────────────────────────────────────────
   Never built here. The chip rows rendered by sv-age-bands already hold
   correctly composed tag URLs — they keep the garment type, they keep the
   sort — so "show my size" looks up the chip for the chosen tag and
   follows it. Only when this shelf has no such chip does it fall back to
   the band's own collection, which Admin's menu supplies.

   Progressive: with the script blocked the chips still work and the
   dialog simply never opens.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  const dialog = document.querySelector('dialog[data-sv-age]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const KEY = 'sv_age';
  const TAG_KEY = 'sv_age_tag';
  const SKIP_KEY = 'sv_age_skip';

  /* Every read and write is guarded: private windows and blocked site
     data throw on access, and nothing here may break a shelf. */
  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* storage unavailable: the choice simply does not persist */
    }
  };

  let bands = [];
  try {
    bands = JSON.parse(dialog.dataset.bands || '[]');
  } catch {
    bands = [];
  }
  const byLabel = new Map(bands.map((b) => [b.label, b]));

  const activeTag = dialog.dataset.activeTag || '';
  const isCollection = dialog.dataset.page === 'collection';

  /* The chip for a tag, if this shelf offers it. `[href]` matters: a size
     nothing is made in is rendered as a <span>, and following it would
     drop the shopper back to the unfiltered shelf. */
  const bandChip = (tag) => {
    if (!tag) return null;
    try {
      return document.querySelector(`a.sv-bands__chip[data-sv-band-tag="${CSS.escape(tag)}"]`);
    } catch {
      return null;
    }
  };

  /* ── the dialog ───────────────────────────────────────────────────── */
  const chips = Array.from(dialog.querySelectorAll('[data-sv-age-band]'));
  const ok = dialog.querySelector('[data-sv-age-ok]');
  let chosen = read(KEY);

  const paintChips = () => {
    chips.forEach((c) => {
      const on = c.dataset.svAgeBand === chosen;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-checked', String(on));
    });
    if (ok) ok.disabled = !chosen;
  };

  chips.forEach((c) =>
    c.addEventListener('click', () => {
      chosen = c.dataset.svAgeBand;
      paintChips();
    })
  );

  const open = () => {
    chosen = read(KEY);
    paintChips();
    dialog.showModal();
  };

  /* ── the line that reports the answer back ────────────────────────── */
  const line = document.querySelector('[data-sv-age-now]');
  const lineLabel = document.querySelector('[data-sv-age-now-label]');
  const lineApply = document.querySelector('[data-sv-age-apply]');

  const paintLine = () => {
    if (!line) return;
    const label = read(KEY);
    if (!label) {
      line.hidden = true;
      return;
    }
    if (lineLabel) lineLabel.textContent = label;
    line.hidden = false;

    /* "Show only this size" appears only when it would do something: an
       age is stored, this shelf carries it, and the shelf is not already
       narrowed to it. */
    if (lineApply) {
      const band = byLabel.get(label);
      const chip = band && band.tag !== activeTag ? bandChip(band.tag) : null;
      if (chip) {
        lineApply.href = chip.getAttribute('href');
        lineApply.hidden = false;
      } else {
        lineApply.hidden = true;
      }
    }
  };

  /* ── answering ────────────────────────────────────────────────────── */
  ok?.addEventListener('click', () => {
    if (!chosen) return;
    write(KEY, chosen);
    write(SKIP_KEY, null);
    const band = byLabel.get(chosen);
    write(TAG_KEY, band ? band.tag : null);
    dialog.close();

    const chip = bandChip(band && band.tag);
    if (chip) {
      window.location.href = chip.getAttribute('href');
      return;
    }
    /* No chip row here — a type shelf like Rompers & Onesies. If this
       shelf carries the size, narrow IT rather than leaving for the age
       collection: the parent asked for rompers in 6–9 m, not for every
       garment in 6–9 m. */
    const shelfUrl = dialog.dataset.shelfUrl || '';
    let shelfTags = [];
    try {
      shelfTags = JSON.parse(dialog.dataset.shelfTags || '[]');
    } catch {
      shelfTags = [];
    }
    if (isCollection && shelfUrl && band && band.tag !== activeTag && shelfTags.includes(band.tag)) {
      window.location.href = shelfUrl + '/' + band.tag;
      return;
    }
    /* This shelf is not made in that size. Rather than show them a shelf
       that cannot answer, move to the band's own collection — but only
       from a collection: doing it from a search results page would throw
       away what they searched for. */
    if (isCollection && band && band.url && band.tag !== activeTag) {
      window.location.href = band.url;
      return;
    }
    paintLine();
  });

  dialog.querySelectorAll('[data-sv-age-all]').forEach((b) =>
    b.addEventListener('click', () => {
      /* "Show all sizes" is an answer too: never ask again this visit
         run, but keep any age they had set before. */
      write(SKIP_KEY, '1');
      dialog.close();
    })
  );

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* Delegated, because the line is painted after this runs and a shelf
     re-renders its rows through the Section Rendering API. */
  document.addEventListener('click', (e) => {
    const trigger = e.target instanceof Element ? e.target.closest('[data-sv-age-open]') : null;
    if (!trigger) return;
    e.preventDefault();
    open();
  });

  /* Arriving on a size-filtered shelf IS an answer — they clicked a chip,
     or followed a link someone sent them. Record it rather than asking a
     question they have just finished answering. */
  if (activeTag) {
    const band = bands.find((b) => b.tag === activeTag);
    if (band && read(KEY) !== band.label) {
      write(KEY, band.label);
      write(TAG_KEY, band.tag);
    }
  }

  paintLine();

  /* ── when to ask unprompted ───────────────────────────────────────── */
  if (dialog.dataset.ask !== 'true' || read(KEY) || read(SKIP_KEY) === '1' || activeTag) return;

  /* A beat after load, so the shelf is seen first — the dialog should
     read as help, not as a wall. Never on top of Shopify's cookie
     banner: a first visit would otherwise stack two dialogs. The banner
     script can inject after this runs, so look again shortly before
     deciding. */
  const later = () =>
    setTimeout(() => {
      if (!read(KEY)) open();
    }, 900);

  const bannerUp = (el) => el && getComputedStyle(el).display !== 'none';

  setTimeout(() => {
    const banner = document.getElementById('shopify-pc__banner');
    if (!bannerUp(banner)) {
      later();
      return;
    }
    /* Hidden (style change) or removed (childList) — watch both. */
    const watch = new MutationObserver(() => {
      if (bannerUp(banner)) return;
      watch.disconnect();
      later();
    });
    watch.observe(banner, { attributes: true, attributeFilter: ['style', 'class'] });
    if (banner.parentNode) watch.observe(banner.parentNode, { childList: true });
  }, 600);
})();
