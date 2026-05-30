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
    document.body.addEventListener("click", (e) => this.onClick(e));
    document.body.addEventListener("input", (e) => this.onInput(e));
    document.body.addEventListener("keydown", (e) => this.onKey(e));
    this.go("home");
  },

  go(view, params = {}) {
    this.view = view;
    this.params = params;
    this.session = null;
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
      progress: () => this.renderProgress(),
    };
    this.root.innerHTML =
      this.renderNav() + `<main class="screen">${(map[this.view] || map.home)()}</main>`;
    if (this.afterRender) { const f = this.afterRender; this.afterRender = null; f(); }
  },

  renderNav() {
    const tabs = [
      ["home", "🏠", "Главная"],
      ["alphabet", "🔤", "Алфавит"],
      ["review", "🧠", "Повтор"],
      ["decks", "📚", "Темы"],
      ["grammar", "📖", "Грамматика"],
      ["progress", "📊", "Прогресс"],
    ];
    const root = ["alphaQuiz"].includes(this.view) ? "alphabet"
      : this.view === "practice" ? "decks" : this.view;
    return `<nav class="nav">
      <div class="brand" data-go="home">Ελληνικά <span>A1</span></div>
      <div class="tabs">${tabs
        .map(([v, ic, l]) =>
          `<button class="tab ${root === v ? "active" : ""}" data-go="${v}"><span>${ic}</span>${l}</button>`
        )
        .join("")}</div>
    </nav>`;
  },

  /* ---------- ГЛАВНАЯ ---------- */
  renderHome() {
    const s = SRS.summary(ALL_WORDS);
    const pct = Math.round((s.learned / s.total) * 100);
    const ttsWarn = Speech.hasGreek()
      ? ""
      : `<div class="banner">🔇 Греческий голос не найден в браузере. Текст и обучение работают полностью; для озвучки попробуйте Chrome/Edge или установите греческий голос в системе.</div>`;
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
          `<button class="opt" data-alpha-opt="${o.upper}">${o.sound}<br><small>${o.example} — ${o.exTr}</small></button>`
      )
      .join("");
    return `
      <header class="page-head"><h2>Буква → звук</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <div class="quiz-prompt">
        <div class="big-letter">${cur.upper} ${cur.lower}</div>
        <div class="muted">${cur.name} ${this.speakBtn(cur.example)}</div>
      </div>
      <p class="muted center">Какой это звук?</p>
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
          <div class="w-gr">${w.gr} ${this.speakBtn(w.gr)}</div>
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
    const titleByMode = { learn: "🧠 Карточки", choice: "✅ Выбор перевода", listen: "👂 Аудирование", type: "⌨️ Набор по-гречески" };

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

    if (mode === "type") {
      return `${head}
        <div class="quiz-prompt">
          <div class="type-ru">${cur.ru}</div>
          <div class="muted small">подсказка: [${cur.tr}]</div>
        </div>
        <input id="typeInput" class="type-input" autocomplete="off" autocapitalize="off"
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

  /* ---------- ГРАММАТИКА ---------- */
  renderGrammar() {
    const items = GRAMMAR.map(
      (g) => `<details class="gram"><summary>${g.title}</summary><div class="gram-body">${g.body.replace(/\n/g, "<br>")}</div></details>`
    ).join("");
    return `
      <header class="page-head"><h2>📖 Мини-грамматика A1</h2></header>
      <p class="muted">Самое нужное на старте. Не зубри — просто понимай, как слова соединяются.</p>
      ${items}
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
    const t = e.target.closest("[data-go],[data-say],[data-say-slow],[data-action],[data-alpha-opt],[data-grade],[data-deck],[data-mode],[data-choice],[data-deck-next],[data-key]");
    if (!t) return;

    if (t.dataset.go) return this.go(t.dataset.go);

    if (t.dataset.say !== undefined) { Speech.say(t.dataset.say); return; }
    if (t.dataset.saySlow !== undefined) { Speech.say(t.dataset.saySlow, 0.6); return; }

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
      case "deck-flip": this.session.answered = true; return this.render();
      case "type-check": return this.typeCheck();
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
        ${ok ? "✓ Верно!" : "✗ Правильно: <b>" + cur.gr + "</b>"} ${this.speakBtn(cur.gr)}
      </div>
      <button class="big-btn primary" id="nextBtn">Дальше →</button>`;
    if (inp) inp.disabled = true;
    Speech.say(cur.gr);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.input = ""; this.render(); });
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
