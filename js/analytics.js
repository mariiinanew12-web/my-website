/* ------------------------------------------------------------------
   Аналитика. Вставь номер счётчика из Яндекс.Метрики в строку ниже
   и больше здесь ничего трогать не нужно.
   ------------------------------------------------------------------ */
var COUNTER_ID = 0;   // ← например: 99887766

(function () {
  'use strict';
  if (!COUNTER_ID) return;   // без номера счётчика ничего не грузим

  /* --- стандартный инициализатор Метрики --- */
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    for (var j = 0; j < e.scripts.length; j++) {
      if (e.scripts[j].src === r) return;
    }
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  ym(COUNTER_ID, 'init', {
    clickmap: true,             // карта кликов
    trackLinks: true,           // переходы по внешним ссылкам
    accurateTrackBounce: true,  // отказы считаются честнее
    webvisor: true              // записи сессий
  });

  function hit(goal, params) {
    if (window.ym) ym(COUNTER_ID, 'reachGoal', goal, params || {});
  }

  /* --- Цели: клик по любому элементу с data-goal --- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-goal]');
    if (el) hit(el.getAttribute('data-goal'));
  }, true);

  /* --- Сколько времени человек провёл на каждом блоке --- */
  var seen = {};        // накопленное время по блокам, мс
  var visible = {};     // когда блок попал в кадр
  var lastBlock = '';

  function nameOf(el) {
    return el.id || (el.className || '').split(' ')[0] || 'unknown';
  }

  var blocks = document.querySelectorAll('section, .cp, .nf, .case-main');

  if ('IntersectionObserver' in window && blocks.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var name = nameOf(entry.target);
        if (entry.isIntersecting) {
          visible[name] = performance.now();
          lastBlock = name;
        } else if (visible[name]) {
          seen[name] = (seen[name] || 0) + (performance.now() - visible[name]);
          delete visible[name];
        }
      });
    }, { threshold: 0.5 });   // блок считается просмотренным, если виден наполовину

    blocks.forEach(function (b) { io.observe(b); });
  }

  /* --- Отправляем всё разом при уходе со страницы --- */
  var sent = false;
  function flush() {
    if (sent || !window.ym) return;
    sent = true;

    var now = performance.now();
    Object.keys(visible).forEach(function (name) {
      seen[name] = (seen[name] || 0) + (now - visible[name]);
    });

    var blocksSec = {};
    Object.keys(seen).forEach(function (name) {
      var sec = Math.round(seen[name] / 1000);
      if (sec > 0) blocksSec[name] = sec;
    });

    ym(COUNTER_ID, 'params', {
      blocks: blocksSec,               // секунды по каждому блоку
      exit_block: lastBlock,           // на каком блоке ушли
      session_sec: Math.round(now / 1000)
    });
  }

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
})();
