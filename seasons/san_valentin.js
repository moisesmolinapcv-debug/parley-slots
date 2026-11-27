/* ══════════════════════════════════════════════════════════════
   MODO SAN VALENTÍN — "Rosé" (diseño aprobado en Figma)
   · 12–18 corazones que suben con vaivén y desenfoque de profundidad.
   · Corazones colgantes bajo la barra · brillo rosado en las tarjetas.
   · Entrada: nube de corazones que sube durante 2 s (1 vez al día).
   · Reacción: el corazón de favoritos late y suelta mini corazones.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PINK = '#FF3D7F', ROSE = '#F7C6D4', GOLD = '#E8B85A', WIRE = '#7A3550';
  var HEART = 'M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z';

  function heart(size, color) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + HEART + '" fill="' + color + '"/></svg>';
  }

  /* Corazones pre-dibujados: nítido (cerca) y difuso (lejos) */
  var sprites = {};
  function sprite(color, soft) {
    var key = color + (soft ? 's' : 'n');
    if (sprites[key]) return sprites[key];
    var s = 48, c = document.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d'), p = new Path2D(HEART);
    g.translate(soft ? 10 : 6, soft ? 10 : 6);
    g.scale(soft ? 28 / 24 : 36 / 24, soft ? 28 / 24 : 36 / 24);
    if (soft) { g.shadowColor = color; g.shadowBlur = 9; }
    g.fillStyle = color; g.fill(p);
    sprites[key] = c;
    return c;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  var particles = {
    mobile: 12,
    desktop: 18,
    spawn: function (vw, vh, initial, o) {
      var burst = o && o.burst, depth = burst ? rnd(0.5, 1) : Math.random();   // 0 = lejos, 1 = cerca
      return {
        x: Math.random() * vw,
        y: initial ? Math.random() * vh : vh + 20 + (burst ? Math.random() * 60 : 0),
        s: 8 + depth * 14, vy: (14 + depth * 22) * (burst ? 3.2 : 1),
        amp: rnd(8, 20), f: rnd(0.35, 0.7), ph: rnd(0, 6.28), rot: rnd(-0.35, 0.35),
        a: burst ? 0.85 : 0.28 + depth * 0.45, soft: depth < 0.45,
        c: Math.random() < 0.15 ? GOLD : pick([PINK, PINK, ROSE]),
        temp: !!burst, life: 0
      };
    },
    update: function (p, dt) {
      p.y -= p.vy * dt;
      if (p.temp) { p.life += dt; p.vy *= Math.pow(0.55, dt); }
      return p.y > -30 && !(p.temp && p.life > 3);
    },
    draw: function (ctx, p, t, dark) {
      var x = p.x + Math.sin(t * p.f + p.ph) * p.amp;
      var a = p.a * (dark ? 1 : 0.8);
      if (p.temp) a *= Math.max(0, 1 - p.life / 3);
      ctx.globalAlpha = a;
      var img = sprite(dark ? p.c : (p.c === ROSE ? '#E58AA8' : p.c), p.soft), d = p.s * (p.soft ? 1.7 : 1.33);
      ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot + Math.sin(t * p.f + p.ph) * 0.15);
      ctx.drawImage(img, -d / 2, -d / 2, d, d);
      ctx.restore();
    }
  };

  /* Corazones colgantes bajo la barra superior */
  function hangersSVG(width) {
    var h = 30, out = '', x = 14, i = 0, cols = [PINK, ROSE, PINK, GOLD];
    while (x < width - 6) {
      var len = 4 + ((i * 7) % 10), c = cols[i % 4], s = 10 + ((i * 3) % 4);
      out += '<g class="hanger" style="transform-origin:' + x + 'px 0px;animation-delay:-' + ((i * 0.41) % 3).toFixed(2) + 's">' +
        '<path d="M' + x + ' 0V' + len + '" stroke="' + WIRE + '" stroke-width="1"/>' +
        '<path transform="translate(' + (x - s / 2) + ' ' + (len - 1) + ') scale(' + (s / 24) + ')" d="' + HEART + '" fill="' + c + '"/></g>';
      x += 30 + ((i * 11) % 18); i++;
    }
    return '<svg width="' + width + '" height="' + h + '" viewBox="0 0 ' + width + ' ' + h + '" aria-hidden="true">' + out + '</svg>';
  }

  function mount(api) {
    var undo = [];
    var nav = document.getElementById('topNav');
    if (nav) {
      var g = document.createElement('div');
      g.className = 'sv-hangers';
      var build = function () { g.innerHTML = hangersSVG(Math.ceil(nav.getBoundingClientRect().width) || window.innerWidth); };
      build(); nav.appendChild(g);
      api.on(window, 'resize', api.debounce(build, 200));
      undo.push(function () { g.remove(); });
    }
    var badge = document.querySelector('.featured-badge-title');
    if (badge) {
      var original = badge.innerHTML;
      badge.innerHTML = original.replace(/★/g, '<span class="season-badge-emblem">' + heart(12, PINK) + '</span>');
      undo.push(function () { badge.innerHTML = original; });
    }
    return function () { while (undo.length) undo.pop()(); };
  }

  window.ParleySeasonThemes = window.ParleySeasonThemes || {};
  window.ParleySeasonThemes.san_valentin = {
    id: 'san_valentin',
    name: 'San Valentín',
    greeting: '¡Juega con el corazón este San Valentín!',
    emblem: function (size) { return heart(size, PINK); },
    particles: particles,
    mount: mount,
    // Nube de corazones que sube durante 2 s
    entry: function (api) {
      var n = api.isMobile() ? 16 : 30, sent = 0, step = Math.ceil(n / 6);
      var iv = setInterval(function () { api.burst(Math.min(step, n - sent)); sent += step; if (sent >= n) clearInterval(iv); }, 330);
      api.cleanup(function () { clearInterval(iv); });
    },
    // El corazón late y suelta 4 mini corazones
    react: function (btn, api) {
      var svg = btn.querySelector('svg');
      if (svg && svg.animate && api.motionOK() && api.fxOn()) {
        svg.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: 0.3 }, { transform: 'scale(0.92)', offset: 0.55 }, { transform: 'scale(1.12)', offset: 0.75 }, { transform: 'scale(1)' }],
          { duration: 620, easing: 'ease-out' });
      }
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 4; i++) {
        var dx = (i - 1.5) * 12 + rnd(-3, 3), dy = -(30 + rnd(0, 18));
        api.pop(cx, cy, heart(12, i % 3 === 2 ? GOLD : PINK), [
          { transform: 'translate(0,0) scale(0.3)', opacity: 0 },
          { transform: 'translate(' + dx * 0.5 + 'px,' + dy * 0.4 + 'px) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(0.7)', opacity: 0 }
        ], { duration: 900, delay: 120 + i * 60 });
      }
    }
  };
})();
