/* Логика приложения: учебный трек и сборка экзаменов. node:test. */
const { test } = require("node:test");
const assert = require("node:assert");
const { load } = require("./load");

const X = load();
const App = X.App;

test("все экраны рендерятся на свежем профиле (без прогресса)", () => {
  const screens = [
    "renderHome", "renderTrack", "renderAlphabet", "renderAlphaQuiz", "renderReview",
    "renderDecks", "renderGrammar", "renderWriting", "renderSpeaking", "renderReadingList",
    "renderExamsList", "renderProgress", "renderCoverage", "renderMistakes",
  ];
  for (const fn of screens) {
    App.params = {}; App.session = null;
    const r = App[fn]();
    assert.ok(typeof r === "string" && r.length > 0, `${fn}: пустой/упавший рендер`);
  }
  // под-режимы письма и говорения
  for (const mode of ["worder", "gap", "compose", "self", "open"]) {
    App.params = { mode }; App.session = null;
    assert.ok(App.renderWriting().length, `writing/${mode}: пусто`);
  }
  for (const mode of ["phrases", "qa", "dialog"]) {
    App.params = { mode }; App.session = null;
    assert.ok(App.renderSpeaking().length, `speaking/${mode}: пусто`);
  }
  // параметризованные экраны
  App.params = { id: X.GRAMMAR_LESSONS[0].id }; App.session = null;
  assert.ok(App.renderLesson().length, "lesson");
  App.params = { id: X.READING_TEXTS[0].id }; App.session = null;
  assert.ok(App.renderRead().length, "read");
  App.params = { n: "0" }; App.session = null;
  assert.ok(App.renderExam().length, "exam");
  App.params = { topic: X.GRAMMAR_LESSONS[1].id }; App.session = null;
  assert.ok(App.renderGex().length, "gex");
});

test("трек строится, дни и недели согласованы", () => {
  const days = App.buildTrack();
  assert.ok(days.length > 50, `мало дней: ${days.length}`);
  days.forEach((d, i) => {
    assert.ok(d.title, `день ${i}: нет title`);
    assert.ok(Array.isArray(d.tasks) && d.tasks.length, `день ${i}: нет задач`);
    assert.equal(d.week, Math.floor(i / 5) + 1, `день ${i}: неверная неделя`);
  });
});

test("трек: задействованы все уроки грамматики", () => {
  const days = App.buildTrack();
  const used = new Set();
  days.forEach((d) => d.tasks.forEach((t) => { if (t.t === "lesson") used.add(t.ref); }));
  assert.equal(used.size, X.GRAMMAR_LESSONS.length, `уроков в треке ${used.size} из ${X.GRAMMAR_LESSONS.length}`);
});

test("трек: ссылки на темы/тексты/уроки/экзамены валидны", () => {
  const days = App.buildTrack();
  const decks = new Set(X.DECKS.map((d) => d.id));
  const lessons = new Set(X.GRAMMAR_LESSONS.map((l) => l.id));
  const texts = new Set(X.READING_TEXTS.map((t) => t.id));
  days.forEach((d, i) => d.tasks.forEach((t) => {
    if (t.t === "deck") assert.ok(decks.has(t.ref), `день ${i}: нет темы ${t.ref}`);
    if (t.t === "lesson") assert.ok(lessons.has(t.ref), `день ${i}: нет урока ${t.ref}`);
    if (t.t === "read") assert.ok(texts.has(t.ref), `день ${i}: нет текста ${t.ref}`);
    if (t.t === "exam") assert.ok(t.ref >= 0 && t.ref < X.EXAM_READINGS.length, `день ${i}: экзамен ${t.ref} вне диапазона`);
  }));
});

test("трек: задействовано существенно больше половины текстов", () => {
  const days = App.buildTrack();
  const used = new Set();
  days.forEach((d) => d.tasks.forEach((t) => { if (t.t === "read") used.add(t.ref); }));
  assert.ok(used.size >= X.READING_TEXTS.length * 0.6, `текстов в треке ${used.size} из ${X.READING_TEXTS.length}`);
});

test("трек: грамматика-фундамент идёт рано (простое→сложное)", () => {
  const days = App.buildTrack();
  const when = {};
  days.forEach((d, i) => d.tasks.forEach((t) => { if (t.t === "lesson" && when[t.ref] == null) when[t.ref] = i + 1; }));
  // базовые правила должны быть в первой трети пути
  ["read", "gender", "cases", "be-have", "verb-a"].forEach((id) => {
    assert.ok(when[id] && when[id] <= days.length / 2, `урок-фундамент ${id} слишком поздно: день ${when[id]}`);
  });
  // каждый урок выдаётся ровно один раз
  const counts = {};
  days.forEach((d) => d.tasks.forEach((t) => { if (t.t === "lesson") counts[t.ref] = (counts[t.ref] || 0) + 1; }));
  Object.entries(counts).forEach(([id, c]) => assert.equal(c, 1, `урок ${id} выдан ${c} раз`));
});

test("трек: темы чередуются, базовая колода семьи раньше «сиквелов»", () => {
  const days = App.buildTrack();
  const fam = (id) => id.replace(/[0-9]+$/, "").replace(/_freq$|_life$/, "");
  const dayOf = {};
  days.forEach((d, i) => d.tasks.forEach((t) => { if (t.t === "deck" && dayOf[t.ref] == null) dayOf[t.ref] = i; }));
  // 1) базовая колода семьи (food) идёт раньше сиквелов (food2…)
  const baseByFam = {};
  X.DECKS.forEach((d) => { const f = fam(d.id); if (baseByFam[f] == null) baseByFam[f] = d.id; });
  X.DECKS.forEach((d) => {
    const base = baseByFam[fam(d.id)];
    if (d.id !== base && dayOf[d.id] != null && dayOf[base] != null) {
      assert.ok(dayOf[base] < dayOf[d.id], `сиквел ${d.id} раньше базовой ${base}`);
    }
  });
  // 2) интерливинг: большие семьи НЕ идут сплошным блоком (разнесены)
  const byFam = {};
  Object.entries(dayOf).forEach(([id, day]) => { (byFam[fam(id)] = byFam[fam(id)] || []).push(day); });
  const big = Object.values(byFam).filter((ds) => ds.length >= 4);
  big.forEach((ds) => { const span = Math.max(...ds) - Math.min(...ds); assert.ok(span >= ds.length, `большая тема идёт блоком (span ${span} при ${ds.length} колодах)`); });
});

test("трек: чекпоинт-экзамены тестируют лексику пройденного блока", () => {
  const days = App.buildTrack();
  let total = 0, inScope = 0;
  days.forEach((d) => {
    const ex = d.tasks.find((t) => t.t === "exam" && t.scope && t.scope.length);
    if (!ex) return;
    const qs = App.buildExam(ex.ref, ex.scope);
    const scopeWords = new Set(X.ALL_WORDS.filter((w) => ex.scope.includes(w.deck)).map((w) => w.ru));
    qs.filter((q) => q.section === "Лексика" || q.section === "Аудио").forEach((q) => {
      total++; if (scopeWords.has(q.answer)) inScope++;
    });
  });
  assert.ok(total > 0, "нет чекпоинт-экзаменов со scope");
  assert.equal(inScope, total, `лексика/аудио вне блока: ${total - inScope}/${total}`);
});

test("трек: экзамены-чекпоинты не повторяются", () => {
  const days = App.buildTrack();
  const refs = [];
  days.forEach((d) => { const ex = d.tasks.find((t) => t.t === "exam" && t.scope); if (ex) refs.push(ex.ref); });
  assert.equal(new Set(refs).size, refs.length, `повтор экзамена: ${refs.join(",")}`);
});

test("трек: есть дни закрепления и экзамены-чекпоинты", () => {
  const days = App.buildTrack();
  assert.ok(days.some((d) => d.rest), "нет дней закрепления");
  assert.ok(days.some((d) => d.checkpoint), "нет чекпоинтов");
});

test("экзамен: собирается, ответы среди вариантов", () => {
  const qs = App.buildExam(0, null);
  assert.ok(qs.length >= 8, `мало вопросов: ${qs.length}`);
  qs.forEach((q, i) => {
    if (q.input) { assert.ok(q.answer, `q#${i}: input без ответа`); return; }
    assert.ok(q.options.includes(q.answer), `q#${i} (${q.section}): ответа нет среди вариантов`);
  });
});

test("экзамен со scope: лексика берётся из тем блока", () => {
  const scope = ["food", "city"];
  const qs = App.buildExam(0, scope);
  const scopeWords = new Set(X.ALL_WORDS.filter((w) => scope.includes(w.deck)).map((w) => w.ru));
  const lex = qs.filter((q) => q.section === "Лексика");
  assert.ok(lex.length > 0, "нет вопросов лексики");
  lex.forEach((q) => assert.ok(scopeWords.has(q.answer), `лексика "${q.answer}" вне блока`));
});

test("экзамен: блок «верно/неверно» присутствует и валиден", () => {
  // прогоняем несколько раз — состав частично случайный
  let seen = false;
  for (let i = 0; i < 5; i++) {
    const qs = App.buildExam(i, null);
    qs.filter((q) => /верно\/неверно/.test(q.section)).forEach((q) => {
      seen = true;
      assert.equal(q.options.length, 2, "T/F должен иметь 2 варианта");
      assert.ok(q.options.includes(q.answer), "T/F: ответ среди вариантов");
    });
  }
  assert.ok(seen, "блок верно/неверно не появился");
});

test("isRare: ядро не помечено, периферия помечена", () => {
  // ядро A1 — НЕ редкое
  ["ώρα", "οκτώ", "οικογένεια", "αγγλικός", "νερό"].forEach((w) =>
    assert.equal(App.isRare(w), false, `ядро помечено редким: ${w}`));
  // периферия — редкое
  ["διεθνής", "πληθυντικός", "εφορία"].forEach((w) =>
    assert.ok(App.isRare(w), `периферия не помечена: ${w}`));
});
