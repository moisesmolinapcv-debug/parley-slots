/* ══════════════════════════════════════════════════════════════
   MODO VACACIONAL — "Atardecer tropical" (diseño aprobado en Figma)
   · Flores de hibisco cayendo despacio + destellos como luz sobre el agua.
   · Hojas de palmera meciéndose en las esquinas · sol y ola en el banner.
   · Entrada: la ola entra por debajo del banner durante 2 s (1 vez al día).
   · Reacción: JUGAR salpica gotas de agua (también al marcar favorito).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var CORAL = '#FF7A59', TEAL = '#2FD5D0', SAND = '#F6D7A7', LEAF = '#2BAA6E', LEAF2 = '#1F8A58';

  function sun(size, bold) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="' + CORAL + '"/>' +
      '<g stroke="' + (bold ? '#FFC98A' : SAND) + '" stroke-width="' + (bold ? 2.4 : 1.8) + '" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></g></svg>';
  }
  function drop(color) {
    return '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.5C9.4 5 10.5 6.9 10.5 8.6a3.5 3.5 0 0 1-7 0C3.5 6.9 4.6 5 7 1.5z" fill="' + color + '"/></svg>';
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* Hibisco pre-dibujado */
  var flowers = {};
  function hibiscus(color) {
    if (flowers[color]) return flowers[color];
    var s = 40, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'); g.translate(20, 20);
    for (var i = 0; i < 5; i++) {
      g.save(); g.rotate(i * 1.2566);
      g.fillStyle = color; g.beginPath(); g.ellipse(0, -9, 6.5, 9.5, 0, 0, 6.283); g.fill();
      g.restore();
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.beginPath(); g.arc(0, 0, 9, 0, 6.283); g.fill();
    g.fillStyle = '#F6D7A7'; g.beginPath(); g.arc(0, 0, 3, 0, 6.283); g.fill();
    g.strokeStyle = '#F6D7A7'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -8); g.stroke();
    flowers[color] = c; return c;
  }

  var particles = {
    mobile: 12,
    desktop: 18,
    spawn: function (vw, vh, initial) {
      if (Math.random() < 0.4) {                    // destello como luz sobre el agua
        return { k: 'g', x: Math.random() * vw, y: Math.random() * vh, life: initial ? rnd(0, 3) : 0, L: rnd(2.6, 4.2), s: rnd(3, 6), vx: rnd(-4, 4) };
      }
      return { k: 'f', x: Math.random() * vw, y: initial ? Math.random() * vh : -24, vy: rnd(16, 28), s: rnd(12, 20),
        rot: rnd(0, 6.28), vr: rnd(-0.6, 0.6), amp: rnd(10, 24), f: rnd(0.3, 0.6), ph: rnd(0, 6.28), c: Math.random() < 0.75 ? CORAL : '#FF5C8A' };
    },
    update: function (p, dt, t, vw, vh) {
      if (p.k === 'g') { p.life += dt; p.x += p.vx * dt; return p.life < p.L; }
      p.y += p.vy * dt; p.rot += p.vr * dt;
      return p.y < vh + 24;
    },
    draw: function (ctx, p, t, dark) {
      if (p.k === 'g') {
        var k = Math.sin(Math.PI * p.life / p.L);                    // aparece y se apaga suave
        ctx.globalAlpha = k * (dark ? 0.8 : 0.6);
        ctx.fillStyle = dark ? '#E9FFFE' : '#13A9A4';
        var s = p.s * (0.7 + 0.3 * k);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s); ctx.quadraticCurveTo(p.x, p.y, p.x + s * 0.45, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s); ctx.quadraticCurveTo(p.x, p.y, p.x - s * 0.45, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s); ctx.fill();
        return;
      }
      var x = p.x + Math.sin(t * p.f + p.ph) * p.amp;
      ctx.globalAlpha = dark ? 0.85 : 0.75;
      ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot);
      ctx.drawImage(hibiscus(p.c), -p.s / 2, -p.s / 2, p.s, p.s);
      ctx.restore();
    }
  };

  function palmSVG(flip) {
    var leaves = '';
    var angles = [-70, -40, -12, 16, 44];
    angles.forEach(function (a, i) {
      leaves += '<g transform="rotate(' + a + ' 6 58)"><path d="M6 58 C 18 40, 34 26, 58 18 C 40 30, 26 42, 6 58 Z" fill="' + (i % 2 ? LEAF2 : LEAF) + '"/>' +
        '<path d="M6 58 C 20 42, 36 28, 58 18" stroke="#0F5E3A" stroke-width="1" fill="none" stroke-opacity="0.6"/></g>';
    });
    return '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"' + (flip ? ' style="transform:scaleX(-1)"' : '') + '>' + leaves + '</svg>';
  }
  function waveSVG(width) {
    var w = width * 2, d = 'M0 9', x = 0, i = 0;
    while (x < w) { d += ' q 15 ' + (i % 2 ? 6 : -6) + ' 30 0'; x += 30; i++; }
    var foam = d;
    d += ' V20 H0 Z';
    return '<div class="vc-wave-track"><svg width="' + w + '" height="20" viewBox="0 0 ' + w + ' 20" aria-hidden="true">' +
      '<path d="' + d + '" fill="' + TEAL + '" fill-opacity="0.92"/><path d="' + foam + '" stroke="#E9FFFE" stroke-width="2" fill="none" stroke-linecap="round"/></svg></div>';
  }

  function splash(api, x, y) {
    for (var i = 0; i < 4; i++) {
      var dx = (i - 1.5) * 14 + rnd(-3, 3), up = 18 + rnd(0, 12);
      api.pop(x, y, drop(i % 2 ? TEAL : '#9BEFEA'), [
        { transform: 'translate(0,0) scale(0.4)', opacity: 0 },
        { transform: 'translate(' + dx * 0.6 + 'px,-' + up + 'px) scale(1)', opacity: 1, offset: 0.4 },
        { transform: 'translate(' + dx + 'px,6px) scale(0.6)', opacity: 0 }
      ], { duration: 720, delay: i * 30, easing: 'cubic-bezier(0.33, 0, 0.67, 1)' });
    }
  }

  function mount(api) {
    var undo = [];
    var wrap = document.getElementById('heroCarouselWrap');
    var carousel = document.getElementById('heroCarousel');
    if (wrap && carousel) {
      var left = document.createElement('div'); left.className = 'vc-palm vc-palm-l'; left.innerHTML = palmSVG(false);
      var right = document.createElement('div'); right.className = 'vc-corner'; right.innerHTML = '<span class="vc-palm vc-palm-r">' + palmSVG(true) + '</span><span class="vc-sun">' + sun(40, true) + '</span>';
      var wave = document.createElement('div'); wave.className = 'vc-wave';
      var buildW = function () {
        var cr = carousel.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), w = Math.max(60, Math.round(cr.width) - 44);
        wave.style.width = w + 'px';
        wave.style.left = Math.round(cr.left - wr.left + (cr.width - w) / 2) + 'px';
        wave.innerHTML = waveSVG(w);
      };
      wrap.appendChild(left); wrap.appendChild(right); wrap.appendChild(wave);
      buildW();
      api.on(window, 'resize', api.debounce(buildW, 200));
      undo.push(function () { left.remove(); right.remove(); wave.remove(); });
    }
    var badge = document.querySelector('.featured-badge-title');
    if (badge) {
      var original = badge.innerHTML;
      badge.innerHTML = original.replace(/★/g, '<span class="season-badge-emblem">' + sun(14) + '</span>');
      undo.push(function () { badge.innerHTML = original; });
    }
    // JUGAR salpica gotas de agua
    api.on(document, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('.btn-play-always, .featured-play-btn');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      splash(api, r.left + r.width / 2, r.top + 4);
    });
    return function () { while (undo.length) undo.pop()(); };
  }

  window.ParleySeasonThemes = window.ParleySeasonThemes || {};
  window.ParleySeasonThemes.vacacional = {
    id: 'vacacional',
    name: 'Vacacional',
    greeting: '¡Modo vacaciones! Gira bajo el sol',
    emblem: function (size) { return sun(size); },
    particles: particles,
    mount: mount,
    // La ola entra por debajo del banner
    entry: function () { var w = document.querySelector('.vc-wave'); if (w) w.classList.add('is-entering'); },
    react: function (btn, api) { var r = btn.getBoundingClientRect(); splash(api, r.left + r.width / 2, r.top + r.height / 2); }
  };
})();
