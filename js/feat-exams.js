/* ============================================================
   Ελληνικά A1 — ЭКЗАМЕНЫ (сборка, рендер, таймер, проверка).
   Расширение App.
   ============================================================ */
Object.assign(App, {
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
      <p class="muted">Формат как на экзамене: чтение, лексика, грамматика, аудио (слова и фразы) и письмо (выбор + набор с клавиатуры). Идёт ⏱ хронометраж. Зачёт — от 60%. Можно пересдавать: вопросы каждый раз обновляются.</p>
      <div class="deck-list">${tiles}</div>
    `;
  },

  // Привести предложение к единому виду: заглавная первая буква + точка.
  // starter — исходно заглавное первое слово (его делаем строчным, если оно не первое),
  // чтобы варианты нельзя было отличить по формату — только по порядку слов.
  presentSentence(arr, starter) {
    const lo = (w) => w.charAt(0).toLowerCase() + w.slice(1);
    const up = (w) => w.charAt(0).toUpperCase() + w.slice(1);
    let used = false;
    const words = arr.map((w) => {
      if (!used && w === starter) { used = true; return lo(w); }
      return w;
    });
    words[0] = up(words[0]);
    return words.join(" ") + ".";
  },

  // Сборка одного экзамена из текста + банков.
  // scope (массив id колод) — если задан, лексика/аудио берутся ИЗ ЭТИХ тем
  // (срез блока трека), иначе из всего словаря.
  buildExam(n, scope) {
    const R = EXAM_READINGS[n % EXAM_READINGS.length];
    const qs = [];
    const uniq = (arr) => [...new Set(arr)];
    const inScope = (scope && scope.length) ? ALL_WORDS.filter((w) => scope.includes(w.deck)) : null;
    const vocabPool = (inScope && inScope.length >= 6) ? inScope : ALL_WORDS;
    // Дистракторы — из ТОЙ ЖЕ темы (числа к числу, фразы к фразе), чтобы
    // нельзя было угадать по формату/длине. Добор из общего словаря при нехватке.
    const distract = (w, k) => {
      let pool = ALL_WORDS.filter((x) => x.deck === w.deck && x.ru !== w.ru);
      if (pool.length < k) pool = pool.concat(ALL_WORDS.filter((x) => x.deck !== w.deck && x.ru !== w.ru));
      return this.shuffle(pool).slice(0, k).map((x) => x.ru);
    };

    // Чтение
    R.q.forEach((q) => qs.push({ section: "Чтение", passage: R.gr, passageRu: R.ru, prompt: q.ask, options: this.shuffle(q.options.slice()), answer: q.answer }));
    // Лексика (3): что значит слово (из тем блока, если задано)
    this.shuffle(vocabPool).slice(0, 3).forEach((w) => {
      const opts = uniq([w.ru, ...distract(w, 3)]);
      qs.push({ section: "Лексика", prompt: `Что значит «${w.gr}»?`, audio: w.gr, options: this.shuffle(opts), answer: w.ru });
    });
    // Грамматика (3): вставь слово
    this.shuffle(WRITING_GAPS).slice(0, 3).forEach((g) => {
      qs.push({ section: "Грамматика", prompt: `${g.parts[0]}<span class="blank">_____</span>${g.parts[1]} <span class="muted small">(${g.ru})</span>`, options: this.shuffle(g.options.slice()), answer: g.answer });
    });
    // Аудио — слово (2): услышь и выбери перевод (текст скрыт)
    this.shuffle(vocabPool).slice(0, 2).forEach((w) => {
      const opts = uniq([w.ru, ...distract(w, 3)]);
      qs.push({ section: "Аудио", prompt: "Прослушай слово и выбери перевод:", audio: w.gr, hideAudioText: true, autoplay: true, options: this.shuffle(opts), answer: w.ru });
    });
    // Аудио — фраза (1): услышь предложение и выбери смысл
    const sPool = this.shuffle(WRITING_ORDER);
    const sa = sPool[0];
    if (sa) {
      const sentGr = sa.tokens.join(" ");
      const others = this.shuffle(WRITING_ORDER.filter((x) => x.ru !== sa.ru)).slice(0, 2).map((x) => x.ru);
      qs.push({ section: "Аудио (фраза)", prompt: "Прослушай фразу и выбери перевод:", audio: sentGr, hideAudioText: true, autoplay: true, options: this.shuffle(uniq([sa.ru, ...others])), answer: sa.ru });
    }
    // Письмо — выбор (1): выбери правильное предложение (все варианты в едином виде)
    const sw = sPool[1] || sPool[0];
    if (sw) {
      const starter = sw.tokens[0];
      const correct = this.presentSentence(sw.tokens, starter);
      const opts = new Set([correct]);
      let guard = 0;
      while (opts.size < 3 && guard++ < 40) {
        const perm = this.shuffle(sw.tokens);
        if (perm.join(" ") !== sw.tokens.join(" ")) opts.add(this.presentSentence(perm, starter));
      }
      qs.push({ section: "Письмо", prompt: `Выбери правильное предложение: «${sw.ru}»`, options: this.shuffle([...opts]), answer: correct });
    }
    // Письмо — ввод (1): набери предложение по-гречески с клавиатуры
    const st = sPool[2] || sPool[0];
    if (st) {
      qs.push({ section: "Письмо (ввод)", input: true, prompt: `Напиши по-гречески: «${st.ru}»`, hint: st.tokens.length + " слов(а)", answer: st.tokens.join(" "), alt: st.alt || [] });
    }
    return qs;
  },

  fmtMS(ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  },
  startExamTimer() {
    if (this._exTimer) return;
    this._exTimer = setInterval(() => {
      const el = document.getElementById("ex-timer");
      if (!el || !this.session || !this.session.startTs) return;
      el.textContent = this.fmtMS(Date.now() - this.session.startTs);
    }, 1000);
  },
  stopExamTimer() { if (this._exTimer) { clearInterval(this._exTimer); this._exTimer = null; } },

  renderExam() {
    const n = parseInt(this.params.n, 10) || 0;
    const scope = this.params.scope ? this.params.scope.split(",").filter(Boolean) : null;
    const scopeKey = scope ? scope.join(",") : "";
    if (!this.session || this.session.n !== n || this.session.scopeKey !== scopeKey) { this.stopExamTimer(); this.session = { n, scopeKey, qs: this.buildExam(n, scope), idx: 0, correct: 0, sect: {}, startTs: Date.now() }; }
    const s = this.session;

    if (s.idx >= s.qs.length) {
      this.stopExamTimer();
      if (!s.endTs) s.endTs = Date.now();
      const pct = Math.round((100 * s.correct) / s.qs.length);
      this.saveExamBest(n, pct);
      const pass = pct >= 60;
      const rows = Object.keys(s.sect).map((k) =>
        `<div class="word-row"><div class="w-gr">${k}</div><div class="w-ru">${s.sect[k].c}/${s.sect[k].t}</div></div>`).join("");
      return `
        <div class="result">
          <h2>${pass ? "Сдан! 🎉" : "Почти 💪"}</h2>
          <p class="big-score ${pass ? "" : "fail"}">${pct}%</p>
          <p class="muted">${s.correct} из ${s.qs.length} правильно · зачёт от 60% · ⏱ ${this.fmtMS(s.endTs - s.startTs)}</p>
        </div>
        <div class="word-list">${rows}</div>
        <button class="big-btn primary" data-exam="${n}"${s.scopeKey ? ` data-exam-scope="${this.esc(s.scopeKey)}"` : ""}>Пересдать</button>
        <button class="big-btn ghost" data-go="exams">К списку экзаменов</button>`;
    }

    const q = s.qs[s.idx];
    const passage = q.passage
      ? `<div class="passage">
           <div class="passage-label">📖 Прочитай</div>
           <div class="passage-gr">${q.passage}</div>
           <details class="passage-tr"><summary>Перевод (подсмотреть)</summary><div class="muted small">${q.passageRu}</div></details>
         </div>`
      : "";
    const audio = q.audio
      ? `<div class="quiz-prompt listen">
           <button class="play-big" data-say="${this.esc(q.audio)}">🔊 Слушать</button>
           <button class="play-slow" data-say-slow="${this.esc(q.audio)}">🐢 Медленно</button>
         </div>`
      : "";
    this.afterRender = () => { if (q.autoplay) Speech.say(q.audio); this.startExamTimer(); };
    const body = q.input
      ? `<input id="typeInput" class="type-input" autocomplete="off" autocapitalize="off" placeholder="Набери по-гречески…" value="${this.esc(s.input || "")}">
         <div class="muted small">${q.hint || ""}</div>
         ${this.greekKeyboard()}
         <button class="big-btn primary" data-action="exam-type-check">Проверить</button>`
      : `<div class="opts">${q.options.map((o) => `<button class="opt" data-exopt="${this.esc(o)}">${o}</button>`).join("")}</div>`;
    return `
      <header class="page-head"><h2>Экзамен ${n + 1}</h2><div class="counter">⏱ <span id="ex-timer">${this.fmtMS(Date.now() - s.startTs)}</span> · ${s.idx + 1}/${s.qs.length}</div></header>
      <div class="exam-sec">${q.section}</div>
      ${passage}${audio}
      <div class="exam-q">${q.prompt}</div>
      ${body}
      <div id="fb" class="feedback"></div>`;
  },

  examTypeCheck() {
    const s = this.session;
    const q = s.qs[s.idx];
    const inp = document.getElementById("typeInput");
    const val = inp ? inp.value : (s.input || "");
    const ok = [q.answer, ...(q.alt || [])].some((c) => this.normGreek(val) === this.normGreek(c));
    if (ok) s.correct++;
    if (!s.sect[q.section]) s.sect[q.section] = { c: 0, t: 0 };
    s.sect[q.section].t++; if (ok) s.sect[q.section].c++;
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ Правильно: <b>" + q.answer + "</b>"} ${this.speakBtn(q.answer)}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.qs.length ? "Результат →" : "Дальше →"}</button>`;
    Speech.say(q.answer);
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.input = ""; this.render(); });
    this.afterAnswer();
  },

  examAnswer(opt, el) {
    const s = this.session;
    const q = s.qs[s.idx];
    const ok = opt === q.answer;
    if (ok) s.correct++; else this.addWeak({ q: q.prompt, opts: q.options, ans: q.answer });
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
});
