/* ------------------------------------------------------------------
   Страница Гали. Вся логика тамагочи живёт здесь, внешний вид бабочки —
   в assets/galya/galya.js, который трогать нельзя.

   Данные никуда не уходят: только localStorage этого браузера.
   ------------------------------------------------------------------ */

/* ЗАПОЛНИ, КОГДА ПОЯВИТСЯ МАГАЗИН. Пустая строка — реплика про магазин
   просто не участвует в болтовне, ничего не ломается. */
const SHOP_URL = '';

const CASES_URL    = 'index.html#portfolio';
const THREADS_URL  = 'https://www.threads.com/@mgmdvmrn';
const TELEGRAM_URL = 'https://t.me/qualcunodai';

/* ---------- реплики ---------- */

const LINES = {
  first: [
    'Привет! Я Галя. Живу тут, слежу за курсором и пью кофе.',
    'О, новый человек! Я Галя, местная бабочка-фавикон.'
  ],
  back: [
    'Снова ты! Я даже не успела соскучиться.',
    'Ты вернулась быстрее, чем клиент с правками.',
    'О, привет ещё раз. Кофе захватила?'
  ],
  backLong: [
    'Где ты была? Я тут без тебя пиксели пересчитывала.',
    'Наконец-то! Я уже думала, ты ушла в Figma навсегда.'
  ],
  jubilee: {
    10:  'Десятый визит! Можно я буду звать тебя постоянным клиентом?',
    25:  '25 визитов. Это уже дружба или ретейнер?',
    50:  'Полсотни! Поставлю твой курсор в портфолио.',
    100: 'Сотый визит. Я официально твоя бабочка.'
  },
  morning: 'Доброе утро! Кофе будет?',
  evening: 'Уже зеваю. Скоро спать, бабочки ложатся до полуночи.',
  phone: 'Кстати, я умею больше на компуктере.',
  chat: [
    { text: 'Если долго смотреть на сетку, сетка начинает смотреть на тебя.' },
    { text: 'Я не залипаю, я проверяю отступы.' },
    { text: 'Мне нравится твой курсор. Очень пиксель-перфект.' },
    { text: 'Иногда я мечтаю стать векторной.' },
    { text: 'Почему у меня прозрачные крылья? Ничего лишнего, как в хорошем интерфейсе.' },
    { text: 'Подпишитесь на мой тредс.', href: THREADS_URL, link: 'вот он' },
    { text: 'Мне кажется, ты хочешь обсудить проект с моей создательницей.', href: TELEGRAM_URL, link: 'написать ей' },
    { text: 'Сумочка Jacquemus...' },
    { text: 'Хочу бешбармак.' },
    { text: 'Я всё узнаю в вебвизоре!!' },
    { text: 'Хорошего тебе дня.' },
    { text: 'Посылаю в космос импульс, чтобы тебе благоволила удача.' },
    { text: 'Кстати, тут есть кейсы. Я в них почти снималась.', href: CASES_URL, link: 'посмотреть' },
    { text: 'Тут продаются штуки для дизайнеров. Я бы купила, но у меня лапки.', href: SHOP_URL, link: 'в магазин' }
  ],
  pet: ['хи-хи', 'ещё!', 'мурр... ой, это не мой звук', 'щекотно!'],
  wing: 'осторожно, крылышко!',
  tickle: ['Всё-всё, сдаюсь!', 'Ты кликаешь как заказчик за час до дедлайна.'],
  coffee: [
    'Ммм, американо. Теперь можно и макет собрать.',
    'Второй кофе. Я чувствую кернинг.',
    'Третий... я вижу шрифты без сглаживания.'
  ],
  tooMuch: ['Я. Слышу. Цвета.', 'Ещё одна чашка, и я начну редизайн всего сайта.'],
  enough: [
    'Нет-нет, крылья и так дрожат. Завтра!',
    'Лимит кофе на сегодня исчерпан. Как и бюджет у клиента.'
  ],
  hungry: ['Кофе?..', 'Я бы не отказалась от американо. Или двух.', 'Без кофе я работаю в режиме wireframe.'],
  sleep: ['хррр... кернинг... хррр', 'zzz... переделай кнопку... zzz', '*сопит в макет*'],
  woken: [
    'М-м... у меня в Москве ночь. Приходи после восьми.',
    'Пять минуточек... ну или до утра.',
    'Тсс. Я в спящем режиме, как твой ноутбук.'
  ]
};

/* ---------- московское время ---------- */

const mskParts = () => Object.fromEntries(new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit',
  year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23'
}).formatToParts(new Date()).map(p => [p.type, p.value]));

const mskHour = () => Number(mskParts().hour);
const mskClock = () => { const p = mskParts(); return p.hour + ':' + p.minute; };
const mskDate  = () => { const p = mskParts(); return p.year + '-' + p.month + '-' + p.day; };

const isNight = () => { const h = mskHour(); return h >= 23 || h < 8; };

/* Телефон: пальцем не наведёшь, так что часть фокусов Гали недоступна */
const onPhone = () => window.matchMedia
  && (matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 760px)').matches);

/* ---------- хранилище ---------- */
/* В приватном окне localStorage может быть недоступен — тогда страница
   просто работает как при первом визите. */

const KEY = 'galya.v1';
const BLANK = { visits: 0, firstVisit: 0, lastVisit: 0, lastFed: 0, cupsDate: '', cupsToday: 0, pets: 0 };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? Object.assign({}, BLANK, JSON.parse(raw)) : Object.assign({}, BLANK);
  } catch (e) { return Object.assign({}, BLANK); }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* и ладно */ }
}

const S = load();

/* ---------- визит ---------- */

const HALF_HOUR = 30 * 60 * 1000;
const SIX_HOURS = 6 * 60 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

const now0 = Date.now();
const isFirstVisit = S.visits === 0;
const gapSinceLast = S.lastVisit ? now0 - S.lastVisit : 0;
const isNewVisit = !S.lastVisit || gapSinceLast > HALF_HOUR;   // перезагрузка визитом не считается

if (isNewVisit) {
  S.visits += 1;
  if (!S.firstVisit) S.firstVisit = now0;
}
S.lastVisit = now0;
save();

/* ---------- элементы ---------- */

const stage    = document.getElementById('gpStage');
const host     = document.getElementById('galya');
const fallback = document.getElementById('gpFallback');
const loader   = document.getElementById('gpLoader');
const bubble   = document.getElementById('gpBubble');
const statusEl = document.getElementById('gpStatus');
const btnPet   = document.getElementById('gpPet');
const btnCup   = document.getElementById('gpCoffee');
const cupEl    = document.getElementById('gpCup');

const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------- пузырь ---------- */

let bubbleTimer = 0;

function say(text, ms = 3500) { showBubble({ text: text }, ms); }

function showBubble(line, ms) {
  clearTimeout(bubbleTimer);
  const hasLink = Boolean(line.href);

  bubble.textContent = line.text;
  bubble.classList.toggle('has-link', hasLink);

  if (hasLink) {
    const a = document.createElement('a');
    a.href = line.href;
    a.textContent = line.link || 'открыть';
    bubble.append(' ', a);
  }

  bubble.hidden = false;
  requestAnimationFrame(() => bubble.classList.add('is-on'));

  // реплике со ссылкой даём пожить подольше, чтобы по ней успели попасть
  bubbleTimer = setTimeout(hideBubble, hasLink ? 9000 : (ms || 3500));
}

function hideBubble() {
  bubble.classList.remove('is-on');
  setTimeout(() => { if (!bubble.classList.contains('is-on')) bubble.hidden = true; }, 240);
}

// пока на пузырь со ссылкой наведён курсор, не убираем его
bubble.addEventListener('pointerenter', () => { if (bubble.classList.contains('has-link')) clearTimeout(bubbleTimer); });
bubble.addEventListener('pointerleave', () => { if (bubble.classList.contains('has-link')) bubbleTimer = setTimeout(hideBubble, 2500); });

/* ---------- состояние ---------- */

let galya = null;

function baseState() {
  if (isNight()) return 'sleep';
  // новичка голодом не встречаем
  if (!isFirstVisit && Date.now() - S.lastFed > SIX_HOURS) return 'hungry';
  return 'idle';
}

let shownState = '';

function applyState() {
  const next = baseState();
  if (galya && next !== shownState) {
    galya.setState(next);
    // проголодалась прямо при человеке — пусть скажет
    if (shownState && next === 'hungry') say(pick(LINES.hungry));
  }
  shownState = next;
  updateButtons();
  updateStatus();
}

/* ---------- строка статуса ---------- */

function updateStatus() {
  const cups = S.cupsDate === mskDate() ? S.cupsToday : 0;
  const cupsText = cups > 3 ? 'Кофе сегодня: перебор' : 'Кофе сегодня: ' + cups + ' из 3';
  statusEl.textContent = isNight()
    ? 'У Гали ' + mskClock() + ', она спит · Визитов: ' + S.visits + ' · ' + cupsText
    : 'У Гали ' + mskClock() + ' · Визитов: ' + S.visits + ' · ' + cupsText;
}

function updateButtons() {
  const night = isNight();
  btnPet.textContent = night ? 'Разбудить' : 'Погладить';

  const cups = S.cupsDate === mskDate() ? S.cupsToday : 0;
  if (night) {
    btnCup.textContent = 'Галя спит';
    btnCup.setAttribute('aria-disabled', 'true');
  } else if (cups >= 4) {
    btnCup.textContent = 'Завтра';
    btnCup.setAttribute('aria-disabled', 'true');
  } else {
    btnCup.textContent = 'Налить кофе';
    btnCup.removeAttribute('aria-disabled');
  }
}

/* ---------- поглаживание ---------- */

let clicks = [], tickledUntil = 0;

function petHer(part) {
  idleKick();
  if (isNight()) { wakeHer(); return; }

  if (galya) galya.react('happy', 1400);
  S.pets += 1; save();

  const t = Date.now();
  // пока держится реплика про щекотку, обычные «хи-хи» её не затирают —
  // иначе при быстрых кликах шутку просто не успеваешь прочитать
  if (t > tickledUntil) say(part === 'wing' ? LINES.wing : pick(LINES.pet));

  clicks.push(t);
  clicks = clicks.filter(x => t - x < 3000);
  if (clicks.length > 5) {
    clicks = [];
    tickledUntil = t + 2500;
    if (galya) galya.react('buzzed', 800);
    say(pick(LINES.tickle));
  }
}

function wakeHer() {
  idleKick();
  if (galya) galya.react('idle', 2500);   // проснулась на пару секунд и снова спит
  say(pick(LINES.woken));
}

/* ---------- кофе ---------- */

function sameDayCups() {
  if (S.cupsDate !== mskDate()) { S.cupsDate = mskDate(); S.cupsToday = 0; save(); }
  return S.cupsToday;
}

function pourCoffee() {
  idleKick();
  if (isNight()) { say(pick(LINES.woken)); return; }

  const n = sameDayCups() + 1;

  if (n <= 3) {
    flyCup();
    if (galya) { galya.react('eat', 1800); setTimeout(() => galya.react('happy', 1200), 1800); }
    S.cupsToday = n;
    S.lastFed = Date.now();        // голод снимается сразу
    save();
    say(LINES.coffee[n - 1]);
  } else if (n === 4) {
    flyCup();
    if (galya) galya.react('buzzed', 3000);
    S.cupsToday = n;
    S.lastFed = Date.now();        // четвёртая — всё ещё кофе, голодной после неё быть странно
    save();
    say(pick(LINES.tooMuch));
  } else {
    say(pick(LINES.enough));       // пятую не наливаем
  }

  applyState();
}

function flyCup() {
  if (!galya) return;
  const from = btnCup.getBoundingClientRect();
  const to = galya.screenPoint('face');

  cupEl.hidden = false;
  cupEl.style.transition = 'none';
  cupEl.style.opacity = '1';
  cupEl.style.left = (from.left + from.width / 2) + 'px';
  cupEl.style.top = (from.top + from.height / 2) + 'px';

  requestAnimationFrame(() => {
    cupEl.style.transition = '';
    cupEl.style.left = to.x + 'px';
    cupEl.style.top = to.y + 'px';
    cupEl.style.opacity = '0';
  });

  setTimeout(() => { cupEl.hidden = true; }, 1100);
}

/* ---------- болтовня ---------- */

let chatTimer = 0, chatSaid = 0, lastChat = -1;

const chatPool = () => LINES.chat.filter(l => !('href' in l) || l.href);   // без магазина, пока нет адреса

function idleKick() {
  clearTimeout(chatTimer);
  chatTimer = setTimeout(chatter, 30000);
}

function chatter() {
  if (chatSaid >= 6) return;          // не больше шести реплик за визит

  if (isNight()) {
    chatSaid += 1;
    say(pick(LINES.sleep));
    chatTimer = setTimeout(chatter, 30000);
    return;
  }

  const pool = chatPool();
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === lastChat) i = (i + 1) % pool.length;   // подряд не повторяем
  lastChat = i;
  chatSaid += 1;
  showBubble(pool[i]);

  chatTimer = setTimeout(chatter, 25000 + Math.random() * 15000);
}

/* ---------- приветствие ---------- */

function greet() {
  if (isNight()) { say(pick(LINES.sleep)); return; }   // ночью вместо приветствия сопение

  if (isFirstVisit)                      say(pick(LINES.first));
  else if (LINES.jubilee[S.visits])      say(LINES.jubilee[S.visits]);
  else if (gapSinceLast > THREE_DAYS)    say(pick(LINES.backLong));
  else                                   say(pick(LINES.back));

  // утром и поздним вечером подмешиваем реплику про время суток
  const h = mskHour();
  if (h >= 8 && h <= 10)  setTimeout(() => say(LINES.morning), 4500);
  else if (h === 22)      setTimeout(() => say(LINES.evening), 4500);

  // с телефона половина трюков недоступна — предупреждает об этом сама
  if (onPhone()) setTimeout(() => say(LINES.phone), h >= 8 && h <= 10 || h === 22 ? 9000 : 5000);
}

/* ---------- «я не могу существовать в таких условиях» ---------- */
/* Три разные беды приводят к одной плашке: сеть отвалилась, модуль не
   доехал с CDN, или машина не вытягивает и кадры падают. */

const sos = document.getElementById('gpSos');
let sosShown = false;

/* Счётчик кадров. Порог нарочно низкий: слабый телефон выдаёт 25-30,
   и дёргать его плашкой незачем. Меньше десяти шесть секунд подряд —
   это уже не «подтормаживает», а «невозможно смотреть». */
let lagWatch = false, lagFrames = 0, lagSince = 0, lagBad = 0;

function callSos() {
  if (sosShown || !sos) return;
  sosShown = true;
  lagWatch = false;
  sos.hidden = false;
  requestAnimationFrame(() => sos.classList.add('is-on'));
}

window.addEventListener('offline', callSos);

function lagTick(now) {
  if (!lagWatch) return;
  lagFrames++;
  if (!lagSince) lagSince = now;
  const span = now - lagSince;
  if (span >= 1000) {
    const fps = lagFrames / (span / 1000);
    lagBad = fps < 10 ? lagBad + 1 : 0;
    if (lagBad >= 6) callSos();
    lagFrames = 0;
    lagSince = now;
  }
  requestAnimationFrame(lagTick);
}

/* ---------- запуск ---------- */

btnPet.addEventListener('click', () => { isNight() ? wakeHer() : petHer(null); });

btnCup.addEventListener('click', () => {
  if (btnCup.getAttribute('aria-disabled') === 'true') {
    say(isNight() ? pick(LINES.woken) : pick(LINES.enough));
    return;
  }
  pourCoffee();
});

// клик по самой Гале
stage.addEventListener('click', e => {
  if (!galya) return;
  const part = galya.hitTest(e.clientX, e.clientY);
  if (part) petHer(part);
});

// курсор полежал на ней полторы секунды — тоже поглаживание
let hoverFrom = 0, lastHoverPet = 0, moveGate = 0;

stage.addEventListener('pointermove', e => {
  const t = Date.now();
  if (t - moveGate < 100) return;      // троттлинг
  moveGate = t;
  if (!galya || isNight()) { hoverFrom = 0; return; }

  const part = galya.hitTest(e.clientX, e.clientY);
  if (!part) { hoverFrom = 0; return; }

  if (!hoverFrom) hoverFrom = t;
  else if (t - hoverFrom > 1500 && t - lastHoverPet > 10000) {
    lastHoverPet = t;
    hoverFrom = 0;
    petHer(part);
  }
}, { passive: true });

// пузырь держится над головой; без 3D цепляется к картинке,
// иначе он уезжает в угол и висит поверх шапки
function followHead() {
  if (!bubble.hidden) {
    let pt;
    if (galya) {
      pt = galya.screenPoint('top');
    } else {
      const r = (fallback.hidden ? stage : fallback).getBoundingClientRect();
      pt = { x: r.left + r.width / 2, y: r.top + r.height * 0.16 };
    }
    bubble.style.left = pt.x + 'px';
    bubble.style.top = pt.y + 'px';
  }
  requestAnimationFrame(followHead);
}

// раз в минуту: граница сна и голода могла пройти прямо при человеке
setInterval(applyState, 60000);
setInterval(updateStatus, 10000);

updateStatus();
updateButtons();

(async function start() {
  let mod = null;

  // Модуль и three.js едут с CDN. Не доехали — это почти наверняка сеть.
  try {
    mod = await import('../assets/galya/galya.js');
  } catch (e) {
    loader.hidden = true;
    fallback.hidden = false;
    console.warn('Галя не доехала по сети:', e);
    callSos();
  }

  if (mod) {
    try {
      galya = mod.createGalya(host, { background: '#181818', margin: 0.95 });
      // кружок уезжает плавно, уже поверх собранной Гали
      loader.classList.add('is-gone');
      setTimeout(() => { loader.hidden = true; }, 320);
      // следим за кадрами только когда есть что ронять
      lagWatch = true;
      requestAnimationFrame(lagTick);
    } catch (e) {
      // модуль приехал, но WebGL нет: это не сеть, плашку не показываем
      galya = null;
      host.textContent = '';   // модуль успевает вставить пустой canvas — убираем
      loader.hidden = true;
      fallback.hidden = false;
      console.warn('Галя не завелась, остаётся картинка:', e);
    }
  }

  if (!navigator.onLine) callSos();

  applyState();
  followHead();
  setTimeout(greet, 1200);
  idleKick();
})();

window.addEventListener('pagehide', () => { if (galya) galya.dispose(); });

/* ------------------------------------------------------------------
   Отладочная ручка для проверок из чек-листа. В консоли браузера:

     galyaDebug.store                     — что сейчас в памяти
     galyaDebug.store.lastFed = 0         — сделать Галю голодной
     galyaDebug.save(); galyaDebug.apply() — применить без перезагрузки
     galyaDebug.state                     — текущее состояние бабочки
     galyaDebug.forget()                  — забыть всё и начать с нуля
   ------------------------------------------------------------------ */
window.galyaDebug = {
  store: S,
  save: save,
  apply: applyState,
  get state() { return galya ? galya.state : 'без WebGL'; },
  get reaction() { return galya ? galya.reaction : null; },
  forget() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); },
  sos: callSos,                                  // показать плашку вручную
  lagWatch(on) { lagWatch = on !== false; if (lagWatch) requestAnimationFrame(lagTick); }
};
