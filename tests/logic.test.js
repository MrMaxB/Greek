/* Логика приложения: учебный трек и сборка экзаменов. node:test. */
const { test } = require("node:test");
const assert = require("node:assert");
const { load } = require("./load");

const X = load();
const App = X.App;

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

test("трек: родственные темы кластеризованы (не разбросаны)", () => {
  const days = App.buildTrack();
  const fam = (id) => id.replace(/[0-9]+$/, "").replace(/_freq$|_life$/, "");
  const dayOf = {};
  days.forEach((d, i) => d.tasks.forEach((t) => { if (t.t === "deck" && dayOf[t.ref] == null) dayOf[t.ref] = i; }));
  const byFam = {};
  Object.entries(dayOf).forEach(([id, day]) => { (byFam[fam(id)] = byFam[fam(id)] || []).push(day); });
  let worst = 0;
  Object.values(byFam).forEach((ds) => { if (ds.length > 1) worst = Math.max(worst, Math.max(...ds) - Math.min(...ds)); });
  assert.ok(worst <= 20, `тема разбросана на ${worst} дней (ожидалось ≤20)`);
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
