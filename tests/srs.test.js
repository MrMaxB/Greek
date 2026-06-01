/* SRS-движок: интервалы, лимит новых, стрик. Ядро удержания. node:test.
   Грузим srs.js в изоляции со stub localStorage (без сети/облака). */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function freshSRS() {
  const sandbox = {
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    window: {}, console,
  };
  sandbox.window.localStorage = sandbox.localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(path.dirname(__dirname), "js", "srs.js"), "utf8") + "\nthis.SRS = SRS;", sandbox);
  return sandbox.SRS;
}

test("новое слово после оценки становится изученным", () => {
  const S = freshSRS();
  assert.ok(S.isNew("w1"));
  S.grade("w1", 2);
  assert.ok(!S.isNew("w1"));
  assert.equal(S.data.w1.reps, 1);
});

test("оценка «не помню» (0) сбрасывает reps и копит lapses", () => {
  const S = freshSRS();
  S.grade("w1", 3); S.grade("w1", 3);
  assert.ok(S.data.w1.reps >= 2);
  S.grade("w1", 0);
  assert.equal(S.data.w1.reps, 0);
  assert.equal(S.data.w1.lapses, 1);
});

test("интервал растёт при успешных повторах", () => {
  const S = freshSRS();
  S.grade("w1", 2); const i1 = S.data.w1.interval;
  S.grade("w1", 2); const i2 = S.data.w1.interval;
  S.grade("w1", 2); const i3 = S.data.w1.interval;
  assert.ok(i2 >= i1 && i3 > i2, `интервалы не растут: ${i1},${i2},${i3}`);
});

test("лимит новых слов в день соблюдается (newPerDay)", () => {
  const S = freshSRS();
  const lim = S.summary([]).newPerDay;
  const words = Array.from({ length: lim + 10 }, (_, i) => ({ id: "w" + i }));
  const news = S.newCards(words);
  assert.equal(news.length, lim, `выдал ${news.length}, ожидалось ${lim}`);
});

test("dueCards возвращает только подошедшие по сроку", () => {
  const S = freshSRS();
  S.grade("w1", 3); // интервал в будущее
  const due = S.dueCards([{ id: "w1" }]);
  assert.equal(due.length, 0, "только что оценённое не должно быть due сегодня");
});

test("стрик растёт со вчера и сбрасывается при пропуске", () => {
  const S = freshSRS();
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  // как будто занимались вчера
  S.stats.lastDay = iso(yest); S.stats.streak = 4;
  S.touchStreak();
  assert.equal(S.stats.streak, 5, "должен продолжиться");
  // пропуск: последний день — позавчера
  const before = new Date(); before.setDate(before.getDate() - 3);
  S.stats.lastDay = iso(before); S.stats.streak = 9;
  S.touchStreak();
  assert.equal(S.stats.streak, 1, "после пропуска стрик = 1");
});
