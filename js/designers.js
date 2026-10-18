/* ------------------------------------------------------------------
   Ленты мемов. Едут сами, но это обычная горизонтальная прокрутка:
   её можно схватить пальцем, колесом или с клавиатуры, и лента
   послушно встанет. Через пару секунд после того, как её отпустили,
   она снова трогается.
   ------------------------------------------------------------------ */

(function () {
  'use strict';

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-marquee]').forEach(function (box) {
    var track = box.querySelector('[data-track]');
    if (!track) return;

    var speed = parseFloat(box.getAttribute('data-speed')) || 16;   // пикселей в секунду
    var dir   = parseFloat(box.getAttribute('data-dir')) || 1;

    // Дублируем содержимое, чтобы было чем заполнять круг.
    // Копии прячем от скринридера: это те же картинки.
    var copy = track.cloneNode(true);
    copy.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
    copy.setAttribute('aria-hidden', 'true');
    while (copy.firstChild) track.appendChild(copy.firstChild);

    var half = 0;
    function measure() { half = track.scrollWidth / 2; }
    measure();
    new ResizeObserver(measure).observe(track);

    // Если дублированная лента всё равно уже окна, ехать некуда
    var canRun = function () { return half > 4 && box.scrollWidth > box.clientWidth + 4; };

    var paused = false, idle = 0, last = 0, raf = 0, acc = 0;

    function hold() { paused = true; clearTimeout(idle); }
    function release() { clearTimeout(idle); idle = setTimeout(function () { paused = false; }, 2000); }

    box.addEventListener('pointerenter', hold);
    box.addEventListener('pointerleave', release);
    box.addEventListener('pointerdown', hold);
    window.addEventListener('pointerup', release);
    box.addEventListener('touchstart', hold, { passive: true });
    box.addEventListener('touchend', release, { passive: true });
    box.addEventListener('wheel', function () { hold(); release(); }, { passive: true });
    box.addEventListener('focusin', hold);
    box.addEventListener('focusout', release);

    function step(now) {
      raf = 0;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;

      if (!paused && canRun()) {
        acc += speed * dt * dir;
        var whole = acc > 0 ? Math.floor(acc) : Math.ceil(acc);
        if (whole) { box.scrollLeft += whole; acc -= whole; }
      }

      // бесконечный круг: вторая половина — копия первой
      if (half > 4) {
        if (box.scrollLeft >= half) box.scrollLeft -= half;
        else if (box.scrollLeft <= 0) box.scrollLeft += half;
      }

      schedule();
    }

    function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(step); }

    document.addEventListener('visibilitychange', function () { last = 0; schedule(); });

    // Лента вне экрана не тратит кадры
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { last = 0; schedule(); }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }, { threshold: 0 }).observe(box);

    // Старт с середины: обе стороны одинаково свободны для ручной прокрутки
    requestAnimationFrame(function () { measure(); if (dir < 0) box.scrollLeft = half; });

    if (!reduced) schedule();
  });

})();
