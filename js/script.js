(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isDesktop = window.matchMedia('(min-width: 901px)');

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ---------- FAQ: вопросы раскрываются независимо ---------- */
  document.querySelectorAll('.faq-card').forEach(function (card) {
    card.setAttribute('aria-expanded', 'false');
    card.addEventListener('click', function () {
      var open = card.classList.toggle('is-open');
      card.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Мобильное меню ---------- */
  var menu = document.getElementById('mobileMenu');
  var menuOpen = document.getElementById('menuOpen');
  var menuClose = document.getElementById('menuClose');

  if (menu && menuOpen && menuClose) {
    var setMenu = function (open) {
      menu.hidden = !open;
      menuOpen.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
      if (open) menuClose.focus();
    };
    menuOpen.addEventListener('click', function () { setMenu(true); });
    menuClose.addEventListener('click', function () { setMenu(false); });
    menu.addEventListener('click', function (e) {
      if (e.target === menu || e.target.closest('.menu__link')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) setMenu(false);
    });
  }

  /* ---------- Свитч: включение запускает салют из эмодзи ---------- */
  var funSwitch = document.getElementById('funSwitch');

  function launchEmojis() {
    if (reduced) return;
    var chars = ['🔥', '🎯', '🦋', '💙', '🚀', '🎉', '💖', '🩷', '✨', '💫', '⚡', '🌟'];
    var layer = document.createElement('div');
    layer.className = 'fun-layer';
    document.body.appendChild(layer);

    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var count = 34;
    var done = 0;

    var finish = function () {
      done++;
      if (done >= count && layer.parentNode) layer.parentNode.removeChild(layer);
    };

    for (var i = 0; i < count; i++) {
      var el = document.createElement('span');
      el.className = 'fun-emoji';
      el.textContent = chars[Math.floor(Math.random() * chars.length)];

      // вылетают преимущественно из левого и правого нижних углов
      var fromLeft = i % 2 === 0;
      el.style.left = (fromLeft
        ? vw * (Math.random() * 0.16)
        : vw * (0.84 + Math.random() * 0.16)) + 'px';
      el.style.top = vh + 'px';
      el.style.fontSize = (38 + Math.random() * 34) + 'px';
      layer.appendChild(el);

      // к середине экрана гаснут, уходя к центру
      var riseY = -(vh * (0.45 + Math.random() * 0.25));
      var driftX = (fromLeft ? 1 : -1) * vw * (0.06 + Math.random() * 0.22);
      var spin = (Math.random() * 2 - 1) * 240;

      var anim = el.animate([
        { transform: 'translate3d(0,0,0) scale(0.4) rotate(0deg)', opacity: 0 },
        { transform: 'translate3d(' + (driftX * 0.45) + 'px,' + (riseY * 0.55) + 'px,0) scale(1) rotate(' + (spin * 0.5) + 'deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate3d(' + driftX + 'px,' + riseY + 'px,0) scale(0.9) rotate(' + spin + 'deg)', opacity: 0 }
      ], {
        duration: 1500 + Math.random() * 900,
        delay: Math.random() * 420,
        easing: 'cubic-bezier(0.16, 0.7, 0.35, 1)',
        fill: 'forwards'
      });
      anim.onfinish = finish;
      anim.oncancel = finish;
    }
  }

  if (funSwitch) {
    funSwitch.addEventListener('click', function () {
      var on = funSwitch.classList.toggle('is-on');
      funSwitch.setAttribute('aria-checked', String(on));
      if (on) launchEmojis();      // выключение проходит тихо
    });
  }

  /* ---------- Группы услуг разъезжаются перед срочной плашкой ---------- */
  var groupSites = document.querySelector('.services__group--sites');
  var groupProducts = document.querySelector('.services__group--products');
  var banner = document.querySelector('.cta-banner');
  var bannerWrap = document.querySelector('.cta-banner-wrap');

  function updateServices() {
    if (!groupSites || !groupProducts || !bannerWrap) return;
    if (reduced || !isDesktop.matches) {
      groupSites.style.transform = groupProducts.style.transform = '';
      groupSites.style.opacity = groupProducts.style.opacity = '';
      if (banner) { banner.style.transform = ''; banner.style.opacity = ''; }
      return;
    }
    // меряем обёртку: она не двигается, поэтому расчёт не зациклится
    var r = bannerWrap.getBoundingClientRect();
    var vh = window.innerHeight;

    // Плашка тихо подбирается снизу. Нарочно длинный ход и слабое смещение,
    // чтобы это не читалось как анимация.
    var bp = clamp((vh - r.top) / (vh * 0.55), 0, 1);
    var be = 1 - Math.pow(1 - bp, 3);
    banner.style.transform = 'translate3d(0,' + ((1 - be) * 90) + 'px,0)';
    banner.style.opacity = String(clamp(bp * 1.7, 0, 1));

    // Карточки расходятся, пока плашка ещё поднимается, а не когда она уже вверху
    var p = clamp((vh * 0.88 - r.top) / (vh * 0.5), 0, 1);
    p = p * p * p * (p * (p * 6 - 15) + 10);
    groupSites.style.transform = 'translate3d(-' + (p * 115) + '%,0,0)';
    groupProducts.style.transform = 'translate3d(' + (p * 115) + '%,0,0)';
    groupSites.style.opacity = groupProducts.style.opacity = String(1 - p * 0.9);
  }

  /* ---------- Бабочка ---------- */
  var stage = document.getElementById('bf');
  var bfL = null;

  if (stage) {
    bfL = {
      flight: stage.querySelector('.bf__flight'),
      depart: stage.querySelector('.bf__depart'),
      tilt:   stage.querySelector('.bf__tilt'),
      wingL:  stage.querySelector('.bf__wing--left'),
      wingR:  stage.querySelector('.bf__wing--right'),
      body:   stage.querySelector('.bf__body'),
      boxes:  stage.querySelectorAll('.bf__wing-box')
    };
  }

  var CFG = {
    ampBurst: 70,     // размах взмаха, градусы
    speedBurst: 13,   // скорость взмаха
    restMax: 1,       // максимальная пауза между сериями, сек
    tiltMax: 16,      // предел наклона за курсором
    escape: 0.16      // насколько далеко убегает, в долях ширины сцены
  };

  var px = 0, py = 0, pointerSeen = false;
  var tiltX = 0, tiltY = 0, vX = 0, vY = 0;
  var escX = 0, escY = 0, escRoll = 0;
  var phase = 0, amp = 5, speed = 1.5;
  var mode = 'rest', restTimer = 0.6, burstEnd = 0;
  var prox = 0, proxSmooth = 0, proxPrev = 0;
  var boost = 0, lastW = 0, exit = 0, rage = false;
  var last = performance.now();

  if (bfL && hasPointer && !reduced) {
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY; pointerSeen = true;
    }, { passive: true });
  }

  function startBurst(extra) {
    mode = 'burst';
    burstEnd = phase + (3 + Math.floor(Math.random() * 4) + (extra || 0)) * Math.PI * 2;
  }

  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;

    updateServices();

    if (bfL) {
      var r = stage.getBoundingClientRect();
      var u = r.width / 867;
      var bx = r.left + r.width * 0.5;
      var by = r.top + r.height * 0.6183;

      if (r.width !== lastW) {
        lastW = r.width;
        var persp = (r.width * 2.1) + 'px';
        stage.style.perspective = persp;
        for (var i = 0; i < bfL.boxes.length; i++) bfL.boxes[i].style.perspective = persp;
      }

      var dirX = 0, dirY = 0;
      if (pointerSeen && !reduced) {
        var dx = bx - px, dy = by - py;
        var dist = Math.hypot(dx, dy) || 1;
        dirX = dx / dist; dirY = dy / dist;
        prox = clamp(1 - (dist - r.width * 0.32) / (r.width * 0.95), 0, 1);
      }
      proxSmooth += (prox - proxSmooth) * Math.min(1, dt * 6);

      if (prox > 0.55 && proxPrev <= 0.55) { startBurst(2); boost = 0.7; }
      proxPrev = prox;

      var ampTarget, speedTarget;
      if (boost > 0) { boost -= dt; if (mode === 'rest') startBurst(1); }

      if (mode === 'rest') {
        restTimer -= dt;
        ampTarget = 4 + proxSmooth * 5;
        speedTarget = 1.5 + proxSmooth * 1.2;
        if (restTimer <= 0) startBurst(proxSmooth > 0.5 ? 1 : 0);
      } else {
        ampTarget = CFG.ampBurst * (0.82 + proxSmooth * 0.25);
        speedTarget = CFG.speedBurst * (0.85 + proxSmooth * 0.45);
        if (phase >= burstEnd) {
          mode = 'rest';
          var lo = CFG.restMax * 0.45 * (1 - proxSmooth * 0.9);
          var hi = CFG.restMax * (1 - proxSmooth * 0.85);
          restTimer = lo + Math.random() * Math.max(0.05, hi - lo);
        }
      }
      if (rage) {                       // курсор на «Обсудить идею» — зовём изо всех сил
        mode = 'burst';
        burstEnd = phase + Math.PI * 2;
        ampTarget = 88;
        speedTarget = 26;
      }
      if (reduced) { ampTarget = 0; speedTarget = 0; }

      amp += (ampTarget - amp) * Math.min(1, dt * 7);
      speed += (speedTarget - speed) * Math.min(1, dt * 6);
      phase += speed * dt;

      var fL = 0.5 - 0.5 * Math.cos(phase);
      var fR = 0.5 - 0.5 * Math.cos(phase - 0.16);
      var aL = amp * fL, aR = amp * fR;

      bfL.wingL.style.transform = 'rotateY(' + aL + 'deg) rotateZ(' + (aL * 0.05) + 'deg)';
      bfL.wingR.style.transform = 'rotateY(' + (-aR) + 'deg) rotateZ(' + (-aR * 0.05) + 'deg)';
      bfL.body.style.transform = 'translate3d(0,' + (fL * amp * 0.08 * u) + 'px,0)';

      var esc = proxSmooth * proxSmooth;
      escX += (dirX * esc * r.width * CFG.escape - escX) * Math.min(1, dt * 4.5);
      escY += ((dirY * esc * r.width * CFG.escape * 0.45 - esc * r.width * 0.03) - escY) * Math.min(1, dt * 4.5);
      escRoll += (dirX * esc * 7 - escRoll) * Math.min(1, dt * 4);

      var tX, tY;
      if (reduced) {
        tX = 0; tY = 0;
      } else if (pointerSeen) {
        var look = 1 - esc * 0.55;
        tY = clamp((px - bx) / (r.width * 0.9), -1, 1) * CFG.tiltMax * look;
        tX = -clamp((py - by) / (r.height * 0.9), -1, 1) * CFG.tiltMax * 0.62 * look;
      } else {
        var t = now / 1000;
        tY = Math.sin(t * 0.45) * CFG.tiltMax * 0.42;
        tX = Math.sin(t * 0.33 + 1.1) * CFG.tiltMax * 0.26;
      }

      var damping = Math.pow(0.80, dt * 60);
      vX += (tX - tiltX) * 60 * dt; vX *= damping; tiltX += vX * dt;
      vY += (tY - tiltY) * 60 * dt; vY *= damping; tiltY += vY * dt;

      bfL.tilt.style.transform =
        'translate3d(' + (escX + tiltY * 0.9 * u) + 'px,' + (escY - tiltX * 0.9 * u) + 'px,0) ' +
        'rotateZ(' + escRoll + 'deg) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)';

      // улетает вверх, когда блок уходит за верх экрана. Крутишь назад — возвращается.
      var eT = clamp(-r.top / (r.height * 0.85), 0, 1);
      var eE = eT * eT * (3 - 2 * eT);
      exit += (eE - exit) * Math.min(1, dt * 9);
      if (exit > 0.004) {
        bfL.depart.style.transform =
          'translate3d(' + (exit * r.width * 0.06) + 'px,' + (-exit * r.height * 1.25) + 'px,0) ' +
          'scale(' + (1 - exit * 0.72) + ') rotate(' + (-exit * 10) + 'deg)';
        bfL.depart.style.opacity = String(Math.max(0, 1 - exit * 1.15));
        if (exit > 0.05 && mode === 'rest') startBurst(2);
      } else if (bfL.depart.style.transform) {
        bfL.depart.style.transform = '';
        bfL.depart.style.opacity = '';
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  var ideaBtn = document.getElementById('ideaBtn');
  if (bfL && ideaBtn && hasPointer && !reduced) {
    ideaBtn.addEventListener('pointerenter', function () { rage = true; });
    ideaBtn.addEventListener('pointerleave', function () { rage = false; });
    ideaBtn.addEventListener('focus', function () { rage = true; });
    ideaBtn.addEventListener('blur', function () { rage = false; });
  }

  /* На тач-устройствах курсора нет: живёт сама, но отзывается на касание */
  if (bfL && !hasPointer && !reduced) {
    var calmTimer;
    stage.addEventListener('pointerdown', function (e) {
      px = e.clientX; py = e.clientY;
      pointerSeen = true;
      prox = 1; proxSmooth = 1;
      startBurst(4);
      boost = 1.2;
      clearTimeout(calmTimer);
      calmTimer = setTimeout(function () { pointerSeen = false; prox = 0; }, 1500);
    }, { passive: true });
  }

  /* Прилёт при первом появлении блока */
  if (bfL) {
    if (reduced || !('IntersectionObserver' in window)) {
      stage.classList.add('is-in');
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            stage.classList.add('is-in');
            boost = 1.9;
            startBurst(5);
            io.disconnect();
          }
        });
      }, { threshold: 0.3 });
      io.observe(stage);
    }
  }
})();
