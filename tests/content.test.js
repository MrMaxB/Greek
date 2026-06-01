/* Целостность контента: словарь, темы, грамматика, склонения, спряжения,
   генераторы упражнений, письмо, чтение, экзамены. node:test. */
const { test } = require("node:test");
const assert = require("node:assert");
const { load } = require("./load");

const X = load();
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ς/g, "σ").replace(/[;.,!·»«]/g, "").replace(/\s+/g, " ").trim();
const GK = (t) => (t.match(/[Ͱ-Ͽἀ-῿]+/g) || []);

test("словарь: поля, id, без лишних пробелов", () => {
  const ids = new Set();
  for (const w of X.ALL_WORDS) {
    assert.ok(w.gr && w.tr && w.ru, `пустое поле: ${JSON.stringify(w)}`);
    assert.ok(!ids.has(w.id), `дубль id ${w.id}`); ids.add(w.id);
    assert.equal(w.gr, w.gr.trim(), `пробелы вокруг "${w.gr}"`);
  }
});

test("темы: id/title/icon, непустые, уникальные", () => {
  const seen = new Set();
  for (const d of X.DECKS) {
    assert.ok(d.id && d.title && d.icon, `тема без id/title/icon: ${d.id}`);
    assert.ok(!seen.has(d.id), `дубль id темы ${d.id}`); seen.add(d.id);
    assert.ok(d.words && d.words.length, `пустая тема ${d.id}`);
  }
});

test("грамматика: уникальные id, есть title/body", () => {
  const seen = new Set();
  for (const g of X.GRAMMAR_LESSONS) {
    assert.ok(!seen.has(g.id), `дубль id урока ${g.id}`); seen.add(g.id);
    assert.ok(g.title && g.body, `урок без title/body: ${g.id}`);
  }
});

test("грамматика: нумерация уроков без пропусков", () => {
  const nums = X.GRAMMAR_LESSONS.map((g) => (g.title.match(/^(\d+)\./) || [])[1]).filter(Boolean).map(Number);
  for (let i = 1; i < nums.length; i++) {
    assert.ok(nums[i] === nums[i - 1] + 1 || nums[i] === nums[i - 1], `пропуск в нумерации: ${nums[i - 1]} → ${nums[i]}`);
  }
});

test("склонения: 6 форм, артикль ↔ род", () => {
  const ART = { "м": "ο", "ж": "η", "ср": "το" };
  for (const d of X.DECLENSIONS) {
    ["nomS", "genS", "accS", "nomP", "genP", "accP"].forEach((k) => assert.ok(d.f[k], `скл. ${d.word}: пустая форма ${k}`));
    assert.ok(["м", "ж", "ср"].includes(d.g), `скл. ${d.word}: род "${d.g}"`);
    const a0 = d.f.nomS.split(" ")[0];
    assert.equal(a0, ART[d.g], `скл. ${d.word}: им.ед артикль "${a0}"`);
  }
});

test("спряжения: 6 лиц заполнены", () => {
  for (const v of X.CONJUGATIONS) {
    ["s1", "s2", "s3", "p1", "p2", "p3"].forEach((k) => assert.ok(v.f[k], `спр. ${v.word}: пустая форма ${k}`));
  }
});

test("генераторы упражнений: ответ среди вариантов, без дублей", () => {
  const ids = X.GRAMMAR_LESSONS.map((g) => g.id).filter((id) => X.GrammarEx.has(id));
  assert.ok(ids.length > 0, "нет генераторов");
  for (const id of ids) {
    const items = X.GrammarEx.gen(id);
    assert.ok(items.length, `ген. ${id}: 0 заданий`);
    items.forEach((q, i) => {
      assert.ok(q.q && !/undefined|NaN/.test(q.q), `ген. ${id}#${i}: плохой вопрос`);
      assert.ok(q.opts && q.opts.length >= 2, `ген. ${id}#${i}: <2 вариантов`);
      assert.ok(q.opts.includes(q.ans), `ген. ${id}#${i}: ответ "${q.ans}" не среди вариантов`);
      assert.equal(new Set(q.opts).size, q.opts.length, `ген. ${id}#${i}: дубль-варианты`);
    });
  }
});

test("письмо: пропуски корректны", () => {
  X.WRITING_GAPS.forEach((g, i) => {
    assert.ok(g.options.includes(g.answer), `gap#${i}: ответ не среди вариантов`);
    assert.equal(g.parts.length, 2, `gap#${i}: parts ≠ 2`);
  });
});

test("письмо: конструктор и alt-перестановки", () => {
  X.WRITING_ORDER.forEach((s, i) => {
    assert.ok(s.tokens && s.tokens.length >= 2 && s.ru, `order#${i}: плохая запись`);
    if (s.alt) {
      const key = (a) => a.map((t) => t.toLowerCase()).sort().join("|");
      const base = key(s.tokens);
      s.alt.forEach((a) => assert.equal(key(a.split(/\s+/)), base, `order#${i}: alt не перестановка: "${a}"`));
    }
  });
  X.WRITING_ORDER.forEach((s, i) => assert.ok(s.ru, `order#${i}: нет ru`));
});

test("письмо: нет дублей русских подсказок в конструкторе", () => {
  const seen = {};
  X.WRITING_ORDER.forEach((s) => { seen[s.ru] = (seen[s.ru] || 0) + 1; });
  const dups = Object.entries(seen).filter(([, c]) => c > 1).map(([k]) => k);
  assert.equal(dups.length, 0, `дубли подсказок: ${dups.join(", ")}`);
});

test("чтение: id уникальны, level/titleRu заданы, предложения парные", () => {
  const ids = new Set();
  X.READING_TEXTS.forEach((t) => {
    assert.ok(!ids.has(t.id), `дубль id текста ${t.id}`); ids.add(t.id);
    assert.ok(t.titleRu && ["A0", "A0+", "A1"].includes(t.level), `текст ${t.id}: level/titleRu`);
    (t.sents || []).forEach((p) => {
      assert.ok(Array.isArray(p) && p.length === 2 && p[0] && p[1], `текст ${t.id}: плохое предложение`);
    });
  });
});

test("экзамены: вопросы есть, ответ среди вариантов", () => {
  X.EXAM_READINGS.forEach((r, i) => {
    assert.ok(r.q && r.q.length, `экзамен#${i}: нет вопросов`);
    r.q.forEach((q, j) => {
      assert.ok(q.options.includes(q.answer), `экзамен#${i}.${j}: ответ не среди вариантов`);
      assert.ok(q.options.length >= 2, `экзамен#${i}.${j}: <2 вариантов`);
    });
  });
});

test("rare: все помеченные есть в словаре и в офиц. A1", () => {
  const deck = new Set(X.ALL_WORDS.map((w) => norm(w.gr)));
  const off = new Set(X.OFFICIAL_A1);
  for (const w of X.RARE_A1) {
    assert.ok(deck.has(w), `rare "${w}" нет в словаре`);
    assert.ok(off.has(w), `rare "${w}" нет в офиц. A1`);
  }
});

module.exports = { X, norm, GK };
