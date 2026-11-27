/* ══════════════════════════════════════════════════════════════
   MODO NAVIDAD — "Noche dorada nevada" (diseño aprobado en Figma)
   · Nieve en 3 profundidades que se mece con el viento.
   · Guirnalda de luces en la barra superior · nieve sobre el banner.
   · Entrada: ráfaga suave de nieve (1 vez al día).
   · Reacción: 3 copos dorados al marcar un favorito.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var GOLD = '#F2C14E', RED = '#E51C23', GREEN = '#3DDC97', WHITE = '#FFFFFF', WIRE = '#2E5E48';

  function flake(size, color) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<g stroke="' + color + '" stroke-width="1.9" stroke-linecap="round">' +
      '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9.5 4.2L12 6.5l2.5-2.3M9.5 19.8L12 17.5l2.5 2.3"/></g></svg>';
  }

  /* Copo suave pre-dibujado (se reutiliza en cada cuadro: barato de pintar) */
  var sprites = {};
  function sprite(dark) {
    var key = dark ? 'd' : 'l';
    if (sprites[key]) return sprites[key];
    var c = document.createElement('canvas'), s = 32;
    c.width = c.height = s;
    var g = c.getContext('2d');
    var rgb = dark ? '255,255,255' : '96,138,170';
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)');
    gr.addColorStop(0.42, 'rgba(' + rgb + ',0.92)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    sprites[key] = c;
    return c;
  }

  // Tres capas de profundidad: lejana (muchos, pequeños, lentos) → cercana (pocos, grandes)
  var LAYERS = [
    { r: [0.9, 1.4], v: [16, 26], a: 0.42, amp: [6, 12] },
    { r: [1.7, 2.4], v: [28, 42], a: 0.66, amp: [10, 18] },
    { r: [2.7, 3.7], v: [46, 66], a: 0.9, amp: [14, 24] }
  ];
  function rnd(range) { return range[0] + Math.random() * (range[1] - range[0]); }
  function pickLayer() { var x = Math.random(); return x < 0.55 ? 0 : (x < 0.88 ? 1 : 2); }

  var particles = {
    mobile: 26,
    desktop: 52,
    spawn: function (vw, vh, initial, o) {
      var burst = o && o.burst;
      var L = LAYERS[burst ? (Math.random() < 0.5 ? 1 : 2) : pickLayer()];
      return {
        x: Math.random() * vw,
        y: initial ? Math.random() * vh : -12 - (burst ? Math.random() * vh * 0.35 : 0),
        r: rnd(L.r),
        vy: rnd(L.v) * (burst ? 2.6 : 1),
        a: L.a,
        amp: rnd(L.amp),
        f: 0.3 + Math.random() * 0.5,
        ph: Math.random() * 6.283,
        temp: !!burst,
        life: 0
      };
    },
    update: function (p, dt, t, vw, vh) {
      p.y += p.vy * dt;
      p.x += Math.sin(t * 0.08) * 9 * dt * (p.r / 3);          // viento suave que cambia lento
      if (p.x < -20) p.x += vw + 40; else if (p.x > vw + 20) p.x -= vw + 40;
      if (p.temp) p.life += dt;
      return p.y < vh + 14 && !(p.temp && p.life > 3.4);
    },
    draw: function (ctx, p, t, dark) {
      var x = p.x + Math.sin(t * p.f + p.ph) * p.amp;
      var a = p.a * (dark ? 1 : 0.75);
      if (p.temp) a *= Math.max(0, 1 - p.life / 3.4);
      ctx.globalAlpha = a;
      var d = p.r * 4;
      ctx.drawImage(sprite(dark), x - d / 2, p.y - d / 2, d, d);
    }
  };

  /* ── Guirnalda de luces bajo la barra superior ── */
  function garlandSVG(width) {
    var step = 30, n = Math.max(6, Math.ceil(width / step) + 1), h = 26;
    var wire = 'M0 8', bulbs = '', colors = [RED, GOLD, WHITE, GREEN];
    for (var i = 0; i < n; i++) {
      var x0 = i * step, xm = x0 + step / 2, x1 = x0 + step;
      wire += ' Q' + xm + ' ' + (i % 2 ? 6 : 18) + ' ' + x1 + ' 10';
      var bx = xm, by = i % 2 ? 9 : 15, c = colors[i % 4];
      var delay = ((i * 0.37) % 2.6).toFixed(2);
      bulbs += '<g class="bulb" style="animation-delay:-' + delay + 's">' +
        '<circle cx="' + bx + '" cy="' + (by + 5) + '" r="7.5" fill="' + c + '" fill-opacity="0.22"/>' +
        '<rect x="' + (bx - 2) + '" y="' + (by - 2) + '" width="4" height="3" rx="1" fill="' + WIRE + '"/>' +
        '<ellipse cx="' + bx + '" cy="' + (by + 5) + '" rx="3.4" ry="4.4" fill="' + c + '"/></g>';
    }
    return '<svg width="' + width + '" height="' + h + '" viewBox="0 0 ' + width + ' ' + h + '" fill="none" aria-hidden="true">' +
      '<path d="' + wire + '" stroke="' + WIRE + '" stroke-width="1.6"/>' + bulbs + '</svg>';
  }

  /* ── Nieve acumulada sobre el borde superior del banner ──
     Montículos bajos e irregulares que se apoyan en el borde (base en y=12)
     con algunas gotas que caen sobre la imagen. Alto total 18px. */
  function snowcapSVG(width) {
    var base = 12, d = 'M0 ' + (base + 2), x = 0, i = 0, drips = '';
    d += ' L0 ' + (base - 3);
    while (x < width) {
      var w = 22 + ((i * 11) % 19), peak = 2 + ((i * 7) % 5);
      var x1 = Math.min(width, x + w);
      d += ' C' + (x + w * 0.25) + ' ' + peak + ' ' + (x + w * 0.75) + ' ' + peak + ' ' + x1 + ' ' + (base - 3 + (i % 2));
      if (i % 3 === 1 && x1 < width - 12) {
        var dx = x + w * 0.55, len = 3 + (i % 4);
        drips += '<path d="M' + (dx - 2.2) + ' ' + (base + 1) + 'q2.2 ' + (len + 3) + ' 4.4 0z" fill="#FFFFFF"/>';
      }
      x = x1; i++;
    }
    d += ' L' + width + ' ' + (base + 2) + ' Z';
    return '<svg width="' + width + '" height="18" viewBox="0 0 ' + width + ' 18" aria-hidden="true">' +
      '<path d="' + d + '" fill="#FFFFFF"/>' +
      '<path d="M0 ' + (base + 1) + ' H' + width + '" stroke="#CFE0EA" stroke-width="1.2" stroke-opacity="0.7"/>' + drips + '</svg>';
  }

  function mount(api) {
    var undo = [];

    // Guirnalda
    var nav = document.getElementById('topNav');
    if (nav) {
      var g = document.createElement('div');
      g.className = 'season-garland';
      var buildG = function () { g.innerHTML = garlandSVG(Math.ceil(nav.getBoundingClientRect().width) || window.innerWidth); };
      buildG();
      nav.appendChild(g);
      api.on(window, 'resize', api.debounce(buildG, 200));
      undo.push(function () { g.remove(); });
    }

    // Nieve sobre el banner
    var wrap = document.getElementById('heroCarouselWrap');
    var carousel = document.getElementById('heroCarousel');
    if (wrap && carousel) {
      var cap = document.createElement('div');
      cap.className = 'season-snowcap';
      var buildC = function () {
        var cr = carousel.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
        var w = Math.max(60, Math.round(cr.width) - 44);
        cap.style.width = w + 'px';
        cap.style.left = Math.round(cr.left - wr.left + (cr.width - w) / 2) + 'px';
        cap.style.top = Math.round(cr.top - wr.top - 10) + 'px';        // la base de la nieve tapa el borde dorado
        cap.innerHTML = snowcapSVG(w);
      };
      wrap.insertBefore(cap, wrap.firstChild);
      buildC();
      api.on(window, 'resize', api.debounce(buildC, 200));
      undo.push(function () { cap.remove(); });
    }

    // Título "SLOTS DESTACADOS": copos en lugar de estrellas
    var badge = document.querySelector('.featured-badge-title');
    if (badge) {
      var original = badge.innerHTML;
      badge.innerHTML = original.replace(/★/g, '<span class="season-badge-emblem">' + flake(12, GOLD) + '</span>');
      undo.push(function () { badge.innerHTML = original; });
    }

    return function () { while (undo.length) undo.pop()(); };
  }

  window.ParleySeasonThemes = window.ParleySeasonThemes || {};
  window.ParleySeasonThemes.navidad = {
    id: 'navidad',
    name: 'Navidad',
    greeting: '¡Felices fiestas! Gira con espíritu navideño',
    emblem: function (size) { return flake(size, GOLD); },
    particles: particles,
    mount: mount,
    // Ráfaga suave de nieve al entrar (1 vez al día)
    entry: function (api) { api.burst(api.isMobile() ? 22 : 40); },
    // Al marcar un favorito caen 3 copos dorados desde el corazón
    react: function (btn, api) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 3; i++) {
        var dx = (i - 1) * 16 + (Math.random() * 6 - 3), dy = 34 + Math.random() * 18, rot = (i - 1) * 70 + 40;
        api.pop(cx, cy, flake(14, GOLD), [
          { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 0 },
          { transform: 'translate(' + (dx * 0.3) + 'px,-10px) rotate(' + (rot * 0.3) + 'deg) scale(1)', opacity: 1, offset: 0.25 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg) scale(0.7)', opacity: 0 }
        ], { duration: 950, delay: i * 70 });
      }
    }
  };
})();
