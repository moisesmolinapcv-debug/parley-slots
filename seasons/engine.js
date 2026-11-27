/* ══════════════════════════════════════════════════════════════
   PARLEY SLOTS — MOTOR DE MODOS VISUALES DE TEMPORADA (v2)
   ──────────────────────────────────────────────────────────────
   · Solo se descarga cuando hay un modo activo (lo carga index.html).
   · Partículas en un único <canvas> detrás del contenido, sin bloquear toques.
   · Se pausa con la pestaña oculta, durante el scroll rápido, con
     "movimiento reducido" del teléfono o si el visitante apaga los efectos.
   · Cada tema (seasons/<id>.js) aporta: partículas, adornos, momento de
     entrada y reacción. Si algo falla, la página sigue funcionando normal.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = window, D = document, root = D.documentElement;
  var mqReduce = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var FX_KEY = 'parley_season_fx';
  var INTENSITY = { sutil: 0.55, normal: 1, festivo: 1.5 };
  var MAX_PARTS = 360;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function todayVET() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var theme = null, opts = null, cleanups = [];
  var canvas = null, ctx = null, raf = 0, running = false, parts = [], last = 0, t0 = 0, vw = 0, vh = 0;

  function fxOn() { return lsGet(FX_KEY) !== 'off'; }
  function motionOK() { return !(mqReduce && mqReduce.matches); }
  function isMobile() { return W.innerWidth < 768 || (navigator.maxTouchPoints > 0 && W.innerWidth < 1024); }
  function lowEnd() {
    return (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  }
  function isDark() { return root.getAttribute('data-theme') !== 'light'; }

  /* ── API que reciben los temas ── */
  var api = {
    root: root,
    isDark: isDark, isMobile: isMobile, fxOn: fxOn, motionOK: motionOK,
    on: function (target, ev, fn, o) {
      if (!target) return;
      target.addEventListener(ev, fn, o);
      cleanups.push(function () { target.removeEventListener(ev, fn, o); });
    },
    cleanup: function (fn) { cleanups.push(fn); },
    el: function (html) { var t = D.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
    debounce: function (fn, ms) { var id; return function () { clearTimeout(id); id = setTimeout(fn, ms); }; },
    /* Partícula temporal creada por el tema (p. ej. chispas de un fuego artificial).
       Tope de seguridad para que nunca se acumulen demasiadas. */
    emit: function (p) { if (running && p && parts.length < MAX_PARTS) { p.temp = true; parts.push(p); } },
    size: function () { return { w: vw, h: vh }; },
    running: function () { return running; },
    burst: function (n) {
      if (!theme || !theme.particles || !canvas || !running) return;
      for (var i = 0; i < n; i++) parts.push(theme.particles.spawn(vw, vh, false, { burst: true, index: i }));
    },
    /* Animación corta de elementos sueltos (reacciones). Usa transform/opacity. */
    pop: function (x, y, html, frames, o) {
      if (!motionOK() || !fxOn() || !Element.prototype.animate) return;
      var el = D.createElement('span');
      el.className = 'season-pop';
      el.innerHTML = html;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      D.body.appendChild(el);
      var a = el.animate(frames, Object.assign({ duration: 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' }, o || {}));
      a.onfinish = a.oncancel = function () { el.remove(); };
    }
  };

  /* ── Partículas ── */
  function targetCount() {
    var p = theme && theme.particles;
    if (!p) return 0;
    var n = isMobile() ? p.mobile : p.desktop;
    n *= INTENSITY[opts.intensity] || 1;
    if (lowEnd()) n *= 0.6;
    return Math.round(n);
  }
  function syncCount() {
    var want = targetCount();
    var base = 0;
    for (var i = 0; i < parts.length; i++) if (!parts[i].temp) base++;
    if (base < want) { for (var k = base; k < want; k++) parts.push(theme.particles.spawn(vw, vh, true, {})); }
    else if (base > want) {
      var extra = base - want;
      parts = parts.filter(function (p) { if (!p.temp && extra > 0) { extra--; return false; } return true; });
    }
  }
  function resize() {
    if (!canvas) return;
    var dpr = Math.min(W.devicePixelRatio || 1, 1.5);
    vw = W.innerWidth; vh = W.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    syncCount();
  }
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    var t = (now - t0) / 1000;
    if (!D.body.classList.contains('is-fast-scrolling')) {
      var P = theme.particles, dark = isDark();
      if (P.tick) P.tick(dt, t, vw, vh, api);           // el tema programa sus eventos (fuegos, etc.)
      ctx.clearRect(0, 0, vw, vh);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        if (P.update(p, dt, t, vw, vh) === false) {
          if (p.temp) { parts.splice(i, 1); continue; }
          parts[i] = p = P.spawn(vw, vh, false, {});
        }
        P.draw(ctx, p, t, dark);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    raf = requestAnimationFrame(frame);
  }
  function updateRunning() {
    var visible = !!(theme && theme.particles && canvas && fxOn() && motionOK());
    if (canvas) canvas.style.display = visible ? '' : 'none';
    var want = visible && !D.hidden;
    if (want && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    else if (!want && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    root.classList.toggle('season-fx-off', !fxOn());
  }

  /* ── Botón para que el visitante apague / encienda los efectos ── */
  function buildFxToggle() {
    var btn = api.el('<button type="button" class="season-fx-toggle" id="seasonFxToggle">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="s1" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>' +
      '<path class="s2" d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/><path class="slash" d="M4 4l16 16"/></svg></button>');
    function sync() {
      var on = fxOn();
      btn.setAttribute('aria-pressed', String(on));
      var label = on ? 'Apagar efectos de temporada' : 'Encender efectos de temporada';
      btn.setAttribute('aria-label', label); btn.title = label;
    }
    btn.addEventListener('click', function () {
      lsSet(FX_KEY, fxOn() ? 'off' : 'on');
      sync(); updateRunning();
      if (theme && theme.onFx) { try { theme.onFx(fxOn(), api); } catch (e) {} }
    });
    sync();
    var anchor = D.getElementById('themeToggleWidget');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(btn, anchor.nextSibling); else D.body.appendChild(btn);
    cleanups.push(function () { btn.remove(); });
  }

  /* ── Saludo de temporada (se puede cerrar; vuelve a la siguiente visita) ── */
  function buildGreeting() {
    var text = opts.greeting === '' ? '' : (opts.greeting || theme.greeting || '');
    if (!text) return;
    var key = 'parley_season_greet_' + theme.id;
    if (ssGet(key) === '1') return;
    var wrap = api.el('<div class="season-greeting" role="status">' +
      '<div class="season-greeting-chip">' + (theme.emblem ? '<span class="season-greeting-emblem" aria-hidden="true">' + theme.emblem(18) + '</span>' : '') +
      '<span class="season-greeting-text">' + esc(text) + '</span>' +
      '<button type="button" class="season-greeting-close" aria-label="Cerrar saludo">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>');
    wrap.querySelector('.season-greeting-close').addEventListener('click', function () {
      ssSet(key, '1');
      wrap.classList.add('is-leaving');
      setTimeout(function () { wrap.remove(); }, 200);
    });
    var after = D.getElementById('featuredSlotsSection');
    var before = D.querySelector('.results-bar');
    if (after && after.parentNode) after.parentNode.insertBefore(wrap, after.nextSibling);
    else if (before && before.parentNode) before.parentNode.insertBefore(wrap, before);
    else return;
    cleanups.push(function () { wrap.remove(); });
  }

  /* ── Aviso de vista previa (solo en el navegador de quien la abrió) ── */
  function buildPreviewPill() {
    var pill = api.el('<div class="season-preview-pill" role="status"><span>Vista previa · <b>' + esc(theme.name) +
      '</b></span><a href="?modo=off">Salir</a></div>');
    D.body.appendChild(pill);
    cleanups.push(function () { pill.remove(); });
  }

  /* ── Montar / desmontar ── */
  function mountNow(th, o) {
    unmount();
    theme = th;
    opts = Object.assign({ intensity: 'normal', greeting: null, preview: false }, o || {});
    root.setAttribute('data-season', th.id);
    root.setAttribute('data-season-intensity', opts.intensity);

    if (th.particles) {
      canvas = D.createElement('canvas');
      canvas.className = 'season-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      (D.querySelector('.casino-atmosphere-wrap') || D.body).appendChild(canvas);
      ctx = canvas.getContext('2d');
      t0 = performance.now();
      resize();
      api.on(W, 'resize', api.debounce(resize, 150));
    }
    try { var c = th.mount && th.mount(api, opts); if (typeof c === 'function') cleanups.push(c); }
    catch (e) { if (W.console) console.warn('[temporada] adornos', e); }

    buildFxToggle();
    buildGreeting();
    if (opts.preview) buildPreviewPill();

    api.on(D, 'visibilitychange', updateRunning);
    if (mqReduce) {
      var onMq = function () { updateRunning(); };
      if (mqReduce.addEventListener) { mqReduce.addEventListener('change', onMq); cleanups.push(function () { mqReduce.removeEventListener('change', onMq); }); }
    }
    // Reacción al marcar un favorito (se ejecuta después del manejador del corazón)
    if (th.react) {
      api.on(D, 'click', function (e) {
        var btn = e.target.closest && e.target.closest('.card-fav');
        if (!btn) return;
        setTimeout(function () { if (btn.classList.contains('is-fav')) { try { th.react(btn, api); } catch (err) {} } }, 0);
      });
    }
    updateRunning();

    // Momento de entrada: solo la primera visita del día, si hay movimiento permitido
    if (th.entry && motionOK() && fxOn()) {
      var k = 'parley_season_entry_' + th.id, today = todayVET();
      if (lsGet(k) !== today) {
        lsSet(k, today);
        var id = setTimeout(function () { try { th.entry(api); } catch (e) {} }, 700);
        cleanups.push(function () { clearTimeout(id); });
      }
    }
  }

  function mount(th, o) {
    try {
      if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', function () { mountNow(th, o); }, { once: true });
      else mountNow(th, o);
    } catch (e) { if (W.console) console.warn('[temporada] no se pudo montar', e); unmount(); }
  }

  function unmount() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    while (cleanups.length) { try { cleanups.pop()(); } catch (e) {} }
    if (canvas) canvas.remove();
    canvas = null; ctx = null; parts = [];
    root.removeAttribute('data-season');
    root.removeAttribute('data-season-intensity');
    root.classList.remove('season-fx-off');
    theme = null; opts = null;
  }

  W.ParleySeasonEngine = { mount: mount, unmount: unmount, api: api };
})();
