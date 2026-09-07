(function () {
  'use strict';

  var stage = document.getElementById('nfStage');
  var bf = document.getElementById('bf');
  var zero = document.getElementById('nfZero');
  var homeBtn = document.getElementById('homeBtn');
  if (!stage || !bf || !zero || !homeBtn) return;

  var flight = bf.querySelector('.bf__flight');
  var tilt = bf.querySelector('.bf__tilt');
  var wingL = bf.querySelector('.bf__wing--left');
  var wingR = bf.querySelector('.bf__wing--right');
  var body = bf.querySelector('.bf__body');
  var boxes = bf.querySelectorAll('.bf__wing-box');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  /* ---------- Опорные точки берём из вёрстки, а не из констант ---------- */

  var track = [];
  var zeroKnockAt = 0;

  function centerOf(el) {
    var r = el.getBoundingClientRect();
    var s = stage.getBoundingClientRect();
    return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
  }

  function buildTrack() {
    var hide = centerOf(homeBtn);
    var slot = centerOf(zero);
    var h = bf.offsetHeight;

    var PEEK = 0.44;                  // пока прячется — маленькая
    // глубина укрытия считается от уменьшенного размера, иначе торчит
    var deep = h * PEEK * 0.5 + 6;
    var above = -h - 320;             // точка за верхним краем сцены

    track = [
      { t: 0.00, x: hide.x, y: hide.y + deep,      s: PEEK,        r: 0 },
      { t: 0.90, x: hide.x, y: hide.y + deep,      s: PEEK,        r: 0 },
      // выглянула и спряталась
      { t: 1.35, x: hide.x, y: hide.y + deep - 64, s: PEEK + 0.02, r: -5 },
      { t: 1.75, x: hide.x, y: hide.y + deep,      s: PEEK,        r: 0 },
      { t: 2.05, x: hide.x, y: hide.y + deep - 38, s: PEEK + 0.01, r: 4 },
      { t: 2.40, x: hide.x, y: hide.y + deep,      s: PEEK,        r: 0 },
      // оп — и вверх
      { t: 3.05, x: hide.x + 50, y: above,         s: 0.34,        r: 14 },
      // за кадром переходит к середине
      { t: 3.50, x: slot.x, y: above,              s: 0.40,        r: -8 },
      // спускается и сталкивает ноль
      { t: 4.35, x: slot.x, y: slot.y + 72,        s: 1.08,        r: 3 },
      { t: 4.95, x: slot.x, y: slot.y,             s: 1.00,        r: 0 }
    ];
    zeroKnockAt = 4.28;
  }

  buildTrack();
  window.addEventListener('resize', function () {
    buildTrack();
    lastW = 0;
  });

  function sample(time) {
    if (time <= track[0].t) return track[0];
    var lastKf = track[track.length - 1];
    if (time >= lastKf.t) return lastKf;
    for (var i = 1; i < track.length; i++) {
      if (time <= track[i].t) {
        var a = track[i - 1], b = track[i];
        var k = smooth((time - a.t) / (b.t - a.t));
        return {
          x: a.x + (b.x - a.x) * k,
          y: a.y + (b.y - a.y) * k,
          s: a.s + (b.s - a.s) * k,
          r: a.r + (b.r - a.r) * k
        };
      }
    }
    return lastKf;
  }

  /* ---------- Взмахи ---------- */

  var phase = 0, amp = 6, speed = 1.6;
  var mode = 'rest', restTimer = 0.5, burstEnd = 0;
  var boost = 0, rage = false, lastW = 0;
  var started = false, t0 = 0, knocked = false;
  var last = performance.now();

  function startBurst(extra) {
    mode = 'burst';
    burstEnd = phase + (3 + Math.floor(Math.random() * 4) + (extra || 0)) * Math.PI * 2;
  }

  homeBtn.addEventListener('pointerenter', function () { rage = true; });
  homeBtn.addEventListener('pointerleave', function () { rage = false; });
  homeBtn.addEventListener('focus', function () { rage = true; });
  homeBtn.addEventListener('blur', function () { rage = false; });

  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    var w = bf.offsetWidth;
    if (w !== lastW) {
      lastW = w;
      var persp = (w * 2.1) + 'px';
      bf.style.perspective = persp;
      for (var i = 0; i < boxes.length; i++) boxes[i].style.perspective = persp;
    }

    var elapsed = started ? (now - t0) / 1000 : 0;
    var p = sample(elapsed);

    // ноль выбивает в момент касания
    if (!knocked && elapsed >= zeroKnockAt) {
      knocked = true;
      zero.classList.add('is-out');
    }

    // ритм взмахов: тише в укрытии, чаще в полёте
    var ampTarget, speedTarget;
    var flying = elapsed > 2.4 && elapsed < 4.95;

    if (rage) {
      mode = 'burst';
      burstEnd = phase + Math.PI * 2;
      ampTarget = 88;
      speedTarget = 26;
    } else if (flying) {
      ampTarget = 74;
      speedTarget = 19;
      mode = 'burst';
      burstEnd = phase + Math.PI * 2;
    } else {
      if (boost > 0) { boost -= dt; if (mode === 'rest') startBurst(1); }
      if (mode === 'rest') {
        restTimer -= dt;
        ampTarget = 5;
        speedTarget = 1.6;
        if (restTimer <= 0) startBurst(0);
      } else {
        ampTarget = 58;
        speedTarget = 12;
        if (phase >= burstEnd) {
          mode = 'rest';
          restTimer = 0.5 + Math.random() * 1.1;
        }
      }
    }
    if (reduced) { ampTarget = 0; speedTarget = 0; }

    amp += (ampTarget - amp) * Math.min(1, dt * 7);
    speed += (speedTarget - speed) * Math.min(1, dt * 6);
    phase += speed * dt;

    var fL = 0.5 - 0.5 * Math.cos(phase);
    var fR = 0.5 - 0.5 * Math.cos(phase - 0.16);
    var aL = amp * fL, aR = amp * fR;
    var u = w / 867;

    wingL.style.transform = 'rotateY(' + aL + 'deg) rotateZ(' + (aL * 0.05) + 'deg)';
    wingR.style.transform = 'rotateY(' + (-aR) + 'deg) rotateZ(' + (-aR * 0.05) + 'deg)';
    body.style.transform = 'translate3d(0,' + (fL * amp * 0.08 * u) + 'px,0)';

    // лёгкое покачивание на месте, когда полёт закончен
    var idle = elapsed > 4.95 && !reduced ? Math.sin(now / 1000 * 0.9) * 4 : 0;
    tilt.style.transform = 'rotateY(' + idle + 'deg)';

    flight.style.transform =
      'translate3d(' + (p.x - w / 2) + 'px,' + (p.y - bf.offsetHeight / 2) + 'px,0) ' +
      'scale(' + p.s + ') rotate(' + p.r + 'deg)';

    requestAnimationFrame(frame);
  }

  /* Старт после загрузки картинок, иначе первый кадр дёрнется */
  function begin() {
    buildTrack();
    bf.classList.add('is-live');
    if (reduced) {
      // без анимации сразу показываем финал
      t0 = performance.now() - 6000;
      started = true;
    } else {
      t0 = performance.now();
      started = true;
      startBurst(1);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'complete') {
    setTimeout(begin, 250);
  } else {
    window.addEventListener('load', function () { setTimeout(begin, 250); });
  }
})();
