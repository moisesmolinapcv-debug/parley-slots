/**
 * ============================================================================
 * Parley.com.ve — Slots Catalog Application
 * ============================================================================
 * Vanilla ES6+ module pattern. No frameworks, no dependencies.
 * Loads 2,000 slots from data/slots.json and provides instant client-side
 * filtering, searching, sorting, and pagination.
 * ============================================================================
 */

'use strict';

const SlotsApp = (() => {

  // ─── Constants ───────────────────────────────────────────────────────
  const SLOTS_PER_PAGE = 48;
  const DEBOUNCE_MS = 300;
  const DATA_URL = 'data/slots.json';

  /** Provider raw key → display name */
  const PROVIDER_DISPLAY = {
    pragmaticplay: 'Pragmatic Play',
    Wazdan: 'Wazdan',
    Betsoft: 'Betsoft',
    'Booming Games': 'Booming Games',
    Spinomenal: 'Spinomenal',
    caletagaming: 'Caleta Gaming',
  };

  /** Sort options — value → { label, compareFn } */
  const SORT_OPTIONS = {
    popular: {
      label: 'Más populares',
      compare: (a, b) => b._totalClicks - a._totalClicks,
    },
    'name-asc': {
      label: 'Nombre A-Z',
      compare: (a, b) => a._nameLower.localeCompare(b._nameLower, 'es'),
    },
    'name-desc': {
      label: 'Nombre Z-A',
      compare: (a, b) => b._nameLower.localeCompare(a._nameLower, 'es'),
    },
    recent: {
      label: 'Más recientes',
      compare: (a, b) => b._createdTs - a._createdTs,
    },
  };

  /** Special tags we care about (from game_url segments after the type) */
  const SPECIAL_TAGS = ['Drop&Win', 'Torneo', 'Navidad'];

  // ─── State ───────────────────────────────────────────────────────────
  let allSlots = [];             // original full dataset (enriched)
  let filteredSlots = [];        // current filtered+sorted subset
  let currentPage = 1;

  const filters = {
    search: '',
    category: 'Todos',
    providers: new Set(),        // empty = all
    sort: 'popular',
    tags: new Set(),
  };

  /** Cached DOM references (populated in init) */
  const dom = {};

  /** Device detection — cached once */
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  /** IntersectionObserver for lazy images */
  let imgObserver = null;

  // ─── Utility Helpers ─────────────────────────────────────────────────

  /**
   * Normalize a string for accent-insensitive comparison.
   * "Ángel" → "angel"
   */
  function normalize(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /** Debounce helper */
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  /** Format large numbers with dot separator (Spanish style) */
  function formatNumber(n) {
    return n.toLocaleString('es-VE');
  }

  /**
   * Parse game_url into { type, tags[] }
   * e.g. "Video Slots,H5,Drop&Win" → { type: "Video Slots", tags: ["H5","Drop&Win"] }
   */
  function parseGameUrl(gameUrl) {
    if (!gameUrl) return { type: 'Desconocido', tags: [] };
    const parts = gameUrl.split(',').map((s) => s.trim());
    return {
      type: parts[0] || 'Desconocido',
      tags: parts.slice(1),
    };
  }

  // ─── Data Loading & Enrichment ───────────────────────────────────────

  const SUPABASE_API_URL = "https://zofknbvkoxwoqtrcwpas.supabase.co/rest/v1";
  const SUPABASE_PUBLIC_KEY = "sb_publishable_EilryQ89HDbmfGDWmlKQ1A_Ch-aSEQC";

  /** ⚡ Consulta relámpago a Supabase (~100ms) con Inversión Lógica para activos y site_config */
  async function fetchLiveOverrides() {
    try {
      const headers = { 'apikey': SUPABASE_PUBLIC_KEY, 'Authorization': `Bearer ${SUPABASE_PUBLIC_KEY}` };
      const [resProvActive, resSlotsInactive, resBanners, resConfig] = await Promise.all([
        fetch(`${SUPABASE_API_URL}/providers?is_active=eq.true&select=name,display_name`, { headers }).catch(() => null),
        fetch(`${SUPABASE_API_URL}/slots?is_active=eq.false&select=id,external_id,name`, { headers }).catch(() => null),
        fetch(`${SUPABASE_API_URL}/banners?is_active=eq.true&select=position,title,image_url&order=position.asc`, { headers }).catch(() => null),
        fetch(`${SUPABASE_API_URL}/site_config?select=key,value`, { headers }).catch(() => null)
      ]);

      // ⚡ 1. Proveedores ACTIVOS devueltos por Supabase
      const activeProvs = new Set();
      if (resProvActive && resProvActive.ok) {
        const provData = await resProvActive.json();
        provData.forEach(p => {
          if (p.name) activeProvs.add(p.name.toLowerCase().trim());
          if (p.display_name) activeProvs.add(p.display_name.toLowerCase().trim());
        });
      }

      // ⚡ 2. Coincidencia Triple Redundante (ID DB, External ID, Nombre) para Slots Inactivos
      const inactiveSlotIds = new Set();
      if (resSlotsInactive && resSlotsInactive.ok) {
        const slotData = await resSlotsInactive.json();
        slotData.forEach(s => {
          if (s.id) inactiveSlotIds.add(String(s.id));
          if (s.external_id) inactiveSlotIds.add(String(s.external_id));
          if (s.name) inactiveSlotIds.add(s.name.toLowerCase().trim());
        });
      }

      // ⚡ 3. Banners dinámicos
      if (resBanners && resBanners.ok) {
        const bannerData = await resBanners.json();
        if (Array.isArray(bannerData) && bannerData.length > 0) {
          renderDynamicBanners(bannerData);
        }
      }

      // ⚙️ 4. Configuraciones dinámicas de site_config
      if (resConfig && resConfig.ok) {
        const configList = await resConfig.json();
        if (Array.isArray(configList)) {
          const configMap = {};
          configList.forEach(item => { if (item.key) configMap[item.key] = item.value; });
          applyLiveSiteConfig(configMap);
        }
      }

      return { activeProvs, inactiveSlotIds };
    } catch (e) {
      return { activeProvs: null, inactiveSlotIds: new Set() };
    }
  }

  function applyLiveSiteConfig(configMap) {
    if (configMap.site_title) {
      document.title = configMap.site_title;
    }
    if (configMap.site_description) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.content = configMap.site_description;
      const subTitleEl = document.querySelector('.hero-subtitle') || document.querySelector('.tagline');
      if (subTitleEl) subTitleEl.textContent = configMap.site_description;
    }
    if (configMap.maintenance_mode === 'true') {
      const hero = document.getElementById('heroCarousel');
      if (hero && !document.getElementById('maintenanceBanner')) {
        const m = document.createElement('div');
        m.id = 'maintenanceBanner';
        m.style.cssText = 'background:linear-gradient(90deg, #e51c23, #ff9800); color:#fff; text-align:center; padding:12px; font-weight:800; border-radius:8px; margin-bottom:16px; font-size:14px;';
        m.innerHTML = '⚠️ SITIO EN MANTENIMIENTO TEMPORAL — ALGUNOS JUEGOS PUEDEN NO ESTAR DISPONIBLES';
        hero.parentNode.insertBefore(m, hero);
      }
    }
  }

  /** Renderiza los banners dinámicos desde Supabase DB en la web pública */
  function renderDynamicBanners(banners) {
    const track = document.querySelector('.carousel-track');
    const nav = document.getElementById('carouselNav');
    if (!track) return;

    let slidesHtml = '';
    let dotsHtml = '';

    banners.forEach((b, idx) => {
      const imgUrl = b.image_url || 'BANNER/public.avif';
      slidesHtml += `
        <div class="carousel-slide">
          <img class="carousel-banner-img"
               src="${imgUrl}"
               alt="${b.title || 'Banner Parley'}"
               ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
               decoding="async"
               onerror="this.src='BANNER/public.avif'">
        </div>`;
      dotsHtml += `<div class="carousel-dot ${idx === 0 ? 'active' : ''}" onclick="App.goSlide(${idx})"></div>`;
    });

    track.innerHTML = slidesHtml;
    if (nav) nav.innerHTML = dotsHtml;
  }

  /**
   * Fetch slots, banners and live overrides directly from Supabase DB,
   * enrich each object, and extract unique categories/providers/tags.
   */
  async function loadData() {
    showLoading(true);
    try {
      const headers = { 'apikey': SUPABASE_PUBLIC_KEY, 'Authorization': `Bearer ${SUPABASE_PUBLIC_KEY}` };

      // ⚡ 1. Cargar Banners Dinámicos desde Supabase DB en tiempo real
      fetch(`${SUPABASE_API_URL}/banners?is_active=eq.true&select=position,title,image_url&order=position.asc`, { headers })
        .then(r => r.ok ? r.json() : null)
        .then(bData => { if (Array.isArray(bData) && bData.length > 0) renderDynamicBanners(bData); })
        .catch(() => {});

      // ⚡ 2. Cargar inactividades de Supabase DB en paralelo (~100ms)
      const overridesPromise = fetchLiveOverrides();

      // ⚡ 3. Si SLOTS_INITIAL_DATA existe (Top 40 - 25 KB), inicializar INSTANTÁNEAMENTE en <100ms
      if (typeof window !== 'undefined' && window.SLOTS_INITIAL_DATA && Array.isArray(window.SLOTS_INITIAL_DATA)) {
        const overrides = await overridesPromise;
        allSlots = processRawSlots(window.SLOTS_INITIAL_DATA, overrides);
        buildFilterUI();
        restoreFiltersFromURL();
        applyFilters();
        showLoading(false);
      }

      // ⚡ 4. Cargar dataset completo en segundo plano
      let fullRaw = null;
      if (typeof window !== 'undefined' && window.SLOTS_DATA && Array.isArray(window.SLOTS_DATA)) {
        fullRaw = window.SLOTS_DATA;
      } else {
        const res = await fetch(DATA_URL).catch(() => null);
        if (res && res.ok) {
          fullRaw = await res.json();
        }
      }

      if (fullRaw && Array.isArray(fullRaw) && fullRaw.length > 0) {
        const overrides = await overridesPromise;
        allSlots = processRawSlots(fullRaw, overrides);
        buildFilterUI();
        restoreFiltersFromURL();
        applyFilters();
      }
    } catch (err) {
      console.error('Error en carga progresiva de datos:', err);
    } finally {
      showLoading(false);
    }
  }

  function processRawSlots(raw, overrides = { activeProvs: null, inactiveSlotIds: new Set() }) {
    return raw
      .filter((s) => {
        // 1. Si el slot individual tiene is_active === false
        if (s.is_active === false) return false;
        
        // 2. 🛡️ Coincidencia de 3 Capas para Desactivación Individual de Slots (ID, ExtID, Nombre)
        const slotId = String(s.id || '');
        const extId = String(s.external_id || s.slot_product_id || '');
        const slotName = (s.name || '').toLowerCase().trim();

        if (overrides.inactiveSlotIds && (
            (slotId && overrides.inactiveSlotIds.has(slotId)) ||
            (extId && overrides.inactiveSlotIds.has(extId)) ||
            (slotName && overrides.inactiveSlotIds.has(slotName))
        )) {
          return false;
        }

        // 3. ⚡ INVERSIÓN LÓGICA DE PROVEEDORES: Si se cargaron proveedores activos desde Supabase,
        // el proveedor del slot DEBE pertenecer a esa lista activa. Si NO está, se descarta dinámicamente!
        if (overrides.activeProvs && overrides.activeProvs.size > 0) {
          const provName = (s.provider || '').toLowerCase().trim();
          const provDisp = (s.provider_display || '').toLowerCase().trim();
          const isProvActive = overrides.activeProvs.has(provName) || overrides.activeProvs.has(provDisp);
          if (!isProvActive) return false;
        }

        return true;
      })
      .map((s) => {
        const parsed = parseGameUrl(s.game_url || s.game_url_raw);
        const providerName = s.provider || PROVIDER_DISPLAY[s.provider_raw] || 'Otros';
        const typeName = s.category || parsed.type || 'Video Slots';
        const tagsList = (s.tags && Array.isArray(s.tags) && s.tags.length > 0) ? s.tags : parsed.tags;
        const totalClicks = s.total_clicks !== undefined ? s.total_clicks : ((s.clicks_desktop || 0) + (s.clicks_mobile || 0));

        return {
          ...s,
          provider: providerName,
          _type: typeName,
          _tags: tagsList,
          _totalClicks: totalClicks,
          _nameLower: s.name ? s.name.toLowerCase() : '',
          _nameNorm: s.name ? normalize(s.name) : '',
          _createdTs: s.created_at ? new Date(s.created_at).getTime() : 0,
          _providerDisplay: providerName,
        };
      });
  }

  // ─── Filter UI Construction ──────────────────────────────────────────

  /** Build category pills, provider buttons, sort dropdown, tag toggles */
  function buildFilterUI() {
    // --- Categories ---
    const categories = ['Todos', ...new Set(allSlots.map((s) => s._type))].sort(
      (a, b) => {
        if (a === 'Todos') return -1;
        if (b === 'Todos') return 1;
        return a.localeCompare(b, 'es');
      }
    );

    dom.categoryPills.innerHTML = categories
      .map(
        (cat) =>
          `<button class="pill${cat === 'Todos' ? ' active' : ''}" data-category="${cat}">${cat}</button>`
      )
      .join('');

    // --- Providers ---
    const providerKeys = [...new Set(allSlots.map((s) => s.provider))].sort(
      (a, b) => {
        const da = PROVIDER_DISPLAY[a] || a;
        const db = PROVIDER_DISPLAY[b] || b;
        return da.localeCompare(db, 'es');
      }
    );

    dom.providerFilters.innerHTML =
      `<button class="provider-btn active" data-provider="Todos">Todos</button>` +
      providerKeys
        .map(
          (key) =>
            `<button class="provider-btn" data-provider="${key}">${PROVIDER_DISPLAY[key] || key}</button>`
        )
        .join('');

    // --- Sort dropdown ---
    dom.sortSelect.innerHTML = Object.entries(SORT_OPTIONS)
      .map(
        ([value, { label }]) =>
          `<option value="${value}"${value === 'popular' ? ' selected' : ''}>${label}</option>`
      )
      .join('');

    // --- Tag toggles ---
    dom.tagFilters.innerHTML = SPECIAL_TAGS.map(
      (tag) =>
        `<button class="tag-toggle" data-tag="${tag}">🏷️ ${tag}</button>`
    ).join('');
  }

  // ─── Filtering Engine ────────────────────────────────────────────────

  /**
   * Central filter pipeline — runs through ALL filters in one pass,
   * then sorts the result. ~2ms for 2,000 items on modern hardware.
   */
  function applyFilters() {
    const {
      search,
      category,
      providers,
      sort,
      tags,
    } = filters;

    const searchNorm = normalize(search);
    const hasSearch = searchNorm.length > 0;
    const hasCategory = category !== 'Todos';
    const hasProviders = providers.size > 0;
    const hasTags = tags.size > 0;

    // Single-pass filter
    filteredSlots = allSlots.filter((s) => {
      if (hasSearch && !s._nameNorm.includes(searchNorm)) return false;
      if (hasCategory && s._type !== category) return false;
      if (hasProviders && !providers.has(s.provider)) return false;
      if (hasTags) {
        for (const tag of tags) {
          if (!s._tags.includes(tag)) return false;
        }
      }
      return true;
    });

    // Sort
    const sortOpt = SORT_OPTIONS[sort];
    if (sortOpt) {
      filteredSlots.sort(sortOpt.compare);
    }

    // Reset to page 1 (unless restoring from URL)
    currentPage = Math.min(currentPage, getTotalPages() || 1);

    renderAll();
    syncFiltersToURL();
  }

  // ─── Rendering ───────────────────────────────────────────────────────

  /** Render everything: counter, active chips, grid, pagination */
  function renderAll() {
    renderResultCounter();
    renderActiveFilters();
    renderGrid();
    renderPagination();
  }

  /** "Mostrando X de Y slots" */
  function renderResultCounter() {
    const total = filteredSlots.length;
    const start = total === 0 ? 0 : (currentPage - 1) * SLOTS_PER_PAGE + 1;
    const end = Math.min(currentPage * SLOTS_PER_PAGE, total);

    dom.resultCounter.textContent =
      total === 0
        ? 'No se encontraron slots'
        : `Mostrando ${formatNumber(start)}–${formatNumber(end)} de ${formatNumber(total)} slots`;
  }

  /** Active filter chips with ✕ to remove */
  function renderActiveFilters() {
    const chips = [];

    if (filters.search) {
      chips.push(
        makeChip(`Búsqueda: "${filters.search}"`, () => {
          filters.search = '';
          dom.searchInput.value = '';
          currentPage = 1;
          applyFilters();
        })
      );
    }

    if (filters.category !== 'Todos') {
      chips.push(
        makeChip(`Categoría: ${filters.category}`, () => {
          setCategory('Todos');
        })
      );
    }

    for (const prov of filters.providers) {
      chips.push(
        makeChip(`Proveedor: ${PROVIDER_DISPLAY[prov] || prov}`, () => {
          filters.providers.delete(prov);
          currentPage = 1;
          updateProviderButtons();
          applyFilters();
        })
      );
    }

    for (const tag of filters.tags) {
      chips.push(
        makeChip(`Etiqueta: ${tag}`, () => {
          filters.tags.delete(tag);
          currentPage = 1;
          updateTagButtons();
          applyFilters();
        })
      );
    }

    dom.activeFilters.innerHTML = '';
    if (chips.length > 0) {
      chips.forEach((el) => dom.activeFilters.appendChild(el));

      // "Clear all" button
      if (chips.length > 1) {
        const clearAll = document.createElement('button');
        clearAll.className = 'chip chip--clear-all';
        clearAll.textContent = 'Limpiar todo';
        clearAll.addEventListener('click', resetAllFilters);
        dom.activeFilters.appendChild(clearAll);
      }
    }
  }

  function makeChip(label, onRemove) {
    const el = document.createElement('span');
    el.className = 'chip';
    el.innerHTML = `${label} <button class="chip__remove" aria-label="Eliminar filtro">&times;</button>`;
    el.querySelector('.chip__remove').addEventListener('click', onRemove);
    return el;
  }

  /** Render the slot cards for the current page */
  function renderGrid() {
    const total = filteredSlots.length;

    // Empty state
    if (total === 0) {
      dom.slotsGrid.innerHTML = '';
      dom.emptyState.classList.add('visible');
      return;
    }

    dom.emptyState.classList.remove('visible');

    const start = (currentPage - 1) * SLOTS_PER_PAGE;
    const pageSlots = filteredSlots.slice(start, start + SLOTS_PER_PAGE);

    // Build HTML in one shot — innerHTML is faster than 48 individual appends
    const fragment = document.createDocumentFragment();

    for (const slot of pageSlots) {
      const card = document.createElement('article');
      card.className = 'slot-card';
      card.setAttribute('data-id', slot.id);

      const playUrl = isMobile 
        ? (slot.slot_url_movil || slot.slot_url_app || slot.slot_desktop_movil) 
        : (slot.slot_desktop_movil || slot.slot_url_movil || slot.slot_url_app);
      const tagBadges = slot._tags
        .filter((t) => SPECIAL_TAGS.includes(t))
        .map((t) => `<span class="slot-card__tag">${t}</span>`)
        .join('');

      card.innerHTML = `
        <div class="slot-card__img-wrap">
          <img
            class="slot-card__img"
            data-src="${slot.image_url}"
            alt="${slot.name}"
            decoding="async"
          />
          <div class="slot-card__img-placeholder">
            <span>${slot.name}</span>
          </div>
          ${tagBadges ? `<div class="slot-card__tags">${tagBadges}</div>` : ''}
        </div>
        <div class="slot-card__body">
          <h3 class="slot-card__name" title="${slot.name}">${slot.name}</h3>
          <span class="slot-card__provider">${slot._providerDisplay}</span>
          <div class="slot-card__meta">
            <span class="slot-card__clicks">🔥 ${formatNumber(slot._totalClicks)}</span>
          </div>
          <a href="${playUrl}" class="slot-card__play" target="_blank" rel="noopener">
            Jugar
          </a>
        </div>
      `;

      fragment.appendChild(card);
    }

    dom.slotsGrid.innerHTML = '';
    dom.slotsGrid.appendChild(fragment);

    // Observe images for lazy loading
    observeImages();
  }

  /** Render pagination controls */
  function renderPagination() {
    const totalPages = getTotalPages();
    if (totalPages <= 1) {
      dom.pagination.innerHTML = '';
      return;
    }

    const buttons = [];

    // Prev
    buttons.push(
      `<button class="page-btn page-btn--prev" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
        ‹ Anterior
      </button>`
    );

    // Page numbers with ellipsis
    const pages = getPageNumbers(currentPage, totalPages);
    for (const p of pages) {
      if (p === '…') {
        buttons.push(`<span class="page-ellipsis">…</span>`);
      } else {
        buttons.push(
          `<button class="page-btn${p === currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`
        );
      }
    }

    // Next
    buttons.push(
      `<button class="page-btn page-btn--next" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
        Siguiente ›
      </button>`
    );

    dom.pagination.innerHTML = buttons.join('');
  }

  /**
   * Generate smart page numbers with ellipsis.
   * Always shows first, last, and a window around current.
   */
  function getPageNumbers(current, total) {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages = new Set([1, 2, total - 1, total]);
    for (let i = current - 1; i <= current + 1; i++) {
      if (i >= 1 && i <= total) pages.add(i);
    }

    const sorted = [...pages].sort((a, b) => a - b);
    const result = [];

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        result.push('…');
      }
      result.push(sorted[i]);
    }

    return result;
  }

  function getTotalPages() {
    return Math.ceil(filteredSlots.length / SLOTS_PER_PAGE);
  }

  // ─── Loading Skeleton ────────────────────────────────────────────────

  function showLoading(show) {
    if (show) {
      dom.loadingSkeleton.classList.add('visible');
      dom.slotsGrid.innerHTML = '';
    } else {
      dom.loadingSkeleton.classList.remove('visible');
    }
  }

  // ─── Lazy Image Loading ──────────────────────────────────────────────

  function initImageObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      return;
    }

    imgObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const img = entry.target;
            const src = img.dataset.src;
            if (src) {
              img.src = src;
              img.removeAttribute('data-src');
              img.addEventListener('load', () => {
                img.classList.add('loaded');
                // Hide the placeholder gradient
                const placeholder = img.parentElement.querySelector('.slot-card__img-placeholder');
                if (placeholder) placeholder.style.opacity = '0';
              });
              img.addEventListener('error', () => {
                // Keep placeholder visible with slot name
                img.classList.add('error');
              });
            }
            imgObserver.unobserve(img);
          }
        }
      },
      {
        rootMargin: '800px', // start loading 800px before visible for ultra-smooth scroll
      }
    );
  }

  function observeImages() {
    if (!imgObserver) {
      // Fallback: load all images now
      dom.slotsGrid.querySelectorAll('img[data-src]').forEach((img) => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.addEventListener('load', () => {
          img.classList.add('loaded');
          const placeholder = img.parentElement.querySelector('.slot-card__img-placeholder');
          if (placeholder) placeholder.style.opacity = '0';
        });
        img.addEventListener('error', () => {
          img.classList.add('error');
        });
      });
      return;
    }

    dom.slotsGrid.querySelectorAll('img[data-src]').forEach((img) => {
      imgObserver.observe(img);
    });
  }

  // ─── URL State Sync ──────────────────────────────────────────────────

  /** Write current filters to URL query params (replaceState — no history noise) */
  function syncFiltersToURL() {
    const params = new URLSearchParams();

    if (filters.search) params.set('q', filters.search);
    if (filters.category !== 'Todos') params.set('cat', filters.category);
    if (filters.providers.size > 0) params.set('prov', [...filters.providers].join(','));
    if (filters.sort !== 'popular') params.set('sort', filters.sort);
    if (filters.tags.size > 0) params.set('tags', [...filters.tags].join(','));
    if (currentPage > 1) params.set('page', currentPage);

    const qs = params.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, '', url);
  }

  /** Read filters from URL on initial load */
  function restoreFiltersFromURL() {
    const params = new URLSearchParams(location.search);

    if (params.has('q')) {
      filters.search = params.get('q');
      dom.searchInput.value = filters.search;
    }

    if (params.has('cat')) {
      const cat = params.get('cat');
      // Validate it exists in our data
      if (allSlots.some((s) => s._type === cat)) {
        filters.category = cat;
      }
    }

    if (params.has('prov')) {
      const provs = params.get('prov').split(',');
      const valid = new Set(allSlots.map((s) => s.provider));
      for (const p of provs) {
        if (valid.has(p)) filters.providers.add(p);
      }
    }

    if (params.has('sort') && SORT_OPTIONS[params.get('sort')]) {
      filters.sort = params.get('sort');
      dom.sortSelect.value = filters.sort;
    }

    if (params.has('tags')) {
      const tags = params.get('tags').split(',');
      for (const t of tags) {
        if (SPECIAL_TAGS.includes(t)) filters.tags.add(t);
      }
    }

    if (params.has('page')) {
      currentPage = Math.max(1, parseInt(params.get('page'), 10) || 1);
    }

    // Sync UI to restored state
    updateCategoryPills();
    updateProviderButtons();
    updateTagButtons();
  }

  // ─── UI State Sync Helpers ───────────────────────────────────────────

  function updateCategoryPills() {
    dom.categoryPills.querySelectorAll('.pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.category === filters.category);
    });
  }

  function updateProviderButtons() {
    const hasProviders = filters.providers.size > 0;
    dom.providerFilters.querySelectorAll('.provider-btn').forEach((btn) => {
      const prov = btn.dataset.provider;
      if (prov === 'Todos') {
        btn.classList.toggle('active', !hasProviders);
      } else {
        btn.classList.toggle('active', filters.providers.has(prov));
      }
    });
  }

  function updateTagButtons() {
    dom.tagFilters.querySelectorAll('.tag-toggle').forEach((btn) => {
      btn.classList.toggle('active', filters.tags.has(btn.dataset.tag));
    });
  }

  function setCategory(cat) {
    filters.category = cat;
    currentPage = 1;
    updateCategoryPills();
    applyFilters();
  }

  function resetAllFilters() {
    filters.search = '';
    filters.category = 'Todos';
    filters.providers.clear();
    filters.sort = 'popular';
    filters.tags.clear();
    currentPage = 1;

    dom.searchInput.value = '';
    dom.sortSelect.value = 'popular';
    updateCategoryPills();
    updateProviderButtons();
    updateTagButtons();
    applyFilters();
  }

  // ─── Event Binding ───────────────────────────────────────────────────

  function bindEvents() {
    // --- Search (debounced) ---
    const debouncedSearch = debounce((value) => {
      filters.search = value.trim();
      currentPage = 1;
      applyFilters();
    }, DEBOUNCE_MS);

    dom.searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });

    // Clear search on Escape inside input
    dom.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dom.searchInput.value = '';
        filters.search = '';
        currentPage = 1;
        dom.searchInput.blur();
        applyFilters();
      }
    });

    // --- Category pills (event delegation) ---
    dom.categoryPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill');
      if (!btn) return;
      setCategory(btn.dataset.category);
    });

    // --- Provider buttons (multi-select, event delegation) ---
    dom.providerFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.provider-btn');
      if (!btn) return;

      const prov = btn.dataset.provider;

      if (prov === 'Todos') {
        // "Todos" clears all provider filters
        filters.providers.clear();
      } else {
        // Toggle this provider
        if (filters.providers.has(prov)) {
          filters.providers.delete(prov);
        } else {
          filters.providers.add(prov);
        }
      }

      currentPage = 1;
      updateProviderButtons();
      applyFilters();
    });

    // --- Sort dropdown ---
    dom.sortSelect.addEventListener('change', (e) => {
      filters.sort = e.target.value;
      currentPage = 1;
      applyFilters();
    });

    // --- Tag toggles (event delegation) ---
    dom.tagFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-toggle');
      if (!btn) return;

      const tag = btn.dataset.tag;
      if (filters.tags.has(tag)) {
        filters.tags.delete(tag);
      } else {
        filters.tags.add(tag);
      }

      currentPage = 1;
      updateTagButtons();
      applyFilters();
    });

    // --- Pagination (event delegation) ---
    dom.pagination.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page]');
      if (!btn || btn.disabled) return;

      const page = parseInt(btn.dataset.page, 10);
      if (page >= 1 && page <= getTotalPages()) {
        currentPage = page;
        renderAll();
        syncFiltersToURL();

        // Smooth scroll to top of grid
        dom.slotsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
      // Ctrl+K or / to focus search (unless already in an input)
      const isInput =
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT';

      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !isInput)) {
        e.preventDefault();
        dom.searchInput.focus();
        dom.searchInput.select();
      }
    });

    // --- Browser back/forward navigation ---
    window.addEventListener('popstate', () => {
      // Re-read URL and re-apply
      filters.search = '';
      filters.category = 'Todos';
      filters.providers.clear();
      filters.sort = 'popular';
      filters.tags.clear();
      currentPage = 1;

      restoreFiltersFromURL();
      applyFilters();
    });
  }

  // ─── DOM Cache ───────────────────────────────────────────────────────

  function cacheDom() {
    dom.searchInput = document.getElementById('search-input');
    dom.categoryPills = document.getElementById('category-pills');
    dom.providerFilters = document.getElementById('provider-filters');
    dom.sortSelect = document.getElementById('sort-select');
    dom.tagFilters = document.getElementById('tag-filters');
    dom.slotsGrid = document.getElementById('slots-grid');
    dom.pagination = document.getElementById('pagination');
    dom.resultCounter = document.getElementById('result-counter');
    dom.activeFilters = document.getElementById('active-filters');
    dom.loadingSkeleton = document.getElementById('loading-skeleton');
    dom.emptyState = document.getElementById('empty-state');

    // Validate all elements exist
    for (const [key, el] of Object.entries(dom)) {
      if (!el) {
        console.warn(`[SlotsApp] Elemento DOM no encontrado: #${key}`);
      }
    }
  }

  // ─── Initialization ──────────────────────────────────────────────────

  function init() {
    cacheDom();
    initImageObserver();
    bindEvents();
    loadData();
  }

  // Boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API (for debugging / external access) ────────────────────
  return {
    getState: () => ({ filters: { ...filters }, currentPage, total: filteredSlots.length }),
    resetFilters: resetAllFilters,
  };
})();
