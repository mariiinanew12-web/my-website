/* Страница-пасхалка: заставка уезжает по скроллу, свитч гасит сайт. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- Прогресс прокрутки заставки ---------- */
  /* Сцена едет вверх сама, прилипшей заставкой занимается CSS.
     Сюда нужен только 0→1, чтобы текст погас и углы сцены распрямились. */

  var intro = document.getElementById('intro');
  var mHeader = document.getElementById('mHeader');
  var ticking = false;

  function progress() {
    ticking = false;
    if (!intro) return;
    var h = window.innerHeight || 1;
    var p = window.scrollY / h;
    p = p < 0 ? 0 : (p > 1 ? 1 : p);
    root.style.setProperty('--p', p.toFixed(4));

    // Пока на экране одна надпись на чёрном, шапку не только не видно —
    // её ещё и нельзя нажать, иначе ловится невидимая кнопка.
    if (mHeader) {
      if (p > 0.6) mHeader.setAttribute('data-live', '1');
      else mHeader.removeAttribute('data-live');
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(progress);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  progress();

  /* ---------- Свитч ---------- */

  var sw     = document.getElementById('mSwitch');
  var label  = document.getElementById('mLabel');
  var btnOrder  = document.getElementById('mBtnOrder');
  var btnClaude = document.getElementById('mBtnClaude');
  var sad    = false;

  var TEXT_CALM = 'Я подтверждаю, что я не люблю маму';
  var TEXT_SAD  = 'Я не люблю маму';

  // Живой всегда остаётся ровно одна кнопка — та, что горит
  function setLive(btn, live) {
    if (!btn) return;
    if (live) {
      btn.removeAttribute('aria-disabled');
      btn.removeAttribute('tabindex');
    } else {
      btn.setAttribute('aria-disabled', 'true');
      btn.setAttribute('tabindex', '-1');
    }
  }

  if (sw && label) {
    sw.addEventListener('click', function () {
      sad = !sad;
      document.body.classList.toggle('is-sad', sad);
      sw.setAttribute('aria-checked', sad ? 'true' : 'false');
      label.textContent = sad ? TEXT_SAD : TEXT_CALM;
      setLive(btnOrder, !sad);
      setLive(btnClaude, sad);
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
