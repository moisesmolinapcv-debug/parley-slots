/* ══════════════════════════════════════════════════════════════
   MODO CARNAVAL — "Comparsa" (diseño aprobado en Figma)
   · Confeti multicolor (18–28 piezas) + serpentinas que se enroscan.
   · Banderines que se mecen bajo la barra · antifaz sobre el banner.
   · Entrada: ráfaga de confeti desde los lados durante 2 s (1 vez al día).
   · Reacción: el corazón de favoritos suelta confeti.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PINK = '#FF2E93', TEAL = '#19D3C5', YELLOW = '#FFD23F', VIOLET = '#9B6BFF', GOLD = '#F5C431';
  var COLORS = [PINK, TEAL, YELLOW, VIOLET, GOLD];
  var MASK = 'M2 8c3-2 7-2 10 0 3-2 7-2 10 0 0 5-3 8-6 8-2 0-3-1-4-3-1 2-2 3-4 3-3 0-6-3-6-8z';

  function mask(size, color, eye) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + MASK + '" fill="' + color + '"/>' +
      '<ellipse cx="7.5" cy="10.5" rx="2" ry="1.3" fill="' + (eye || '#120A24') + '"/><ellipse cx="16.5" cy="10.5" rx="2" ry="1.3" fill="' + (eye || '#120A24') + '"/>' +
      '<circle cx="12" cy="6" r="1.5" fill="' + YELLOW + '"/></svg>';
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  function deep(c) { return { '#FF2E93': '#D81B78', '#19D3C5': '#0E9E93', '#FFD23F': '#D9A400', '#9B6BFF': '#6E44D9', '#F5C431': '#C99A12' }[c] || c; }

  var particles = {
    mobile: 18,
    desktop: 28,
    spawn: function (vw, vh, initial, o) {
      if (o && o.burst) {                          // ráfaga desde los lados
        var left = (o.index || 0) % 2 === 0;
        return {
          k: 'c', temp: true, life: 0, x: left ? -8 : vw + 8, y: vh * rnd(0.35, 0.75),
          vx: (left ? 1 : -1) * rnd(160, 300), vy: -rnd(160, 300), g: 300,
          rot: rnd(0, 6.28), vr: rnd(-8, 8), w: rnd(4, 6), h: rnd(7, 10), c: pick(COLORS), f: rnd(2, 4), ph: rnd(0, 6.28)
        };
      }
      if (Math.random() < 0.12) {                  // serpentina
        return {
          k: 's', x: Math.random() * vw, y: initial ? Math.random() * vh : -40, vy: rnd(22, 34),
          len: rnd(34, 52), amp: rnd(4, 7), rot: rnd(0, 6.28), vr: rnd(-0.6, 0.6), c: pick(COLORS), ph: rnd(0, 6.28)
        };
      }
      return {
        k: 'c', x: Math.random() * vw, y: initial ? Math.random() * vh : -10, vy: rnd(28, 52), vx: 0, g: 0,
        sway: rnd(10, 24), f: rnd(1, 2.2), ph: rnd(0, 6.28), rot: rnd(0, 6.28), vr: rnd(-3, 3),
        w: rnd(3, 5), h: rnd(6, 9), c: pick(COLORS), round: Math.random() < 0.3
      };
    },
    update: function (p, dt, t, vw, vh) {
      p.rot += p.vr * dt;
      if (p.temp) {
        p.life += dt; p.vy += p.g * dt; p.vx *= Math.pow(0.4, dt);
        p.x += p.vx * dt; p.y += p.vy * dt;
        return p.life < 3.2 && p.y < vh + 20;
      }
      p.y += p.vy * dt;
      return p.y < vh + 50;
    },
    draw: function (ctx, p, t, dark) {
      var c = dark ? p.c : deep(p.c);
      ctx.globalAlpha = (dark ? 0.85 : 0.75) * (p.temp ? Math.min(1, (3.2 - p.life) / 0.6) : 1);
      if (p.k === 's') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.beginPath();
        for (var i = 0; i <= 14; i++) {
          var u = i / 14, yy = (u - 0.5) * p.len, xx = Math.sin(u * 12 + t * 2 + p.ph) * p.amp;
          if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
        }
        ctx.stroke(); ctx.restore();
        return;
      }
      var x = p.x + (p.temp ? 0 : Math.sin(t * p.f + p.ph) * p.sway);
      ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w * 0.6, 0, 6.283); ctx.fill(); }
      else { ctx.scale(1, Math.cos(t * p.f * 2 + p.ph)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      ctx.restore();
    }
  };

  /* Banderines bajo la barra superior */
  function buntingSVG(width) {
    var h = 22, step = 22, out = '', wire = 'M0 2';
    var n = Math.ceil(width / step) + 1;
    for (var i = 0; i < n; i++) {
      var x0 = i * step, x1 = x0 + step;
      wire += ' L' + x1 + ' 2';
      out += '<path class="flag" style="transform-origin:' + (x0 + step / 2) + 'px 2px;animation-delay:-' + ((i * 0.29) % 2.4).toFixed(2) + 's" d="M' + (x0 + 2) + ' 2 L' + (x1 - 2) + ' 2 L' + (x0 + step / 2) + ' 16 Z" fill="' + COLORS[i % COLORS.length] + '"/>';
    }
    return '<svg width="' + width + '" height="' + h + '" viewBox="0 0 ' + width + ' ' + h + '" aria-hidden="true"><path d="' + wire + '" stroke="#C4B5E8" stroke-opacity="0.6" stroke-width="1"/>' + out + '</svg>';
  }

  function mount(api) {
    var undo = [];
    var nav = document.getElementById('topNav');
    if (nav) {
      var b = document.createElement('div');
      b.className = 'cv-bunting';
      var build = function () { b.innerHTML = buntingSVG(Math.ceil(nav.getBoundingClientRect().width) || window.innerWidth); };
      build(); nav.appendChild(b);
      api.on(window, 'resize', api.debounce(build, 200));
      undo.push(function () { b.remove(); });
    }
    // Antifaz en la esquina superior derecha del banner
    var wrap = document.getElementById('heroCarouselWrap');
    if (wrap) {
      var m = document.createElement('div');
      m.className = 'cv-mask';
      m.innerHTML = mask(44, PINK) + '<span class="cv-mask-ribbon r1"></span><span class="cv-mask-ribbon r2"></span>';
      wrap.appendChild(m);
      undo.push(function () { m.remove(); });
    }
    var badge = document.querySelector('.featured-badge-title');
    if (badge) {
      var original = badge.innerHTML;
      badge.innerHTML = original.replace(/★/g, '<span class="season-badge-emblem">' + mask(14, PINK) + '</span>');
      undo.push(function () { badge.innerHTML = original; });
    }
    return function () { while (undo.length) undo.pop()(); };
  }

  window.ParleySeasonThemes = window.ParleySeasonThemes || {};
  window.ParleySeasonThemes.carnaval = {
    id: 'carnaval',
    name: 'Carnaval',
    greeting: '¡Que viva el Carnaval! Gira con alegría',
    emblem: function (size) { return mask(size, PINK); },
    particles: particles,
    mount: mount,
    // Ráfaga de confeti desde los dos lados durante 2 s
    entry: function (api) {
      var n = api.isMobile() ? 36 : 70, sent = 0, step = Math.ceil(n / 6);
      var iv = setInterval(function () { api.burst(Math.min(step, n - sent)); sent += step; if (sent >= n) clearInterval(iv); }, 330);
      api.cleanup(function () { clearInterval(iv); });
    },
    // El corazón de favoritos suelta confeti
    react: function (btn, api) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 7; i++) {
        var ang = -Math.PI / 2 + (i - 3) * 0.42 + rnd(-0.1, 0.1), dist = 26 + rnd(0, 14);
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist, rot = rnd(-300, 300);
        api.pop(cx, cy, '<svg viewBox="0 0 14 14"><rect x="5" y="3" width="4" height="8" rx="1" fill="' + COLORS[i % COLORS.length] + '"/></svg>', [
          { transform: 'translate(0,0) rotate(0deg) scale(0.5)', opacity: 0 },
          { transform: 'translate(' + dx * 0.75 + 'px,' + dy * 0.75 + 'px) rotate(' + rot * 0.5 + 'deg) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(' + dx + 'px,' + (dy + 22) + 'px) rotate(' + rot + 'deg) scale(0.8)', opacity: 0 }
        ], { duration: 850, delay: i * 20 });
      }
    }
  };
})();
