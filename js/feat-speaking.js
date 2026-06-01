/* ============================================================
   Ελληνικά A1 — ГОВОРЕНИЕ (фразы вслух, вопрос-ответ, диалоги).
   Расширение App.
   ============================================================ */
Object.assign(App, {
  /* ---------- ГОВОРЕНИЕ (фразы вслух + распознавание) ---------- */
  // Греческие числительные → цифра (распознавание возвращает цифры)
  NUM: {
    "μηδεν":"0","ενα":"1","μια":"1","δυο":"2","τρια":"3","τρεις":"3","τεσσερα":"4","τεσσερις":"4",
    "πεντε":"5","εξι":"6","εφτα":"7","επτα":"7","οχτω":"8","οκτω":"8","εννια":"9","εννεα":"9","δεκα":"10",
    "εντεκα":"11","δωδεκα":"12","εικοσι":"20","τριαντα":"30","σαραντα":"40","πενηντα":"50","εξηντα":"60",
    "εβδομηντα":"70","ογδοντα":"80","ενενηντα":"90","εκατο":"100","χιλια":"1000",
  },
  speechTokens(text) {
    const toks = (text || "").match(/\d+|[Ͱ-Ͽἀ-῿]+/g) || [];
    return toks.map((t) => {
      if (/^\d+$/.test(t)) return t;
      const ng = this.normGreek(t);
      return this.NUM[ng] || this.phoneticGreek(t);
    }).filter(Boolean);
  },
  // Совпало ли произнесённое с целью (с учётом чисел и омофонов)
  phraseMatch(target, alts) {
    const tt = this.speechTokens(target);
    const tjoin = tt.join(" ");
    return alts.some((a) => {
      const ht = this.speechTokens(a);
      if (ht.join(" ") === tjoin) return true;
      return tt.length > 0 && tt.every((x) => ht.includes(x));
    });
  },

  buildSpeaking() {
    if (this._speaking) return this._speaking;
    const out = [];
    const seen = new Set();
    const add = (gr, ru) => { const k = this.normGreek(gr); if (gr && !seen.has(k)) { seen.add(k); out.push({ gr, ru }); } };
    const ph = DECKS.find((d) => d.id === "phrases"); if (ph) ph.words.forEach((w) => add(w.gr, w.ru));
    const gr = DECKS.find((d) => d.id === "greetings"); if (gr) gr.words.forEach((w) => add(w.gr, w.ru));
    if (typeof WRITING_ORDER !== "undefined") WRITING_ORDER.forEach((s) => add(s.tokens.join(" "), s.ru));
    this._speaking = out;
    return out;
  },

  renderSpeaking() {
    const noMic = !Recog.supported;
    const mode = this.params.mode;
    if (!mode) {
      const tile = (m, ic, t, d) => `<button class="deck-tile" data-spkmode="${m}"><div class="deck-ic">${ic}</div><div class="deck-body"><div class="deck-title">${t}</div><div class="deck-meta">${d}</div></div></button>`;
      return `<header class="page-head"><h2>🗣️ Говорение</h2></header>
        ${noMic ? `<div class="banner">🎤 В этом браузере нет распознавания речи (iPhone/Firefox). Тренировка работает в режиме «слушай образец и говори вслух»; для авто-проверки открой в <b>Chrome</b>.</div>` : ""}
        <p class="muted">Тренируй речь: повторяй фразы, отвечай на вопросы или проходи диалоги-сценарии.</p>
        <div class="deck-list">
          ${tile("listen", "🎧", "Аудирование", "слушай диалог (текст скрыт) → вопрос на понимание")}
          ${tile("phrases", "🔊", "Фразы вслух", noMic ? "слушай образец и повторяй вслух" : "читаешь фразу — приложение сверяет")}
          ${tile("qa", "💬", "Вопрос-ответ", "отвечаешь своими словами, потом образец")}
          ${tile("dialog", "🎭", "Диалоги", `${SPEAKING_DIALOGS.length} сценариев: кафе, магазин, врач…`)}
        </div>`;
    }
    if (mode === "qa") return this.renderSpeakQA();
    if (mode === "dialog") return this.renderSpeakDialog();
    if (mode === "listen") return this.renderListen();
    if (!this.session) {
      this.session = { pool: this.shuffle(this.buildSpeaking()), idx: 0, correct: 0, done: 0, scored: false };
    }
    const s = this.session;
    if (s.idx >= s.pool.length) {
      return `<div class="result"><h2>Готово! 🎉</h2>
        <p class="big-score">${noMic ? s.done + " / " + s.pool.length : s.correct + " / " + s.pool.length}</p>
        <p class="muted">${noMic ? "фраз проговорено" : "фраз произнесено верно"}</p>
        <button class="big-btn primary" data-action="spk-again">Ещё раунд</button>
        <button class="big-btn ghost" data-go="speaking">К говорению</button></div>`;
    }
    const cur = s.pool[s.idx];
    return `
      <header class="page-head"><h2>🗣️ Фразы вслух</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <button class="back" data-go="speaking">← Говорение</button>
      <p class="muted small">${noMic ? "Послушай образец 🔊 и повтори вслух. Потом — дальше." : "Прочитай фразу вслух. Нажми 🔊 послушать, потом 🎤 и говори."}</p>
      <div class="quiz-prompt">
        <div class="flash-gr">${cur.gr} ${this.speakBtn(cur.gr)}</div>
        <div class="muted">${cur.ru}</div>
      </div>
      <button class="play-slow" data-say-slow="${this.esc(cur.gr)}">🐢 Медленно</button>
      ${noMic
        ? `<button class="big-btn primary" data-action="spk-next">✓ Сказал вслух — дальше →</button>`
        : `<button class="mic-btn" data-action="spk-start">🎤 Произнести фразу</button>`}
      <div id="fb" class="feedback"></div>`;
  },

  speakStartPhrase() {
    const cur = this.session.pool[this.session.idx];
    const mic = document.querySelector(".mic-btn");
    const fb = document.getElementById("fb");
    Recog.listen(
      (alts) => this.speakPhraseResult(alts, cur),
      (code) => {
        if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Произнести фразу"; mic.disabled = false; }
        const msg = code === "not-allowed" || code === "service-not-allowed"
          ? "Доступ к микрофону запрещён. Разреши его в браузере."
          : code === "nomatch" ? "Не расслышал. Чётче и ещё раз." : "Не получилось. Ещё раз.";
        if (fb) fb.innerHTML = `<div class="bad-msg">${msg}</div>`;
      },
      () => { if (mic) { mic.classList.add("rec"); mic.innerHTML = "🔴 Слушаю… говори"; mic.disabled = true; } if (fb) fb.innerHTML = ""; }
    );
  },

  // Пословная обратная связь: какие слова распознаны (зелёные), какие нет
  phraseWordFeedback(target, alts) {
    const heard = new Set();
    (alts || []).forEach((a) => this.speechTokens(a).forEach((t) => heard.add(t)));
    const words = target.match(/\d+|[Ͱ-Ͽἀ-῿]+/g) || [];
    return words.map((w) => {
      const tok = this.speechTokens(w)[0];
      const ok = tok && heard.has(tok);
      return `<span class="wfb ${ok ? "wfb-ok" : "wfb-no"}">${w}</span>`;
    }).join(" ");
  },

  speakPhraseResult(alts, cur) {
    const s = this.session;
    const mic = document.querySelector(".mic-btn");
    if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Сказать снова"; mic.disabled = false; }
    const ok = this.phraseMatch(cur.gr, alts);
    if (ok && !s.scored) s.correct++;
    s.scored = true;
    const heard = alts[0] || "—";
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">
        ${ok ? "✓ Отлично!" : "✗ Почти — смотри, где разошлось:"} ${this.speakBtn(cur.gr)}
        <div class="wfb-line">${this.phraseWordFeedback(cur.gr, alts)}</div>
        <div class="answer-ru">Услышал: «${this.esc(heard)}»</div>
      </div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.pool.length ? "Результат →" : "Дальше →"}</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.scored = false; this.render(); });
    this.afterAnswer();
  },

  // Открытый вопрос-ответ: говоришь свободно, потом образец
  renderSpeakQA() {
    if (!this.session) this.session = { pool: this.shuffle(SPEAKING_Q.slice()), idx: 0 };
    const s = this.session;
    if (s.idx >= s.pool.length) {
      return `<div class="result"><h2>Готово! 🎉</h2><p class="muted">Ты ответил на все вопросы.</p>
        <button class="big-btn primary" data-action="spkq-again">Ещё раз</button>
        <button class="big-btn ghost" data-go="speaking">К говорению</button></div>`;
    }
    const [q, ru] = s.pool[s.idx];
    const noMic = !Recog.supported;
    return `
      <header class="page-head"><h2>💬 Вопрос-ответ</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <button class="back" data-go="speaking">← Говорение</button>
      <p class="muted small">Послушай вопрос и ответь по-гречески своими словами. Потом сверься с образцом.</p>
      <div class="quiz-prompt"><div class="flash-gr">${q} ${this.speakBtn(q)}</div><div class="muted">${ru}</div></div>
      ${noMic
        ? `<button class="big-btn primary" data-action="spkq-reveal">💡 Показать образец</button>`
        : `<button class="mic-btn" data-action="spkq-start">🎤 Ответить</button>`}
      <div id="fb" class="feedback"></div>`;
  },
  // Без микрофона: показать образец и перейти дальше
  speakQAReveal() {
    const s = this.session;
    const cur = s.pool[s.idx];
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="ok-msg" style="text-align:left">
        Образец: <b>${cur[2]}</b> ${this.speakBtn(cur[2])}
      </div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.pool.length ? "Итог →" : "Дальше →"}</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
  },
  speakQAStart() {
    const cur = this.session.pool[this.session.idx];
    const mic = document.querySelector(".mic-btn");
    const fb = document.getElementById("fb");
    Recog.listen(
      (alts) => this.speakQAResult(alts, cur),
      () => { if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Ответить снова"; mic.disabled = false; } if (fb) fb.innerHTML = `<div class="bad-msg">Не расслышал. Ещё раз.</div>`; },
      () => { if (mic) { mic.classList.add("rec"); mic.innerHTML = "🔴 Слушаю…"; mic.disabled = true; } if (fb) fb.innerHTML = ""; }
    );
  },
  speakQAResult(alts, cur) {
    const s = this.session;
    const mic = document.querySelector(".mic-btn");
    if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Ответить снова"; mic.disabled = false; }
    const heard = alts[0] || "—";
    const model = cur[2];
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="ok-msg" style="text-align:left">
        🗣 Ты сказал: «${this.esc(heard)}»
        <div class="answer-ru">Образец: <b>${model}</b> ${this.speakBtn(model)}</div>
      </div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.pool.length ? "Итог →" : "Дальше →"}</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },

  /* ---------- АУДИРОВАНИЕ: слушай диалог → вопрос на понимание ---------- */
  renderListen() {
    const pool = SPEAKING_DIALOGS.filter((d) => d.q);
    if (!this.session || this.session.mode !== "listen") {
      this.session = { mode: "listen", pool: this.shuffle(pool), idx: 0, correct: 0, answered: false };
    }
    const s = this.session;
    if (s.idx >= s.pool.length) {
      return `<div class="result"><h2>Готово! 🎧</h2><p class="big-score">${s.correct} / ${s.pool.length}</p>
        <p class="muted">диалогов понято</p>
        <button class="big-btn primary" data-action="listen-again">Ещё раз</button>
        <button class="big-btn ghost" data-go="speaking">К говорению</button></div>`;
    }
    const d = s.pool[s.idx];
    if (!Speech.supported) {
      return `<header class="page-head"><h2>🎧 Аудирование</h2></header>
        <button class="back" data-go="speaking">← Говорение</button>
        <div class="banner">🔇 Этот браузер не озвучивает текст — аудирование недоступно. Открой в Chrome/Edge. А пока можно пройти «Диалоги» с текстом.</div>`;
    }
    const opts = d.q.options.map((o) => `<button class="opt" data-listenopt="${this.esc(o)}">${o}</button>`).join("");
    // автозапуск проигрывания диалога двумя «голосами»
    this.afterRender = () => this.playDialogAudio(d);
    return `
      <header class="page-head"><h2>🎧 Аудирование</h2><div class="counter">${s.idx + 1}/${s.pool.length}</div></header>
      <button class="back" data-go="speaking">← Говорение</button>
      <p class="muted small">Прослушай диалог (текст скрыт) и ответь на вопрос. Можно переслушать.</p>
      <div class="quiz-prompt"><div class="deck-ic" style="font-size:2.2rem">${d.icon}</div>
        <button class="big-btn primary slim" data-action="listen-replay">🔊 Прослушать ещё раз</button></div>
      <div class="exam-q">${d.q.ask}</div>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>`;
  },
  playDialogAudio(d) {
    // два «голоса»: собеседник (p) выше, ты (u) ниже
    Speech.sayAll(d.lines.map((l) => ({ text: l.gr, pitch: l.who === "p" ? 1.15 : 0.85 })));
  },
  listenAnswer(opt, el) {
    const s = this.session;
    const d = s.pool[s.idx];
    if (s.answered) return;
    s.answered = true;
    const ok = opt === d.q.answer;
    if (ok) s.correct++;
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.listenopt === d.q.answer) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ Правильно: <b>" + d.q.answer + "</b>"}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.pool.length ? "Итог →" : "Дальше →"}</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; s.answered = false; this.render(); });
    this.afterAnswer();
  },

  /* ---------- ГОВОРЕНИЕ: диалоги-сценарии ---------- */
  renderSpeakDialog() {
    const s = this.session;
    if (!s || !s.d) {
      const tiles = SPEAKING_DIALOGS.map((d) =>
        `<button class="deck-tile" data-dialog="${d.id}"><div class="deck-ic">${d.icon}</div>
          <div class="deck-body"><div class="deck-title">${d.title}</div>
          <div class="deck-meta">${d.ru} · ${d.lines.length} реплик</div></div></button>`).join("");
      return `<header class="page-head"><h2>🎭 Диалоги</h2></header>
        <button class="back" data-go="speaking">← Говорение</button>
        <p class="muted small">Выбери сценарий. Реплики собеседника звучат, твои — произносишь вслух (можно с подсказкой).</p>
        <div class="deck-list">${tiles}</div>`;
    }
    const d = s.d;
    if (s.idx >= d.lines.length) {
      return `<div class="result"><h2>Сценарий пройден! 🎉</h2><p class="muted">«${d.title}»</p>
        <button class="big-btn primary" data-action="dlg-restart">Ещё раз</button>
        <button class="big-btn ghost" data-go="speaking">К другим диалогам</button></div>`;
    }
    const noMic = !Recog.supported;
    const bub = (l, extra = "") => `<div class="bubble ${l.who === "u" ? "me" : "them"} ${extra}">
        ${this.wrapGreek(l.gr)} ${this.speakBtn(l.gr)}<div class="bub-ru">${l.ru}</div></div>`;
    const history = d.lines.slice(0, s.idx).map((l) => bub(l)).join("");
    const cur = d.lines[s.idx];
    let active;
    if (cur.who === "p") {
      active = `${bub(cur, "active")}
        <button class="big-btn primary" data-action="dlg-next">Дальше →</button>`;
      this.afterRender = () => Speech.say(cur.gr);
    } else {
      active = `<div class="bubble me task">🗣 Твоя реплика — скажи вслух:<div class="bub-ru">«${cur.ru}»</div>
          ${s.reveal ? `<div class="reveal-gr">${this.wrapGreek(cur.gr)} ${this.speakBtn(cur.gr)}</div>` : ""}
        </div>
        ${!s.reveal ? `<button class="big-btn" data-action="dlg-reveal">💡 Подсказка / образец</button>` : ""}
        ${!noMic ? `<button class="mic-btn" data-action="dlg-mic">🎤 Произнести</button>` : ""}
        <button class="big-btn primary" data-action="dlg-next">${s.idx + 1 >= d.lines.length ? "Готово →" : "Дальше →"}</button>
        <div id="fb" class="feedback"></div>`;
    }
    return `<header class="page-head"><h2>${d.icon} ${d.title}</h2><div class="counter">${s.idx + 1}/${d.lines.length}</div></header>
      <button class="back" data-go="speaking">← Говорение</button>
      <div class="chat">${history}${active}</div>`;
  },
  speakDialogMic() {
    const s = this.session;
    const cur = s.d.lines[s.idx];
    const mic = document.querySelector(".mic-btn");
    const fb = document.getElementById("fb");
    Recog.listen(
      (alts) => {
        if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Ещё раз"; mic.disabled = false; }
        const ok = this.phraseMatch(cur.gr, alts);
        fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Отлично!" : "Почти — где разошлось:"}
          <div class="wfb-line">${this.phraseWordFeedback(cur.gr, alts)}</div></div>`;
      },
      () => { if (mic) { mic.classList.remove("rec"); mic.innerHTML = "🎤 Ещё раз"; mic.disabled = false; } if (fb) fb.innerHTML = `<div class="bad-msg">Не расслышал. Ещё раз.</div>`; },
      () => { if (mic) { mic.classList.add("rec"); mic.innerHTML = "🔴 Слушаю…"; mic.disabled = true; } if (fb) fb.innerHTML = ""; }
    );
  },
});
