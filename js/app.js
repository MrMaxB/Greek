/* ============================================================
   Ελληνικά A1 — главный контроллер приложения.
   Без зависимостей. Рендер строками + делегирование событий.
   ============================================================ */

const App = {
  view: "home",
  params: {},
  session: null,

  root: null,

  init() {
    this.root = document.getElementById("app");
    // Service worker: «никогда не залипает на старой версии» (только на https-сайте)
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(() => {});
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

  go(view, params = {}) {
    this.view = view;
    this.params = params;
    this.session = null;
    this.menuOpen = false;
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

  // Сравнение греческого без учёта ударений/регистра (для набора)
  normGreek(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // снять диакритику
      .replace(/ς/g, "σ")
      .replace(/[;.,!·]/g, "")
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
      alphabet: () => this.renderAlphabet(),
      alphaQuiz: () => this.renderAlphaQuiz(),
      review: () => this.renderReview(),
      decks: () => this.renderDecks(),
      practice: () => this.renderPractice(),
      grammar: () => this.renderGrammar(),
      trainer: () => this.renderTrainer(),
      writing: () => this.renderWriting(),
      exams: () => this.renderExamsList(),
      exam: () => this.renderExam(),
      progress: () => this.renderProgress(),
    };
    this.root.innerHTML =
      this.renderNav() + `<main class="screen">${(map[this.view] || map.home)()}</main>`;
    if (this.afterRender) { const f = this.afterRender; this.afterRender = null; f(); }
  },

  renderNav() {
    const items = [
      ["home", "🏠", "Главная"],
      ["alphabet", "🔤", "Алфавит"],
      ["review", "🧠", "Повтор"],
      ["decks", "📚", "Темы"],
      ["grammar", "📖", "Грамматика"],
      ["writing", "✍️", "Письмо"],
      ["exams", "📝", "Экзамены"],
      ["progress", "📊", "Прогресс"],
    ];
    const root = ["alphaQuiz"].includes(this.view) ? "alphabet"
      : this.view === "practice" ? "decks"
      : this.view === "trainer" ? "grammar"
      : this.view === "exam" ? "exams" : this.view;
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

  /* ---------- ГЛАВНАЯ ---------- */
  renderHome() {
    const s = SRS.summary(ALL_WORDS);
    const pct = Math.round((s.learned / s.total) * 100);
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

      <section class="cta">
        <button class="big-btn primary" data-go="review">
          🧠 Заниматься сейчас
          <small>${s.due} повторить · ${Math.max(0, 12 - s.newToday)} новых доступно</small>
        </button>
        <button class="big-btn" data-go="exams">
          📝 Пробные экзамены A1
          <small>${EXAM_READINGS.length} мини-тестов в формате экзамена</small>
        </button>
      </section>

      <h3 class="section-title">План «с нуля» — 4 шага</h3>
      <ol class="steps">
        <li><b>Шаг 1.</b> Выучи <a data-go="alphabet">алфавит</a> — читать звуки и буквосочетания.</li>
        <li><b>Шаг 2.</b> Каждый день делай <a data-go="review">повторение (SRS)</a> — 10–15 минут.</li>
        <li><b>Шаг 3.</b> Прокачивай <a data-go="decks">темы</a>: аудирование, выбор, набор слов.</li>
        <li><b>Шаг 4.</b> Загляни в <a data-go="grammar">грамматику</a>, когда слова начнут складываться.</li>
      </ol>

      <h3 class="section-title">Быстрый старт</h3>
      <div class="grid">
        <button class="tile" data-go="alphabet"><span class="tile-ic">🔤</span>Алфавит</button>
        <button class="tile" data-go="decks"><span class="tile-ic">📚</span>Темы (${DECKS.length})</button>
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
      const queue = SRS.buildQueue(ALL_WORDS, 12);
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
          <div class="w-gr">${w.gr}</div>
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
               <div class="muted">[${cur.tr}]</div>
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
          <div class="muted">[${cur.tr}] · ${cur.ru}</div>
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
               <div class="muted small">подсказка: [${cur.tr}]</div>
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

  /* ---------- ГРАММАТИКА (теория + тренажёры) ---------- */
  renderGrammar() {
    const items = GRAMMAR_LESSONS.map(
      (g) => `<details class="gram"><summary>${g.title}</summary><div class="gram-body">${g.body}</div></details>`
    ).join("");
    return `
      <header class="page-head"><h2>📖 Грамматика A1</h2></header>
      <p class="muted">Полная теория для A1 + упражнения. Сначала прочитай урок, потом закрепи в тренажёре.</p>

      <div class="train-row">
        <button class="train-btn" data-train="decl"><span>🧩</span><b>Склонения</b><small>падежи существительных</small></button>
        <button class="train-btn" data-train="conj"><span>🔀</span><b>Спряжения</b><small>глаголы в наст. времени</small></button>
      </div>

      <h3 class="section-title">📚 Теория (${GRAMMAR_LESSONS.length} уроков)</h3>
      ${items}
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
      const tasks = this.shuffle(data).slice(0, 10).map((entry) => {
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

  /* ---------- ПИСЬМО (авто-упражнения) ---------- */
  renderWriting() {
    const mode = this.params.mode || "menu";
    if (mode === "menu") {
      const tile = (m, ic, t, d) =>
        `<button class="deck-tile" data-wmode="${m}"><div class="deck-ic">${ic}</div><div class="deck-body"><div class="deck-title">${t}</div><div class="deck-meta">${d}</div></div></button>`;
      return `
        <header class="page-head"><h2>✍️ Письмо</h2></header>
        <p class="muted">Письменные упражнения A1 — проверяются автоматически.</p>
        <div class="deck-list">
          ${tile("worder", "🧩", "Собери предложение", "порядок слов из блоков")}
          ${tile("gap", "✏️", "Вставь слово", "пропущенное слово · грамматика")}
          ${tile("compose", "📝", "Текст из слов", "составь предложения из изученных слов")}
          ${tile("self", "🪪", "О себе", "ответь по-гречески, сверься с образцом")}
        </div>`;
    }
    if (mode === "worder") return this.renderWOrder();
    if (mode === "gap") return this.renderWGap();
    if (mode === "compose") return this.renderWCompose();
    if (mode === "self") return this.renderWSelf();
    return this.renderWriting();
  },

  wHead(title, s) {
    return `<header class="page-head"><h2>${title}</h2><div class="counter">${Math.min(s.idx + 1, s.pool.length)}/${s.pool.length}</div></header>
      <button class="back" data-go="writing">← Письмо</button>`;
  },

  wResult(s, label) {
    return `<div class="result">
      <h2>Готово! 🎉</h2><p class="big-score">${s.correct} / ${s.pool.length}</p>
      <p class="muted">${label}</p>
      <button class="big-btn primary" data-action="wr-again">Ещё раунд</button>
      <button class="big-btn ghost" data-go="writing">К письму</button>
    </div>`;
  },

  // Собери предложение (порядок слов)
  renderWOrder() {
    if (!this.session) this.session = { pool: this.shuffle(WRITING_ORDER), idx: 0, correct: 0, bank: null, built: [] };
    const s = this.session;
    if (s.idx >= s.pool.length) return this.wResult(s, "верных предложений");
    const cur = s.pool[s.idx];
    if (s.bank === null) { s.bank = this.shuffle(cur.tokens.map((t, i) => ({ i, t }))); s.built = []; }
    const builtHtml = s.built.length
      ? s.built.map((i) => `<button class="tok built" data-wtoken="built:${i}">${cur.tokens[i]}</button>`).join("")
      : `<span class="muted small">нажимай слова ниже, чтобы собрать фразу…</span>`;
    const bankHtml = s.bank.filter((b) => !s.built.includes(b.i))
      .map((b) => `<button class="tok" data-wtoken="bank:${b.i}">${b.t}</button>`).join("");
    return `${this.wHead("🧩 Собери предложение", s)}
      <div class="quiz-prompt"><div class="type-ru">${cur.ru}</div></div>
      <div class="build-area">${builtHtml}</div>
      <div class="bank-area">${bankHtml}</div>
      <button class="big-btn primary" data-action="worder-check">Проверить</button>
      <div id="fb" class="feedback"></div>`;
  },

  wToken(spec) {
    const s = this.session;
    const [kind, iStr] = spec.split(":");
    const i = parseInt(iStr, 10);
    if (kind === "bank") s.built.push(i);
    else s.built = s.built.filter((x) => x !== i);
    this.render();
  },

  worderCheck() {
    const s = this.session;
    const cur = s.pool[s.idx];
    const built = s.built.map((i) => cur.tokens[i]).join(" ");
    const ok = this.normGreek(built) === this.normGreek(cur.tokens.join(" "));
    if (ok && !s._scored) s.correct++;
    s._scored = true;
    const right = cur.tokens.join(" ");
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно! " + right : "✗ Правильно: <b>" + right + "</b>"} ${this.speakBtn(right)}</div>
      <button class="big-btn primary" id="nextBtn">Дальше →</button>`;
    Speech.say(right);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.bank = null; s.built = []; s._scored = false; this.render(); });
    this.afterAnswer();
  },

  // Вставь слово
  renderWGap() {
    if (!this.session) this.session = { pool: this.shuffle(WRITING_GAPS), idx: 0, correct: 0 };
    const s = this.session;
    if (s.idx >= s.pool.length) return this.wResult(s, "верных ответов");
    const cur = s.pool[s.idx];
    const opts = this.shuffle(cur.options).map((o) => `<button class="opt" data-wgap="${this.esc(o)}">${o}</button>`).join("");
    return `${this.wHead("✏️ Вставь слово", s)}
      <div class="quiz-prompt">
        <div class="gap-sentence">${cur.parts[0]}<span class="blank">_____</span>${cur.parts[1]}</div>
        <div class="muted small">${cur.ru}</div>
      </div>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>`;
  },

  wGapAnswer(opt, el) {
    const s = this.session;
    const cur = s.pool[s.idx];
    const ok = opt === cur.answer;
    if (ok) s.correct++;
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.wgap === cur.answer) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const full = cur.parts[0] + cur.answer + cur.parts[1];
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ " + cur.answer} ${this.speakBtn(full)}<div class="answer-ru">${full}</div></div>
      <button class="big-btn primary" id="nextBtn">Дальше →</button>`;
    Speech.say(full);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },

  // Текст из изученных слов
  renderWCompose() {
    if (!this.session) {
      const learned = ALL_WORDS.filter((w) => !SRS.isNew(w.id) && /^[Α-Ωα-ωΆ-Ώά-ώ]+$/.test(w.gr)).map((w) => w.gr);
      const src = learned.length >= 5 ? learned : WRITING_STARTER_WORDS;
      this.session = { targets: this.shuffle(src).slice(0, 5), text: "" };
    }
    const s = this.session;
    const chips = s.targets.map((t) => `<span class="chip" id="chip-${this.esc(t)}">${t} ${this.speakBtn(t)}</span>`).join("");
    return `
      <header class="page-head"><h2>📝 Текст из слов</h2></header>
      <button class="back" data-go="writing">← Письмо</button>
      <p class="muted">Напиши 2–3 предложения по-гречески, используя <b>все</b> эти слова:</p>
      <div class="chips">${chips}</div>
      <textarea id="composeText" class="type-input area" placeholder="Πιши здесь…">${this.esc(s.text)}</textarea>
      <button class="big-btn primary" data-action="compose-check">Проверить</button>
      <button class="big-btn ghost" data-action="compose-new">Другие слова</button>
      <div id="fb" class="feedback"></div>`;
  },

  composeCheck() {
    const s = this.session;
    const inp = document.getElementById("composeText");
    const text = inp ? inp.value : "";
    s.text = text;
    const norm = this.normGreek(text);
    const used = [], missing = [];
    s.targets.forEach((t) => {
      const nt = this.normGreek(t);
      const stem = nt.slice(0, Math.max(4, nt.length - 2));
      (norm.includes(stem) ? used : missing).push(t);
    });
    s.targets.forEach((t) => {
      const chip = document.getElementById("chip-" + t);
      if (chip) chip.classList.toggle("done", used.includes(t));
    });
    const allUsed = missing.length === 0;
    const hasText = norm.length > 3;
    const fb = document.getElementById("fb");
    fb.innerHTML = allUsed && hasText
      ? `<div class="ok-msg">✓ Отлично! Использованы все ${used.length} слов(а). Так держать!</div>`
      : `<div class="bad-msg">Использовано ${used.length}/${s.targets.length}. Осталось вставить: <b>${missing.join(", ") || "—"}</b>${hasText ? "" : " (и напиши хоть пару слов)"}</div>`;
    this.afterAnswer();
  },

  // О себе (подсказка + образец)
  renderWSelf() {
    if (!this.session) this.session = { pool: this.shuffle(WRITING_SELF), idx: 0, revealed: false, text: "" };
    const s = this.session;
    if (s.idx >= s.pool.length) return `<div class="result"><h2>Готово! 🎉</h2><p class="muted">Ты ответил на все вопросы о себе.</p><button class="big-btn primary" data-action="wr-again">Ещё раз</button><button class="big-btn ghost" data-go="writing">К письму</button></div>`;
    const cur = s.pool[s.idx];
    const reveal = s.revealed
      ? `<div class="ok-msg" style="text-align:left">Образец: <b>${cur.model}</b> ${this.speakBtn(cur.model)}</div>
         <button class="big-btn primary" data-action="self-next">Дальше →</button>`
      : `<button class="big-btn primary" data-action="self-reveal">Показать образец</button>`;
    return `<header class="page-head"><h2>🪪 О себе</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <button class="back" data-go="writing">← Письмо</button>
      <div class="quiz-prompt"><div class="type-ru">${cur.ask}</div></div>
      <textarea id="selfText" class="type-input area" placeholder="Напиши ответ по-гречески…">${this.esc(s.text)}</textarea>
      <div id="reveal">${reveal}</div>`;
  },

  /* ---------- ЭКЗАМЕНЫ ---------- */
  examBest() {
    try { return JSON.parse(localStorage.getItem("greekA1_exam_best")) || {}; }
    catch { return {}; }
  },
  saveExamBest(n, pct) {
    const b = this.examBest();
    if (b[n] == null || pct > b[n]) {
      b[n] = pct;
      localStorage.setItem("greekA1_exam_best", JSON.stringify(b));
      if (window.Cloud && window.Cloud.push) window.Cloud.push();
    }
  },

  // Кнопка аккаунта в шапке (видна на всех экранах)
  renderTopAccount() {
    const c = window.Cloud;
    if (!c || !c.enabled) return "";
    if (c.user) {
      const name = this.esc((c.user.displayName || c.user.email || "Аккаунт").split(" ")[0]);
      return `<button class="acct-chip" data-go="progress">☁️ ${name}</button>`;
    }
    return `<button class="acct-chip" data-action="cloud-login">☁️ Войти</button>`;
  },

  // Карточка аккаунта (облачная синхронизация)
  renderAccount() {
    const c = window.Cloud;
    if (!c || !c.enabled) {
      return `<div class="acct-card"><div class="muted small">☁️ Облачная синхронизация доступна на сайте <b>mrmaxb.github.io/Greek</b> (онлайн, в этом же браузере).</div></div>`;
    }
    const err = c.status ? `<div class="bad-msg small" style="text-align:left">${c.status}</div>` : "";
    if (c.user) {
      const name = this.esc(c.user.displayName || c.user.email || "аккаунт");
      return `<div class="acct-card">
        <div>☁️ <b>${name}</b><br><span class="muted small">Прогресс синхронизируется между устройствами автоматически.</span></div>
        ${err}
        <button class="big-btn ghost" data-action="cloud-logout">Выйти</button>
      </div>`;
    }
    return `<div class="acct-card">
      <button class="big-btn primary" data-action="cloud-login">☁️ Войти через Google</button>
      <div class="muted small">Чтобы прогресс был на ПК и телефоне и не терялся при очистке кэша.</div>
      ${err}
    </div>`;
  },

  renderExamsList() {
    const best = this.examBest();
    const tiles = EXAM_READINGS.map((r, i) => {
      const b = best[i];
      const meta = b != null
        ? `лучший результат: <b>${b}%</b> ${b >= 60 ? "✅ сдан" : "❌ ещё разок"}`
        : "ещё не пройден";
      return `<button class="deck-tile" data-exam="${i}">
        <div class="deck-ic">📝</div>
        <div class="deck-body"><div class="deck-title">Экзамен ${i + 1} · ${r.theme}</div>
        <div class="deck-meta">${meta}</div></div>
      </button>`;
    }).join("");
    return `
      <header class="page-head"><h2>📝 Пробные экзамены A1</h2></header>
      <p class="muted">Формат как на экзамене: чтение, лексика, грамматика, аудио и письмо. Зачёт — от 60%. Можно пересдавать: вопросы каждый раз обновляются.</p>
      <div class="deck-list">${tiles}</div>
    `;
  },

  // Сборка одного экзамена из текста + общих банков
  buildExam(n) {
    const R = EXAM_READINGS[n % EXAM_READINGS.length];
    const qs = [];
    const otherRu = (ru, k) => this.shuffle(ALL_WORDS.filter((x) => x.ru !== ru)).slice(0, k).map((x) => x.ru);
    const uniq = (arr) => [...new Set(arr)];

    // Чтение
    R.q.forEach((q) => qs.push({ section: "Чтение", passage: R.gr, passageRu: R.ru, prompt: q.ask, options: this.shuffle(q.options.slice()), answer: q.answer }));
    // Лексика (4): что значит слово
    this.shuffle(ALL_WORDS).slice(0, 4).forEach((w) => {
      const opts = uniq([w.ru, ...otherRu(w.ru, 3)]);
      qs.push({ section: "Лексика", prompt: `Что значит «${w.gr}»?`, audio: w.gr, options: this.shuffle(opts), answer: w.ru });
    });
    // Грамматика (4): вставь слово
    this.shuffle(WRITING_GAPS).slice(0, 4).forEach((g) => {
      qs.push({ section: "Грамматика", prompt: `${g.parts[0]}<span class="blank">_____</span>${g.parts[1]} <span class="muted small">(${g.ru})</span>`, options: this.shuffle(g.options.slice()), answer: g.answer });
    });
    // Аудио (3): услышь и выбери перевод (текст скрыт)
    this.shuffle(ALL_WORDS).slice(0, 3).forEach((w) => {
      const opts = uniq([w.ru, ...otherRu(w.ru, 3)]);
      qs.push({ section: "Аудио", prompt: "Прослушай и выбери перевод:", audio: w.gr, hideAudioText: true, autoplay: true, options: this.shuffle(opts), answer: w.ru });
    });
    // Письмо (2): выбери правильное предложение
    this.shuffle(WRITING_ORDER).slice(0, 2).forEach((sn) => {
      const correct = sn.tokens.join(" ");
      const scrambles = new Set();
      let guard = 0;
      while (scrambles.size < 2 && guard++ < 30) {
        const x = this.shuffle(sn.tokens).join(" ");
        if (x !== correct) scrambles.add(x);
      }
      qs.push({ section: "Письмо", prompt: `Выбери правильное предложение: «${sn.ru}»`, options: this.shuffle([correct, ...scrambles]), answer: correct });
    });
    return qs;
  },

  renderExam() {
    const n = parseInt(this.params.n, 10) || 0;
    if (!this.session || this.session.n !== n) this.session = { n, qs: this.buildExam(n), idx: 0, correct: 0, sect: {} };
    const s = this.session;

    if (s.idx >= s.qs.length) {
      const pct = Math.round((100 * s.correct) / s.qs.length);
      this.saveExamBest(n, pct);
      const pass = pct >= 60;
      const rows = Object.keys(s.sect).map((k) =>
        `<div class="word-row"><div class="w-gr">${k}</div><div class="w-ru">${s.sect[k].c}/${s.sect[k].t}</div></div>`).join("");
      return `
        <div class="result">
          <h2>${pass ? "Сдан! 🎉" : "Почти 💪"}</h2>
          <p class="big-score ${pass ? "" : "fail"}">${pct}%</p>
          <p class="muted">${s.correct} из ${s.qs.length} правильно · зачёт от 60%</p>
        </div>
        <div class="word-list">${rows}</div>
        <button class="big-btn primary" data-exam="${n}">Пересдать</button>
        <button class="big-btn ghost" data-go="exams">К списку экзаменов</button>`;
    }

    const q = s.qs[s.idx];
    const passage = q.passage
      ? `<details class="passage" open><summary>📖 Текст</summary><div class="passage-gr">${q.passage}</div><div class="passage-ru muted small">${q.passageRu}</div></details>`
      : "";
    const audio = q.audio
      ? `<div class="quiz-prompt listen">
           <button class="play-big" data-say="${this.esc(q.audio)}">🔊 Слушать</button>
           <button class="play-slow" data-say-slow="${this.esc(q.audio)}">🐢 Медленно</button>
         </div>`
      : "";
    if (q.autoplay) this.afterRender = () => Speech.say(q.audio);
    const opts = q.options.map((o) => `<button class="opt" data-exopt="${this.esc(o)}">${o}</button>`).join("");
    return `
      <header class="page-head"><h2>Экзамен ${n + 1}</h2><div class="counter">${s.idx + 1}/${s.qs.length}</div></header>
      <div class="exam-sec">${q.section}</div>
      ${passage}${audio}
      <div class="exam-q">${q.prompt}</div>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>`;
  },

  examAnswer(opt, el) {
    const s = this.session;
    const q = s.qs[s.idx];
    const ok = opt === q.answer;
    if (ok) s.correct++;
    if (!s.sect[q.section]) s.sect[q.section] = { c: 0, t: 0 };
    s.sect[q.section].t++; if (ok) s.sect[q.section].c++;
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.exopt === q.answer) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const reveal = q.hideAudioText ? `<div class="answer-ru">${q.audio}</div>` : "";
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ Правильно: <b>" + q.answer + "</b>"}${reveal}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.qs.length ? "Результат →" : "Дальше →"}</button>`;
    if (q.audio) Speech.say(q.audio);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
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
      <h3 class="section-title">По темам</h3>
      <div class="word-list">${perDeck}</div>
      <button class="big-btn ghost danger" data-action="reset">Сбросить весь прогресс</button>
    `;
  },

  /* ---------- СОБЫТИЯ ---------- */
  onClick(e) {
    const t = e.target.closest("[data-go],[data-say],[data-say-slow],[data-action],[data-alpha-opt],[data-grade],[data-deck],[data-mode],[data-choice],[data-deck-next],[data-key],[data-train],[data-form],[data-wmode],[data-wtoken],[data-wgap],[data-exam],[data-exopt]");
    if (!t) return;

    if (t.dataset.go) return this.go(t.dataset.go);

    if (t.dataset.exam !== undefined) return this.go("exam", { n: t.dataset.exam });
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
    if (e.key === "Enter" && e.target.id === "typeInput") { e.preventDefault(); this.typeCheck(); }
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
      case "speak-start": return this.speakStart();
      case "speak-next": this.session.idx++; return this.render();
      case "worder-check": return this.worderCheck();
      case "compose-check": return this.composeCheck();
      case "compose-new": this.session = null; return this.render();
      case "self-reveal": this.session.revealed = true; return this.render();
      case "self-next": this.session.idx++; this.session.revealed = false; this.session.text = ""; return this.render();
      case "wr-again": this.session = null; return this.render();
      case "cloud-login": if (window.Cloud && window.Cloud.login) window.Cloud.login(); return;
      case "cloud-logout": if (window.Cloud && window.Cloud.logout) window.Cloud.logout(); return;
      case "menu-toggle": return this.toggleMenu();
      case "menu-close": return this.toggleMenu(false);
      case "reset":
        if (confirm("Сбросить весь прогресс и стрик? Это нельзя отменить.")) { SRS.reset(); this.go("home"); }
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
    if (knew) s.correct++;
    s.idx++; s.answered = false;
    this.render();
  },

  /* --- выбор/аудио ответ --- */
  choiceAnswer(id, el) {
    const s = this.session;
    const cur = s.pool[s.idx];
    const ok = id === cur.id;
    if (ok) s.correct++;
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
    if (ok) s.correct++;
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">
        ${ok ? "✓ Верно! " + cur.gr : "✗ Правильно: <b>" + cur.gr + "</b>"} ${this.speakBtn(cur.gr)}
        <div class="answer-ru">${cur.ru} · [${cur.tr}]</div>
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
    // Совпадение: точное ИЛИ все слова цели присутствуют в одном из вариантов
    const ok = heardNorm.some((h) => {
      if (h === target) return true;
      const hw = h.split(" ").filter(Boolean);
      return targetWords.every((w) => hw.includes(w));
    });
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
