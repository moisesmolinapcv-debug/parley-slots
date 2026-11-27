/* ══════════════════════════════════════════════════════════════
   MODO AÑO NUEVO — "Medianoche de gala" (diseño aprobado en Figma)
   · Burbujas de champán que suben + 1 fuego artificial lejano cada 4–7 s
     (chispas pequeñas que se apagan suave: sin destellos bruscos).
   · Luces bokeh bajo la barra · cuenta regresiva sobre el banner
     hasta las 12:00 a. m. del 1 de enero (hora de Venezuela).
   · Entrada: lluvia de confeti dorado de 2 s (1 vez al día).
   · Reacciones: confeti al marcar favorito · chispa dorada en JUGAR.
   · Medianoche: "¡Feliz 2027!" y una salva corta de fuegos (1 sola vez).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var GOLD = '#E8C77A', SILVER = '#C9CED8', PINK = '#FF4FA3', WHITE = '#FFFFFF';
  var VET_OFFSET_H = 4;                 // Venezuela = UTC−4 todo el año

  /* ── Fecha: año que se celebra y momento exacto de la medianoche ── */
  function vetParts(ms) {
    var d = new Date((ms || Date.now()) - VET_OFFSET_H * 3600e3);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  }
  // De julio a diciembre se cuenta hacia el año siguiente; de enero a junio ya se celebró el actual
  function targetYear() { var p = vetParts(); return p.m >= 7 ? p.y + 1 : p.y; }
  function midnightMs(year) { return Date.UTC(year, 0, 1, VET_OFFSET_H, 0, 0); }

  function sparkle(size, color, dot) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M11 2.5l1.9 6.6 6.6 1.9-6.6 1.9L11 19.5l-1.9-6.6L2.5 11l6.6-1.9z" fill="' + color + '"/>' +
      (dot ? '<circle cx="19.5" cy="19" r="2.2" fill="' + PINK + '"/><circle cx="20" cy="4.5" r="1.4" fill="' + SILVER + '"/>' : '') + '</svg>';
  }

  /* ── Partículas ── */
  var A = null;                         // api del motor (lo recibe tick)
  var nextFw = 0;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function rocket(vw, vh, color) {
    return {
      k: 'rocket', x: vw * rnd(0.14, 0.86), y: vh + 8,
      ty: vh * rnd(0.12, 0.36), vy: -vh * rnd(0.62, 0.78), c: color || pick([GOLD, PINK, SILVER, GOLD])
    };
  }
  function explode(p) {
    var mobile = A.isMobile(), n = mobile ? 20 : 28, sp = mobile ? 64 : 86;
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * 6.283 + rnd(-0.12, 0.12), v = sp * rnd(0.7, 1.05);
      A.emit({ k: 'spark', x: p.x, y: p.y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, c: p.c, life: 0, L: rnd(1.3, 1.8) });
    }
    // núcleo blanco muy breve y tenue (no ilumina la pantalla)
    A.emit({ k: 'core', x: p.x, y: p.y, life: 0, L: 0.35 });
  }
  function launch(color) { var s = A.size(); A.emit(rocket(s.w, s.h, color)); }

  var particles = {
    mobile: 20,
    desktop: 40,
    tick: function (dt, t, vw, vh, api) {
      A = api;
      if (!nextFw) nextFw = t + 2.2;
      if (t >= nextFw) {
        launch();
        nextFw = t + (api.isMobile() ? rnd(5, 8) : rnd(4, 7));
      }
    },
    spawn: function (vw, vh, initial, o) {
      if (o && o.burst) {                                     // confeti de la entrada
        return {
          k: 'confetti', temp: true, x: Math.random() * vw, y: -10 - Math.random() * vh * 0.25,
          vy: rnd(110, 190), sway: rnd(14, 30), f: rnd(1.5, 3), ph: rnd(0, 6.28),
          rot: rnd(0, 6.28), vr: rnd(-5, 5), w: rnd(3, 5), h: rnd(6, 9),
          c: Math.random() < 0.7 ? pick([GOLD, '#F2D89B', '#D9B25A']) : pick([SILVER, PINK]), life: 0
        };
      }
      var big = Math.random() < 0.3;                          // burbujas de champán
      return {
        k: 'bubble', x: Math.random() * vw, y: initial ? Math.random() * vh : vh + 8,
        r: big ? rnd(2.2, 3.4) : rnd(0.8, 1.8), vy: big ? rnd(20, 32) : rnd(10, 20),
        amp: rnd(4, 12), f: rnd(0.4, 0.9), ph: rnd(0, 6.28), a: big ? rnd(0.35, 0.55) : rnd(0.25, 0.5), ring: big
      };
    },
    update: function (p, dt, t, vw, vh) {
      switch (p.k) {
        case 'bubble':
          p.y -= p.vy * dt;
          return p.y > -10;
        case 'confetti':
          p.y += p.vy * dt; p.rot += p.vr * dt; p.life += dt;
          return p.y < vh + 12 && p.life < 3.2;
        case 'rocket':
          p.y += p.vy * dt;
          if (p.y <= p.ty) { if (A) explode(p); return false; }
          return true;
        case 'spark':
          p.life += dt;
          var drag = Math.pow(0.35, dt);
          p.vx *= drag; p.vy = p.vy * drag + 26 * dt;          // se frena y cae un poco
          p.x += p.vx * dt; p.y += p.vy * dt;
          return p.life < p.L;
        case 'core':
          p.life += dt;
          return p.life < p.L;
      }
      return false;
    },
    draw: function (ctx, p, t, dark) {
      switch (p.k) {
        case 'bubble': {
          var x = p.x + Math.sin(t * p.f + p.ph) * p.amp;
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = p.a * (dark ? 1 : 0.8);
          if (p.ring) {
            ctx.strokeStyle = dark ? '#F2DDA4' : '#A9862F'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.283); ctx.stroke();
            ctx.fillStyle = dark ? '#FFFFFF' : '#C9A646';
            ctx.globalAlpha *= 0.8;
            ctx.fillRect(x - p.r * 0.45, p.y - p.r * 0.45, 1, 1);  // brillo
          } else {
            ctx.fillStyle = dark ? '#F2DDA4' : '#B8923A';
            ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, 6.283); ctx.fill();
          }
          return;
        }
        case 'confetti': {
          var cx = p.x + Math.sin(t * p.f + p.ph) * p.sway;
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = Math.min(1, (3.2 - p.life) / 0.6) * 0.95;
          ctx.save(); ctx.translate(cx, p.y); ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(t * p.f * 2 + p.ph));          // giro en el aire
          ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
          return;
        }
        case 'rocket':
          ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
          ctx.globalAlpha = dark ? 0.55 : 0.5;
          ctx.strokeStyle = p.c; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + 14); ctx.stroke();
          return;
        case 'spark': {
          var k = 1 - p.life / p.L;
          ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
          ctx.globalAlpha = Math.pow(k, 1.4) * (dark ? 0.85 : 0.7);
          ctx.strokeStyle = dark ? p.c : (p.c === SILVER ? '#7A8194' : p.c === GOLD ? '#B08A2E' : '#D6337F');
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.07, p.y - p.vy * 0.07); ctx.stroke();
          return;
        }
        case 'core':
          if (!dark) return;
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 * (1 - p.life / p.L);
          ctx.fillStyle = WHITE;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, 6.283); ctx.fill();
          return;
      }
    }
  };

  /* ── Luces bokeh bajo la barra superior ── */
  function bokehSVG(width) {
    var h = 16, out = '', colors = [GOLD, SILVER, GOLD, PINK, GOLD, WHITE], x = 6, i = 0;
    var defs = '<defs>' + colors.map(function (c, j) {
      return '<radialGradient id="nyb' + j + '"><stop offset="0" stop-color="' + c + '" stop-opacity="0.95"/>' +
        '<stop offset="0.45" stop-color="' + c + '" stop-opacity="0.45"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>';
    }).join('') + '</defs>';
    while (x < width) {
      var ci = i % colors.length, r = 3 + ((i * 5) % 4), cy = 5 + ((i * 3) % 6);
      out += '<circle class="bokeh" cx="' + x + '" cy="' + cy + '" r="' + r + '" fill="url(#nyb' + ci + ')" style="animation-delay:-' + ((i * 0.53) % 3.4).toFixed(2) + 's"/>';
      x += 16 + ((i * 7) % 14); i++;
    }
    return '<svg width="' + width + '" height="' + h + '" viewBox="0 0 ' + width + ' ' + h + '" aria-hidden="true">' + defs + out + '</svg>';
  }

  /* ── Cuenta regresiva ── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function countdownHTML(ms, year) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    var nums = (d > 0 ? '<b>' + d + '</b><i>d</i> ' : '') + '<b>' + pad(h) + '</b><i>:</i><b>' + pad(m) + '</b><i>:</i><b>' + pad(ss) + '</b>';
    return '<span class="ny-cd-emblem">' + sparkle(14, GOLD) + '</span><span class="ny-cd-lead">Faltan</span><span class="ny-cd-nums">' + nums + '</span><span>para el ' + year + '</span>';
  }
  function celebratedHTML(year) {
    return '<span class="ny-cd-emblem">' + sparkle(14, GOLD, true) + '</span><span class="ny-cd-hny">¡Feliz ' + year + '!</span>';
  }

  function mount(api) {
    var undo = [];
    A = api; nextFw = 0;

    // Luces bokeh
    var nav = document.getElementById('topNav');
    if (nav) {
      var b = document.createElement('div');
      b.className = 'ny-bokeh';
      var buildB = function () { b.innerHTML = bokehSVG(Math.ceil(nav.getBoundingClientRect().width) || window.innerWidth); };
      buildB();
      nav.appendChild(b);
      api.on(window, 'resize', api.debounce(buildB, 200));
      undo.push(function () { b.remove(); });
    }

    // Cuenta regresiva sobre el borde superior del banner
    var wrap = document.getElementById('heroCarouselWrap');
    if (wrap) {
      var year = targetYear(), target = midnightMs(year);
      var cd = document.createElement('div');
      cd.className = 'ny-countdown';
      cd.setAttribute('role', 'timer');
      cd.setAttribute('aria-label', 'Cuenta regresiva para el ' + year);
      wrap.appendChild(cd);
      var celebrated = false;
      var render = function () {
        var left = target - Date.now();
        if (left <= 0) {
          if (!celebrated) {
            celebrated = true;
            cd.classList.add('is-new-year');
            cd.innerHTML = celebratedHTML(year);
            cd.setAttribute('aria-label', '¡Feliz ' + year + '!');
            celebrate(api, year, left > -60e3);
          }
          return;
        }
        if (!document.hidden) cd.innerHTML = countdownHTML(left, year);
      };
      render();
      var iv = setInterval(render, 1000);
      undo.push(function () { clearInterval(iv); cd.remove(); });
    }

    // Título "SLOTS DESTACADOS": destellos en lugar de estrellas
    var badge = document.querySelector('.featured-badge-title');
    if (badge) {
      var original = badge.innerHTML;
      badge.innerHTML = original.replace(/★/g, '<span class="season-badge-emblem">' + sparkle(13, GOLD) + '</span>');
      undo.push(function () { badge.innerHTML = original; });
    }

    // JUGAR lanza una chispa dorada
    api.on(document, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('.btn-play-always, .featured-play-btn');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      api.pop(r.left + r.width / 2, r.top, sparkle(16, GOLD), [
        { transform: 'translate(0,0) scale(0.3) rotate(0deg)', opacity: 0 },
        { transform: 'translate(0,-14px) scale(1.15) rotate(45deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate(0,-24px) scale(0.6) rotate(90deg)', opacity: 0 }
      ], { duration: 600 });
    });

    return function () { while (undo.length) undo.pop()(); };
  }

  // Medianoche: una sola salva corta (5 cohetes separados ≥ 0,35 s) por año y navegador
  function celebrate(api, year, live) {
    var k = 'parley_ny_celebrated_' + year;
    try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch (e) {}
    if (!live || !api.motionOK() || !api.fxOn() || !api.running()) return;
    var cols = [GOLD, PINK, SILVER, GOLD, PINK];
    cols.forEach(function (c, i) { setTimeout(function () { if (api.running()) launch(c); }, i * 380); });
    setTimeout(function () { api.burst(api.isMobile() ? 30 : 60); }, 900);
  }

  window.ParleySeasonThemes = window.ParleySeasonThemes || {};
  window.ParleySeasonThemes.anio_nuevo = {
    id: 'anio_nuevo',
    name: 'Año Nuevo',
    get greeting() { return '¡Feliz ' + targetYear() + '! Que la suerte te acompañe'; },
    emblem: function (size) { return sparkle(size, GOLD, true); },
    particles: particles,
    mount: mount,
    // Lluvia de confeti dorado de 2 s (1 vez al día)
    entry: function (api) {
      var n = api.isMobile() ? 34 : 70, sent = 0;
      var iv = setInterval(function () {
        var step = Math.ceil(n / 8);
        api.burst(Math.min(step, n - sent)); sent += step;
        if (sent >= n) clearInterval(iv);
      }, 250);                                                  // repartido en ~2 s
      api.cleanup(function () { clearInterval(iv); });
    },
    // Al marcar un favorito: pequeña explosión de confeti desde el corazón
    react: function (btn, api) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var cols = [GOLD, PINK, SILVER, GOLD, '#F2D89B', PINK];
      for (var i = 0; i < 6; i++) {
        var ang = (i / 6) * 6.283 - 1.57 + (Math.random() * 0.4 - 0.2), dist = 22 + Math.random() * 12;
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist, rot = Math.random() * 360;
        api.pop(cx, cy, '<svg viewBox="0 0 14 14"><rect x="5" y="3" width="4" height="8" rx="1" fill="' + cols[i] + '"/></svg>', [
          { transform: 'translate(0,0) rotate(0deg) scale(0.5)', opacity: 0 },
          { transform: 'translate(' + dx * 0.7 + 'px,' + dy * 0.7 + 'px) rotate(' + rot * 0.6 + 'deg) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(' + dx + 'px,' + (dy + 14) + 'px) rotate(' + rot + 'deg) scale(0.8)', opacity: 0 }
        ], { duration: 800, delay: i * 25 });
      }
    }
  };
})();
