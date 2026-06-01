/* Тап-перевод: каждое греческое слово в тапаемых материалах должно
   переводиться через App.resolveGloss (точное совпадение или морфо-фолбэк).
   Проверяем реальную рантайм-логику, а не её копию. node:test. */
const { test } = require("node:test");
const assert = require("node:assert");
const { load } = require("./load");

const X = load();
const App = X.App;
const norm = (s) => App.normGreek(s);

function collect() {
  const words = [];
  const eat = (text, where) => {
    App.tokenizeGreek(text).forEach((w) => { if (w.length >= 2) words.push([w, where]); });
  };
  (X.READING_TEXTS || []).forEach((t) => (t.sents || []).forEach((s) => eat(s[0], "чтение")));
  (X.GRAMMAR_LESSONS || []).forEach((g) => eat(g.body, "грамматика"));
  (X.EXAM_READINGS || []).forEach((r) => { eat(r.gr, "экзамен"); (r.q || []).forEach((q) => { eat(q.ask, "экзамен"); (q.options || []).forEach((o) => eat(o, "экзамен")); }); });
  (X.SPEAKING_DIALOGS || []).forEach((d) => (d.lines || []).forEach((l) => eat(l.gr, "диалог")));
  (X.SPEAKING_Q || []).forEach((t) => { eat(t[0], "Q&A"); eat(t[2], "Q&A"); });
  return words;
}

test("все слова материалов имеют тап-перевод", () => {
  const miss = [];
  const seen = new Set();
  for (const [w, where] of collect()) {
    const k = norm(w);
    if (seen.has(k)) continue; seen.add(k);
    if (!App.resolveGloss(k)) miss.push(`${w} [${where}]`);
  }
  assert.equal(miss.length, 0, `без перевода (${miss.length}): ${miss.slice(0, 20).join(", ")}`);
});
