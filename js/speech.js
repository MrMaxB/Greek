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
