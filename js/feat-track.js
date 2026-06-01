/* ============================================================
   Ελληνικά A1 — ПУТЬ (учебный трек по дням).
   Расширение App: Object.assign добавляет методы в общий объект App,
   поэтому this/App.x() работают как раньше. Грузится после app.js.
   ============================================================ */
Object.assign(App, {
  /* ---------- ПУТЬ (учебный трек по дням) ---------- */
  // Настоящий трек, а не набор заданий на таймлайне:
  //  • темы кластеризованы по «семьям» (food/food2/food3 рядом, не вразброс),
  //  • грамматика привязана к мотивирующей теме и идёт фундамент→сложное
  //    через очередь уроков (новое стоит на изученном),
  //  • тексты чтения привязаны К ТЕМЕ ДНЯ (кучность по темам) и растут
  //    по уровню A0→A0+→A1 по мере продвижения,
  //  • каждые 5 дней — День закрепления (возврат к материалу, без новых слов),
  //  • экзамен-чекпоинт тестирует ИМЕННО темы прошедшего блока, не рандом.
  // Жанр текста → по теме колоды (для тематической привязки чтения).
  GENRE_BY_KW: [
    [/привет|вежлив|знаком|о себе|личн/i, ["Знакомство", "Приветствия", "О себе", "Диалог"]],
    [/числ|фигур/i, ["Числа"]],
    [/семь/i, ["Семья"]],
    [/распорядок|рутин/i, ["Распорядок", "Дневник"]],
    [/врем|месяц/i, ["Время", "Распорядок"]],
    [/ед|фрукт|овощ|продукт|напит/i, ["Еда"]],
    [/покупк/i, ["Покупки"]],
    [/город|мест|услуг|банк|документ/i, ["Город", "Места", "Услуги", "Быт"]],
    [/глагол|действ/i, ["Действия", "Рассказ", "Дневник"]],
    [/прилаг|описан/i, ["Описание", "Описания"]],
    [/вопрос|местоимен|сколько|чей/i, ["Диалог"]],
    [/фраз/i, ["Диалог"]],
    [/цвет/i, ["Цвета"]],
    [/погод|сезон/i, ["Погода"]],
    [/тел|здоров/i, ["Тело", "Здоровье"]],
    [/одежд/i, ["Одежда"]],
    [/дом|комнат/i, ["Дом", "Быт"]],
    [/нрав|чувств|иде/i, ["Хобби", "Рассказ"]],
    [/стран|национальност/i, ["Страны"]],
    [/транспорт/i, ["Транспорт"]],
    [/профес|работ/i, ["Профессии", "Работа"]],
    [/природ|животн/i, ["Природа"]],
    [/вещ|предмет/i, ["Вещи"]],
    [/люд|обществ/i, ["Общество"]],
    [/учёб|учеб|школ|язык/i, ["Учёба", "Медиа"]],
    [/наречи|связк/i, ["Связки"]],
    [/досуг|искусств|медиа|техник|цифр/i, ["Хобби", "Медиа"]],
    [/слов|жизнь|разное|быт/i, ["Слова", "Жизнь", "Быт"]],
  ],
  buildTrack() {
    if (this._track) return this._track;
    const ord = { "A0": 0, "A0+": 1, "A1": 2 };
    const texts = (typeof READING_TEXTS !== "undefined") ? [...READING_TEXTS].sort((a, b) => (ord[a.level] - ord[b.level])) : [];
    const lessons = GRAMMAR_LESSONS, exams = EXAM_READINGS;
    // Темы кластеризуем по «семьям» (food/food2/food3 рядом), сохраняя
    // порядок первого появления семьи — фундамент остаётся в начале, но
    // родственные темы не разбросаны по всему треку (был эффект «рандома»).
    const fam = (id) => id.replace(/[0-9]+$/, "").replace(/_freq$|_life$/, "");
    const famOrder = [];
    DECKS.forEach((d) => { const f = fam(d.id); if (!famOrder.includes(f)) famOrder.push(f); });
    const decks = [...DECKS].sort((a, b) => {
      const fa = famOrder.indexOf(fam(a.id)), fb = famOrder.indexOf(fam(b.id));
      if (fa !== fb) return fa - fb;
      return DECKS.indexOf(a) - DECKS.indexOf(b); // стабильно внутри семьи
    });
    const days = [];
    const D = (title, focus, tasks, extra) => days.push(Object.assign({ title, focus, tasks }, extra || {}));
    const stripN = (s) => s.replace(/^\d+\.\s*/, "");

    // — подбор текста по теме и уровню (кучность); задействует все 140 текстов —
    const used = new Set(), usedOrder = [];
    const genresFor = (d) => { for (const [re, g] of this.GENRE_BY_KW) if (re.test(d.title)) return g; return []; };
    const pickText = (genres, maxLv) => {
      const tries = [
        (t) => !used.has(t.id) && genres.includes(t.genre) && ord[t.level] <= maxLv,
        (t) => !used.has(t.id) && genres.includes(t.genre),
        (t) => !used.has(t.id) && ord[t.level] <= maxLv,
        (t) => !used.has(t.id),
      ];
      for (const f of tries) { const c = texts.filter(f); if (c.length) { used.add(c[0].id); usedOrder.push(c[0].id); return c[0]; } }
      return null;
    };
    let revPtr = 0;
    const reviewText = () => { if (!usedOrder.length) return null; const id = usedOrder[revPtr % usedOrder.length]; revPtr++; return texts.find((t) => t.id === id); };

    D("Алфавит: буквы и звуки", "Старт", [
      { t: "go", ref: "alphabet", label: "Изучи 24 буквы (нажми — услышишь)" },
      { t: "go", ref: "alphaQuiz", label: "Тренажёр узнавания букв" },
    ]);
    const t0 = pickText(["Приветствия", "Знакомство"], 0);
    D("Буквосочетания и первые слова", "Старт", [
      { t: "go", ref: "alphabet", label: "Буквосочетания: μπ, ντ, αι, ει…" },
      { t: "go", ref: "alphaQuiz", label: "Тренажёр букв" },
      t0 ? { t: "read", ref: t0.id, label: "Первый текст (A0): " + t0.titleRu } : { t: "go", ref: "reading", label: "Открой чтение" },
    ]);

    // ── Грамматика привязана к теме, которая её мотивирует ──
    // Урок раскрывается, когда учится «опорная» колода (грамматика следует
    // за смыслом, а не за равномерным интервалом). lesson → deck-триггер.
    // Триггеры выбраны так, чтобы фундамент шёл рано (опорные колоды есть в
    // начале трека), а специальное — позже. Колоды-триггеры проверены: все
    // в первой половине пути.
    const lessonAfterDeck = {
      "read": "greetings", "gender": "personal", "be-have": "family",
      "cases": "family", "decl-m": "family", "decl-f": "family", "decl-n": "food",
      "numbers": "numbers", "time": "time", "verb-a": "verbs", "verb-b": "verbs",
      "adjectives": "adjectives", "pronouns": "questions", "neg-q": "questions",
      "possessive": "personal", "prepositions": "city", "likes": "likes",
      "imperative": "verbs", "past": "verbs2", "future": "verbs2",
      "na": "verbs2", "conj": "adv2",
    };
    // соберём: на какой колоде какие уроки выдавать (в порядке списка уроков)
    const lessonsByDeck = {};
    lessons.forEach((l) => {
      const dk = lessonAfterDeck[l.id];
      (lessonsByDeck[dk] = lessonsByDeck[dk] || []).push(l);
    });
    // Очередь уроков: когда появляется опорная колода, её уроки встают в
    // очередь; каждый день выдаём один с её фронта (по 1 уроку в день).
    // Если триггер не сработал — досдаём остаток ближе к концу грамм-этапа.
    const lessonQ = [];
    const queued = new Set();
    const enqueue = (ls) => ls.forEach((l) => { if (!queued.has(l.id)) { queued.add(l.id); lessonQ.push(l); } });

    const CONTENT = decks.length;
    let exi = 0, blockDecks = [], contentSince = 0, lessonsTaughtBy = 0;
    const prod = (i) => i % 3 === 0 ? { t: "go", ref: "writing", label: "Письмо: собери предложение" }
      : i % 3 === 1 ? { t: "go", ref: "speaking", label: "Говорение: фразы или диалог" }
        : { t: "go", ref: "writing", label: "Письмо: вставь слово / о себе" };

    for (let i = 0; i < CONTENT; i++) {
      const p = i / CONTENT;                       // прогресс 0..1
      const maxLv = p < 0.28 ? 1 : 2;              // ранний этап — до A0+, дальше — A1
      const tasks = [{ t: "review", label: "SRS-повторение изученных слов" }];
      const d1 = decks[i];
      // поставить в очередь уроки, привязанные к этой колоде
      if (d1 && lessonsByDeck[d1.id]) enqueue(lessonsByDeck[d1.id]);
      // подстраховка: к концу грамм-этапа досдаём всё непоставленное
      if (p > 0.7) enqueue(lessons.filter((l) => !queued.has(l.id)));
      let newLesson = false, lessonTitle = "";
      if (lessonQ.length) {
        const l = lessonQ.shift(); newLesson = true; lessonsTaughtBy++;
        lessonTitle = stripN(l.title);
        tasks.push({ t: "lesson", ref: l.id, label: "Грамматика: " + lessonTitle });
      }
      if (d1) { tasks.push({ t: "deck", ref: d1.id, label: "Тема: " + d1.title }); blockDecks.push(d1.id); }
      // текст(ы) ПО ТЕМЕ дня
      const genres = d1 ? genresFor(d1) : [];
      const rt = pickText(genres, maxLv);
      if (rt) tasks.push({ t: "read", ref: rt.id, label: "Чтение по теме: " + rt.titleRu });
      // на A1-этапе иногда второй текст той же темы
      if (p >= 0.4 && i % 2 === 0) { const rt2 = pickText(genres, maxLv); if (rt2) tasks.push({ t: "read", ref: rt2.id, label: "Ещё текст: " + rt2.titleRu }); }
      tasks.push(prod(i));
      D(newLesson ? lessonTitle : (d1 ? d1.title : "Практика"),
        newLesson ? "Грамматика · тема · чтение" : "Тема · чтение · практика", tasks);
      contentSince++;

      // День закрепления каждые 5 содержательных дней (возврат к материалу)
      if (contentSince >= 5 && i < CONTENT - 3) {
        contentSince = 0;
        const r1 = reviewText(), r2 = reviewText();
        const ctasks = [{ t: "review", label: "Большое SRS-повторение" }];
        if (r1) ctasks.push({ t: "read", ref: r1.id, label: "Перечитай: " + r1.titleRu });
        if (r2) ctasks.push({ t: "read", ref: r2.id, label: "Перечитай: " + r2.titleRu });
        ctasks.push({ t: "go", ref: "mistakes", label: "Работа над ошибками" });
        ctasks.push({ t: "train", ref: p > 0.45 ? "conj" : "decl", label: "🎲 Игра: микс форм вразнобой" });
        D("День закрепления", "Возврат к материалу · без новых слов", ctasks, { rest: true });
      }

      // Экзамен-чекпоинт каждые 8 тем — тестирует ИМЕННО темы блока
      if ((i + 1) % 8 === 0 && exams[exi]) {
        D("Контрольный экзамен", "Срез блока", [
          { t: "review", label: "SRS-повторение" },
          { t: "exam", ref: exi, scope: blockDecks.slice(), label: "Экзамен по темам блока: " + exams[exi].theme },
        ], { checkpoint: true });
        exi = (exi + 1) % exams.length;
        blockDecks = [];
      }
    }
    D("Финал: итоговый пробный экзамен A1", "Финал", [
      { t: "review", label: "Финальное повторение" },
      { t: "exam", ref: 0, label: "Итоговый экзамен" },
      { t: "go", ref: "speaking", label: "Диалоги вслух" },
    ], { checkpoint: true });

    days.forEach((d, i) => { d.week = Math.floor(i / 5) + 1; });
    this._track = days;
    return days;
  },

  trackState() {
    if (this._ts) return this._ts;
    try { this._ts = JSON.parse(localStorage.getItem("greekA1_track")) || null; } catch { this._ts = null; }
    if (!this._ts || typeof this._ts.day !== "number" || this._ts.day < 1) this._ts = { day: 1, done: (this._ts && this._ts.done) || {} };
    if (!this._ts.done) this._ts.done = {};
    return this._ts;
  },
  saveTrackState() {
    localStorage.setItem("greekA1_track", JSON.stringify(this.trackState()));
    if (window.Cloud && window.Cloud.push) window.Cloud.push();
  },
  trackViewDay() {
    const ts = this.trackState();
    const total = this.buildTrack().length;
    let v = this.params.day ? parseInt(this.params.day, 10) : ts.day;
    return Math.max(1, Math.min(total, v));
  },
  toggleTrackTask(idx) {
    const ts = this.trackState();
    const day = this.trackViewDay();
    const arr = ts.done[day] || [];
    const k = parseInt(idx, 10);
    ts.done[day] = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k];
    this.saveTrackState();
    this.render();
  },
  trackDone() {
    const ts = this.trackState();
    const total = this.buildTrack().length;
    const day = this.trackViewDay();
    if (day === ts.day) ts.day = Math.min(total + 1, ts.day + 1);
    this.saveTrackState();
    this.go("track", ts.day > total ? {} : { day: String(ts.day) });
  },
  trackTaskBtn(task, idx, done) {
    const examAttr = `data-exam="${task.ref}"` + (task.scope && task.scope.length ? ` data-exam-scope="${this.esc(task.scope.join(","))}"` : "");
    const map = {
      review: ['data-go="review"', "🧠"], lesson: [`data-lesson="${task.ref}"`, "📖"],
      deck: [`data-deck="${task.ref}"`, "📚"], read: [`data-read="${task.ref}"`, "📕"],
      exam: [examAttr, "📝"], train: [`data-train="${task.ref}"`, "🎲"],
      go: [`data-go="${task.ref}"`, task.ref === "speaking" ? "🗣️" : task.ref === "writing" ? "✍️" : "▶"],
    };
    const [attr, ic] = map[task.t] || ['data-go="home"', "•"];
    const checked = done.includes(idx);
    return `<div class="tk ${checked ? "tk-done" : ""}">
      <button class="tk-check" data-track-check="${idx}" aria-label="Отметить">${checked ? "✅" : "⬜"}</button>
      <button class="tk-go" ${attr}><span class="tk-ic">${ic}</span><span>${task.label}</span></button>
    </div>`;
  },
  renderTrack() {
    const track = this.buildTrack();
    const ts = this.trackState();
    const total = track.length;
    if (ts.day > total) {
      return `<header class="page-head"><h2>🗺️ Путь к A1</h2></header>
        <div class="result"><h2>Курс пройден! 🎓</h2>
        <p class="muted">Ты прошёл все ${total} дней. Дальше — закрепляй: экзамены, диалоги, чтение, и готовься к A2.</p></div>
        <button class="big-btn primary" data-go="exams">📝 Прорешать экзамены</button>
        <button class="big-btn ghost" data-action="track-restart">Начать путь заново</button>`;
    }
    const view = this.trackViewDay();
    const day = track[view - 1];
    const done = ts.done[view] || [];
    const allDone = day.tasks.every((_, i) => done.includes(i));
    const pct = Math.round(100 * (ts.day - 1) / total);
    const weeks = Math.ceil(total / 5);

    const byWeek = {};
    track.forEach((d, i) => { (byWeek[d.week] = byWeek[d.week] || []).push({ d, n: i + 1 }); });
    const overview = Object.keys(byWeek).map((w) => {
      const cur = byWeek[w].some((x) => x.n === ts.day);
      const rows = byWeek[w].map(({ d, n }) =>
        `<button class="track-row ${n < ts.day ? "done" : n === ts.day ? "cur" : ""}" data-track-day="${n}">
          <span class="tr-mark">${n < ts.day ? "✅" : n === ts.day ? "▶" : (d.checkpoint ? "🏁" : "•")}</span>
          День ${n}: ${d.title}</button>`).join("");
      return `<details class="track-week" ${cur ? "open" : ""}><summary>Неделя ${w}</summary>${rows}</details>`;
    }).join("");

    return `
      <header class="page-head"><h2>🗺️ Путь к A1</h2></header>
      <p class="muted">Настоящий маршрут от простого к сложному: каждое новое опирается на пройденное. Один новый набор слов в день (~15), грамматика идёт впереди материала, чтение и практика — <b>по теме дня</b>, каждые 5 дней — день закрепления (возврат, без новых слов), экзамены проверяют темы блока. Сессия — 25–40 мин.</p>
      <p class="muted small">Весь путь — ${total} дней (~${weeks} недель). Реалистично: за <b>2 месяца</b> (≈43 занятия) прочно закрепляется <b>ядро ~600–700 слов</b> и базовая грамматика; полный словарь A1 (~1300) — это ~4 месяца при 5 занятиях в неделю. Темп держим посильным — это важнее скорости. Прогресс синхронизируется.</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <p class="muted center small">Пройдено ${ts.day - 1} из ${total} дней · ${pct}%</p>

      <div class="track-day ${day.checkpoint ? "cp" : ""}">
        <div class="td-head">
          <button class="td-nav" data-track-day="${view - 1}" ${view <= 1 ? "disabled" : ""}>‹</button>
          <div class="td-mid">
            <div class="td-n">День ${view} · Неделя ${day.week}</div>
            <div class="td-title">${day.checkpoint ? "🏁 " : ""}${day.title}</div>
            <div class="muted small">${day.focus}</div>
          </div>
          <button class="td-nav" data-track-day="${view + 1}" ${view >= total ? "disabled" : ""}>›</button>
        </div>
        <div class="tk-list">${day.tasks.map((t, i) => this.trackTaskBtn(t, i, done)).join("")}</div>
        ${view === ts.day
        ? `<button class="big-btn primary" data-action="track-done">${allDone ? "✓ Готово — следующий день →" : "Отметить день пройденным →"}</button>`
        : view < ts.day
          ? `<div class="ok-msg">✓ Этот день уже пройден</div><button class="big-btn ghost" data-track-day="${ts.day}">К текущему дню (${ts.day}) →</button>`
          : `<div class="muted small center">Сначала пройди день ${ts.day}.</div><button class="big-btn ghost" data-track-day="${ts.day}">К текущему дню →</button>`}
      </div>

      <h3 class="section-title">Все недели</h3>
      <div class="track-weeks">${overview}</div>`;
  },
});
