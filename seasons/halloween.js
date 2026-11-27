/* ══════════════════════════════════════════════════════════════
   MODO HALLOWEEN — "Casino embrujado elegante" (diseño aprobado en Figma)
   · Brasas naranjas flotando + 1 murciélago que cruza cada 8–12 s.
   · Niebla baja que se desliza · araña colgante y telaraña en la barra
     · luna llena sobre el banner. Misterioso y elegante, nunca grotesco.
   · Entrada: la niebla sube desde abajo durante 2 s (1 vez al día).
   · Reacción: JUGAR enciende una brasa (y el favorito suelta 3 brasas).
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ORANGE = '#FF7A1A', VIOLET = '#8B5CF6', LIME = '#B6F23C', MOON = '#F6E7B8';
  var CRESCENT = 'M15 3a9 9 0 1 0 6 15A8 8 0 0 1 15 3z';

  function crescent(size, color) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + CRESCENT + '" fill="' + color + '"/></svg>';
  }
  function ember(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="' + ORANGE + '" fill-opacity="0.28"/><circle cx="12" cy="12" r="4.5" fill="#FFB36B"/></svg>';
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* Brasa suave pre-dibujada */
  var glow = {};
  function sprite(dark) {
    var k = dark ? 'd' : 'l';
    if (glow[k]) return glow[k];
    var s = 32, c = document.createElement('canvas'); c.width = c.height = s;
    var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    var core = dark ? '255,190,120' : '214,92,10', edge = dark ? '255,122,26' : '214,92,10';
    gr.addColorStop(0, 'rgba(' + core + ',1)'); gr.addColorStop(0.3, 'rgba(' + edge + ',0.8)'); gr.addColorStop(1, 'rgba(' + edge + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    glow[k] = c; return c;
  }

  var A = null, nextBat = 0;
  var particles = {
    mobile: 16,
    desktop: 30,
    tick: function (dt, t, vw, vh, api) {
      A = api;
      if (!nextBat) nextBat = t + 3;
      if (t >= nextBat) {
        var ltr = Math.random() < 0.5;
        api.emit({ k: 'bat', x: ltr ? -30 : vw + 30, vx: (ltr ? 1 : -1) * rnd(90, 130), y0: vh * rnd(0.12, 0.4), y: 0,
          amp: rnd(14, 26), f: rnd(1.4, 2.2), s: rnd(13, 18), ph: rnd(0, 6.28) });
        nextBat = t + rnd(8, 12);
      }
    },
    spawn: function (vw, vh, initial) {
      return { k: 'e', x: Math.random() * vw, y: initial ? Math.random() * vh : vh + 10, vy: rnd(12, 28),
        r: rnd(1.2, 2.8), amp: rnd(6, 16), f: rnd(0.3, 0.8), ph: rnd(0, 6.28), fl: rnd(3, 7) };
    },
    update: function (p, dt, t, vw, vh) {
      if (p.k === 'bat') { p.x += p.vx * dt; p.y = p.y0 + Math.sin(t * p.f + p.ph) * p.amp; return p.x > -40 && p.x < vw + 40; }
      p.y -= p.vy * dt;
      return p.y > -10;
    },
    draw: function (ctx, p, t, dark) {
      if (p.k === 'bat') {
        var flap = Math.sin(t * 16 + p.ph), s = p.s, dir = p.vx > 0 ? 1 : -1;
        ctx.globalAlpha = dark ? 0.9 : 0.75;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(dir, 1);
        ctx.fillStyle = dark ? '#1A0E2B' : '#2A1840';
        ctx.strokeStyle = dark ? 'rgba(139,92,246,0.55)' : 'rgba(42,24,64,0.6)'; ctx.lineWidth = 0.8;
        var wy = -s * 0.55 * flap;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-s * 0.5, wy - s * 0.2, -s, wy * 0.8);
        ctx.quadraticCurveTo(-s * 0.7, s * 0.05, -s * 0.45, s * 0.12);
        ctx.quadraticCurveTo(-s * 0.25, s * 0.02, 0, s * 0.18);
        ctx.quadraticCurveTo(s * 0.25, s * 0.02, s * 0.45, s * 0.12);
        ctx.quadraticCurveTo(s * 0.7, s * 0.05, s, wy * 0.8);
        ctx.quadraticCurveTo(s * 0.5, wy - s * 0.2, 0, 0);
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, s * 0.06, s * 0.14, s * 0.2, 0, 0, 6.283); ctx.fill();
        ctx.restore();
        return;
      }
      var x = p.x + Math.sin(t * p.f + p.ph) * p.amp;
      ctx.globalAlpha = (0.55 + 0.4 * Math.sin(t * p.fl + p.ph)) * (dark ? 0.9 : 0.6);     // titila suave
      var d = p.r * 5;
      ctx.drawImage(sprite(dark), x - d / 2, p.y - d / 2, d, d);
    }
  };

  function webSVG() {
    return '<svg width="46" height="40" viewBox="0 0 46 40" fill="none" aria-hidden="true"><g stroke="#B6A6CC" stroke-opacity="0.55" stroke-width="0.9">' +
      '<path d="M46 0L6 40M46 0L22 40M46 0L38 40M46 0L0 22M46 0L0 6"/>' +
      '<path d="M40 0q-2 4 1 7q3 -2 5 -1M33 0q-3 8 3 13q7 -4 10 -3M25 0q-4 12 5 20q11 -6 16 -4M16 0q-5 16 8 27q14 -8 22 -6"/></g></svg>';
  }
  function spiderSVG() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><g stroke="#B6A6CC" stroke-width="1" stroke-linecap="round">' +
      '<path d="M5 6L1 3M5 8H0M5 10l-4 3M11 6l4-3M11 8h5M11 10l4 3"/></g>' +
      '<ellipse cx="8" cy="9" rx="3.4" ry="4" fill="#1D1029" stroke="#8B5CF6" stroke-width="0.8"/><circle cx="7" cy="8" r="0.7" fill="#FF7A1A"/><circle cx="9" cy="8" r="0.7" fill="#FF7A1A"/></svg>';
  }
  function moonSVG() {
    return '<svg width="62" height="62" viewBox="0 0 62 62" aria-hidden="true"><defs><radialGradient id="hwg"><stop offset="0.55" stop-color="#F6E7B8" stop-opacity="0.35"/><stop offset="1" stop-color="#F6E7B8" stop-opacity="0"/></radialGradient></defs>' +
      '<circle cx="31" cy="31" r="31" fill="url(#hwg)"/><circle cx="31" cy="31" r="18" fill="' + MOON + '"/>' +
      '<circle cx="25" cy="26" r="3.2" fill="#E2CD92"/><circle cx="36" cy="35" r="4.2" fill="#E2CD92"/><circle cx="34" cy="23" r="1.8" fill="#E2CD92"/></svg>';
  }

  function mount(api) {
    var undo = [];
    A = api; nextBat = 0;

    // Telaraña y araña colgante (lado derecho de la barra)
    var nav = document.getElementById('topNav');
    if (nav) {
      var deco = document.createElement('div');
      deco.className = 'hw-navdeco';
      deco.innerHTML = '<span class="hw-web">' + webSVG() + '</span><span class="hw-spider"><i class="hw-thread"></i>' + spiderSVG() + '</span>';
      nav.appendChild(deco);
      undo.push(function () { deco.remove(); });
    }
    // Luna llena sobre la esquina del banner
    var wrap = document.getElementById('heroCarouselWrap');
    if (wrap) {
      var m = document.createElement('div');
      m.className = 'hw-moon';
      m.innerHTML = moonSVG();
      wrap.appendChild(m);
      undo.push(function () { m.remove(); });
    }
    // Niebla baja (detrás del contenido)
    var atm = document.querySelector('.casino-atmosphere-wrap') || document.body;
    var fog = document.createElement('div');
    fog.className = 'hw-fog';
    fog.setAttribute('aria-hidden', 'true');
    fog.innerHTML = '<i class="f1"></i><i class="f2"></i>';
    atm.appendChild(fog);
    undo.push(function () { fog.remove(); });

    var badge = document.querySelector('.featured-badge-title');
    if (badge) {
      var original = badge.innerHTML;
      badge.innerHTML = original.replace(/★/g, '<span class="season-badge-emblem">' + crescent(12, ORANGE) + '</span>');
      undo.push(function () { badge.innerHTML = original; });
    }

    // JUGAR enciende una brasa
    api.on(document, 'click', function (e) {
      var btn = e.target.closest && e.target.closest('.btn-play-always, .featured-play-btn');
      if (!btn) return;
      var r = btn.getBoundingClientRect();
      api.pop(r.left + r.width / 2, r.top, ember(18), [
        { transform: 'translate(0,0) scale(0.3)', opacity: 0 },
        { transform: 'translate(0,-12px) scale(1.1)', opacity: 1, offset: 0.3 },
        { transform: 'translate(4px,-30px) scale(0.5)', opacity: 0 }
      ], { duration: 700 });
    });
    return function () { while (undo.length) undo.pop()(); };
  }

  window.ParleySeasonThemes = window.ParleySeasonThemes || {};
  window.ParleySeasonThemes.halloween = {
    id: 'halloween',
    name: 'Halloween',
    greeting: 'Noche de premios embrujados',
    emblem: function (size) { return crescent(size, ORANGE); },
    particles: particles,
    mount: mount,
    // La niebla sube desde abajo durante 2 s
    entry: function () {
      var fog = document.querySelector('.hw-fog');
      if (fog) fog.classList.add('is-entering');
    },
    react: function (btn, api) {
      var r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      for (var i = 0; i < 3; i++) {
        var dx = (i - 1) * 12 + rnd(-3, 3);
        api.pop(cx, cy, ember(12), [
          { transform: 'translate(0,0) scale(0.4)', opacity: 0 },
          { transform: 'translate(' + dx * 0.4 + 'px,-10px) scale(1)', opacity: 1, offset: 0.3 },
          { transform: 'translate(' + dx + 'px,-34px) scale(0.5)', opacity: 0 }
        ], { duration: 850, delay: i * 80 });
      }
    }
  };
})();
