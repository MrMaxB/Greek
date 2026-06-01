#!/usr/bin/env node
/* Чек тап-перевода: какие греческие слова в материалах НЕ имеют перевода
   в словаре приложения (ALL_WORDS + READING_COMMON + глоссы текстов +
   формы склонений/спряжений). Запуск: node tools/glosscheck.js
   Выход: список «осиротевших» слов с частотой — их надо добавить
   в READING_COMMON (js/reading.js). Код выхода 1, если есть пропуски. */
// единый загрузчик (всё в одном vm-контексте) — как в тестах
const X = require("../tests/load").load();

const App = X.App;
const norm = (s) => App.normGreek(s);
const tok = (s) => App.tokenizeGreek(s);

// Используем РОВНО прод-функции: словарь = App.globalGloss(), резолв с
// морфо-фолбэком = App.resolveGloss. Так чек проверяет то, что видит юзер.
const gloss = App.globalGloss();

// все тапаемые материалы
const freq = {};
const eat = (text, where) => {
  tok(text).forEach((w) => {
    if (w.length < 2) return;
    const k = norm(w);
    if (!App.resolveGloss(k)) { (freq[k] = freq[k] || { n: 0, ex: w, where: new Set() }).n++; freq[k].where.add(where); }
  });
};
(X.READING_TEXTS || []).forEach((t) => (t.sents || []).forEach((s) => eat(s[0], "чтение")));
(X.GRAMMAR_LESSONS || []).forEach((g) => eat(g.body, "грамматика"));
(X.EXAM_READINGS || []).forEach((r) => { eat(r.gr, "экзамен"); (r.q || []).forEach((q) => { eat(q.ask, "экзамен"); (q.options || []).forEach((o) => eat(o, "экзамен")); }); });
(X.SPEAKING_DIALOGS || []).forEach((d) => (d.lines || []).forEach((l) => eat(l.gr, "диалог")));
(X.SPEAKING_Q || []).forEach((t) => { eat(t[0], "вопрос-ответ"); eat(t[2], "вопрос-ответ"); });

// freq уже содержит только слова, которые App.resolveGloss НЕ смог перевести
const miss = Object.entries(freq).sort((a, b) => b[1].n - a[1].n);
console.log(`Словарь тап-перевода: ${Object.keys(gloss).length} ключей`);
console.log(`Слов в материалах БЕЗ перевода: ${miss.length}\n`);
if (miss.length) {
  miss.forEach(([k, v]) => console.log(`  ${v.ex.padEnd(18)} ×${String(v.n).padEnd(3)} [${[...v.where].join(",")}]`));
  process.exit(1);
}
console.log("✅ Все слова в материалах переводятся по тапу.");
