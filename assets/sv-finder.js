/* ═══════════════════════════════════════════════════════════════════════
   SAHASRA VASTRA · PRODUCTS FINDER
   "Products" → how old? → the categories made in that age → (sub-
   categories) → the shelf, filtered to that age.

   The popup's contents are sections/sv-finder, fetched through the
   Section Rendering API the first time it opens, so no page pays for the
   counting until someone asks. Everything shown is decided by the counts
   the section rendered: a category (or sub-category, or age) with nothing
   in it is hidden or disabled, never linked to an empty shelf.

   The answer is shared with the age dialog and the product page: the
   label goes to localStorage `sv_age`, the tag to `sv_age_tag`, so a
   parent who picks 6–9 m here finds 6–9 m pre-selected on every design.

   Progressive: every trigger is a real link, so with script off
   "Products" is the Products page and a category tile is its shelf.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  const dialog = document.querySelector('[data-sv-finder-dialog]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const mount = dialog.querySelector('[data-sv-finder-mount]');

  const read = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage unavailable: the choice simply does not persist */
    }
  };

  const state = { gender: '', age: '', ageLabel: '', presetCat: '' };
  let body = null;
  let loading = null;

  const load = () => {
    if (body) return Promise.resolve(body);
    if (loading) return loading;
    loading = fetch(dialog.dataset.src, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const found = doc.querySelector('[data-sv-finder-body]');
        if (!found) throw new Error('finder markup missing');
        mount.replaceChildren(document.importNode(found, true));
        body = mount.querySelector('[data-sv-finder-body]');
        bind();
        return body;
      })
      .catch((err) => {
        loading = null;
        throw err;
      });
    return loading;
  };

  /* ── helpers over the rendered counts ─────────────────────────────── */
  const countsOf = (el) => {
    const key = state.gender === 'gender-girl' ? 'countsGirl' : state.gender === 'gender-boy' ? 'countsBoy' : 'counts';
    try {
      return JSON.parse(el.dataset[key] || '{}');
    } catch {
      return {};
    }
  };
  const countFor = (el, age = state.age) => {
    const c = countsOf(el);
    return (age ? c[age] : c.all) || 0;
  };
  const designs = (n) => `${n} design${n === 1 ? '' : 's'}`;

  const $ = (sel) => body.querySelector(sel);
  const $$ = (sel) => Array.from(body.querySelectorAll(sel));
  const tileFor = (handle) => $$('[data-sv-finder-cat]').find((t) => t.dataset.svFinderCat === handle);

  const show = (step) => {
    $$('[data-step]').forEach((s) => {
      s.hidden = s.dataset.step !== step;
    });
    const h = $(`[data-step="${step}"] .sv-finder__h`);
    h?.focus({ preventScroll: true });
    dialog.querySelector('.sv-finderdlg__panel')?.scrollTo(0, 0);
  };

  /* ── step 1: ages ─────────────────────────────────────────────────── */
  const paintAges = () => {
    const tiles = $$('[data-sv-finder-cat]');
    const preset = state.presetCat ? tileFor(state.presetCat) : null;
    const kicker = $('[data-sv-finder-kicker]');
    if (kicker) {
      kicker.hidden = !preset;
      if (preset) kicker.textContent = preset.dataset.label;
    }
    const stored = read('sv_age_tag');
    $$('.sv-finder__age').forEach((btn) => {
      const age = btn.dataset.age;
      const n = preset ? countFor(preset, age) : tiles.reduce((sum, t) => sum + countFor(t, age), 0);
      /* Only sizes that exist are offered; an empty one is not shown at all. */
      btn.hidden = n === 0;
      btn.disabled = n === 0;
      btn.classList.toggle('is-on', age === stored);
      const note = btn.querySelector('[data-sv-finder-agenote]');
      if (note) note.textContent = preset && n > 0 ? designs(n) : '';
    });
    $$('.sv-finder__segbtn').forEach((b) => {
      const on = b.dataset.gender === state.gender;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
  };

  /* ── step 2: categories ───────────────────────────────────────────── */
  const paintCats = () => {
    let shown = 0;
    $$('[data-sv-finder-cat]').forEach((tile) => {
      const n = countFor(tile);
      tile.closest('[data-cat]').hidden = n === 0;
      const count = tile.querySelector('[data-sv-finder-count]');
      if (count) count.textContent = designs(n);
      if (n > 0) shown += 1;
    });
    const empty = $('[data-sv-finder-empty]');
    if (empty) empty.hidden = shown > 0;
    const now = $('[data-sv-finder-agenow]');
    if (now) now.textContent = state.ageLabel ? `${state.ageLabel} · change` : 'Every age · change';
  };

  /* ── step 3: sub-categories, or straight to the shelf ─────────────── */
  const openCat = (handle) => {
    const tile = tileFor(handle);
    if (!tile) return;
    const list = $(`[data-sv-finder-subs="${CSS.escape(handle)}"]`);
    if (list) {
      let live = 0;
      list.querySelectorAll('[data-sv-finder-go]').forEach((card) => {
        const src = card.dataset.countsFrom ? tileFor(card.dataset.countsFrom) : card;
        const n = src ? countFor(src) : 0;
        card.closest('li').hidden = n === 0;
        if (n > 0 && !card.dataset.countsFrom) live += 1;
      });
      /* Sub-categories only earn a step when at least one has this age;
         otherwise it is one more tap to reach the same shelf. */
      if (live > 0) {
        $$('[data-sv-finder-subs]').forEach((l) => {
          l.hidden = l !== list;
        });
        const head = $('[data-sv-finder-subhead]');
        if (head) head.textContent = tile.dataset.label + (state.ageLabel ? ` · ${state.ageLabel}` : '');
        show('sub');
        return;
      }
    }
    go(tile.dataset.url);
  };

  const go = (url) => {
    const tags = [state.age, state.gender].filter(Boolean);
    window.location.href = tags.length ? `${url}/${tags.join('+')}` : url;
  };

  const chooseAge = (age, label) => {
    state.age = age;
    state.ageLabel = age ? label : '';
    if (age) {
      write('sv_age', label);
      write('sv_age_tag', age);
    }
    if (state.presetCat) {
      openCat(state.presetCat);
      return;
    }
    paintCats();
    show('cat');
  };

  /* ── wiring, once the markup has arrived ──────────────────────────── */
  const bind = () => {
    if (body.querySelector('[data-sv-finder-has-gender]')) {
      const g = $('[data-sv-finder-gender]');
      if (g) g.hidden = false;
    }
    body.addEventListener('click', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t) return;

      const seg = t.closest('.sv-finder__segbtn');
      if (seg) {
        state.gender = seg.dataset.gender;
        paintAges();
        return;
      }
      const age = t.closest('[data-age]');
      if (age && !age.disabled) {
        chooseAge(age.dataset.age, age.dataset.label || '');
        return;
      }
      const back = t.closest('[data-sv-finder-back]');
      if (back) {
        if (back.dataset.svFinderBack === 'age') {
          paintAges();
          show('age');
        } else if (state.presetCat) {
          /* Arrived with a category already chosen: "back" from its
             sub-categories is the age question, not a list they never saw. */
          paintAges();
          show('age');
        } else {
          paintCats();
          show('cat');
        }
        return;
      }
      const cat = t.closest('[data-sv-finder-cat]');
      if (cat) {
        openCat(cat.dataset.svFinderCat);
        return;
      }
      const card = t.closest('[data-sv-finder-go]');
      if (card) go(card.dataset.svFinderGo);
    });
  };

  /* ── opening and closing ──────────────────────────────────────────── */
  const open = (presetCat = '') => {
    state.presetCat = presetCat;
    state.age = '';
    state.ageLabel = '';
    dialog.showModal();
    load()
      .then(() => {
        /* A preset category the finder does not know (not in the menu)
           is not worth asking about — follow the link as if closed. */
        if (presetCat && !tileFor(presetCat)) state.presetCat = '';
        paintAges();
        show('age');
      })
      .catch(() => {
        mount.innerHTML = '<p class="sv-finderdlg__loading" role="status">Sorry — that didn’t load. <a href="/collections/all">See every product</a></p>';
      });
  };

  dialog.querySelector('[data-sv-finder-close]')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  const isProductsLink = (a) => {
    try {
      const u = new URL(a.href, window.location.href);
      return u.origin === window.location.origin && /\/pages\/products\/?$/.test(u.pathname);
    } catch {
      return false;
    }
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t || dialog.contains(t)) return;
    const trigger = t.closest('[data-sv-finder]');
    if (trigger) {
      e.preventDefault();
      trigger.closest('details[open]')?.removeAttribute('open');
      open(trigger.dataset.svFinderCat || '');
      return;
    }
    const a = t.closest('a[href]');
    if (a && isProductsLink(a)) {
      e.preventDefault();
      /* A <details> menu sheet (phone) stays open behind a modal; close it. */
      a.closest('details[open]')?.removeAttribute('open');
      open();
    }
  });

  /* The Products page opens straight into the question. */
  if (document.querySelector('[data-sv-finder-autoopen]')) open();

  /* Warm the fetch on first intent, so the popup opens already filled. */
  const warm = () => load().catch(() => {});
  document.addEventListener(
    'pointerover',
    (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t && (t.closest('[data-sv-finder]') || (t.closest('a[href]') && isProductsLink(t.closest('a[href]'))))) warm();
    },
    { passive: true }
  );
})();
