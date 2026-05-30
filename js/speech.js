/* ============================================================
   Озвучка греческого через Web Speech API (SpeechSynthesis).
   Работает офлайн в большинстве браузеров. Если греческого
   голоса нет — мягко деградируем (кнопка просто молчит).
   ============================================================ */

const Speech = {
  voice: null,
  ready: false,
  supported: typeof window !== "undefined" && "speechSynthesis" in window,

  init() {
    if (!this.supported) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      // Ищем греческий голос (el-GR / el)
      this.voice =
        voices.find((v) => /^el(-|_|$)/i.test(v.lang)) ||
        voices.find((v) => /greek/i.test(v.name)) ||
        null;
      this.ready = voices.length > 0;
    };
    pick();
    // Голоса часто грузятся асинхронно
    window.speechSynthesis.onvoiceschanged = pick;
  },

  hasGreek() {
    return this.supported && !!this.voice;
  },

  // Произнести греческий текст. rate < 1 = медленнее.
  say(text, rate = 0.9) {
    if (!this.supported) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "el-GR";
    if (this.voice) u.voice = this.voice;
    u.rate = rate;
    u.pitch = 1;
    window.speechSynthesis.speak(u);
    return true;
  },

  stop() {
    if (this.supported) window.speechSynthesis.cancel();
  },
};

Speech.init();

/* ============================================================
   Распознавание речи (SpeechRecognition).
   Работает в Chrome/Edge и Android Chrome (нужен HTTPS + микрофон).
   В Safari/iOS не поддерживается — Recog.supported === false.
   ============================================================ */
const Recog = {
  SR: typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null,
  get supported() { return !!this.SR; },
  busy: false,

  // onResult(alternatives[]), onError(code), onStart()
  listen(onResult, onError, onStart) {
    if (!this.SR) { onError && onError("unsupported"); return; }
    if (this.busy) return;
    this.busy = true;
    let rec;
    try { rec = new this.SR(); }
    catch (e) { this.busy = false; onError && onError("init"); return; }
    rec.lang = "el-GR";
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    let got = false;
    rec.onstart = () => onStart && onStart();
    rec.onresult = (ev) => {
      got = true;
      const res = ev.results[0];
      const alts = [];
      for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
      onResult && onResult(alts);
    };
    rec.onerror = (ev) => { this.busy = false; onError && onError(ev.error || "error"); };
    rec.onend = () => { this.busy = false; if (!got) onError && onError("nomatch"); };
    try { rec.start(); }
    catch (e) { this.busy = false; onError && onError("start"); }
  },
};
