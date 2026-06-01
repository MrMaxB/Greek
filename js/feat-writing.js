/* ============================================================
   Ελληνικά A1 — ПИСЬМО (конструктор, пропуски, о-себе/свободное, анкета).
   Расширение App (грузится после app.js).
   ============================================================ */
Object.assign(App, {
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
          ${tile("dict", "🎧", "Диктант на слух", "слушай и записывай — по любой теме")}
          ${tile("worder", "🧩", "Собери предложение", "порядок слов · по темам")}
          ${tile("gap", "✏️", "Вставь слово", "пропущенное слово · грамматика")}
          ${tile("compose", "📝", "Текст из слов", "составь предложения из изученных слов")}
          ${tile("self", "🪪", "О себе", "ответь по-гречески, сверься с образцом")}
          ${tile("open", "📋", "Свободное письмо", "напиши 2–3 предложения на тему")}
          ${tile("form", "📑", "Заполни анкету", "формат экзамена: впиши данные в графы")}
        </div>`;
    }
    if (mode === "dict") return this.renderWDict();
    if (mode === "pdict") return this.renderWPhraseDict();
    if (mode === "worder") return this.renderWOrder();
    if (mode === "gap") return this.renderWGap();
    if (mode === "compose") return this.renderWCompose();
    if (mode === "self" || mode === "open") return this.renderWSelf();
    if (mode === "form") return this.renderWForm();
    return this.renderWriting();
  },

  // Диктант на слух: слова по темам (колоды) ИЛИ фразы по темам (предложения).
  renderWDict() {
    const decks = DECKS.map((d) => {
      const done = SRS.summary(d.words).learned;
      return `<button class="deck-tile" data-deck="${d.id}" data-mode="dictation">
        <div class="deck-ic">${d.icon}</div>
        <div class="deck-body"><div class="deck-title">${d.title}</div>
        <div class="deck-meta">${d.words.length} слов${done ? ` · изучается ${done}` : ""}</div></div></button>`;
    }).join("");
    const phrases = this.writingCats().map(([cat, n]) =>
      `<button class="deck-tile" data-pdict="${this.esc(cat)}"><div class="deck-ic">💬</div>
        <div class="deck-body"><div class="deck-title">${cat}</div><div class="deck-meta">${n} фраз</div></div></button>`).join("");
    return `
      <header class="page-head"><h2>🎧 Диктант на слух</h2><button class="back" data-go="writing">← Письмо</button></header>
      <p class="muted">Слушай и записывай — лучший способ закрепить написание (как daily dictation).</p>
      <h3 class="section-title">💬 Фразы по темам</h3>
      <p class="muted small">Целое предложение на слух — пиши, что услышал.</p>
      <div class="deck-list">${phrases}</div>
      <h3 class="section-title">🔤 Слова по темам</h3>
      <div class="deck-list">${decks}</div>`;
  },

  // Пофразовый диктант: слышишь предложение целиком — печатаешь его.
  renderWPhraseDict() {
    if (!this.session) {
      const cat = this.params.cat;
      const src = cat === "__all" || !cat ? WRITING_ORDER : WRITING_ORDER.filter((w) => (w.cat || "Разное") === cat);
      this.session = { pool: this.shuffle(src).slice(0, 10), idx: 0, correct: 0, cat, text: "", checked: false };
    }
    const s = this.session;
    if (s.idx >= s.pool.length) {
      return `<div class="result"><h2>Готово! 🎧</h2><p class="big-score">${s.correct} / ${s.pool.length}</p>
        <p class="muted">фраз записано${s.cat && s.cat !== "__all" ? " · тема: " + s.cat : ""}</p>
        <button class="big-btn primary" data-action="pdict-again">Ещё раунд</button>
        <button class="big-btn ghost" data-wmode="dict">↩ Другая тема</button>
        <button class="big-btn ghost" data-go="writing">К письму</button></div>`;
    }
    const cur = s.pool[s.idx];
    const right = cur.tokens.join(" ");
    if (!s.checked) this.afterRender = () => { Speech.say(right); const i = document.getElementById("pdInput"); if (i) i.focus(); };
    const fb = s.checked
      ? `<div class="${s.lastOk ? "ok-msg" : "bad-msg"}" style="text-align:left">
            ${s.lastOk ? "✓ Верно!" : "✗ Правильно:"} <b>${right}</b> ${this.speakBtn(right)}
            <div class="answer-ru">${cur.ru}</div></div>
          <button class="big-btn primary" data-action="pdict-next">${s.idx + 1 >= s.pool.length ? "Итог →" : "Дальше →"}</button>`
      : `<button class="big-btn primary" data-action="pdict-check">Проверить</button>`;
    return `
      <header class="page-head"><h2>🎧 Диктант: фразы</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <button class="back" data-wmode="dict">← К темам</button>
      <div class="quiz-prompt listen">
        <button class="play-big" data-say="${this.esc(right)}">🔊 Повторить</button>
        <button class="play-slow" data-say-slow="${this.esc(right)}">🐢 Медленно</button>
        <div class="muted small dict-hint">Запиши фразу по-гречески (${cur.ru})</div>
        ${this.dictSkeleton(right)}
      </div>
      <textarea id="pdInput" class="type-input area" autocomplete="off" autocapitalize="off" spellcheck="false" ${s.checked ? "disabled" : ""}>${this.esc(s.text)}</textarea>
      ${s.checked ? "" : `<div class="kbd-hint">✓ Ударения, регистр и знаки можно не ставить. Можно печатать на клавиатуре ниже.</div>
      <div class="gkbd">${this.greekKeyboard()}</div>`}
      <div id="fb" class="feedback">${fb}</div>`;
  },
  pdictCheck() {
    const s = this.session;
    const inp = document.getElementById("pdInput");
    if (inp) s.text = inp.value;
    const cur = s.pool[s.idx];
    const ok = [cur.tokens.join(" "), ...(cur.alt || [])].some((c) => this.normGreek(s.text) === this.normGreek(c));
    s.lastOk = ok; if (ok) s.correct++;
    s.checked = true;
    this.render();
  },
  pdictNext() { const s = this.session; s.idx++; s.text = ""; s.checked = false; s.lastOk = false; this.render(); },

  wHead(title, s) {
    return `<header class="page-head"><h2>${title}</h2><div class="counter">${Math.min(s.idx + 1, s.pool.length)}/${s.pool.length}</div></header>
      <button class="back" data-go="writing">← Письмо</button>`;
  },

  wResult(s, label) {
    // для «собери предложение» — вернуться к выбору темы
    const pick = s.cat ? `<button class="big-btn ghost" data-wmode="worder">↩ Другая тема</button>` : "";
    return `<div class="result">
      <h2>Готово! 🎉</h2><p class="big-score">${s.correct} / ${s.pool.length}</p>
      <p class="muted">${label}${s.cat && s.cat !== "__all" ? " · тема: " + s.cat : ""}</p>
      <button class="big-btn primary" data-action="wr-again">Ещё раунд</button>
      ${pick}
      <button class="big-btn ghost" data-go="writing">К письму</button>
    </div>`;
  },

  // Темы для письма (категории + счётчики) — общий список из WRITING_ORDER
  writingCats() {
    const c = {};
    WRITING_ORDER.forEach((w) => { c[w.cat || "Разное"] = (c[w.cat || "Разное"] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  },
  // Экран выбора темы для письменного упражнения (worder)
  renderWPick() {
    const tiles = this.writingCats().map(([cat, n]) =>
      `<button class="deck-tile" data-wcat="${this.esc(cat)}"><div class="deck-ic">🧩</div>
        <div class="deck-body"><div class="deck-title">${cat}</div><div class="deck-meta">${n} предложений</div></div></button>`).join("");
    return `
      <header class="page-head"><h2>🧩 Собери предложение</h2><button class="back" data-go="writing">← Письмо</button></header>
      <p class="muted">Выбери тему — порция из ~12 предложений. Можно вернуться и взять другую.</p>
      <button class="big-btn primary" data-wcat="__all">🎲 Всё вперемешку</button>
      <div class="deck-list">${tiles}</div>`;
  },
  // Собери предложение (порядок слов) — по выбранной теме, порциями
  renderWOrder() {
    if (!this.session) {
      const cat = this.params.cat;
      if (!cat) return this.renderWPick();
      const src = cat === "__all" ? WRITING_ORDER : WRITING_ORDER.filter((w) => (w.cat || "Разное") === cat);
      this.session = { pool: this.shuffle(src).slice(0, 12), idx: 0, correct: 0, bank: null, built: [], cat };
    }
    const s = this.session;
    if (s.idx >= s.pool.length) return this.wResult(s, "верных предложений");
    const cur = s.pool[s.idx];
    if (s.bank === null) { s.bank = this.shuffle(cur.tokens.map((t, i) => ({ i, t }))); s.built = []; }
    // Канонически первый токен показываем со строчной буквы, чтобы заглавная
    // не выдавала его позицию (проверка регистронезависимая).
    const disp = (i) => i === 0 ? cur.tokens[i].charAt(0).toLowerCase() + cur.tokens[i].slice(1) : cur.tokens[i];
    const builtHtml = s.built.length
      ? s.built.map((i) => `<button class="tok built" data-wtoken="built:${i}">${disp(i)}</button>`).join("")
      : `<span class="muted small">нажимай слова ниже, чтобы собрать фразу…</span>`;
    const bankHtml = s.bank.filter((b) => !s.built.includes(b.i))
      .map((b) => `<button class="tok" data-wtoken="bank:${b.i}">${disp(b.i)}</button>`).join("");
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
    // Принимаем канонический порядок ИЛИ любой из явно заданных равноправных
    // вариантов (cur.alt) — напр. наречие времени в начале/в конце фразы.
    const cands = [cur.tokens.join(" "), ...(cur.alt || [])];
    const ok = cands.some((c) => this.normGreek(built) === this.normGreek(c));
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
    const open = this.params.mode === "open";
    const pool0 = open ? WRITING_OPEN : WRITING_SELF;
    const title = open ? "📋 Свободное письмо" : "🪪 О себе";
    if (!this.session) this.session = { pool: this.shuffle(pool0), idx: 0, revealed: false, text: "" };
    const s = this.session;
    if (s.idx >= s.pool.length) return `<div class="result"><h2>Готово! 🎉</h2><p class="muted">Все задания пройдены.</p><button class="big-btn primary" data-action="wr-again">Ещё раз</button><button class="big-btn ghost" data-go="writing">К письму</button></div>`;
    const cur = s.pool[s.idx];
    // У открытого письма с чек-листом — сначала «Проверить» (направляющий фидбэк),
    // затем образец. У «О себе» — как раньше, сразу образец.
    const guided = open && cur.must;
    const reveal = s.revealed
      ? `<div class="ok-msg" style="text-align:left">Образец: <b>${cur.model}</b> ${this.speakBtn(cur.model)}</div>
         <button class="big-btn primary" data-action="self-next">Дальше →</button>`
      : guided
        ? `<button class="big-btn primary" data-action="self-checkwrite">Проверить</button>
           <button class="big-btn ghost" data-action="self-reveal">Показать образец</button>`
        : `<button class="big-btn primary" data-action="self-reveal">Показать образец</button>`;
    const hint = guided ? `<p class="muted small">Минимум ~${cur.minWords} слов. Включи: ${cur.must.map((m) => m.ru).join(", ")}.</p>` : "";
    return `<header class="page-head"><h2>${title}</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <button class="back" data-go="writing">← Письмо</button>
      <div class="quiz-prompt"><div class="type-ru">${cur.ask}</div></div>
      ${hint}
      <textarea id="selfText" class="type-input area" placeholder="Напиши по-гречески (2–3 предложения)…">${this.esc(s.text)}</textarea>
      <div id="fb" class="feedback"></div>
      <div id="reveal">${reveal}</div>`;
  },
  // Направляющая проверка свободного письма: длина + наличие обязательных элементов.
  selfCheckWrite() {
    const s = this.session;
    const cur = s.pool[s.idx];
    const el = document.getElementById("selfText");
    const text = el ? el.value : (s.text || "");
    s.text = text;
    const norm = this.normGreek(text);
    const words = this.tokenizeGreek(text);
    const checks = cur.must.map((m) => ({ ru: m.ru, ok: m.any.some((f) => norm.includes(this.normGreek(f))) }));
    const lenOk = words.length >= (cur.minWords || 6);
    const missing = checks.filter((c) => !c.ok);
    const fb = document.getElementById("fb");
    const lines = [
      `${lenOk ? "✓" : "✗"} длина: ${words.length} слов (нужно ~${cur.minWords})`,
      ...checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.ru}`),
    ];
    const allOk = lenOk && !missing.length;
    fb.innerHTML = `<div class="${allOk ? "ok-msg" : "bad-msg"}" style="text-align:left">
        ${allOk ? "Отлично! Все элементы на месте — сверься с образцом:" : "Хорошее начало. Чего не хватает:"}
        <div class="small" style="margin-top:6px;line-height:1.6">${lines.join("<br>")}</div>
      </div>`;
    if (allOk && !s.revealed) { s.revealed = true; this.render(); }
  },

  // Заполнение анкеты (αίτηση) — формат реального экзамена.
  renderWForm() {
    if (!this.session) this.session = { fi: Math.floor(Math.random() * WRITING_FORMS.length), checked: false };
    const s = this.session;
    const form = WRITING_FORMS[s.fi];
    const rows = form.fields.map((f, i) => `
      <div class="form-row">
        <label class="form-lbl">${this.wrapGreek(f.gr)} <span class="muted small">(${f.ru})</span></label>
        <input class="type-input form-inp" id="ff${i}" autocomplete="off"
          inputmode="${f.kind === "num" ? "numeric" : "text"}" placeholder="${f.kind === "num" ? "цифры" : f.eg}">
      </div>`).join("");
    return `
      <header class="page-head"><h2>📑 ${form.title}</h2><button class="back" data-go="writing">← Письмо</button></header>
      <div class="r-meta">${form.titleRu}</div>
      <p class="muted small">Впиши свои данные по-гречески в каждую графу (можно выдуманные). Это типовое задание экзамена.</p>
      <div class="form-fill">${rows}</div>
      <button class="big-btn primary" data-action="form-check">Проверить</button>
      <div id="fb" class="feedback"></div>`;
  },
  formCheck() {
    const s = this.session;
    const form = WRITING_FORMS[s.fi];
    const issues = [];
    form.fields.forEach((f, i) => {
      const el = document.getElementById("ff" + i);
      const v = (el ? el.value : "").trim();
      if (!v) { issues.push(`«${f.gr}» (${f.ru}) — пусто`); return; }
      if (f.kind === "num") {
        if (!/\d/.test(v)) issues.push(`«${f.gr}» (${f.ru}) — нужны цифры`);
      } else if (!/[Ͱ-Ͽἀ-῿]/.test(v) && !/@/.test(v)) {
        issues.push(`«${f.gr}» (${f.ru}) — впиши по-гречески`);
      }
    });
    const fb = document.getElementById("fb");
    if (!issues.length) {
      fb.innerHTML = `<div class="ok-msg">✓ Анкета заполнена верно! Все графы на месте.</div>
        <button class="big-btn primary" data-action="form-again">Другая анкета</button>
        <button class="big-btn ghost" data-go="writing">К письму</button>`;
    } else {
      fb.innerHTML = `<div class="bad-msg" style="text-align:left">Проверь графы:<br>${issues.map((x) => "• " + x).join("<br>")}</div>`;
    }
  },

});
