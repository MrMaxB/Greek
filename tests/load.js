/* Общий загрузчик: собирает весь контент и App в одном изолированном
   контексте (с заглушками DOM), чтобы тесты могли проверять и данные,
   и логику (buildTrack/buildExam/isRare…). Без зависимостей. */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.dirname(__dirname);
const read = (f) => fs.readFileSync(path.join(ROOT, "js", f), "utf8");

// Порядок как в index.html
const FILES = [
  "data.js", "grammar.js", "official_a1.js", "rare.js", "exercises.js",
  "writing.js", "reading.js", "exams.js", "srs.js", "speech.js",
  "app.js", "feat-track.js", "feat-speaking.js", "feat-exams.js",
];

let cached = null;

function load() {
  if (cached) return cached;
  // Минимальные заглушки браузерного окружения
  const noop = () => {};
  const elStub = { addEventListener: noop, classList: { toggle: noop, add: noop, remove: noop }, querySelector: () => null, querySelectorAll: () => [], focus: noop, value: "", innerHTML: "", textContent: "", dataset: {}, hidden: false };
  const sandbox = {
    console,
    window: { addEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }), scrollTo: noop },
    navigator: { language: "ru" },
    document: {
      addEventListener: noop, getElementById: () => null, querySelector: () => null,
      querySelectorAll: () => [], createElement: () => elStub, body: elStub, title: "",
    },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
    speechSynthesis: { getVoices: () => [], speak: noop, cancel: noop, addEventListener: noop },
    SpeechSynthesisUtterance: function () { return {}; },
    setInterval: () => 0, clearInterval: noop, setTimeout: () => 0, clearTimeout: noop,
    location: { hash: "", origin: "http://localhost" },
  };
  sandbox.window.localStorage = sandbox.localStorage;
  vm.createContext(sandbox);
  for (const f of FILES) {
    vm.runInContext(read(f), sandbox, { filename: f });
  }
  // const/let на верхнем уровне vm-контекста не попадают в sandbox-объект —
  // вытащим нужные глобалы явно через this в том же контексте.
  const EXPORTS = [
    "ALPHABET", "DIGRAPHS", "DECKS", "ALL_WORDS", "GRAMMAR_LESSONS", "DECLENSIONS",
    "CONJUGATIONS", "GrammarEx", "WRITING_ORDER", "WRITING_GAPS", "WRITING_SELF",
    "WRITING_OPEN", "SPEAKING_Q", "SPEAKING_DIALOGS", "READING_TEXTS", "READING_COMMON",
    "EXAM_READINGS", "OFFICIAL_A1", "RARE_A1", "App",
  ];
  vm.runInContext(
    EXPORTS.map((k) => `try{this.${k}=${k}}catch(e){}`).join(";"),
    sandbox
  );
  cached = sandbox;
  return sandbox;
}

module.exports = { load, ROOT, read };
