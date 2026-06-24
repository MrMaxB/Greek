/* ============================================================
   Ελληνικά A1 — ПУТЬ (учебный трек по дням).
   Расширение App: Object.assign добавляет методы в общий объект App,
   поэтому this/App.x() работают как раньше. Грузится после app.js.
   ============================================================ */
Object.assign(App, {
  /* ---------- ПУТЬ (учебный трек по дням) ---------- */
  // Настоящий трек, а не набор заданий на таймлайне:
  //  • темы чередуются (интерливинг), базовая колода семьи раньше сиквелов,
  //  • грамматика — методический порядок «выживание→ядро→нюансы», равномерно,
  //  • тексты чтения привязаны К ТЕМЕ ДНЯ (кучность по темам),
  //  • каждые 5 дней — День закрепления (возврат к материалу, без новых слов),
  //  • экзамен-чекпоинт подбирается ПОД СОСТАВ блока (его тема макс. совпадает
  //    с пройденными колодами), а лексика/аудио берутся из колод блока.
  // Тема экзамена → ключевые слова в названиях колод (для подбора под блок).
  EXAM_THEME_KW: {
    "Знакомство": /привет|знаком|о себе|личн/i,
    "Семья": /семь|люд|родн/i,
    "Распорядок дня": /распорядок|рутин|день/i,
    "Погода": /погод|сезон|природ|врем.* год/i,
    "Покупки": /покупк|магаз|цен|деньг/i,
    "В ресторане": /ед|напит|фрукт|овощ|продукт/i,
    "В городе": /город|мест|улиц|здани/i,
    "Мой дом": /дом|комнат|быт|мебел/i,
    "Свободное время": /досуг|хобби|искусств|нрав|чувств/i,
    "У врача": /тел|здоров|болезн/i,
    "Работа": /профес|работ|учёб|общест/i,
    "Транспорт": /транспорт/i,
    "Покупка одежды": /одежд/i,
    "Спорт": /спорт|досуг/i,
    "Домашний питомец": /животн|природ/i,
    "Изучение греческого": /язык|школ|учёб|наречи|связк|глагол|прилаг|вопрос|местоимен|числ|цвет|национал|техник/i,
  },
  // выбрать неиспользованный экзамен, чья тема лучше всего покрывает колоды блока
  pickExamForBlock(blockDecks, used, exams) {
    const titles = blockDecks.map((id) => (DECKS.find((d) => d.id === id) || {}).title || "");
    let best = -1, bestScore = -1;
    exams.forEach((e, idx) => {
      if (used.has(idx)) return;
      const re = this.EXAM_THEME_KW[e.theme];
      const score = re ? titles.filter((t) => re.test(t)).length : 0;
      if (score > bestScore) { bestScore = score; best = idx; }
    });
    // если ничего не совпало — первый свободный (чтобы не зациклиться)
    if (best < 0 || bestScore === 0) {
      best = exams.findIndex((_, idx) => !used.has(idx));
      if (best < 0) best = 0;
    }
    return best;
  },
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
    // ЧЕРЕДОВАНИЕ тем, а не блоки: базовая колода каждой семьи (food, verbs…)
    // идёт рано, а «сиквелы» (food2/food3, verbs2…) разносятся по треку.
    // Интерливинг > блокировки для удержания (и не выгораешь от 7 дней еды).
    const fam = (id) => id.replace(/[0-9]+$/, "").replace(/_freq$|_life$/, "");
    // «тир» = насколько это «продолжение» темы (0 — базовая колода семьи)
    const tier = {};
    const famCount = {};
    DECKS.forEach((d) => { const f = fam(d.id); famCount[f] = (famCount[f] || 0); tier[d.id] = famCount[f]++; });
    const decks = [...DECKS].sort((a, b) => {
      if (tier[a.id] !== tier[b.id]) return tier[a.id] - tier[b.id]; // сперва все базовые
      return DECKS.indexOf(a) - DECKS.indexOf(b);                    // внутри тира — естественный порядок
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

    // ── Грамматика: методический порядок «выживание → ядро → нюансы» ──
    // НЕ по списку уроков и НЕ равномерно «как попало»: сначала то, что даёт
    // говорить с первого дня (быть/иметь, читать, род), потом ядро (падежи,
    // глаголы, числа), затем нюансы. Распределяем по ВСЕМУ треку, чтобы во
    // второй половине не было «грамматической пустыни».
    const GRAMMAR_SEQUENCE = [
      "read", "be-have", "gender", "numbers", "verb-a", "cases",
      "possessive", "questions" /*нет урока — пропустится*/, "neg-q", "decl-m",
      "verb-b", "likes", "decl-f", "time", "adjectives", "decl-n",
      "pronouns", "prepositions", "imperative", "past", "future", "na", "conj",
    ].filter((id) => lessons.some((l) => l.id === id));
    const byId = {}; lessons.forEach((l) => { byId[l.id] = l; });
    const lessonOrder = GRAMMAR_SEQUENCE.map((id) => byId[id]).filter(Boolean);
    lessons.forEach((l) => { if (!lessonOrder.includes(l)) lessonOrder.push(l); }); // добор
    let lessonPtr = 0;

    const CONTENT = decks.length;
    // равномерно по всему треку: один урок примерно каждые N тем-дней
    const GRAMMAR_EVERY = Math.max(1, Math.floor(CONTENT / (lessonOrder.length + 2)));
    const examUsed = new Set();
    let blockDecks = [], contentSince = 0, lessonsTaughtBy = 0, sinceLesson = 99, reviewLessonPtr = 0;
    // тема дня → категория письма (для «собери предложение» по теме)
    const WCAT = [[/ед|фрукт|продукт/i, "Еда"], [/цвет/i, "Цвета"], [/животн|птиц/i, "Животные"],
      [/профес|работ/i, "Работа"], [/город|мест|здани|улиц/i, "Город"], [/дом|комнат|мебел/i, "Дом"],
      [/здоров|тел/i, "Здоровье"], [/числ|счёт/i, "Числа"], [/глагол/i, "Глаголы"],
      [/досуг|хобби|искусств/i, "Досуг"], [/техник|цифр/i, "Техника"], [/национал|стран|язык/i, "Люди и страны"],
      [/быт/i, "Быт"], [/прилаг|качеств|описан/i, "Качества"], [/знаком|о себе|привет|личн|семь/i, "Знакомство"]];
    const catForDeck = (d) => { if (!d) return null; const h = WCAT.find(([re]) => re.test(d.title)); return h ? h[1] : null; };
    const prod = (i, d) => {
      if (i % 3 === 1) return { t: "go", ref: "speaking", label: "Говорение: фразы или диалог" };
      if (i % 3 === 2) return { t: "go", ref: "writing", label: "Письмо: вставь слово / о себе" };
      const cat = catForDeck(d);
      return cat ? { t: "write", ref: cat, label: "✍️ Собери предложение: " + cat }
        : { t: "go", ref: "writing", label: "Письмо: собери предложение" };
    };

    for (let i = 0; i < CONTENT; i++) {
      const p = i / CONTENT;                       // прогресс 0..1
      const maxLv = p < 0.28 ? 1 : 2;              // ранний этап — до A0+, дальше — A1
      const tasks = [{ t: "review", label: "SRS-повторение изученных слов" }];
      const d1 = decks[i];
      sinceLesson++;
      // Выдаём очередной урок по методическому порядку, держа равномерный ритм.
      // Первые два урока — пораньше (survival), дальше — раз в GRAMMAR_EVERY дней.
      let newLesson = false, lessonTitle = "", lessonWhy = "";
      const wantLesson = lessonPtr < lessonOrder.length &&
        (lessonPtr < 2 ? sinceLesson >= 1 : sinceLesson >= GRAMMAR_EVERY);
      if (wantLesson) {
        const l = lessonOrder[lessonPtr++]; newLesson = true; lessonsTaughtBy++; sinceLesson = 0;
        lessonTitle = stripN(l.title); lessonWhy = l.why || "";
        tasks.push({ t: "lesson", ref: l.id, label: "Грамматика: " + lessonTitle });
        // Сразу закрепить правило короткой тренировкой (раунд из 12)
        if (GrammarEx.has(l.id) && GrammarEx.gen(l.id).length) {
          tasks.push({ t: "gex", ref: l.id, label: "Тренировка: " + lessonTitle });
        }
      }
      if (d1) {
        tasks.push({ t: "deck", ref: d1.id, label: "Тема: " + d1.title });
        // Диктант на слух по теме дня (прошёл слова — записал их под диктовку)
        tasks.push({ t: "dict", ref: d1.id, label: "🎧 Диктант по теме: " + d1.title });
        blockDecks.push(d1.id);
      }
      // текст(ы) ПО ТЕМЕ дня
      const genres = d1 ? genresFor(d1) : [];
      const rt = pickText(genres, maxLv);
      if (rt) tasks.push({ t: "read", ref: rt.id, label: "Чтение по теме: " + rt.titleRu });
      // на A1-этапе иногда второй текст той же темы
      if (p >= 0.4 && i % 2 === 0) { const rt2 = pickText(genres, maxLv); if (rt2) tasks.push({ t: "read", ref: rt2.id, label: "Ещё текст: " + rt2.titleRu }); }
      tasks.push(prod(i, d1));
      D(newLesson ? lessonTitle : (d1 ? d1.title : "Практика"),
        newLesson ? "Грамматика · тема · чтение" : "Тема · чтение · практика", tasks,
        newLesson && lessonWhy ? { why: lessonWhy } : null);
      contentSince++;

      // День закрепления каждые 5 содержательных дней (возврат к материалу)
      if (contentSince >= 5 && i < CONTENT - 3) {
        contentSince = 0;
        const r1 = reviewText(), r2 = reviewText();
        const ctasks = [{ t: "review", label: "Большое SRS-повторение" }];
        if (r1) ctasks.push({ t: "read", ref: r1.id, label: "Перечитай: " + r1.titleRu });
        if (r2) ctasks.push({ t: "read", ref: r2.id, label: "Перечитай: " + r2.titleRu });
        // Цикличный возврат к УЖЕ пройденному правилу (борьба с забыванием грамматики)
        if (lessonPtr > 0) {
          const rl = lessonOrder[reviewLessonPtr % lessonPtr];
          reviewLessonPtr++;
          ctasks.push({ t: "lesson", ref: rl.id, label: "Повтори правило: " + stripN(rl.title) });
        }
        ctasks.push({ t: "go", ref: "mistakes", label: "Работа над ошибками" });
        ctasks.push({ t: "train", ref: p > 0.45 ? "conj" : "decl", label: "🎲 Игра: микс форм вразнобой" });
        D("День закрепления", "Возврат к материалу · без новых слов", ctasks, { rest: true });
      }

      // Экзамен-чекпоинт каждые 8 тем — текст ПОДБИРАЕТСЯ под состав блока
      if ((i + 1) % 8 === 0 && blockDecks.length) {
        const ref = this.pickExamForBlock(blockDecks, examUsed, exams);
        examUsed.add(ref);
        D("Контрольный экзамен", "Срез блока", [
          { t: "review", label: "SRS-повторение" },
          { t: "exam", ref, scope: blockDecks.slice(), label: "Экзамен: " + exams[ref].theme },
        ], { checkpoint: true });
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
    // Миграция: раньше «пройденность» хранилась в ts.day (ручная кнопка), а не в
    // галочках. Чтобы не потерять прогресс — дни до ts.day считаем пройденными.
    if (!this._ts._migrated && this._ts.day > 1) {
      const track = this.buildTrack();
      for (let n = 1; n < this._ts.day && n <= track.length; n++) {
        const d = track[n - 1];
        if (d && (!this._ts.done[n] || this._ts.done[n].length < d.tasks.length)) {
          this._ts.done[n] = d.tasks.map((_, i) => i);
        }
      }
      this._ts._migrated = true;
    }
    return this._ts;
  },
  saveTrackState() {
    localStorage.setItem("greekA1_track", JSON.stringify(this.trackState()));
    if (window.Cloud && window.Cloud.push) window.Cloud.push();
  },
  // День «пройден» = ВСЕ его задания отмечены (источник правды — галочки,
  // а не отдельный ручной указатель). Прогресс и «текущий день» считаются отсюда.
  trackDayDone(n) {
    const d = this.buildTrack()[n - 1];
    if (!d || !d.tasks.length) return false;
    const done = this.trackState().done[n] || [];
    return d.tasks.every((_, i) => done.includes(i));
  },
  trackCurrentDay() {
    const total = this.buildTrack().length;
    for (let n = 1; n <= total; n++) if (!this.trackDayDone(n)) return n;
    return total + 1; // всё пройдено
  },
  trackDoneCount() {
    const total = this.buildTrack().length; let c = 0;
    for (let n = 1; n <= total; n++) if (this.trackDayDone(n)) c++;
    return c;
  },
  trackViewDay() {
    const total = this.buildTrack().length;
    const cur = this.trackCurrentDay();
    let v = this.params.day ? parseInt(this.params.day, 10) : cur;
    return Math.max(1, Math.min(total, v));
  },
  // Перейти к дню трека БЕЗ прыжка наверх — скроллим к карточке дня, а не к интро.
  goTrackDay(n) {
    this.view = "track"; this.params = n ? { day: String(n) } : {}; this.session = null;
    this.menuOpen = false; this.writeHash(); this.render();
    const el = document.querySelector(".track-day");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "start", behavior: "smooth" });
    else window.scrollTo(0, 0);
  },
  // Синхронизировать кэш ts.day (для облака) с фактическим текущим днём
  syncTrackDay() { const ts = this.trackState(); ts.day = this.trackCurrentDay(); },
  toggleTrackTask(idx) {
    const ts = this.trackState();
    const day = this.trackViewDay();
    const arr = ts.done[day] || [];
    const k = parseInt(idx, 10);
    ts.done[day] = arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k];
    this.syncTrackDay();
    this.saveTrackState();
    this.render(); // без scrollTo — галочка не должна дёргать страницу
  },
  // «Отметить день пройденным» = отметить ВСЕ задания дня, перейти к след. невыполненному
  trackDone() {
    const total = this.buildTrack().length;
    const view = this.trackViewDay();
    const ts = this.trackState();
    ts.done[view] = this.buildTrack()[view - 1].tasks.map((_, i) => i); // все задания
    this.syncTrackDay();
    this.saveTrackState();
    const next = this.trackCurrentDay();
    this.goTrackDay(next > total ? null : next);
  },
  trackTaskBtn(task, idx, done) {
    const examAttr = `data-exam="${task.ref}"` + (task.scope && task.scope.length ? ` data-exam-scope="${this.esc(task.scope.join(","))}"` : "");
    const map = {
      review: ['data-go="review"', "🧠"], lesson: [`data-lesson="${task.ref}"`, "📖"],
      gex: [`data-gex="${task.ref}"`, "✍️"],
      deck: [`data-deck="${task.ref}"`, "📚"], read: [`data-read="${task.ref}"`, "📕"],
      dict: [`data-deck="${task.ref}" data-mode="dictation"`, "🎧"],
      write: [`data-wcat="${this.esc(task.ref)}"`, "✍️"],
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
    const cur = this.trackCurrentDay();
    const doneCount = this.trackDoneCount();
    if (cur > total) {
      return `<header class="page-head"><h2>🗺️ Путь к A1</h2></header>
        <div class="result"><h2>Курс пройден! 🎓</h2>
        <p class="muted">Ты прошёл все ${total} дней. Дальше — закрепляй: экзамены, диалоги, чтение, и готовься к A2.</p></div>
        <button class="big-btn primary" data-go="exams">📝 Прорешать экзамены</button>
        <button class="big-btn ghost" data-action="track-restart">Начать путь заново</button>`;
    }
    const view = this.trackViewDay();
    const day = track[view - 1];
    const done = ts.done[view] || [];
    const allDone = this.trackDayDone(view);
    const pct = Math.round(100 * doneCount / total);
    const weeks = Math.ceil(total / 5);

    const byWeek = {};
    track.forEach((d, i) => { (byWeek[d.week] = byWeek[d.week] || []).push({ d, n: i + 1 }); });
    const overview = Object.keys(byWeek).map((w) => {
      const open = byWeek[w].some((x) => x.n === cur);
      const rows = byWeek[w].map(({ d, n }) => {
        const isDone = this.trackDayDone(n);
        const mark = isDone ? "✅" : n === cur ? "▶" : (d.checkpoint ? "🏁" : "•");
        return `<button class="track-row ${isDone ? "done" : n === cur ? "cur" : ""}" data-track-day="${n}">
          <span class="tr-mark">${mark}</span>
          День ${n}: ${d.title}</button>`;
      }).join("");
      return `<details class="track-week" ${open ? "open" : ""}><summary>Неделя ${w}</summary>${rows}</details>`;
    }).join("");

    return `
      <header class="page-head"><h2>🗺️ Путь к A1</h2></header>
      <p class="muted">Настоящий маршрут от простого к сложному: каждое новое опирается на пройденное. До ~15 новых слов в день (большие темы SRS растянет на пару дней — это нормально), грамматика идёт впереди материала, чтение и практика — <b>по теме дня</b>, каждые 5 дней — день закрепления (возврат, без новых слов), экзамены проверяют темы блока. Сессия — 25–40 мин.</p>
      <p class="muted small">Весь путь — ${total} дней (~${weeks} недель). Реалистично: за <b>2 месяца</b> (≈43 занятия) прочно закрепляется <b>ядро ~600–700 слов</b> и базовая грамматика; полный словарь A1 (~1300) — это ~4 месяца при 5 занятиях в неделю. Темп держим посильным — это важнее скорости. Прогресс синхронизируется.</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <p class="muted center small">Пройдено ${doneCount} из ${total} дней · ${pct}% · текущий день ${cur}</p>

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
        ${day.why ? `<div class="td-why">💡 <b>Зачем этот урок:</b> ${day.why}</div>` : ""}
        <div class="tk-list">${day.tasks.map((t, i) => this.trackTaskBtn(t, i, done)).join("")}</div>
        ${allDone
        ? `<div class="ok-msg">✓ День пройден — все задания сделаны</div>${view < total ? `<button class="big-btn primary" data-track-day="${view + 1}">Следующий день →</button>` : ""}${cur <= total && cur !== view ? `<button class="big-btn ghost" data-track-day="${cur}">К текущему дню (${cur}) →</button>` : ""}`
        : `<button class="big-btn primary" data-action="track-done">Отметить день пройденным →</button>${cur !== view ? `<button class="big-btn ghost" data-track-day="${cur}">К текущему дню (${cur}) →</button>` : ""}`}
      </div>

      <h3 class="section-title">Все недели</h3>
      <div class="track-weeks">${overview}</div>`;
  },
});
