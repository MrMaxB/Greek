/* Тест-сьют на весь контент и генераторы. Запуск: node tools/test.js
   Грузит data/grammar/exercises/writing/reading/exams в один контекст,
   проверяет целостность и логику, печатает ошибки. Exit 1 при провале. */
const fs = require("fs");
const path = require("path");
const ROOT = path.dirname(__dirname);
const read = (f) => fs.readFileSync(path.join(ROOT, "js", f), "utf8");

const errors = [];
const warns = [];
const E = (m) => errors.push(m);
const W = (m) => warns.push(m);

function norm(s) {
  s = (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return s.replace(/ς/g, "σ").replace(/[;.,!·»«]/g, "").replace(/\s+/g, " ").trim();
}
const GK = (t) => (t.match(/[Ͱ-Ͽἀ-῿]+/g) || []);

// грузим контент в один scope
const bundle = read("data.js") + "\n" + read("grammar.js") + "\n" + read("exercises.js") +
  "\n" + read("writing.js") + "\n" + read("reading.js") + "\n" + read("exams.js") +
  "\n;globalThis.__X = {DECKS,ALL_WORDS,GRAMMAR_LESSONS,DECLENSIONS,CONJUGATIONS,GrammarEx,WRITING_ORDER,WRITING_GAPS,WRITING_SELF,READING_TEXTS,READING_COMMON,EXAM_READINGS};";
eval(bundle);
const X = globalThis.__X;

/* ---- словарь ---- */
const ids = new Set();
X.ALL_WORDS.forEach((w) => {
  if (!w.gr || !w.tr || !w.ru) E(`пустое поле в слове ${JSON.stringify(w)}`);
  if (ids.has(w.id)) E(`дубль id ${w.id}`); ids.add(w.id);
  if (w.gr !== w.gr.trim()) E(`пробелы вокруг "${w.gr}"`);
});
// дубли греческого слова между темами
const grcount = {};
X.ALL_WORDS.forEach((w) => { const k = norm(w.gr); grcount[k] = (grcount[k] || 0) + 1; });
Object.entries(grcount).filter(([, c]) => c > 1).forEach(([k, c]) => W(`греч. слово встречается в ${c} темах: ${k}`));

/* ---- темы ---- */
const deckIds = new Set();
X.DECKS.forEach((d) => {
  if (!d.id || !d.title || !d.icon) E(`тема без id/title/icon: ${d.id}`);
  if (deckIds.has(d.id)) E(`дубль id темы ${d.id}`); deckIds.add(d.id);
  if (!d.words || !d.words.length) E(`пустая тема ${d.id}`);
});

/* ---- грамматика ---- */
const lessonIds = new Set();
X.GRAMMAR_LESSONS.forEach((g) => {
  if (lessonIds.has(g.id)) E(`дубль id урока ${g.id}`); lessonIds.add(g.id);
  if (!g.title || !g.body) E(`урок без title/body: ${g.id}`);
});

/* ---- склонения ---- */
const ART = { "м": "ο", "ж": "η", "ср": "το" }, ACC = { "м": "τον", "ж": ["την", "τη"], "ср": "το" };
X.DECLENSIONS.forEach((d) => {
  ["nomS", "genS", "accS", "nomP", "genP", "accP"].forEach((k) => { if (!d.f[k]) E(`скл. ${d.word}: пустая форма ${k}`); });
  if (!["м", "ж", "ср"].includes(d.g)) E(`скл. ${d.word}: род "${d.g}"`);
  const a0 = (d.f.nomS || "").split(" ")[0];
  if (a0 !== ART[d.g]) E(`скл. ${d.word}: им.ед артикль "${a0}" ≠ ${ART[d.g]}`);
  const ac = (d.f.accS || "").split(" ")[0];
  const okAcc = Array.isArray(ACC[d.g]) ? ACC[d.g].includes(ac) : ac === ACC[d.g];
  if (!okAcc) E(`скл. ${d.word}: вин.ед артикль "${ac}"`);
  if (new Set(Object.values(d.f)).size < 4) W(`скл. ${d.word}: <4 уник. форм`);
});

/* ---- спряжения ---- */
X.CONJUGATIONS.forEach((v) => {
  ["s1", "s2", "s3", "p1", "p2", "p3"].forEach((k) => { if (!v.f[k]) E(`спр. ${v.word}: пустая форма ${k}`); });
  if (v.f.s1 !== v.word) W(`спр. ${v.word}: s1 (${v.f.s1}) ≠ словарной форме`);
});

/* ---- генераторы упражнений ---- */
let exTotal = 0;
const genKeys = [];
X.GRAMMAR_LESSONS.forEach((g) => {
  if (!X.GrammarEx.has(g.id)) { if (g.id !== "read") W(`тема "${g.id}" без упражнений`); return; }
  genKeys.push(g.id);
  const items = X.GrammarEx.gen(g.id);
  if (!items.length) E(`ген. ${g.id}: 0 заданий`);
  exTotal += items.length;
  items.forEach((q, i) => {
    if (!q.q || /undefined|NaN/.test(q.q)) E(`ген. ${g.id}#${i}: плохой вопрос`);
    if (!q.opts || q.opts.length < 2) E(`ген. ${g.id}#${i}: <2 вариантов`);
    if (!q.opts.includes(q.ans)) E(`ген. ${g.id}#${i}: ответ "${q.ans}" не среди вариантов`);
    if (new Set(q.opts).size !== q.opts.length) E(`ген. ${g.id}#${i}: дубль-варианты`);
  });
});

/* ---- письмо ---- */
X.WRITING_GAPS.forEach((g, i) => {
  if (!g.options.includes(g.answer)) E(`gap#${i}: ответ не среди вариантов`);
  if (!g.parts || g.parts.length !== 2) E(`gap#${i}: parts ≠ 2`);
});
X.WRITING_ORDER.forEach((s, i) => {
  if (!s.tokens || s.tokens.length < 2 || !s.ru) E(`order#${i}: плохая запись`);
  // alt-порядок должен быть перестановкой тех же слов (защита от опечаток)
  if (s.alt) {
    const key = (a) => a.map((t) => t.toLowerCase()).sort().join("|");
    const base = key(s.tokens);
    s.alt.forEach((a) => { if (key(a.split(/\s+/)) !== base) E(`order#${i}: alt не является перестановкой токенов: "${a}"`); });
  }
});
X.WRITING_SELF.forEach((s, i) => { if (!s.ask || !s.model) E(`self#${i}: нет ask/model`); });

/* ---- чтение ---- */
const rIds = new Set();
const gloss0 = {};
X.ALL_WORDS.forEach((w) => { const k = norm(w.gr); if (k && !k.includes(" ")) gloss0[k] = 1; });
Object.keys(X.READING_COMMON).forEach((k) => gloss0[norm(k)] = 1);
let uncovered = 0, wordsTotal = 0;
X.READING_TEXTS.forEach((t) => {
  if (rIds.has(t.id)) E(`дубль id текста ${t.id}`); rIds.add(t.id);
  if (!t.titleRu || !["A0", "A0+", "A1"].includes(t.level)) E(`текст ${t.id}: level/titleRu`);
  const g = Object.assign({}, gloss0); Object.keys(t.gloss || {}).forEach((k) => g[norm(k)] = 1);
  (t.sents || []).forEach((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !p[0] || !p[1]) E(`текст ${t.id}: плохое предложение`);
    GK(p[0]).forEach((wd) => { wordsTotal++; if (!g[norm(wd)]) uncovered++; });
  });
});
if (uncovered / wordsTotal > 0.05) W(`чтение: без тап-перевода ${uncovered}/${wordsTotal} (${Math.round(100 * uncovered / wordsTotal)}%)`);

/* ---- экзамены ---- */
X.EXAM_READINGS.forEach((r, i) => {
  if (!r.q || !r.q.length) E(`экзамен#${i}: нет вопросов`);
  (r.q || []).forEach((q, j) => {
    if (!q.options.includes(q.answer)) E(`экзамен#${i}.${j}: ответ не среди вариантов`);
    if (q.options.length < 2) E(`экзамен#${i}.${j}: <2 вариантов`);
  });
});

/* ---- итог ---- */
console.log(`Проверено: ${X.ALL_WORDS.length} слов, ${X.DECKS.length} тем, ${X.GRAMMAR_LESSONS.length} уроков, ${X.DECLENSIONS.length} скл., ${X.CONJUGATIONS.length} спр., ${exTotal} упражнений (${genKeys.length} тем), ${X.READING_TEXTS.length} текстов, ${X.EXAM_READINGS.length} экзаменов.`);
if (warns.length) { console.log(`\n⚠️  Предупреждений: ${warns.length}`); warns.slice(0, 40).forEach((w) => console.log("  - " + w)); }
if (errors.length) { console.log(`\n❌ ОШИБОК: ${errors.length}`); errors.forEach((e) => console.log("  - " + e)); process.exit(1); }
console.log("\n✅ Все проверки пройдены.");
