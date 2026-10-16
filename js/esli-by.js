/* Страница-пасхалка: заставка уезжает по скроллу, свитч гасит сайт. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- Прогресс прокрутки заставки ---------- */
  /* Сцена едет вверх сама, прилипшей заставкой занимается CSS.
     Сюда нужен только 0→1, чтобы текст погас и углы сцены распрямились. */

  var intro = document.getElementById('intro');
  var ticking = false;

  function progress() {
    ticking = false;
    if (!intro) return;
    var h = window.innerHeight || 1;
    var p = window.scrollY / h;
    p = p < 0 ? 0 : (p > 1 ? 1 : p);
    root.style.setProperty('--p', p.toFixed(4));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(progress);
  }

  if (!reduced) {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  } else {
    root.style.setProperty('--p', '1');
  }
  progress();

  /* ---------- Свитч ---------- */

  var sw     = document.getElementById('mSwitch');
  var label  = document.getElementById('mLabel');
  var sad    = false;

  var TEXT_CALM = 'Я подтверждаю, что я не люблю маму';
  var TEXT_SAD  = 'Я не люблю маму';

  if (sw && label) {
    sw.addEventListener('click', function () {
      sad = !sad;
      document.body.classList.toggle('is-sad', sad);
      sw.setAttribute('aria-checked', sad ? 'true' : 'false');
      label.textContent = sad ? TEXT_SAD : TEXT_CALM;
    });
  }

  /* ---------- Печеньки ---------- */

  var cookie = document.getElementById('mCookie');
  var cookieClose = document.getElementById('mCookieClose');

  if (cookie && cookieClose) {
    cookieClose.addEventListener('click', function () {
      cookie.classList.add('is-gone');
      // ждём, пока доиграет исчезновение, и убираем из потока совсем
      setTimeout(function () { cookie.hidden = true; }, reduced ? 0 : 320);
    });
  }

})();
