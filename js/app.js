/* ============================================================
   Ελληνικά A1 — главный контроллер приложения.
   Без зависимостей. Рендер строками + делегирование событий.
   ============================================================ */

const App = {
  view: "home",
  params: {},
  session: null,
  settings: { tr: true, gexInput: false }, // дефолт до loadSettings (защита от раннего рендера)

  root: null,

  init() {
    this.root = document.getElementById("app");
    this.loadSettings();
    this.applySettings();
    this.loadWeak();
    // Service worker: «никогда не залипает на старой версии» (только на https-сайте).
    // network-first отдаёт свежее из сети; при выходе новой версии — тихий reload.
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded || !hadController) return; // не перезагружаем при самой первой установке
        reloaded = true;
        location.reload();
      });
      navigator.serviceWorker.register("sw.js").then((reg) => { reg.update(); }).catch(() => {});
    }
    document.body.addEventListener("click", (e) => this.onClick(e));
    document.body.addEventListener("input", (e) => this.onInput(e));
    document.body.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("hashchange", () => this.onHashChange());
    // Стартуем с того экрана, что в URL (устойчиво к F5)
    const { view, params } = this.readHash();
    this.view = view;
    this.params = params;
    this.render();
  },

  /* ---------- НАСТРОЙКИ ---------- */
  loadSettings() {
    try { this.settings = JSON.parse(localStorage.getItem("greekA1_settings")) || {}; }
    catch { this.settings = {}; }
    if (this.settings.tr === undefined) this.settings.tr = true;        // показывать транскрипцию
    if (this.settings.gexInput === undefined) this.settings.gexInput = false; // ввод вместо выбора
  },
  saveSettings() { localStorage.setItem("greekA1_settings", JSON.stringify(this.settings)); },

  /* ---------- РАБОТА НАД ОШИБКАМИ (единый разбор) ---------- */
  loadWeak() { try { this.weak = JSON.parse(localStorage.getItem("greekA1_weak")) || []; } catch { this.weak = []; } },
  saveWeak() { localStorage.setItem("greekA1_weak", JSON.stringify(this.weak.slice(-120))); },
  weakKey(it) { return this.normGreek((it.q || "") + "|" + (it.ans || "")); },
  addWeak(it) {
    if (!it || !it.opts || !it.ans) return;
    if (!this.weak) this.loadWeak();
    const k = this.weakKey(it);
    if (!this.weak.some((w) => this.weakKey(w) === k)) { this.weak.push({ q: it.q, opts: it.opts, ans: it.ans }); this.saveWeak(); }
  },
  removeWeak(it) { const k = this.weakKey(it); this.weak = (this.weak || []).filter((w) => this.weakKey(w) !== k); this.saveWeak(); },
  // Добавить промах по слову темы в «Работу над ошибками» как MCQ «что значит X?»
  addWeakWord(cur) {
    if (!cur || !cur.gr || !cur.ru) return;
    const distract = this.shuffle(ALL_WORDS.filter((w) => w.ru !== cur.ru)).slice(0, 3).map((w) => w.ru);
    this.addWeak({ q: `Что значит «${cur.gr}»?`, opts: this.shuffle([cur.ru, ...distract]), ans: cur.ru });
  },
  applySettings() { if (document.body) document.body.classList.toggle("no-tr", !this.settings.tr); },
  toggleSetting(k) { this.settings[k] = !this.settings[k]; this.saveSettings(); this.applySettings(); this.render(); },

  go(view, params = {}) {
    this.view = view;
    this.params = params;
    this.session = null;
    this.menuOpen = false;
    this.stopExamTimer();
    Speech.stop();
    this.writeHash();
    this.render();
    window.scrollTo(0, 0);
  },

  // URL <-> состояние экрана
  writeHash() {
    let h = "#" + this.view;
    const keys = Object.keys(this.params);
    if (keys.length) h += "?" + keys.map((k) => k + "=" + encodeURIComponent(this.params[k])).join("&");
    if (("#" + (location.hash.replace(/^#/, "") || "home")) !== ("#" + (h.replace(/^#/, "") || "home"))) {
      if (location.hash !== h) { this.suppressHash = true; location.hash = h; }
    }
  },

  readHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return { view: "home", params: {} };
    const [view, qs] = raw.split("?");
    const params = {};
    if (qs) qs.split("&").forEach((p) => { const [k, v] = p.split("="); if (k) params[k] = decodeURIComponent(v || ""); });
    return { view: view || "home", params };
  },

  // Назад/вперёд браузера и ручная правка URL
  onHashChange() {
    if (this.suppressHash) { this.suppressHash = false; return; }
    const { view, params } = this.readHash();
    this.view = view;
    this.params = params;
    this.session = null;
    this.menuOpen = false;
    this.stopExamTimer();
    Speech.stop();
    this.render();
    window.scrollTo(0, 0);
  },

  /* ---------- УТИЛИТЫ ---------- */
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // «Редкое» слово A1 (есть в офиц. глоссарии, но низкочастотное) — для бейджа
  isRare(gr) {
    return typeof RARE_A1 !== "undefined" && RARE_A1.has(this.normGreek(gr));
  },

  // Выделить греческие слова из текста (единый токенизатор для всего проекта)
  tokenizeGreek(s) { return (String(s || "").match(/[Ͱ-Ͽἀ-῿]+/g)) || []; },

  // Сравнение греческого без учёта ударений/регистра (для набора)
  normGreek(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // снять диакритику
      .replace(/ς/g, "σ")
      .replace(/[;.,!·»«]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  },

  // Фонетическая нормализация для голоса: омофоны → один звук.
  // Так «звучит верно» засчитывается даже при ином написании.
  phoneticGreek(s) {
    let x = this.normGreek(s);
    x = x
      .replace(/ει|οι|υι/g, "ι")   // ει/οι/υι звучат как «и»
      .replace(/αι/g, "ε")          // αι звучит как «э»
      .replace(/[ηυ]/g, "ι")        // η, υ → «и»
      .replace(/ω/g, "ο")           // ω → «о»
      .replace(/μπ/g, "б").replace(/ντ/g, "д") // звонкие сочетания
      .replace(/(.)\1+/g, "$1");    // двойные буквы → одна (σσ→σ)
    return x;
  },

  // Прокрутить блок обратной связи (с кнопкой «Дальше») в зону видимости
  afterAnswer() {
    requestAnimationFrame(() => {
      const fb = document.getElementById("fb");
      if (fb) fb.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  },

  esc(s) {
    return (s || "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  },

  speakBtn(text, label = "🔊") {
    return `<button class="speak" data-say="${this.esc(text)}" title="Послушать">${label}</button>`;
  },

  /* ---------- РЕНДЕР ---------- */
  render() {
    const map = {
      home: () => this.renderHome(),
      track: () => this.renderTrack(),
      alphabet: () => this.renderAlphabet(),
      alphaQuiz: () => this.renderAlphaQuiz(),
      review: () => this.renderReview(),
      decks: () => this.renderDecks(),
      practice: () => this.renderPractice(),
      grammar: () => this.renderGrammar(),
      lesson: () => this.renderLesson(),
      trainer: () => this.renderTrainer(),
      gex: () => this.renderGex(),
      writing: () => this.renderWriting(),
      speaking: () => this.renderSpeaking(),
      reading: () => this.renderReadingList(),
      read: () => this.renderRead(),
      readquiz: () => this.renderReadQuiz(),
      exams: () => this.renderExamsList(),
      exam: () => this.renderExam(),
      progress: () => this.renderProgress(),
      coverage: () => this.renderCoverage(),
      mistakes: () => this.renderMistakes(),
    };
    this.root.innerHTML =
      this.renderNav() + `<main class="screen">${(map[this.view] || map.home)()}</main>` + this.wordbarHtml();
    if (this.afterRender) { const f = this.afterRender; this.afterRender = null; f(); }
  },

  // Глобальная панель перевода слова (тап по любому греческому слову)
  wordbarHtml() {
    return `<div id="wordbar" class="wordbar" hidden>
      <button class="wb-spk" data-say="">🔊</button>
      <div class="wb-body"><span class="wb-gr"></span><span class="wb-ru"></span></div>
      <button class="wb-x" data-action="wordbar-close">✕</button>
    </div>`;
  },
  // Общий словарь для тап-перевода (слова + общие + глоссарии чтения + формы)
  globalGloss() {
    if (this._gg) return this._gg;
    const g = {};
    ALL_WORDS.forEach((w) => { const k = this.normGreek(w.gr); if (k && !k.includes(" ")) g[k] = w.ru; });
    if (typeof READING_COMMON !== "undefined") Object.entries(READING_COMMON).forEach(([k, v]) => { g[this.normGreek(k)] = v; });
    if (typeof READING_TEXTS !== "undefined") READING_TEXTS.forEach((t) => Object.entries(t.gloss || {}).forEach(([k, v]) => { const nk = this.normGreek(k); if (!g[nk]) g[nk] = v; }));
    if (typeof DECLENSIONS !== "undefined") DECLENSIONS.forEach((d) => Object.values(d.f).forEach((f) => f.split(" ").forEach((tok) => { const nk = this.normGreek(tok); if (nk && !g[nk]) g[nk] = d.ru; })));
    if (typeof CONJUGATIONS !== "undefined") CONJUGATIONS.forEach((v) => Object.values(v.f).forEach((f) => { const nk = this.normGreek(f); if (!g[nk]) g[nk] = v.ru; }));
    this._gg = g;
    return g;
  },
  // Приблизительный резолв: точное совпадение → иначе лемма с той же основой
  // (самый длинный общий префикс). Покрывает падежные/родовые формы:
  // καλή→καλός, πυρετό→πυρετός, πράγματα→πράγμα.
  glossStems() {
    if (this._stems) return this._stems;
    this._stems = Object.entries(this.globalGloss()).filter(([k]) => k.length >= 3);
    return this._stems;
  },
  resolveGloss(norm) {
    const g = this.globalGloss();
    if (g[norm]) return g[norm];
    if (!norm || norm.length < 3) return "";
    let best = null, bestLen = 0;
    for (const [k, ru] of this.glossStems()) {
      let i = 0; const m = Math.min(k.length, norm.length);
      while (i < m && k[i] === norm[i]) i++;
      if (i < 3) continue;                      // общая основа слишком короткая
      if (i < k.length - 3 || i < norm.length - 4) continue; // хвосты должны быть короткими
      if (Math.abs(k.length - norm.length) > 5) continue;
      if (i > bestLen) { bestLen = i; best = ru; }
    }
    return best ? best + " (форма)" : "";
  },
  // Обернуть греческие слова в тап-спаны (для теории/упражнений)
  wrapGreek(html) {
    return (html || "").replace(/[Ͱ-Ͽἀ-῿]+/g, (m) =>
      `<span class="rword" data-rw="${this.esc(this.normGreek(m))}" data-ro="${this.esc(m)}">${m}</span>`);
  },

  renderNav() {
    const items = [
      ["home", "🏠", "Главная"],
      ["track", "🗺️", "Путь"],
      ["alphabet", "🔤", "Алфавит"],
      ["review", "🧠", "Повтор"],
      ["decks", "📚", "Темы"],
      ["grammar", "📖", "Грамматика"],
      ["writing", "✍️", "Письмо"],
      ["speaking", "🗣️", "Говорение"],
      ["reading", "📕", "Чтение"],
      ["exams", "📝", "Экзамены"],
      ["progress", "📊", "Прогресс"],
      ["coverage", "ℹ️", "Методика"],
    ];
    const root = ["alphaQuiz"].includes(this.view) ? "alphabet"
      : this.view === "practice" ? "decks"
      : this.view === "trainer" ? "grammar"
      : this.view === "lesson" ? "grammar"
      : this.view === "gex" ? "grammar"
      : this.view === "exam" ? "exams"
      : this.view === "read" || this.view === "readquiz" ? "reading" : this.view;
    const menu = items.map(([v, ic, l]) =>
      `<button class="menu-item ${root === v ? "active" : ""}" data-go="${v}"><span class="mi-ic">${ic}</span>${l}</button>`
    ).join("");
    return `<header class="topbar">
        <button class="burger" data-action="menu-toggle" aria-label="Меню"><span></span><span></span><span></span></button>
        <div class="brand" data-go="home">Ελληνικά <span>A1</span></div>
        ${this.renderTopAccount()}
      </header>
      <div class="menu-backdrop" data-action="menu-close"></div>
      <nav class="menu">
        <div class="menu-head">Меню</div>
        ${menu}
      </nav>`;
  },

  toggleMenu(open) {
    this.menuOpen = open != null ? open : !this.menuOpen;
    const m = document.querySelector(".menu");
    const b = document.querySelector(".menu-backdrop");
    if (m) m.classList.toggle("open", this.menuOpen);
    if (b) b.classList.toggle("open", this.menuOpen);
  },

  // Достижения (дофамин): считаются из прогресса, без отдельного хранилища.
  badges(s) {
    const decksDone = DECKS.filter((d) => SRS.summary(d.words).learned >= d.words.length).length;
    const list = [];
    if (s.learned >= 1) list.push(["🌱", "Первые слова"]);
    if (s.streak >= 3) list.push(["🔥", "Стрик 3 дня"]);
    if (s.streak >= 7) list.push(["🔥", "Неделя подряд"]);
    if (s.streak >= 30) list.push(["🏆", "Месяц подряд"]);
    if (s.learned >= 50) list.push(["📚", "50 слов"]);
    if (s.learned >= 200) list.push(["📚", "200 слов"]);
    if (s.learned >= 500) list.push(["🎓", "500 слов"]);
    if (s.mature >= 100) list.push(["💎", "100 закреплено"]);
    if (decksDone >= 1) list.push(["✅", "Тема закрыта"]);
    if (decksDone >= 10) list.push(["🗂️", "10 тем закрыто"]);
    const taken = Object.values(this.examBest()); const passed = taken.filter((p) => p >= 60).length;
    if (passed >= 1) list.push(["📝", "Экзамен сдан"]);
    if (passed >= 5) list.push(["🥇", "5 экзаменов"]);
    return list;
  },
  badgesHtml(s) {
    const b = this.badges(s);
    if (!b.length) return "";
    return `<div class="badges">${b.map(([ic, t]) => `<span class="badge" title="${t}">${ic} ${t}</span>`).join("")}</div>`;
  },

  onboardSeen() { try { return localStorage.getItem("greekA1_onboard") === "1"; } catch { return false; } },
  dismissOnboard() { try { localStorage.setItem("greekA1_onboard", "1"); } catch {} this.render(); },

  /* ---------- ГЛАВНАЯ ---------- */
  renderHome() {
    const s = SRS.summary(ALL_WORDS);
    const pct = Math.round((s.learned / s.total) * 100);
    // Онбординг первого запуска: один раз, пока нет прогресса
    if (!this.onboardSeen() && s.learned === 0) {
      return `
        <div class="onboard">
          <h1>Γεια σου! 👋</h1>
          <p class="sub">Это тренажёр греческого <b>с нуля до A1</b> — фундамент для экзамена A2 (гражданство Кипра).</p>
          <div class="onboard-steps">
            <div class="ob-step"><span class="ob-ic">🗺️</span><div><b>Иди по «Пути»</b><br><span class="muted small">Маршрут по дням: что учить сегодня — решать не нужно.</span></div></div>
            <div class="ob-step"><span class="ob-ic">⏱️</span><div><b>25–40 минут в день</b><br><span class="muted small">Слова, грамматика, чтение, практика — по чуть-чуть.</span></div></div>
            <div class="ob-step"><span class="ob-ic">☁️</span><div><b>Прогресс сохраняется</b><br><span class="muted small">Войди через Google — занимайся с телефона и компа.</span></div></div>
          </div>
          <button class="big-btn primary" data-action="onboard-go">🚀 Начать с Дня 1</button>
          <button class="big-btn ghost" data-action="onboard-dismiss">Осмотреться сам(а)</button>
        </div>`;
    }
    // Баннер только если синтез речи реально не поддерживается.
    // (Раньше проверяли наличие именованного el-GR голоса — мобильный
    //  Chrome его не показывает в списке, но озвучивает по запросу.)
    const ttsWarn = Speech.supported
      ? ""
      : `<div class="banner">🔇 Этот браузер не умеет озвучивать текст. Всё обучение работает; для аудио откройте сайт в Chrome или Edge.</div>`;
    return `
      ${ttsWarn}
      <header class="hero">
        <h1>Γεια σου! 👋</h1>
        <p class="sub">Тренажёр греческого с нуля до <b>A1</b> — фундамент для экзамена <b>A2</b> (гражданство Кипра).</p>
      </header>

      <section class="cards-row">
        <div class="stat">
          <div class="stat-num">${s.streak}🔥</div>
          <div class="stat-lbl">дней подряд</div>
        </div>
        <div class="stat">
          <div class="stat-num">${s.learned}/${s.total}</div>
          <div class="stat-lbl">слов изучается</div>
        </div>
        <div class="stat">
          <div class="stat-num">${s.due}</div>
          <div class="stat-lbl">к повтору сегодня</div>
        </div>
      </section>

      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <p class="muted center">Освоено ${pct}% словаря A1</p>
      ${this.badgesHtml(s)}

      <section class="cta">
        ${(() => {
          const tr = this.buildTrack(); const tsd = this.trackState().day;
          const cur = tr[Math.max(1, Math.min(tsd, tr.length)) - 1];
          return `<button class="big-btn primary" data-go="track">
            🗺️ Путь к A1 — День ${Math.min(tsd, tr.length)} из ${tr.length}
            <small>${tsd > tr.length ? "курс пройден 🎓" : cur.title}</small>
          </button>`;
        })()}
        <button class="big-btn" data-go="review">
          🧠 Заниматься сейчас
          <small>${s.due} повторить · ${Math.max(0, s.newPerDay - s.newToday)} новых доступно</small>
        </button>
        <button class="big-btn" data-go="exams">
          📝 Пробные экзамены A1
          <small>${EXAM_READINGS.length} мини-тестов в формате экзамена</small>
        </button>
        ${(this.weak && this.weak.length) ? `<button class="big-btn" data-go="mistakes">
          🔁 Работа над ошибками
          <small>${this.weak.length} вопросов на повторе</small>
        </button>` : ""}
      </section>

      <h3 class="section-title">Путь «с нуля» до A1</h3>
      <ol class="steps">
        <li>Выучи <a data-go="alphabet">алфавит</a> — звуки и буквосочетания.</li>
        <li>Каждый день — <a data-go="review">повторение (SRS)</a>, 10–15 минут.</li>
        <li>Прокачивай <a data-go="decks">темы</a>: аудио, диктант, голос, набор.</li>
        <li>Читай <a data-go="reading">тексты</a> и пиши в <a data-go="writing">письме</a> — слова в деле.</li>
        <li>Сверяйся с <a data-go="grammar">грамматикой</a> и проверяй себя <a data-go="exams">экзаменами</a>.</li>
      </ol>

      <h3 class="section-title">Быстрый старт</h3>
      <div class="grid">
        <button class="tile" data-go="alphabet"><span class="tile-ic">🔤</span>Алфавит</button>
        <button class="tile" data-go="decks"><span class="tile-ic">📚</span>Темы (${DECKS.length})</button>
        <button class="tile" data-go="reading"><span class="tile-ic">📕</span>Чтение (${READING_TEXTS.length})</button>
        <button class="tile" data-go="writing"><span class="tile-ic">✍️</span>Письмо</button>
        <button class="tile" data-go="grammar"><span class="tile-ic">📖</span>Грамматика</button>
        <button class="tile" data-go="progress"><span class="tile-ic">📊</span>Прогресс</button>
      </div>
    `;
  },


  /* ---------- АЛФАВИТ ---------- */
  renderAlphabet() {
    const letters = ALPHABET.map(
      (l) => `
      <button class="letter" data-say="${l.lower.replace('/ς','')}, ${l.example}">
        <div class="letter-glyph">${l.upper} ${l.lower}</div>
        <div class="letter-name">${l.name}</div>
        <div class="letter-sound">${l.sound}</div>
        <div class="letter-ex">${l.example} — ${l.exTr}</div>
      </button>`
    ).join("");

    const digs = DIGRAPHS.map(
      (d) => `
      <button class="letter dig" data-say="${d.example}">
        <div class="letter-glyph">${d.gr}</div>
        <div class="letter-sound">${d.translit} · ${d.note}</div>
        <div class="letter-ex">${d.example} — ${d.exTr}</div>
      </button>`
    ).join("");

    return `
      <header class="page-head">
        <h2>🔤 Греческий алфавит</h2>
        <button class="big-btn primary slim" data-go="alphaQuiz">▶ Тренировать буквы</button>
      </header>
      <p class="muted">24 буквы. Нажми на букву — услышишь название и пример. Сначала выучи узнавание, потом переходи к тренажёру.</p>
      <div class="letter-grid">${letters}</div>

      <h3 class="section-title">Буквосочетания (обязательно!)</h3>
      <p class="muted">Без них слова читаются неправильно. Например, <b>ου</b> = «у», а <b>μπ</b> в начале = «б».</p>
      <div class="letter-grid">${digs}</div>
    `;
  },

  /* ---------- ТРЕНАЖЁР БУКВ ---------- */
  renderAlphaQuiz() {
    if (!this.session) {
      const pool = this.shuffle(ALPHABET).slice(0, 10);
      this.session = { pool, idx: 0, correct: 0, answered: false };
    }
    const s = this.session;
    if (s.idx >= s.pool.length) {
      return `
        <div class="result">
          <h2>Готово! 🎉</h2>
          <p class="big-score">${s.correct} / ${s.pool.length}</p>
          <p class="muted">правильных ответов по буквам</p>
          <button class="big-btn primary" data-action="alpha-again">Ещё раунд</button>
          <button class="big-btn ghost" data-go="alphabet">К алфавиту</button>
        </div>`;
    }
    const cur = s.pool[s.idx];
    // Варианты: какой звук/название у этой буквы (выбор из 4)
    const options = this.shuffle([
      cur,
      ...this.shuffle(ALPHABET.filter((l) => l.upper !== cur.upper)).slice(0, 3),
    ]);
    const opts = options
      .map(
        (o) =>
          `<button class="opt" data-alpha-opt="${o.upper}">${o.sound} <small>· ${o.example}</small></button>`
      )
      .join("");
    return `
      <header class="page-head"><h2>Буква → звук</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <div class="quiz-prompt compact">
        <div class="big-letter">${cur.upper} ${cur.lower}</div>
        <div class="muted small">${cur.name} ${this.speakBtn(cur.example)}</div>
      </div>
      <p class="muted center small q-ask">Какой это звук?</p>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>
    `;
  },

  /* ---------- ПОВТОРЕНИЕ (SRS) ---------- */
  renderReview() {
    if (!this.session) {
      const queue = SRS.buildQueue(ALL_WORDS);
      this.session = { queue, idx: 0, flipped: false, done: 0, again: [] };
    }
    const s = this.session;
    // Если основная очередь кончилась, добиваем "не помню"
    let cur = s.queue[s.idx];
    if (!cur && s.again.length) { s.queue = s.again; s.again = []; s.idx = 0; cur = s.queue[0]; }

    if (!cur) {
      const sum = SRS.summary(ALL_WORDS);
      return `
        <div class="result">
          <h2>Сессия завершена 👏</h2>
          <p class="muted">Повторено карточек: <b>${s.done}</b></p>
          <p class="muted">Стрик: <b>${sum.streak} 🔥</b> · Всего изучается: <b>${sum.learned}/${sum.total}</b></p>
          <button class="big-btn primary" data-action="review-again">Продолжить</button>
          <button class="big-btn ghost" data-go="decks">Тренировать темы</button>
        </div>`;
    }
    const isNew = SRS.isNew(cur.id);
    const front = `
      <div class="card-tag">${isNew ? "🆕 новое слово" : "🔁 повторение"} · ${cur.deckTitle}</div>
      <div class="flash-gr">${cur.gr} ${this.speakBtn(cur.gr)}</div>
      <div class="flash-tr">[${cur.tr}]</div>`;
    const back = s.flipped
      ? `<div class="flash-ru">${cur.ru}</div>`
      : `<button class="reveal" data-action="flip">Показать перевод</button>`;
    const controls = s.flipped
      ? `<div class="grades">
          <button class="grade g0" data-grade="0">Не помню<small>снова</small></button>
          <button class="grade g1" data-grade="1">Трудно<small>скоро</small></button>
          <button class="grade g2" data-grade="2">Хорошо<small>+дни</small></button>
          <button class="grade g3" data-grade="3">Легко<small>+нед.</small></button>
        </div>`
      : "";
    return `
      <header class="page-head"><h2>🧠 Повторение</h2><div class="counter">осталось ${s.queue.length - s.idx + s.again.length}</div></header>
      <div class="flashcard">${front}${back}</div>
      ${controls}
      <p class="muted center small">Оцени честно: чем хуже помнишь — тем раньше слово вернётся.</p>
    `;
  },

  /* ---------- СПИСОК ТЕМ ---------- */
  renderDecks() {
    const tiles = DECKS.map((d) => {
      const sum = SRS.summary(d.words);
      const pct = Math.round((sum.learned / sum.total) * 100);
      return `
        <button class="deck-tile" data-deck="${d.id}">
          <div class="deck-ic">${d.icon}</div>
          <div class="deck-body">
            <div class="deck-title">${d.title}</div>
            <div class="deck-meta">${d.words.length} слов · освоено ${pct}%</div>
            <div class="progress-bar mini"><div class="progress-fill" style="width:${pct}%"></div></div>
          </div>
        </button>`;
    }).join("");
    return `
      <header class="page-head"><h2>📚 Темы</h2></header>
      <p class="muted">Бытовые темы экзамена A2. Выбери тему — внутри слова, аудирование, выбор и набор.</p>
      <div class="deck-list">${tiles}</div>
    `;
  },

  /* ---------- ТЕМА: ПРОСМОТР + РЕЖИМЫ ---------- */
  renderPractice() {
    const deck = DECKS.find((d) => d.id === this.params.deck);
    if (!deck) return this.renderDecks();
    const mode = this.params.mode || "list";

    if (mode === "list") {
      const rows = deck.words
        .map(
          (w) => `
        <div class="word-row">
          <span class="w-audio">${this.speakBtn(w.gr)}</span>
          <div class="w-gr">${w.gr}${this.isRare(w.gr) ? ' <span class="rare-badge" title="Есть в офиц. A1, но редкое — учи в последнюю очередь">редкое</span>' : ""}</div>
          <div class="w-tr">[${w.tr}]</div>
          <div class="w-ru">${w.ru}</div>
        </div>`
        )
        .join("");
      return `
        <header class="page-head"><h2>${deck.icon} ${deck.title}</h2><button class="back" data-go="decks">← Темы</button></header>
        <div class="mode-row">
          <button class="mode-btn" data-mode="learn"><span>🧠</span>Карточки</button>
          <button class="mode-btn" data-mode="choice"><span>✅</span>Выбор</button>
          <button class="mode-btn" data-mode="listen"><span>👂</span>Аудио</button>
          <button class="mode-btn" data-mode="type"><span>⌨️</span>Набор</button>
          <button class="mode-btn hot" data-mode="dictation"><span>🎧</span>Диктант</button>
          <button class="mode-btn hot" data-mode="speak"><span>🎤</span>Голос</button>
        </div>
        <div class="word-list">${rows}</div>
      `;
    }
    return this.renderDeckMode(deck, mode);
  },

  renderDeckMode(deck, mode) {
    if (!this.session) {
      this.session = { pool: this.shuffle(deck.words), idx: 0, correct: 0, answered: false, input: "" };
    }
    const s = this.session;
    const titleByMode = { learn: "🧠 Карточки", choice: "✅ Выбор перевода", listen: "👂 Аудирование", type: "⌨️ Набор по-гречески", dictation: "🎧 Диктант (на слух)", speak: "🎤 Произношение" };

    if (s.idx >= s.pool.length) {
      return `
        <div class="result">
          <h2>Тема пройдена! 🎉</h2>
          <p class="big-score">${s.correct} / ${s.pool.length}</p>
          <button class="big-btn primary" data-action="mode-again">Ещё раз</button>
          <button class="big-btn ghost" data-deck="${deck.id}" data-mode="list">К теме</button>
          <button class="big-btn ghost" data-go="decks">Все темы</button>
        </div>`;
    }
    const cur = s.pool[s.idx];
    const head = `<header class="page-head"><h2>${titleByMode[mode]}</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>`;

    if (mode === "learn") {
      const body = s.answered
        ? `<div class="flash-ru">${cur.ru}</div>
           <div class="grades simple">
             <button class="grade g0" data-deck-next="0">Не знал</button>
             <button class="grade g2" data-deck-next="1">Знал</button>
           </div>`
        : `<button class="reveal" data-action="deck-flip">Показать перевод</button>`;
      return `${head}
        <div class="flashcard">
          <div class="card-tag">${deck.title}</div>
          <div class="flash-gr">${cur.gr} ${this.speakBtn(cur.gr)}</div>
          <div class="flash-tr">[${cur.tr}]</div>
          ${body}
        </div>`;
    }

    if (mode === "choice" || mode === "listen") {
      const opts = this.shuffle([
        cur,
        ...this.shuffle(deck.words.filter((w) => w.id !== cur.id)).slice(0, 3),
      ]);
      const prompt =
        mode === "listen"
          ? `<div class="quiz-prompt listen">
               <button class="play-big" data-say="${this.esc(cur.gr)}">🔊 Слушать</button>
               <button class="play-slow" data-say-slow="${this.esc(cur.gr)}">🐢 Медленно</button>
             </div>
             <p class="muted center">Что ты услышал?</p>`
          : `<div class="quiz-prompt">
               <div class="big-letter sm">${cur.gr} ${this.speakBtn(cur.gr)}</div>
               <div class="muted tr">[${cur.tr}]</div>
             </div>
             <p class="muted center">Выбери перевод</p>`;
      const buttons = opts
        .map((o) => `<button class="opt" data-choice="${o.id}">${o.ru}</button>`)
        .join("");
      this.afterRender = mode === "listen" ? () => Speech.say(cur.gr) : null;
      return `${head}${prompt}<div class="opts">${buttons}</div><div id="fb" class="feedback"></div>`;
    }

    if (mode === "speak") {
      const ok = Recog.supported;
      const body = ok
        ? `<button class="mic-btn" data-action="speak-start">🎤 Произнести</button>
           <p class="muted center small">Нажми и чётко скажи слово вслух. Браузер спросит доступ к микрофону — разреши.</p>`
        : `<div class="banner">🎤 Распознавание речи не поддерживается этим браузером (на iPhone его нет). Открой сайт в <b>Chrome</b> на Android или компьютере. Пока можешь слушать образец и повторять вслух.</div>
           <button class="big-btn primary" data-action="speak-next">Дальше →</button>`;
      return `${head}
        <div class="quiz-prompt">
          <div class="big-letter sm">${cur.gr} ${this.speakBtn(cur.gr)}</div>
          <div class="muted"><span class="tr">[${cur.tr}] · </span>${cur.ru}</div>
        </div>
        ${body}
        <div id="fb" class="feedback"></div>`;
    }

    if (mode === "type" || mode === "dictation") {
      const prompt =
        mode === "dictation"
          ? `<div class="quiz-prompt listen">
               <button class="play-big" data-say="${this.esc(cur.gr)}">🔊 Повторить</button>
               <button class="play-slow" data-say-slow="${this.esc(cur.gr)}">🐢 Медленно</button>
               <div class="muted small dict-hint">Слушай и запиши по-гречески</div>
             </div>`
          : `<div class="quiz-prompt">
               <div class="type-ru">${cur.ru}</div>
               <div class="muted small tr">подсказка: [${cur.tr}]</div>
             </div>`;
      // В диктанте звук проигрывается сам при показе карточки
      this.afterRender = () => {
        if (mode === "dictation") Speech.say(cur.gr);
        const i = document.getElementById("typeInput");
        if (i) i.focus();
      };
      return `${head}
        ${prompt}
        <input id="typeInput" class="type-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
               placeholder="Напиши по-гречески (ударения можно не ставить)" value="${this.esc(s.input)}">
        <div class="kbd-hint">Нужны греческие буквы? Включи раскладку Ελληνικά или используй экранную клавиатуру ниже.</div>
        <div class="gkbd">${this.greekKeyboard()}</div>
        <button class="big-btn primary" data-action="type-check">Проверить</button>
        <div id="fb" class="feedback"></div>`;
    }
    return this.renderDecks();
  },

  greekKeyboard() {
    const rows = ["ασδφγηξκλ", "ζχψωβνμ", "ερτυθιοπ"];
    return rows
      .map(
        (r) =>
          `<div class="gkbd-row">${r
            .split("")
            .map((c) => `<button class="gkey" data-key="${c}">${c}</button>`)
            .join("")}<button class="gkey wide" data-key=" ">␣</button><button class="gkey wide" data-key="BACK">⌫</button></div>`
      )
      .join("");
  },

  /* ---------- ГРАММАТИКА: список тем → полная страница урока ---------- */
  renderGrammar() {
    const rows = GRAMMAR_LESSONS.map((g) => {
      const n = GrammarEx.has(g.id) ? GrammarEx.gen(g.id).length : 0;
      return `<button class="lesson-row" data-lesson="${g.id}">
        <span class="lesson-ic">${GrammarEx.icon(g.id)}</span>
        <span class="lesson-ttl">${g.title}</span>
        ${n ? `<span class="lesson-n">${n} упр.</span>` : ""}
        <span class="lesson-arr">›</span>
      </button>`;
    }).join("");
    return `
      <header class="page-head"><h2>📖 Грамматика A1</h2></header>
      <p class="muted">Выбери тему — полное объяснение с примерами и упражнения. Любое греческое слово можно тапнуть для перевода.</p>
      <div class="mix-cta">
        <button class="big-btn primary" data-train="decl">🧩 Микс склонений
          <small>все рода и падежи вразнобой — ${DECLENSIONS.length} слов</small></button>
        <button class="big-btn primary" data-train="conj">🔀 Микс спряжений
          <small>глаголы и лица вразнобой — ${CONJUGATIONS.length} слов</small></button>
      </div>
      <div class="lesson-list">${rows}</div>
    `;
  },

  renderLesson() {
    const i = GRAMMAR_LESSONS.findIndex((g) => g.id === this.params.id);
    const g = GRAMMAR_LESSONS[i];
    if (!g) return this.renderGrammar();
    const n = GrammarEx.has(g.id) ? GrammarEx.gen(g.id).length : 0;
    const next = GRAMMAR_LESSONS[i + 1];
    // На уроках склонений/спряжений предлагаем «микс вразнобой»
    const mix = ["cases", "decl-m", "decl-f", "decl-n"].includes(g.id)
      ? `<button class="big-btn" data-train="decl">🧩 Микс склонений (все рода вразнобой)</button>`
      : ["verb-a", "verb-b", "conj"].includes(g.id)
      ? `<button class="big-btn" data-train="conj">🔀 Микс спряжений (вразнобой)</button>` : "";
    return `
      <header class="page-head"><h2>${GrammarEx.icon(g.id)} ${g.title}</h2><button class="back" data-go="grammar">← Темы</button></header>
      ${g.why ? `<div class="td-why">💡 <b>Зачем это:</b> ${g.why}</div>` : ""}
      <article class="lesson">${this.wrapGreek(g.body)}</article>
      <div class="lesson-actions">
        ${n ? `<button class="big-btn primary" data-gex="${g.id}">▶ Упражнения (${n})</button>` : ""}
        ${mix}
        ${next ? `<button class="big-btn ghost" data-lesson="${next.id}">Дальше: ${next.title.replace(/^\d+\.\s*/, "")} →</button>` : `<button class="big-btn ghost" data-go="grammar">К списку тем</button>`}
      </div>
    `;
  },

  /* ---------- ТРЕНАЖЁР ФОРМ (склонения / спряжения) ---------- */
  renderTrainer() {
    const kind = this.params.kind || "decl";
    const isDecl = kind === "decl";
    const data = isDecl ? DECLENSIONS : CONJUGATIONS;
    const slots = isDecl ? DECL_CASES : CONJ_PERSONS;
    // Для спряжений не спрашиваем словарную форму (s1 = εγώ)
    const askable = isDecl ? slots : slots.filter((s) => s.key !== "s1");

    if (!this.session) {
      const tasks = this.shuffle(data).slice(0, 16).map((entry) => {
        const slot = askable[Math.floor(Math.random() * askable.length)];
        return { entry, slot };
      });
      this.session = { kind, tasks, idx: 0, correct: 0 };
    }
    const s = this.session;
    const title = isDecl ? "🧩 Тренажёр склонений" : "🔀 Тренажёр спряжений";

    if (s.idx >= s.tasks.length) {
      return `
        <div class="result">
          <h2>Готово! 🎉</h2>
          <p class="big-score">${s.correct} / ${s.tasks.length}</p>
          <p class="muted">${isDecl ? "правильных форм по падежам" : "правильных форм глаголов"}</p>
          <button class="big-btn primary" data-action="trainer-again">Ещё раунд</button>
          <button class="big-btn ghost" data-go="grammar">К грамматике</button>
        </div>`;
    }
    const { entry, slot } = s.tasks[s.idx];
    const correct = entry.f[slot.key];
    // Варианты из других форм этого же слова (учим различать формы)
    const pool = [...new Set(Object.values(entry.f))].filter((v) => v !== correct);
    const options = this.shuffle([correct, ...this.shuffle(pool).slice(0, 3)]);

    const promptTop = isDecl
      ? `Поставь <b>«${entry.word}»</b> (${entry.ru}, ${entry.g} род, тип ${entry.pat}) в форму:`
      : `Проспрягай <b>«${entry.word}»</b> (${entry.ru}, группа «${entry.grp}») для лица:`;

    const opts = options
      .map((o) => `<button class="opt" data-form="${this.esc(o)}">${o} ${this.speakBtn(o)}</button>`)
      .join("");

    return `
      <header class="page-head"><h2>${title}</h2><div class="counter">${s.idx + 1}/${s.tasks.length}</div></header>
      <div class="quiz-prompt">
        <div class="muted small">${promptTop}</div>
        <div class="slot-target">${slot.label}</div>
        <div class="muted small">${slot.hint}</div>
      </div>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>
    `;
  },

  /* ---------- РАБОТА НАД ОШИБКАМИ ---------- */
  renderMistakes() {
    if (!this.weak) this.loadWeak();
    if (!this.weak.length) {
      return `<header class="page-head"><h2>🔁 Работа над ошибками</h2></header>
        <p class="muted">Ошибок нет — чисто! 🎉 Они появятся здесь, когда ошибёшься в упражнениях или экзамене.</p>
        <button class="big-btn ghost" data-go="home">На главную</button>`;
    }
    if (!this.session) this.session = { qs: this.shuffle(this.weak.slice()), idx: 0, correct: 0, fixed: 0 };
    const s = this.session;
    if (s.idx >= s.qs.length) {
      return `<div class="result"><h2>Готово 💪</h2>
        <p class="big-score">${s.fixed} / ${s.qs.length}</p>
        <p class="muted">исправлено · осталось в работе: ${this.weak.length}</p>
        <button class="big-btn primary" data-action="mistakes-again">Ещё раз</button>
        <button class="big-btn ghost" data-go="home">На главную</button></div>`;
    }
    const q = s.qs[s.idx];
    const opts = this.shuffle(q.opts.slice()).map((o) => `<button class="opt" data-mistakeopt="${this.esc(o)}">${o}</button>`).join("");
    return `
      <header class="page-head"><h2>🔁 Ошибки</h2><div class="counter">${s.idx + 1}/${s.qs.length}</div></header>
      <p class="muted small">Повтори то, в чём ошибся. Ответишь верно — уйдёт из списка.</p>
      <div class="exam-q">${this.wrapGreek(q.q)}</div>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>`;
  },

  mistakesAnswer(opt, el) {
    const s = this.session;
    const q = s.qs[s.idx];
    const ok = opt === q.ans;
    if (ok) { s.fixed++; this.removeWeak(q); }
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.mistakeopt === q.ans) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно! Убрал из ошибок" : "✗ Правильно: <b>" + q.ans + "</b> (оставил на повтор)"} ${this.speakBtn(q.ans)}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.qs.length ? "Итог →" : "Дальше →"}</button>`;
    Speech.say(q.ans);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },

  /* ---------- УПРАЖНЕНИЯ ПО ТЕМЕ ГРАММАТИКИ ---------- */
  renderGex() {
    const id = this.params.topic;
    const lesson = GRAMMAR_LESSONS.find((g) => g.id === id);
    if (!this.session) {
      const all = GrammarEx.gen(id);
      const byLvl = {};
      all.forEach((x) => { const l = x.lvl || 1; (byLvl[l] = byLvl[l] || []).push(x); });
      let ordered = [];
      Object.keys(byLvl).sort().forEach((l) => ordered = ordered.concat(this.shuffle(byLvl[l])));
      this.session = { id, qs: ordered.slice(0, 24), idx: 0, correct: 0 };
    }
    const s = this.session;
    const title = (lesson ? lesson.title.replace(/^\d+\.\s*/, "") : "Упражнения");
    if (s.idx >= s.qs.length) {
      const pct = s.qs.length ? Math.round((100 * s.correct) / s.qs.length) : 0;
      return `<div class="result"><h2>${pct >= 80 ? "Отлично! 🎉" : "Готово 💪"}</h2>
        <p class="big-score ${pct < 60 ? "fail" : ""}">${s.correct} / ${s.qs.length}</p>
        <button class="big-btn primary" data-gex="${s.id}">Ещё раунд</button>
        <button class="big-btn ghost" data-go="grammar">К грамматике</button></div>`;
    }
    if (!s.qs.length) return `<div class="result"><h2>Скоро</h2><p class="muted">Для этой темы упражнения готовятся.</p><button class="big-btn ghost" data-go="grammar">Назад</button></div>`;
    const q = s.qs[s.idx];
    const body = this.settings.gexInput
      ? `<input id="typeInput" class="type-input" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
                placeholder="Напиши ответ по-гречески" value="${this.esc(s.input || "")}">
         <div class="gkbd">${this.greekKeyboard()}</div>
         <button class="big-btn primary" data-action="gex-check">Проверить</button>`
      : `<div class="opts">${q.opts.map((o) => `<button class="opt" data-gexopt="${this.esc(o)}">${o}</button>`).join("")}</div>`;
    if (this.settings.gexInput) this.afterRender = () => { const i = document.getElementById("typeInput"); if (i) i.focus(); };
    return `
      <header class="page-head"><h2>${GrammarEx.icon(s.id)} ${title}</h2><div class="counter">${s.idx + 1}/${s.qs.length}</div></header>
      <button class="back" data-go="grammar">← Грамматика</button>
      <div class="exam-q">${this.wrapGreek(q.q)}</div>
      ${body}
      <div id="fb" class="feedback"></div>`;
  },

  gexCheck() {
    const s = this.session;
    const q = s.qs[s.idx];
    const inp = document.getElementById("typeInput");
    const val = inp ? inp.value : (s.input || "");
    const ok = this.normGreek(val) === this.normGreek(q.ans);
    if (ok) s.correct++; else this.addWeak(q);
    if (inp) inp.disabled = true;
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно! " + q.ans : "✗ Правильно: <b>" + q.ans + "</b>"} ${this.speakBtn(q.ans)}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.qs.length ? "Результат →" : "Дальше →"}</button>`;
    Speech.say(q.ans);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.input = ""; this.render(); });
    this.afterAnswer();
  },

  gexAnswer(opt, el) {
    const s = this.session;
    const q = s.qs[s.idx];
    const ok = opt === q.ans;
    if (ok) s.correct++; else this.addWeak(q);
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.gexopt === q.ans) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ Правильно: <b>" + q.ans + "</b>"} ${this.speakBtn(q.ans)}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.qs.length ? "Результат →" : "Дальше →"}</button>`;
    Speech.say(q.ans);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },




  /* ---------- МЕТОДИКА И ПОКРЫТИЕ (живой расчёт) ---------- */
  grTokens(text) { return this.normGreek(text).split(" ").filter(Boolean); },

  renderCoverage() {
    const words = ALL_WORDS.length, themes = DECKS.length, lessons = GRAMMAR_LESSONS.length;
    const texts = (typeof READING_TEXTS !== "undefined") ? READING_TEXTS.length : 0;
    const exams = (typeof EXAM_READINGS !== "undefined") ? EXAM_READINGS.length : 0;
    let exCount = 0, exTopics = 0;
    GRAMMAR_LESSONS.forEach((g) => { if (GrammarEx.has(g.id)) { exTopics++; exCount += GrammarEx.gen(g.id).length; } });
    const speakN = this.buildSpeaking().length;

    // множества нормализованных словоформ
    const deckSet = new Set(); ALL_WORDS.forEach((w) => this.grTokens(w.gr).forEach((t) => deckSet.add(t)));
    const matSet = new Set();
    const addText = (s) => this.grTokens(s).forEach((t) => matSet.add(t));
    if (typeof READING_TEXTS !== "undefined") READING_TEXTS.forEach((t) => { t.sents.forEach((p) => addText(p[0])); Object.keys(t.gloss || {}).forEach((k) => addText(k)); });
    if (typeof WRITING_ORDER !== "undefined") WRITING_ORDER.forEach((s) => addText(s.tokens.join(" ")));
    if (typeof WRITING_GAPS !== "undefined") WRITING_GAPS.forEach((g) => addText(g.parts.join(" " + g.answer + " ")));
    if (typeof EXAM_READINGS !== "undefined") EXAM_READINGS.forEach((r) => addText(r.gr));
    GRAMMAR_LESSONS.forEach((g) => addText(g.body));

    const inMat = ALL_WORDS.filter((w) => this.grTokens(w.gr).some((t) => matSet.has(t))).length;
    const synergy = Math.round(100 * inMat / words);

    // официальный A1
    const allSet = new Set([...deckSet, ...matSet]);
    const off = (typeof OFFICIAL_A1 !== "undefined") ? OFFICIAL_A1 : [];
    const offDeck = off.length ? Math.round(100 * off.filter((h) => deckSet.has(h)).length / off.length) : 0;
    const offAll = off.length ? Math.round(100 * off.filter((h) => allSet.has(h)).length / off.length) : 0;

    // трек
    const track = this.buildTrack();
    const tDay = this.trackState().day;
    const trWeeks = track[track.length - 1].week;
    const trRest = track.filter((d) => d.rest).length;
    const trCheck = track.filter((d) => d.checkpoint).length;
    const trTexts = new Set(); track.forEach((d) => d.tasks.forEach((t) => { if (t.t === "read") trTexts.add(t.ref); }));
    const rareN = (typeof RARE_A1 !== "undefined") ? RARE_A1.size : 0;
    const dialogN = (typeof SPEAKING_DIALOGS !== "undefined") ? SPEAKING_DIALOGS.length : 0;

    return `
      <header class="page-head"><h2>ℹ️ Методика</h2></header>
      <p class="muted small">Считается вживую из контента — всегда актуально.</p>

      <h3 class="section-title">🗺️ Учебный путь</h3>
      <p class="muted small">Главный режим: маршрут от простого к сложному, новое стоит на изученном. По теме дня — слова, грамматика, чтение и практика; каждые 5 дней — закрепление; экзамены проверяют пройденный блок.</p>
      <div class="word-row"><div class="w-gr">Сейчас</div><div class="w-ru"><b>День ${Math.min(tDay, track.length)} из ${track.length}</b></div></div>
      <div class="word-row"><div class="w-gr">Длительность</div><div class="w-ru">~${trWeeks} недель</div></div>
      <div class="word-row"><div class="w-gr">Дни закрепления · чекпоинты</div><div class="w-ru">${trRest} · ${trCheck}</div></div>
      <div class="word-row"><div class="w-gr">Темп словаря</div><div class="w-ru">~15 новых слов в день</div></div>
      <button class="big-btn primary" data-go="track" style="margin-top:10px">Открыть путь →</button>
      <p class="muted small">⚙️ Настройки (транскрипция, режим упражнений) — на вкладке «Прогресс».</p>

      <h3 class="section-title">Что внутри</h3>
      <section class="cards-row">
        <div class="stat"><div class="stat-num">${words}</div><div class="stat-lbl">слов</div></div>
        <div class="stat"><div class="stat-num">${themes}</div><div class="stat-lbl">тем</div></div>
        <div class="stat"><div class="stat-num">${exCount}</div><div class="stat-lbl">упражнений</div></div>
      </section>
      <section class="cards-row">
        <div class="stat"><div class="stat-num">${lessons}</div><div class="stat-lbl">уроков</div></div>
        <div class="stat"><div class="stat-num">${texts}</div><div class="stat-lbl">текстов</div></div>
        <div class="stat"><div class="stat-num">${exams}</div><div class="stat-lbl">экзаменов</div></div>
      </section>

      <p class="muted center small">🗣️ говорение: ${speakN} фраз + ${dialogN} диалогов · в треке задействовано ${trTexts.size} текстов</p>

      <h3 class="section-title">Покрытие официального A1 (ΚΕΓ)</h3>
      <p class="muted small">Эталон — глоссарий ΚΛΙΚ Α1 (${off.length} лемм). Из них ${rareN} помечены «редкое» (есть в A1, но низкочастотные — учи в последнюю очередь).</p>
      <div class="word-row"><div class="w-gr">Словарём (темы)</div><div class="w-ru"><b>${offDeck}%</b></div></div>
      <div class="word-row"><div class="w-gr">Со всем контентом</div><div class="w-ru"><b>${offAll}%</b></div></div>

      <h3 class="section-title">Синергия «слово ↔ материалы»</h3>
      <p class="muted small">Доля слов, встречающихся в текстах/упражнениях/экзаменах/грамматике (контекст → удержание).</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${synergy}%"></div></div>
      <p class="muted center"><b>${synergy}%</b> слов живут в материалах</p>

      <h3 class="section-title">Методология (5 опор)</h3>
      <ol class="steps">
        <li>Алфавит → звук в первую очередь.</li>
        <li>Интервальные повторения (SRS, SM-2) — ядро удержания.</li>
        <li>Понятный ввод — graded-тексты A0→A1 с тап-переводом.</li>
        <li>Продукция — письмо, говорение, упражнения по грамматике.</li>
        <li>Самопроверка — пробные экзамены формата ΚΕΓ.</li>
      </ol>
    `;
  },

  /* ---------- ПРОГРЕСС ---------- */
  renderProgress() {
    const s = SRS.summary(ALL_WORDS);
    const perDeck = DECKS.map((d) => {
      const ds = SRS.summary(d.words);
      const pct = Math.round((ds.learned / ds.total) * 100);
      return `<div class="word-row">
        <div class="w-gr">${d.icon} ${d.title}</div>
        <div class="w-ru">${ds.learned}/${ds.total}</div>
        <div class="progress-bar mini" style="flex:1"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join("");
    // мини-календарь активности (последние 14 дней)
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const cnt = SRS.stats.learnedDates[key] || 0;
      days.push(`<div class="hday ${cnt ? "on" : ""}" title="${key}: ${cnt} новых">${d.getDate()}</div>`);
    }
    return `
      <header class="page-head"><h2>📊 Прогресс</h2></header>
      <h3 class="section-title">⚙️ Настройки</h3>
      <button class="big-btn ghost" data-action="set-tr">Транскрипция: <b>${this.settings.tr ? "показана" : "скрыта"}</b></button>
      <button class="big-btn ghost" data-action="set-gexinput">Упражнения грамматики: <b>${this.settings.gexInput ? "ввод по-гречески" : "выбор варианта"}</b></button>
      <p class="muted small">Скрой транскрипцию, когда выучишь алфавит — так формируется чтение. Режим «ввод» тренирует активное вспоминание.</p>
      <h3 class="section-title">☁️ Синхронизация</h3>
      ${this.renderAccount()}
      <section class="cards-row">
        <div class="stat"><div class="stat-num">${s.streak}🔥</div><div class="stat-lbl">дней подряд</div></div>
        <div class="stat"><div class="stat-num">${s.learned}/${s.total}</div><div class="stat-lbl">слов</div></div>
        <div class="stat"><div class="stat-num">${s.mature}</div><div class="stat-lbl">закреплено</div></div>
        <div class="stat"><div class="stat-num">${s.totalReviews}</div><div class="stat-lbl">повторов всего</div></div>
      </section>
      <h3 class="section-title">Активность (14 дней)</h3>
      <div class="heat">${days.join("")}</div>
      ${this.renderExamProgress()}
      <h3 class="section-title">По темам</h3>
      <div class="word-list">${perDeck}</div>
      <button class="big-btn ghost danger" data-action="reset">Сбросить весь прогресс</button>
    `;
  },

  renderExamProgress() {
    const best = this.examBest();
    const taken = Object.keys(best).length;
    const passed = Object.values(best).filter((p) => p >= 60).length;
    const rows = EXAM_READINGS.map((r, i) => {
      const b = best[i];
      if (b == null) return "";
      return `<div class="word-row"><div class="w-gr">📝 ${r.theme}</div><div class="w-ru">${b}% ${b >= 60 ? "✅" : ""}</div></div>`;
    }).filter(Boolean).join("");
    return `
      <h3 class="section-title">📝 Экзамены</h3>
      <p class="muted small">Сдано ${passed} из ${EXAM_READINGS.length} · пройдено ${taken}</p>
      ${rows ? `<div class="word-list">${rows}</div>` : `<p class="muted small">Пока ни одного. Открой «Экзамены» в меню.</p>`}
    `;
  },

  /* ---------- СОБЫТИЯ ---------- */
  onClick(e) {
    const t = e.target.closest("[data-go],[data-say],[data-say-slow],[data-action],[data-alpha-opt],[data-grade],[data-deck],[data-mode],[data-choice],[data-deck-next],[data-key],[data-train],[data-form],[data-wmode],[data-wtoken],[data-wgap],[data-exam],[data-exopt],[data-read],[data-readopt],[data-listenopt],[data-matchopt],[data-rw],[data-rtr],[data-gex],[data-gexopt],[data-lesson],[data-mistakeopt],[data-spkmode],[data-dialog],[data-track-day],[data-track-check]");
    if (!t) return;

    if (t.dataset.trackDay !== undefined) return this.go("track", { day: t.dataset.trackDay });
    if (t.dataset.trackCheck !== undefined) return this.toggleTrackTask(t.dataset.trackCheck);
    if (t.dataset.lesson !== undefined) return this.go("lesson", { id: t.dataset.lesson });
    if (t.dataset.gex !== undefined) { e.preventDefault(); return this.go("gex", { topic: t.dataset.gex }); }
    if (t.dataset.gexopt !== undefined) return this.gexAnswer(t.dataset.gexopt, t);
    if (t.dataset.mistakeopt !== undefined) return this.mistakesAnswer(t.dataset.mistakeopt, t);
    if (t.dataset.spkmode !== undefined) return this.go("speaking", { mode: t.dataset.spkmode });
    if (t.dataset.dialog !== undefined) {
      const d = SPEAKING_DIALOGS.find((x) => x.id === t.dataset.dialog);
      this.view = "speaking"; this.params = { mode: "dialog" };
      this.session = { d, idx: 0, reveal: false };
      this.menuOpen = false; this.writeHash(); this.render(); window.scrollTo(0, 0);
      return;
    }

    if (t.dataset.rw !== undefined) return this.showWord(t.dataset.rw, t.dataset.ro);
    if (t.dataset.rtr !== undefined) return this.rTrans(t.dataset.rtr);
    if (t.dataset.read !== undefined) return this.go("read", { id: t.dataset.read });
    if (t.dataset.readopt !== undefined) return this.readQuizAnswer(t.dataset.readopt, t);
    if (t.dataset.listenopt !== undefined) return this.listenAnswer(t.dataset.listenopt, t);
    if (t.dataset.matchopt !== undefined) return this.matchAnswer(t.dataset.matchopt, t);

    if (t.dataset.go) return this.go(t.dataset.go);

    if (t.dataset.exam !== undefined) return this.go("exam", { n: t.dataset.exam, scope: t.dataset.examScope || "" });
    if (t.dataset.exopt !== undefined) return this.examAnswer(t.dataset.exopt, t);

    if (t.dataset.wmode) return this.go("writing", { mode: t.dataset.wmode });
    if (t.dataset.wtoken) return this.wToken(t.dataset.wtoken);
    if (t.dataset.wgap !== undefined) return this.wGapAnswer(t.dataset.wgap, t);

    if (t.dataset.say !== undefined) { Speech.say(t.dataset.say); return; }
    if (t.dataset.saySlow !== undefined) { Speech.say(t.dataset.saySlow, 0.6); return; }

    if (t.dataset.train) return this.go("trainer", { kind: t.dataset.train });
    if (t.dataset.form !== undefined) return this.formAnswer(t.dataset.form, t);

    if (t.dataset.deck && !t.dataset.mode) return this.go("practice", { deck: t.dataset.deck, mode: "list" });
    if (t.dataset.deck && t.dataset.mode) return this.go("practice", { deck: t.dataset.deck, mode: t.dataset.mode });
    if (t.dataset.mode) return this.go("practice", { deck: this.params.deck, mode: t.dataset.mode });

    const a = t.dataset.action;
    if (a) return this.action(a, t);

    if (t.dataset.alphaOpt) return this.alphaAnswer(t.dataset.alphaOpt, t);
    if (t.dataset.grade !== undefined) return this.reviewGrade(parseInt(t.dataset.grade, 10));
    if (t.dataset.deckNext !== undefined) return this.deckLearnNext(parseInt(t.dataset.deckNext, 10));
    if (t.dataset.choice) return this.choiceAnswer(t.dataset.choice, t);
    if (t.dataset.key) return this.kbdKey(t.dataset.key);
  },

  onInput(e) {
    if (e.target.id === "typeInput") this.session.input = e.target.value;
    if (e.target.id === "composeText" || e.target.id === "selfText") this.session.text = e.target.value;
  },

  onKey(e) {
    if (e.key === "Enter" && e.target.id === "typeInput") {
      e.preventDefault();
      if (this.view === "gex") this.gexCheck(); else this.typeCheck();
    }
    if (this.view === "review" && this.session && !this.session.flipped && e.code === "Space") {
      e.preventDefault(); this.action("flip");
    }
  },

  action(name, el) {
    switch (name) {
      case "flip": this.session.flipped = true; return this.render();
      case "review-again": this.session = null; return this.render();
      case "alpha-again": this.session = null; return this.render();
      case "mode-again": this.session = null; return this.render();
      case "trainer-again": this.session = null; return this.render();
      case "deck-flip": this.session.answered = true; return this.render();
      case "type-check": return this.typeCheck();
      case "exam-type-check": return this.examTypeCheck();
      case "speak-start": return this.speakStart();
      case "speak-next": this.session.idx++; return this.render();
      case "track-done": return this.trackDone();
      case "track-restart": { this.trackState().day = 1; this.trackState().done = {}; this.saveTrackState(); return this.go("track"); }
      case "spk-start": return this.speakStartPhrase();
      case "spk-next": this.session.done++; this.session.idx++; this.session.scored = false; return this.render();
      case "spk-again": this.session = null; return this.render();
      case "spkq-start": return this.speakQAStart();
      case "spkq-reveal": return this.speakQAReveal();
      case "spkq-again": this.session = null; return this.render();
      case "dlg-next": this.session.idx++; this.session.reveal = false; return this.render();
      case "dlg-reveal": this.session.reveal = true; return this.render();
      case "dlg-mic": return this.speakDialogMic();
      case "dlg-restart": this.session.idx = 0; this.session.reveal = false; return this.render();
      case "listen-replay": { const d = this.session.pool[this.session.idx]; return this.playDialogAudio(d); }
      case "listen-again": this.session = null; return this.render();
      case "match-again": this.session = null; return this.render();
      case "worder-check": return this.worderCheck();
      case "compose-check": return this.composeCheck();
      case "compose-new": this.session = null; return this.render();
      case "form-check": return this.formCheck();
      case "form-again": this.session = null; return this.render();
      case "self-checkwrite": return this.selfCheckWrite();
      case "self-reveal": this.session.revealed = true; return this.render();
      case "self-next": this.session.idx++; this.session.revealed = false; this.session.text = ""; return this.render();
      case "wr-again": this.session = null; return this.render();
      case "cloud-login": if (window.Cloud && window.Cloud.login) window.Cloud.login(); return;
      case "cloud-logout": if (window.Cloud && window.Cloud.logout) window.Cloud.logout(); return;
      case "menu-toggle": return this.toggleMenu();
      case "menu-close": return this.toggleMenu(false);
      case "read-done": { const id = el.dataset.id; this.markRead(id); return this.go("reading"); }
      case "read-quiz": return this.go("readquiz", { id: el.dataset.id });
      case "read-all": {
        const tx = READING_TEXTS.find((x) => x.id === this.params.id);
        if (tx) Speech.sayAll(tx.sents.map((p) => p[0]));
        return;
      }
      case "wordbar-close": { const b = document.getElementById("wordbar"); if (b) b.hidden = true; return; }
      case "set-tr": return this.toggleSetting("tr");
      case "set-gexinput": return this.toggleSetting("gexInput");
      case "gex-check": return this.gexCheck();
      case "mistakes-again": this.session = null; return this.render();
      case "onboard-go": try { localStorage.setItem("greekA1_onboard", "1"); } catch {} return this.go("track");
      case "onboard-dismiss": return this.dismissOnboard();
      case "reset":
        if (confirm("Сбросить весь прогресс (слова, экзамены, чтение, стрик)? Это нельзя отменить.")) {
          SRS.reset();
          localStorage.removeItem("greekA1_exam_best");
          localStorage.removeItem("greekA1_reading_done");
          localStorage.removeItem("greekA1_track");
          this._ts = null; this._track = null;
          if (window.Cloud && window.Cloud.reset) window.Cloud.reset();
          this._gg = null; this._stems = null; this._speaking = null;
          this.go("home");
        }
        return;
    }
  },

  /* --- логика тренажёра букв --- */
  alphaAnswer(upper, el) {
    const s = this.session;
    const cur = s.pool[s.idx];
    const fb = document.getElementById("fb");
    const ok = upper === cur.upper;
    if (ok) s.correct++;
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.alphaOpt === cur.upper) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    Speech.say(cur.example);
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ Это " + cur.upper + " " + cur.lower + " — " + cur.sound}</div>
      <button class="big-btn primary" data-action="alpha-next">Дальше →</button>`;
    this.afterRender = () => {};
    // навешиваем next
    fb.querySelector("[data-action='alpha-next']").addEventListener("click", () => {
      s.idx++; s.answered = false; this.render();
    });
    this.afterAnswer();
  },

  /* --- SRS оценка --- */
  reviewGrade(q) {
    const s = this.session;
    const cur = s.queue[s.idx];
    SRS.grade(cur.id, q);
    s.done++;
    if (q === 0) s.again.push(cur); // вернуть в конце сессии
    s.idx++;
    s.flipped = false;
    this.render();
  },

  /* --- ответ в тренажёре склонений/спряжений --- */
  formAnswer(form, el) {
    const s = this.session;
    const { entry, slot } = s.tasks[s.idx];
    const correct = entry.f[slot.key];
    const ok = form === correct;
    if (ok) s.correct++;
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.form === correct) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    Speech.say(correct);
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно! " + correct : "✗ Правильно: <b>" + correct + "</b>"}</div>
      <button class="big-btn primary" id="nextBtn">Дальше →</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },

  /* --- карточки внутри темы --- */
  deckLearnNext(knew) {
    const s = this.session;
    const cur = s.pool[s.idx];
    if (cur && cur.id) SRS.grade(cur.id, knew ? 2 : 0); // практика идёт в прогресс
    if (knew) s.correct++;
    s.idx++; s.answered = false;
    this.render();
  },

  /* --- выбор/аудио ответ --- */
  choiceAnswer(id, el) {
    const s = this.session;
    const cur = s.pool[s.idx];
    const ok = id === cur.id;
    if (cur && cur.id) SRS.grade(cur.id, ok ? 2 : 0); // практика идёт в прогресс
    if (ok) s.correct++; else this.addWeakWord(cur);
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.choice === cur.id) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ " + cur.gr + " — " + cur.ru}</div>
      <button class="big-btn primary" id="nextBtn">Дальше →</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },

  /* --- экранная клавиатура --- */
  kbdKey(k) {
    const inp = document.getElementById("typeInput");
    if (!inp) return;
    if (k === "BACK") inp.value = inp.value.slice(0, -1);
    else inp.value += k;
    this.session.input = inp.value;
    inp.focus();
  },

  /* --- проверка набора --- */
  typeCheck() {
    const s = this.session;
    const cur = s.pool[s.idx];
    const inp = document.getElementById("typeInput");
    const val = inp ? inp.value : s.input;
    const ok = this.normGreek(val) === this.normGreek(cur.gr);
    if (cur && cur.id) SRS.grade(cur.id, ok ? 2 : 0); // практика идёт в прогресс
    if (ok) s.correct++; else this.addWeakWord(cur);
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">
        ${ok ? "✓ Верно! " + cur.gr : "✗ Правильно: <b>" + cur.gr + "</b>"} ${this.speakBtn(cur.gr)}
        <div class="answer-ru">${cur.ru} <span class="tr">· [${cur.tr}]</span></div>
      </div>
      <button class="big-btn primary" id="nextBtn">Дальше →</button>`;
    if (inp) inp.disabled = true;
    Speech.say(cur.gr);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.input = ""; this.render(); });
    this.afterAnswer();
  },

  /* --- произношение: запись и проверка --- */
  speakStart() {
    const cur = this.session.pool[this.session.idx];
    const mic = document.querySelector(".mic-btn");
    const fb = document.getElementById("fb");
    Recog.listen(
      (alts) => this.speakResult(alts, cur),
      (code) => {
        if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Произнести"; mic.disabled = false; }
        const msg = code === "not-allowed" || code === "service-not-allowed"
          ? "Доступ к микрофону запрещён. Разреши его в настройках браузера."
          : code === "nomatch"
          ? "Не расслышал. Попробуй ещё раз, чётче."
          : "Не получилось записать. Попробуй ещё раз.";
        if (fb) fb.innerHTML = `<div class="bad-msg">${msg}</div>`;
      },
      () => {
        if (mic) { mic.classList.add("rec"); mic.innerHTML = "🔴 Слушаю… говори"; mic.disabled = true; }
        if (fb) fb.innerHTML = "";
      }
    );
  },

  speakResult(alts, cur) {
    const s = this.session;
    const mic = document.querySelector(".mic-btn");
    if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Сказать снова"; mic.disabled = false; }
    const target = this.phoneticGreek(cur.gr);
    const targetWords = target.split(" ").filter(Boolean);
    const heardNorm = alts.map((a) => this.phoneticGreek(a));
    // Числа распознаются как цифры («δύο» → «2»): принимаем и цифру.
    const ruDigits = (cur.ru || "").replace(/[^\d]/g, "");
    const digitOk = ruDigits && alts.some((a) => a.replace(/[^\d]/g, "") === ruDigits);
    // Совпадение: точное ИЛИ все слова цели присутствуют в одном из вариантов
    const ok = digitOk || heardNorm.some((h) => {
      if (h === target) return true;
      const hw = h.split(" ").filter(Boolean);
      return targetWords.every((w) => hw.includes(w));
    });
    if (ok && cur.id) SRS.grade(cur.id, 2); // успешное произношение идёт в прогресс
    if (ok && !s._scored) s.correct++;
    s._scored = true; // не двойной счёт при повторных попытках одного слова
    const heardShow = alts[0] || "—";
    const fb = document.getElementById("fb");
    fb.innerHTML = `
      <div class="${ok ? "ok-msg" : "bad-msg"}">
        ${ok ? "✓ Отлично, верно!" : "✗ Похоже, не то"} ${this.speakBtn(cur.gr)}
        <div class="answer-ru">Услышал: «${this.esc(heardShow)}» · нужно: <b>${cur.gr}</b></div>
      </div>
      <button class="big-btn primary" id="nextBtn">${ok ? "Дальше →" : "Дальше (пропустить) →"}</button>`;
    Speech.say(cur.gr);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s._scored = false; this.render(); });
    this.afterAnswer();
  },
};

window.App = App; // для облачной синхронизации (js/cloud.js)
document.addEventListener("DOMContentLoaded", () => App.init());
