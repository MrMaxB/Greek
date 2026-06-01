/* ============================================================
   Ελληνικά A1 — ЧТЕНИЕ (graded readers, тап-перевод, проверка понимания).
   Расширение App (грузится после app.js).
   ============================================================ */
Object.assign(App, {
  /* ---------- ЧТЕНИЕ (graded readers) ---------- */
  readingDone() {
    try { return JSON.parse(localStorage.getItem("greekA1_reading_done")) || {}; }
    catch { return {}; }
  },
  isRead(id) { return !!this.readingDone()[id]; },
  markRead(id) {
    const d = this.readingDone();
    d[id] = true;
    localStorage.setItem("greekA1_reading_done", JSON.stringify(d));
    if (window.Cloud && window.Cloud.push) window.Cloud.push();
  },

  renderReadingList() {
    const done = this.readingDone();
    const groups = ["A0", "A0+", "A1"].map((lv) => {
      const items = READING_TEXTS.filter((t) => t.level === lv).map((t) => `
        <button class="deck-tile" data-read="${t.id}">
          <div class="deck-ic">${done[t.id] ? "✅" : "📖"}</div>
          <div class="deck-body"><div class="deck-title">${t.title}</div>
          <div class="deck-meta">${t.genre} · ${t.titleRu}</div></div>
        </button>`).join("");
      return `<h3 class="section-title">Уровень ${lv}</h3><div class="deck-list">${items}</div>`;
    }).join("");
    const total = READING_TEXTS.length;
    const read = READING_TEXTS.filter((t) => done[t.id]).length;
    return `
      <header class="page-head"><h2>📕 Чтение</h2></header>
      <p class="muted">Короткие тексты от A0 до честного A1. Тапни слово — перевод и звук; тапни 🇷🇺 — перевод фразы. Прочитано <b>${read}/${total}</b>.</p>
      ${groups}`;
  },

  // Словарь для тап-перевода: текст > общий > словарь приложения
  // Словарь тап-перевода для текста = общий глоссарий + переопределения текста.
  buildGloss(t) {
    const g = Object.assign({}, this.globalGloss());
    Object.entries(t.gloss || {}).forEach(([k, v]) => { g[this.normGreek(k)] = v; });
    return g;
  },

  buildReadWords(gr) {
    const parts = gr.match(/[Ͱ-Ͽἀ-῿]+|[^Ͱ-Ͽἀ-῿]+/g) || [];
    return parts.map((p) => {
      if (/[Ͱ-Ͽἀ-῿]/.test(p)) {
        return `<span class="rword" data-rw="${this.esc(this.normGreek(p))}" data-ro="${this.esc(p)}">${this.esc(p)}</span>`;
      }
      return this.esc(p);
    }).join("");
  },

  renderRead() {
    const t = READING_TEXTS.find((x) => x.id === this.params.id);
    if (!t) return this.renderReadingList();
    this._gloss = this.buildGloss(t);
    const sents = t.sents.map((p, i) => `
      <div class="r-sent">
        <span class="r-text">${this.buildReadWords(p[0])}</span>
        <span class="r-tools"><button class="r-ic" data-say="${this.esc(p[0])}">🔊</button><button class="r-ic" data-rtr="${i}">🇷🇺</button></span>
        <div class="r-trans" id="rtrans-${i}" hidden>${p[1]}</div>
      </div>`).join("");
    const readBtn = this.isRead(t.id)
      ? `<button class="big-btn ghost" data-action="read-done" data-id="${t.id}">✅ Прочитано</button>`
      : `<button class="big-btn primary" data-action="read-done" data-id="${t.id}">✓ Отметить прочитанным</button>`;
    // Проверка понимания доступна, если в тексте ≥3 предложения (есть из чего делать дистракторы)
    const canCheck = t.sents.length >= 3;
    return `
      <header class="page-head"><h2>${t.title}</h2><button class="back" data-go="reading">← Чтение</button></header>
      <div class="r-meta"><span class="lvl-badge">${t.level}</span> ${t.genre} · ${t.titleRu}</div>
      <button class="big-btn primary slim" data-action="read-all">🔊 Озвучить весь текст</button>
      <p class="muted small">Тапни слово — перевод и звук. Тапни 🇷🇺 у строки — перевод предложения.</p>
      <div class="reader">${sents}</div>
      ${canCheck ? `<button class="big-btn" data-action="read-quiz" data-id="${t.id}">🧩 Проверить понимание</button>` : ""}
      ${readBtn}`;
  },

  // Проверка понимания текста: «что значит фраза?» из самого текста.
  // Дистракторы — переводы ДРУГИХ предложений (того же или соседних текстов).
  // Нулевой риск по греческому: используем только выверенные пары [гр, ру].
  buildReadQuiz(t) {
    const own = t.sents.filter((p) => p[1] && p[1].length > 4);
    const pool = [];
    READING_TEXTS.forEach((x) => x.sents.forEach((p) => { if (p[1] && p[1].length > 4) pool.push(p[1]); }));
    const pick = this.shuffle(own).slice(0, Math.min(3, own.length));
    return pick.map((p) => {
      const correct = p[1];
      const distract = this.shuffle(pool.filter((ru) => ru !== correct)).slice(0, 3);
      return { gr: p[0], options: this.shuffle([correct, ...distract]), answer: correct };
    });
  },
  renderReadQuiz() {
    const t = READING_TEXTS.find((x) => x.id === this.params.id);
    if (!t) return this.renderReadingList();
    if (!this.session) this.session = { qs: this.buildReadQuiz(t), idx: 0, correct: 0 };
    const s = this.session;
    if (s.idx >= s.qs.length) {
      const ok = s.correct === s.qs.length;
      if (ok) this.markRead(t.id);
      return `<div class="result"><h2>${ok ? "Понято! 🎉" : "Почти 💪"}</h2>
        <p class="big-score ${ok ? "" : "fail"}">${s.correct} / ${s.qs.length}</p>
        <p class="muted">${ok ? "текст засчитан как прочитанный" : "перечитай и попробуй снова"}</p>
        <button class="big-btn primary" data-read="${t.id}">← К тексту</button>
        <button class="big-btn ghost" data-go="reading">К списку</button></div>`;
    }
    const q = s.qs[s.idx];
    const opts = q.options.map((o) => `<button class="opt" data-readopt="${this.esc(o)}">${o}</button>`).join("");
    return `
      <header class="page-head"><h2>🧩 Понимание</h2><div class="counter">${s.idx + 1}/${s.qs.length}</div></header>
      <button class="back" data-read="${t.id}">← К тексту</button>
      <p class="muted small">Что значит эта фраза из текста?</p>
      <div class="exam-q">${this.wrapGreek(q.gr)} ${this.speakBtn(q.gr)}</div>
      <div class="opts">${opts}</div>
      <div id="fb" class="feedback"></div>`;
  },
  readQuizAnswer(opt, el) {
    const s = this.session;
    const q = s.qs[s.idx];
    const ok = opt === q.answer;
    if (ok) s.correct++;
    document.querySelectorAll(".opt").forEach((b) => {
      if (b.dataset.readopt === q.answer) b.classList.add("ok");
      else if (b === el) b.classList.add("bad");
      b.disabled = true;
    });
    const fb = document.getElementById("fb");
    fb.innerHTML = `<div class="${ok ? "ok-msg" : "bad-msg"}">${ok ? "✓ Верно!" : "✗ Правильно: <b>" + q.answer + "</b>"}</div>
      <button class="big-btn primary" id="nextBtn">${s.idx + 1 >= s.qs.length ? "Итог →" : "Дальше →"}</button>`;
    fb.querySelector("#nextBtn").addEventListener("click", () => { s.idx++; this.render(); });
    this.afterAnswer();
  },

  showWord(norm, orig) {
    const tr = (this._gloss && this._gloss[norm]) || this.resolveGloss(norm);
    const bar = document.getElementById("wordbar");
    if (!bar) return;
    bar.querySelector(".wb-gr").textContent = orig;
    bar.querySelector(".wb-ru").textContent = tr || "— (нет в словаре)";
    bar.querySelector(".wb-spk").dataset.say = orig;
    bar.hidden = false;
    Speech.say(orig);
  },

  rTrans(i) {
    const el = document.getElementById("rtrans-" + i);
    if (el) el.hidden = !el.hidden;
  },
});
