#!/usr/bin/env node
/* Чек тап-перевода: какие греческие слова в материалах НЕ имеют перевода
   в словаре приложения (ALL_WORDS + READING_COMMON + глоссы текстов +
   формы склонений/спряжений). Запуск: node tools/glosscheck.js
   Выход: список «осиротевших» слов с частотой — их надо добавить
   в READING_COMMON (js/reading.js). Код выхода 1, если есть пропуски. */
// единый загрузчик (всё в одном vm-контексте) — как в тестах
const X = require("../tests/load").load();

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ς/g, "σ").replace(/[;.,!·]/g, "").replace(/\s+/g, " ").trim();
const GREEK = /[Ͱ-Ͽἀ-῿]+/g;

// 1) словарь приложения (как globalGloss)
const gloss = new Set();
(X.ALL_WORDS || []).forEach((w) => { const k = norm(w.gr); if (k && !k.includes(" ")) gloss.add(k); });
Object.keys(X.READING_COMMON || {}).forEach((k) => gloss.add(norm(k)));
(X.READING_TEXTS || []).forEach((t) => Object.keys(t.gloss || {}).forEach((k) => gloss.add(norm(k))));
(X.DECLENSIONS || []).forEach((d) => Object.values(d.f).forEach((f) => f.split(" ").forEach((tok) => gloss.add(norm(tok)))));
(X.CONJUGATIONS || []).forEach((v) => Object.values(v.f).forEach((f) => gloss.add(norm(f))));

// 2) все тапаемые материалы
const freq = {};
const eat = (text, where) => {
  (String(text || "").match(GREEK) || []).forEach((w) => {
    if (w.length < 2) return;
    const k = norm(w);
    if (!gloss.has(k)) { (freq[k] = freq[k] || { n: 0, ex: w, where: new Set() }).n++; freq[k].where.add(where); }
  });
};
(X.READING_TEXTS || []).forEach((t) => (t.sents || []).forEach((s) => eat(s[0], "чтение")));
(X.GRAMMAR_LESSONS || []).forEach((g) => eat(g.body, "грамматика"));
(X.EXAM_READINGS || []).forEach((r) => { eat(r.gr, "экзамен"); (r.q || []).forEach((q) => { eat(q.ask, "экзамен"); (q.options || []).forEach((o) => eat(o, "экзамен")); }); });
(X.SPEAKING_DIALOGS || []).forEach((d) => (d.lines || []).forEach((l) => eat(l.gr, "диалог")));
(X.SPEAKING_Q || []).forEach((t) => { eat(t[0], "вопрос-ответ"); eat(t[2], "вопрос-ответ"); });

// приблизительный резолв (как App.resolveGloss): общая основа с леммой
const stems = [...gloss];
const resolvable = (w) => {
  for (const k of stems) {
    if (k.length < 3) continue;
    let i = 0; const m = Math.min(k.length, w.length);
    while (i < m && k[i] === w[i]) i++;
    if (i < 3) continue;
    if (i < k.length - 3 || i < w.length - 4) continue;
    if (Math.abs(k.length - w.length) > 5) continue;
    return true;
  }
  return false;
};
const miss = Object.entries(freq).filter(([k]) => !resolvable(k)).sort((a, b) => b[1].n - a[1].n);
console.log(`Словарь тап-перевода: ${gloss.size} ключей`);
console.log(`Слов в материалах БЕЗ перевода: ${miss.length}\n`);
if (miss.length) {
  miss.forEach(([k, v]) => console.log(`  ${v.ex.padEnd(18)} ×${String(v.n).padEnd(3)} [${[...v.where].join(",")}]`));
  process.exit(1);
}
console.log("✅ Все слова в материалах переводятся по тапу.");
