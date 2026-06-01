/* cloud.mergeState — слияние прогресса между устройствами. Баг здесь =
   тихая потеря данных пользователя. Грузим cloud.js в изоляции и достаём
   приватную mergeState через хук. node:test. */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function getMergeState() {
  const src = fs.readFileSync(path.join(path.dirname(__dirname), "js", "cloud.js"), "utf8");
  // cloud.js — ES-модуль с import; берём только тело mergeState (чистая функция).
  const m = src.match(/function mergeState\(a, b\) \{[\s\S]*?\n\}/);
  if (!m) throw new Error("mergeState не найдена в cloud.js");
  const sandbox = { console }; vm.createContext(sandbox);
  vm.runInContext(m[0] + "\nthis.mergeState = mergeState;", sandbox);
  return sandbox.mergeState;
}
const mergeState = getMergeState();

test("merge берёт карточку с большим числом повторов (не теряет прогресс)", () => {
  const a = { srs: { w1: { reps: 5, due: "2025-01-10" } } };
  const b = { srs: { w1: { reps: 2, due: "2025-02-01" } } };
  const r = mergeState(a, b);
  assert.equal(r.srs.w1.reps, 5, "должна победить более продвинутая карточка");
});

test("merge объединяет карточки с разных устройств", () => {
  const a = { srs: { w1: { reps: 1 } } };
  const b = { srs: { w2: { reps: 1 } } };
  const r = mergeState(a, b);
  assert.ok(r.srs.w1 && r.srs.w2, "обе карточки должны сохраниться");
});

test("merge берёт максимум стрика и сумм статистики", () => {
  const a = { stats: { streak: 3, totalReviews: 100, learnedDates: { "2025-01-01": 5 } } };
  const b = { stats: { streak: 7, totalReviews: 80, learnedDates: { "2025-01-02": 3 } } };
  const r = mergeState(a, b);
  assert.equal(r.stats.streak, 7);
  assert.equal(r.stats.totalReviews, 100);
  assert.equal(r.stats.learnedDates["2025-01-01"], 5);
  assert.equal(r.stats.learnedDates["2025-01-02"], 3);
});

test("merge берёт лучший результат экзамена", () => {
  const a = { exams: { "0": 70, "1": 50 } };
  const b = { exams: { "0": 55, "1": 90 } };
  const r = mergeState(a, b);
  assert.equal(r.exams["0"], 70);
  assert.equal(r.exams["1"], 90);
});

test("merge трека: больший день + объединение отметок", () => {
  const a = { track: { day: 5, done: { "1": [0, 1], "2": [0] } } };
  const b = { track: { day: 3, done: { "1": [2], "3": [0] } } };
  const r = mergeState(a, b);
  assert.equal(r.track.day, 5, "берём более продвинутый день");
  assert.deepEqual([...r.track.done["1"]].sort(), [0, 1, 2], "отметки дня объединяются");
  assert.ok(r.track.done["3"], "день только из b сохраняется");
});

test("merge устойчив к пустым/одностороним состояниям", () => {
  assert.doesNotThrow(() => mergeState({}, {}));
  const r = mergeState({ srs: { w1: { reps: 1 } } }, {});
  assert.ok(r.srs.w1, "односторонний прогресс не теряется");
});

test("merge не падает на не-объектном track (легаси/мусор из облака)", () => {
  assert.doesNotThrow(() => mergeState({ track: 5 }, { track: { day: 2, done: {} } }));
});
