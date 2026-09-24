/* ═══════════════════════════════════════════════════════════════════════
   SAHASRA VASTRA · PRODUCT
   Behaviour for sections/sv-product.liquid.

   Four jobs, and deliberately no more: size selection, the quantity
   stepper, add-to-cart, and revealing the mobile bar.

   NO SCROLL LISTENERS. The bar is driven by an IntersectionObserver on
   the real Add button, per the theme's performance rule — scroll events
   fire dozens of times a second on the main thread and that is exactly
   what INP measures.

   ── Nothing here is load-bearing for the sale ──────────────────────────
   The page is a working product page with this file removed: the form is
   a real <form> posting to /cart/add, the first available variant is
   already selected server-side, the WhatsApp href already carries that
   size, and every expander is a <details>. This file upgrades that — it
   never enables it.

   ── Why the cart imports are dynamic ───────────────────────────────────
   @shopify/events resolves to a Shopify CDN URL in the importmap. A
   static import would make this whole module fail to evaluate if that
   request is blocked, taking size selection down with it. It is imported
   at the moment of the add instead, and a failure there falls back to a
   native form submit, which still adds the item.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  document.querySelectorAll('[data-sv-pdp]').forEach(setup);

  /* The theme editor replaces a section's markup in place. A module is
     only evaluated once per URL, so without this the re-rendered section
     would come back with no handlers bound and the merchant would think
     the page had broken. */
  document.addEventListener('shopify:section:load', (event) => {
    event.target.querySelectorAll?.('[data-sv-pdp]').forEach(setup);
  });

  /** @param {Element} root */
  function setup(root) {
    /* Guard against a second pass over the same DOM — section:load can
       fire for an ancestor that already contains a bound root. */
    if (root.dataset.svBound === 'true') return;
    const form = root.querySelector('[data-sv-pdp-form]');
    if (!form) return;
    root.dataset.svBound = 'true';

    const variantInput = form.querySelector('[data-sv-variant-input]');
    const sizes = Array.from(root.querySelectorAll('[data-sv-size]'));
    const addButton = root.querySelector('[data-sv-add]');
    const addLabel = root.querySelector('[data-sv-add-label]');
    const priceEl = root.querySelector('[data-sv-price]');
    /* The MRP line now lives in its own section below the shelves
       (sv-product-record), outside this root — look for it page-wide. */
    const mrpEl = root.querySelector('[data-sv-mrp]') || document.querySelector('[data-sv-mrp]');
    const waLink = root.querySelector('[data-sv-wa]');
    const errorEl = root.querySelector('[data-sv-error]');
    const bar = root.querySelector('[data-sv-bar]');
    const barPrice = root.querySelector('[data-sv-bar-price]');
    const barLabel = root.querySelector('[data-sv-bar-label]');
    const barAdd = root.querySelector('[data-sv-bar-add]');
    const qtyInput = form.querySelector('[data-sv-qty-input]');
    const barSize = root.querySelector('[data-sv-bar-size]');

    /* ── size selection ─────────────────────────────────────────────
       A sold-out size is selectable on purpose: choosing it is how a
       visitor finds out it is gone, and the Add button answers in the
       same beat. Hiding it would read as a size that was never made. */
    sizes.forEach((button) => {
      button.addEventListener('click', () => select(button));
    });

    /* Arrow keys across the radiogroup, which role="radio" promises. */
    sizes.forEach((button, index) => {
      button.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = sizes[(index + step + sizes.length) % sizes.length];
        next.focus();
        select(next);
      });
    });

    /** @param {Element} button */
    function select(button) {
      const id = button.dataset.variantId;
      const available = button.dataset.available === 'true';

      sizes.forEach((other) => {
        const on = other === button;
        other.classList.toggle('is-on', on);
        other.setAttribute('aria-checked', String(on));
        other.tabIndex = on ? 0 : -1;
      });

      if (variantInput) variantInput.value = id;

      /* The shelves below rank on the size being looked at, so the
         selection is announced rather than read out of the DOM by
         another script. */
      document.dispatchEvent(
        new CustomEvent('sv:size-change', {
          detail: { label: (button.dataset.title || button.textContent || '').trim(), available },
        })
      );

      if (priceEl) {
        priceEl.textContent = button.dataset.price || '';
        if (button.dataset.compare) {
          const was = document.createElement('s');
          was.className = 'sv-pdp__was';
          was.textContent = button.dataset.compare;
          priceEl.append(was);
        }
      }

      if (barPrice) barPrice.textContent = button.dataset.price || '';
      if (mrpEl) mrpEl.textContent = `${button.dataset.price} inclusive of all taxes`;

      if (addButton) addButton.disabled = !available;
      if (barAdd) barAdd.disabled = !available;
      const label = available ? 'Add to bag' : 'Sold out';
      if (addLabel) addLabel.textContent = label;
      if (barLabel) barLabel.textContent = label;

      /* Light the matching row of the measurement table. This is the one
         piece of motion on the page that carries meaning: it ties the
         size you picked to the numbers that justify it. */
      root.querySelectorAll('[data-sv-row]').forEach((row) => {
        row.classList.toggle('is-on', row.dataset.svRow === id);
      });

      /* The WhatsApp prefill names the size, so the reply can be
         specific rather than asking which one you meant. */
      if (waLink) {
        const parts = [`Hi, I'd like to ask about ${waLink.dataset.waProduct} (${button.dataset.title})`];
        if (waLink.dataset.waCode) parts.push(`, design ${waLink.dataset.waCode}`);
        /* The page link rides along (owner's direction), pinned to the
           chosen size, so a forwarded message still opens the right one. */
        const link = waLink.dataset.waUrl ? ` ${waLink.dataset.waUrl}?variant=${id}` : '';
        waLink.href = waLink.dataset.waBase + encodeURIComponent(`${parts.join('')}.${link}`);
      }

      if (barSize && barSize.value !== id) barSize.value = id;

      /* Keep the URL shareable and the back button honest. */
      const url = new URL(window.location.href);
      url.searchParams.set('variant', id);
      window.history.replaceState({}, '', url);

      hideError();
    }

    /* ── quantity ───────────────────────────────────────────────────*/
    form.querySelectorAll('[data-sv-qty]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!qtyInput) return;
        const next = (parseInt(qtyInput.value, 10) || 1) + Number(button.dataset.svQty);
        qtyInput.value = String(Math.max(1, next));
      });
    });

    /* ── add to cart ────────────────────────────────────────────────*/
    form.addEventListener('submit', onSubmit);

    function onSubmit(event) {
      /* preventDefault has to happen in this tick — the browser does not
         wait for a promise before navigating, so anything awaited before
         it would let the native POST fire first and the page reload out
         from under the drawer. */
      event.preventDefault();
      if (addButton?.disabled) return;

      /* form.submit() does not re-fire this handler, so the fallback is a
         plain POST to /cart/add and never a loop. The sale completes
         either way; only the drawer is lost. */
      addToCart().catch(() => form.submit());
    }

    async function addToCart() {
      const [events, utilities] = await Promise.all([
        import('@shopify/events'),
        import('@theme/utilities'),
      ]);

      const { CartLinesUpdateEvent } = events;
      const { fetchConfig } = utilities;

      const formData = new FormData(form);
      const quantity = Number(formData.get('quantity')) || 1;

      /* Ask for the cart sections back in the same round trip, the way
         Horizon's own product form does — otherwise the drawer has to
         make a second request to render what was just added. */
      const sectionIds = [];
      document.querySelectorAll('cart-items-component[data-section-id]').forEach((node) => {
        sectionIds.push(node.dataset.sectionId);
      });
      if (sectionIds.length) formData.append('sections', sectionIds.join(','));

      setBusy(true);
      hideError();

      /* The drawer opens on this event and waits on the promise, so it is
         dispatched BEFORE the request — the panel opens immediately and
         fills when the cart comes back, rather than after a blank beat. */
      const deferred = CartLinesUpdateEvent.createPromise();
      form.dispatchEvent(
        new CartLinesUpdateEvent({
          action: 'add',
          context: 'product',
          lines: [{ merchandiseId: String(formData.get('id')), quantity }],
          promise: deferred.promise,
        })
      );

      const config = fetchConfig('javascript', { body: formData });

      try {
        const response = await fetch(form.action, config);
        const payload = await response.json();

        /* Whether the add succeeded or Shopify refused it, the drawer is
           already open and waiting on this promise — so the real cart is
           fetched either way and the panel shows what is actually in it,
           never a line that was not added. */
        const root = window.Shopify?.routes?.root || '/';
        const cart = await fetch(`${root}cart.js`).then((r) => r.json());
        const didError = Boolean(payload.status);

        if (didError) {
          /* Shopify answers an oversell or a vanished variant with a
             status field rather than a failed request. */
          showError(payload.description || payload.message);
        }

        deferred.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
          detail: {
            didError,
            items: cart.items,
            source: 'sv-product',
            itemCount: didError ? 0 : quantity,
            sections: payload.sections,
          },
        });
      } catch (error) {
        /* Leave the drawer's listener settled before the outer catch
           hands the sale back to a native POST. */
        deferred.reject(error);
        throw error;
      } finally {
        setBusy(false);
      }
    }

    function setBusy(busy) {
      [addButton, barAdd].forEach((button) => {
        if (!button) return;
        button.setAttribute('aria-busy', String(busy));
      });
    }

    function showError(message) {
      if (!errorEl || !message) return;
      /* Unhide BEFORE writing: a role="status" region that is still
         hidden when its text changes is not announced at all. */
      errorEl.hidden = false;
      errorEl.textContent = message;
    }

    function hideError() {
      if (!errorEl) return;
      errorEl.hidden = true;
      errorEl.textContent = '';
    }

    /* ── the mobile bar ─────────────────────────────────────────────
       Up once the real Add button has left the viewport, down again when
       it returns. IntersectionObserver, never a scroll listener. */
    if (bar && addButton) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          bar.hidden = entry.isIntersecting;
        },
        { rootMargin: '0px 0px -10% 0px' }
      );
      observer.observe(addButton);
    }

    /* Roving tabindex: only the checked size is in the tab order, which
       is what a radiogroup promises a keyboard user. */
    sizes.forEach((button) => {
      button.tabIndex = button.classList.contains('is-on') ? 0 : -1;
    });

    /* The bar's select is a second handle on the SAME buttons. */
    barSize?.addEventListener('change', () => {
      const match = sizes.find((b) => b.dataset.variantId === barSize.value);
      if (match) select(match);
    });

    /* Size chart: every [data-sv-chart-open] opens the one dialog. */
    const chart = root.querySelector('[data-sv-chart]');
    if (chart) {
      root.querySelectorAll('[data-sv-chart-open]').forEach((b) =>
        b.addEventListener('click', () => chart.showModal())
      );
      chart.addEventListener('click', (e) => { if (e.target === chart) chart.close(); });
    }

    /* The Size guide is a closed <details> in the column now. Any link
       to it — the sizing note under the gallery — opens it before the
       browser scrolls there, so the jump lands on the table, not on a
       shut bar. */
    const measure = root.querySelector('[data-sv-measure]');
    if (measure) {
      const openMeasure = () => {
        measure.open = true;
      };
      root.querySelectorAll(`a[href="#${CSS.escape(measure.id)}"]`).forEach((a) =>
        a.addEventListener('click', openMeasure)
      );
      if (window.location.hash === `#${measure.id}`) openMeasure();
    }

    setupGallery(root);
    setupShare(root);
    setupSave(root);
    setupAge(root, sizes, select);
    rememberViewed(root);
  }

  /* ── storage ──────────────────────────────────────────────────────
     Every read and write is guarded: private windows and blocked site
     data throw on access, and none of these features may break the
     page when storage is unavailable. */
  function readList(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      /* storage unavailable: the feature simply does not persist */
    }
  }

  function readValue(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeValue(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }

  /* ── gallery ──────────────────────────────────────────────────────
     The track is a native scroll-snap row; everything here only moves
     it. Active index comes from an IntersectionObserver over the
     slides, so a swipe, a thumb, an arrow and the keyboard all agree. */
  function setupGallery(root) {
    const gal = root.querySelector('[data-sv-gal]');
    const track = gal?.querySelector('[data-sv-gal-track]');
    if (!gal || !track) return;
    const slides = Array.from(track.querySelectorAll('[data-sv-gal-slide]'));
    if (!slides.length) return;
    const thumbs = Array.from(gal.querySelectorAll('[data-sv-gal-thumb]'));
    const indexEl = gal.querySelector('[data-sv-gal-index]');
    let current = 0;

    const goTo = (i) => {
      const next = (i + slides.length) % slides.length;
      track.scrollTo({ left: slides[next].offsetLeft - track.offsetLeft, behavior: 'smooth' });
    };

    /* A product video plays only while its slide is the one on screen,
       and never under reduced motion (its controls are still there). */
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const playOnly = (i) => {
      slides.forEach((slide, n) => {
        const video = slide.querySelector('video');
        if (!video) return;
        if (n === i && !still) video.play().catch(() => {});
        else video.pause();
      });
    };

    const mark = (i) => {
      current = i;
      playOnly(i);
      thumbs.forEach((t, n) => {
        const on = n === i;
        t.classList.toggle('is-on', on);
        if (on) t.setAttribute('aria-current', 'true');
        else t.removeAttribute('aria-current');
      });
      if (indexEl) indexEl.textContent = String(i + 1);
    };

    const seen = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) mark(slides.indexOf(entry.target));
        });
      },
      { root: track, threshold: 0.6 }
    );
    slides.forEach((s) => seen.observe(s));

    thumbs.forEach((t) => t.addEventListener('click', () => goTo(Number(t.dataset.svGalThumb))));
    gal.querySelectorAll('[data-sv-gal-step]').forEach((b) =>
      b.addEventListener('click', () => goTo(current + Number(b.dataset.svGalStep)))
    );
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
    });

    /* Hover zoom: a lens over the photo, the magnified crop in a pane
       laid over the decision column. Fine pointers only — on touch the
       browser's own pinch-zoom is the better tool. */
    const lens = gal.querySelector('[data-sv-gal-lens]');
    const pane = gal.querySelector('[data-sv-gal-zoom]');
    if (!lens || !pane || !window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 881px)').matches) return;
    const ZOOM = 2.5;

    slides.forEach((slide) => {
      const frame = slide.querySelector('.im');
      if (!frame || !frame.querySelector('img')) return;

      frame.addEventListener('pointerenter', () => {
        /* Two layers: the 2400px rendition on top, the photo already on
           screen beneath it. The pane is never blank while the big file
           downloads — it starts soft and sharpens in place. */
        const shown = frame.querySelector('img')?.currentSrc;
        pane.style.backgroundImage = shown
          ? `url("${slide.dataset.zoom}"), url("${shown}")`
          : `url("${slide.dataset.zoom}")`;
        pane.hidden = false;
        lens.hidden = false;
      });
      frame.addEventListener('pointerleave', () => {
        pane.hidden = true;
        lens.hidden = true;
      });
      frame.addEventListener('pointermove', (e) => {
        /* A pointermove can land while the lens is still hidden (before
           pointerenter, or after leave), when offsetParent is null — so
           measure against the stage element itself. */
        if (lens.hidden) return;
        const box = frame.getBoundingClientRect();
        const stage = (lens.parentElement || frame).getBoundingClientRect();
        const lw = box.width / ZOOM;
        const lh = box.height / ZOOM;
        const x = Math.min(Math.max(e.clientX - box.left - lw / 2, 0), box.width - lw);
        const y = Math.min(Math.max(e.clientY - box.top - lh / 2, 0), box.height - lh);
        lens.style.width = `${lw}px`;
        lens.style.height = `${lh}px`;
        lens.style.transform = `translate(${box.left - stage.left + x}px, ${box.top - stage.top + y}px)`;
        pane.style.backgroundSize = `${box.width * ZOOM}px ${box.height * ZOOM}px`;
        pane.style.backgroundPosition = `${-x * ZOOM}px ${-y * ZOOM}px`;
      });
    });
  }

  /* ── share ────────────────────────────────────────────────────────
     Phones get the native share sheet; everything else gets the menu.
     The menu's links are real hrefs, so they work if this never runs. */
  function setupShare(root) {
    const panel = root.querySelector('[data-sv-share]');
    const openers = root.querySelectorAll('[data-sv-share-open]');
    if (!panel || !openers.length) return;
    const copy = panel.querySelector('[data-sv-share-copy]');
    const copyLabel = panel.querySelector('[data-sv-share-copy-label]');
    let opener = null;

    const close = () => {
      panel.hidden = true;
      opener?.setAttribute('aria-expanded', 'false');
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', esc);
    };
    const outside = (e) => {
      if (!panel.contains(e.target) && !opener?.contains(e.target)) close();
    };
    const esc = (e) => {
      if (e.key === 'Escape') { close(); opener?.focus(); }
    };

    const currentUrl = () => window.location.href;

    openers.forEach((button) => {
      button.addEventListener('click', async () => {
        const touch = window.matchMedia('(pointer: coarse)').matches;
        if (touch && navigator.share) {
          try {
            await navigator.share({ title: document.title, url: currentUrl() });
          } catch {
            /* dismissed — nothing to do */
          }
          return;
        }
        if (!panel.hidden && opener === button) { close(); return; }
        opener = button;
        /* Anchor the panel under whichever button opened it. Unhidden
           first: a display:none element has no offsetParent to measure. */
        panel.hidden = false;
        const col = panel.offsetParent?.getBoundingClientRect();
        const b = button.getBoundingClientRect();
        if (col) {
          panel.style.top = `${b.bottom - col.top + 8}px`;
          panel.style.left = `${Math.max(0, Math.min(b.right - col.left - panel.offsetWidth, col.width - panel.offsetWidth))}px`;
        }
        button.setAttribute('aria-expanded', 'true');
        document.addEventListener('pointerdown', outside, true);
        document.addEventListener('keydown', esc);
        panel.querySelector('a, button')?.focus();
      });
    });

    /* Keep shared links pinned to the chosen size. */
    panel.querySelectorAll('[data-sv-share-link]').forEach((a) => {
      a.addEventListener('click', () => {
        const url = currentUrl();
        const kind = a.dataset.svShareLink;
        const title = document.querySelector('.sv-pdp__title')?.textContent?.trim() || document.title;
        const enc = encodeURIComponent;
        if (kind === 'whatsapp') a.href = `https://wa.me/?text=${enc(`${title} ${url}`)}`;
        if (kind === 'facebook') a.href = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
        if (kind === 'email') a.href = `mailto:?subject=${enc(title)}&body=${enc(url)}`;
        if (kind === 'pinterest') a.href = a.href.replace(/url=[^&]*/, `url=${enc(url)}`);
      });
    });

    copy?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentUrl());
        if (copyLabel) copyLabel.textContent = 'Link copied';
      } catch {
        if (copyLabel) copyLabel.textContent = 'Copy failed';
      }
      setTimeout(() => { if (copyLabel) copyLabel.textContent = 'Copy link'; }, 2000);
    });
  }

  /* ── save (device wishlist) ───────────────────────────────────────*/
  function setupSave(root) {
    const button = root.querySelector('[data-sv-save]');
    if (!button) return;
    const handle = button.dataset.handle;
    const label = button.querySelector('[data-sv-save-label]');
    const paint = () => {
      const on = readList('sv_saved').includes(handle);
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('is-on', on);
      if (label) label.textContent = on ? 'Wishlisted' : 'Wishlist';
      button.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Add to wishlist');
    };
    button.addEventListener('click', () => {
      const list = readList('sv_saved').filter((h) => h !== handle);
      if (button.getAttribute('aria-pressed') !== 'true') list.unshift(handle);
      writeList('sv_saved', list.slice(0, 60));
      paint();
      document.dispatchEvent(new CustomEvent('sv:saved-change', { detail: { count: list.length } }));
    });
    paint();
  }

  /* ── age picker ───────────────────────────────────────────────────
     Band strings like "6–9 m" or "2–3 y" become a month range; the
     size whose range CONTAINS the band's start wins, so a design cut
     "6-12m" answers a "6–9 m" parent. Nothing matched is said aloud
     rather than silently picking the nearest size. */
  function parseBand(text) {
    const t = String(text).toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, '');
    const years = /y/.test(t);
    const nums = t.match(/\d+(\.\d+)?/g);
    if (!nums) return null;
    const k = years ? 12 : 1;
    return { from: Number(nums[0]) * k, to: Number(nums[nums.length - 1]) * k };
  }

  function setupAge(root, sizes, select) {
    if (!sizes.length) return;
    const dialog = root.querySelector('[data-sv-age]');
    const now = root.querySelector('[data-sv-age-now]');
    const nowLabel = root.querySelector('[data-sv-age-now-label]');

    const apply = (band) => {
      if (!band) {
        if (now) now.hidden = true;
        return;
      }
      if (now && nowLabel) { nowLabel.textContent = band; now.hidden = false; }
      const want = parseBand(band);
      if (!want) return;
      const fits = sizes.filter((b) => {
        const from = Number(b.dataset.from);
        const to = Number(b.dataset.to);
        return want.from >= from && want.from < to;
      });
      /* No matching size: leave the selection alone. The greyed stops
         on the stepper already show the design is not made for that age
         (the owner removed the explanatory box, Sep 2026). */
      const pick = fits.find((b) => b.dataset.available === 'true') || fits[0];
      if (pick) select(pick);
    };

    const stored = readValue('sv_age');
    const params = new URLSearchParams(window.location.search);
    if (stored && !params.has('variant')) apply(stored);
    else if (stored && now && nowLabel) { nowLabel.textContent = stored; now.hidden = false; }

    if (!dialog) return;
    const chips = Array.from(dialog.querySelectorAll('[data-sv-age-band]'));
    const ok = dialog.querySelector('[data-sv-age-ok]');
    let chosen = stored;

    const paintChips = () => {
      chips.forEach((c) => {
        const on = c.dataset.svAgeBand === chosen;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-checked', String(on));
      });
      if (ok) ok.disabled = !chosen;
    };
    chips.forEach((c) => c.addEventListener('click', () => { chosen = c.dataset.svAgeBand; paintChips(); }));

    const open = () => { chosen = readValue('sv_age'); paintChips(); dialog.showModal(); };

    ok?.addEventListener('click', () => {
      writeValue('sv_age', chosen);
      writeValue('sv_age_skip', null);
      dialog.close();
      apply(chosen);
    });
    dialog.querySelectorAll('[data-sv-age-all]').forEach((b) =>
      b.addEventListener('click', () => {
        /* "Show all sizes" is an answer too: never ask again this visit
           run, but keep any age they had set before. */
        writeValue('sv_age_skip', '1');
        dialog.close();
      })
    );
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    root.querySelectorAll('[data-sv-age-open]').forEach((b) => b.addEventListener('click', open));

    /* When to ask unprompted: no age yet, not skipped, no size in the
       link, and not arriving from one of the age collections. */
    const skip = (dialog.dataset.skipCollections || '').split(',').map((s) => s.trim()).filter(Boolean);
    let fromAge = false;
    try {
      const ref = new URL(document.referrer);
      fromAge = ref.origin === window.location.origin && skip.some((h) => ref.pathname.includes(`/collections/${h}`));
    } catch {
      /* no referrer */
    }
    const inAgePath = skip.some((h) => window.location.pathname.includes(`/collections/${h}/`));
    if (!stored && readValue('sv_age_skip') !== '1' && !params.has('variant') && !fromAge && !inAgePath) {
      /* A beat after load, so the page is seen first — the popup should
         read as help, not as a wall. Never on top of Shopify's cookie
         banner: a first visit would otherwise stack two dialogs. If the
         banner is up, wait for it to be answered, then ask. */
      const later = () => setTimeout(() => { if (!readValue('sv_age')) open(); }, 900);
      const bannerUp = () => {
        const b = document.getElementById('shopify-pc__banner');
        return b && getComputedStyle(b).display !== 'none';
      };
      /* The banner script can inject after this runs, so look again
         shortly before deciding. */
      setTimeout(() => {
        const b = document.getElementById('shopify-pc__banner');
        if (!bannerUp()) { later(); return; }
        /* Hidden (style change) or removed (childList) — watch both. */
        const watch = new MutationObserver(() => {
          if (bannerUp()) return;
          watch.disconnect();
          later();
        });
        watch.observe(b, { attributes: true, attributeFilter: ['style', 'class'] });
        if (b.parentNode) watch.observe(b.parentNode, { childList: true });
      }, 600);
    }
  }

  /* ── recently viewed ──────────────────────────────────────────────
     Handles only, newest first, capped. sv-recently-viewed.liquid
     reads the same key and renders the shelf. */
  function rememberViewed(root) {
    const handle = root.querySelector('[data-sv-save]')?.dataset.handle;
    if (!handle) return;
    const list = readList('sv_recent').filter((h) => h !== handle);
    list.unshift(handle);
    writeList('sv_recent', list.slice(0, 12));
  }
})();
