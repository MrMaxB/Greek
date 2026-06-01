/* ============================================================
   SRS — интервальные повторения (упрощённый SM-2 + стрик)
   Всё хранится в localStorage. Ничего не уходит в сеть.
   ============================================================ */

const SRS_KEY = "greekA1_srs_v1";
const STATS_KEY = "greekA1_stats_v1";
const NEW_PER_DAY = 15; // новых слов в день (устойчивый верх удержания; совпадает с обещанием «Пути»)

const SRS = {
  data: {},   // id -> { reps, interval, ease, due, lapses }
  stats: {},  // { streak, lastDay, learnedDates: {date: count}, totalReviews }

  load() {
    try { this.data = JSON.parse(localStorage.getItem(SRS_KEY)) || {}; }
    catch { this.data = {}; }
    try { this.stats = JSON.parse(localStorage.getItem(STATS_KEY)) || {}; }
    catch { this.stats = {}; }
    if (!this.stats.learnedDates) this.stats.learnedDates = {};
    if (!this.stats.totalReviews) this.stats.totalReviews = 0;
  },

  save() {
    localStorage.setItem(SRS_KEY, JSON.stringify(this.data));
    localStorage.setItem(STATS_KEY, JSON.stringify(this.stats));
    // Отправить в облако (если подключено и это не применение облачных данных)
    if (window.Cloud && window.Cloud.push && !window.Cloud._applying) window.Cloud.push();
  },

  today() {
    return new Date().toISOString().slice(0, 10);
  },

  // Карточка ещё не виделась
  isNew(id) {
    return !this.data[id];
  },

  // Карточки к повторению на сегодня (уже изученные, срок подошёл)
  dueCards(words) {
    const t = this.today();
    return words.filter((w) => {
      const c = this.data[w.id];
      return c && c.due <= t;
    });
  },

  // Новые карточки (с дневным лимитом)
  newCards(words, limit = NEW_PER_DAY) {
    const introducedToday = this.stats.learnedDates[this.today()] || 0;
    const remaining = Math.max(0, limit - introducedToday);
    return words.filter((w) => this.isNew(w.id)).slice(0, remaining);
  },

  // Очередь на сессию: сначала повторения, потом новые
  buildQueue(words, newLimit = NEW_PER_DAY) {
    return [...this.dueCards(words), ...this.newCards(words, newLimit)];
  },

  /* Оценка: 0 = не помню, 1 = трудно, 2 = хорошо, 3 = легко */
  grade(id, quality) {
    const t = this.today();
    let c = this.data[id];
    const wasNew = !c;
    if (!c) c = { reps: 0, interval: 0, ease: 2.5, lapses: 0 };

    if (quality === 0) {
      c.reps = 0;
      c.interval = 0;          // вернётся в эту же сессию / завтра
      c.lapses += 1;
      c.ease = Math.max(1.3, c.ease - 0.2);
    } else {
      c.reps += 1;
      if (c.reps === 1) c.interval = quality === 1 ? 1 : 1;
      else if (c.reps === 2) c.interval = quality === 1 ? 2 : 3;
      else c.interval = Math.round(c.interval * c.ease);

      // корректировка лёгкости
      if (quality === 1) c.ease = Math.max(1.3, c.ease - 0.15);
      else if (quality === 3) c.ease = c.ease + 0.1;

      if (quality === 1) c.interval = Math.max(1, Math.round(c.interval * 0.6));
      if (quality === 3) c.interval = Math.round(c.interval * 1.3);
    }

    c.interval = Math.max(0, c.interval);
    const due = new Date();
    due.setDate(due.getDate() + Math.max(c.interval, quality === 0 ? 0 : 1));
    c.due = due.toISOString().slice(0, 10);
    this.data[id] = c;

    // Статистика
    this.stats.totalReviews += 1;
    if (wasNew) {
      this.stats.learnedDates[t] = (this.stats.learnedDates[t] || 0) + 1;
    }
    this.touchStreak();
    this.save();
    return c;
  },

  // Обновление стрика (дни подряд с активностью).
  // Льготный день: пропуск ОДНОГО дня не рвёт стрик (gap=2 дня — прощаем,
  // как «заморозка» у Duolingo). Рвётся только при пропуске ≥2 дней подряд.
  touchStreak() {
    const t = this.today();
    if (this.stats.lastDay === t) return;
    const last = this.stats.lastDay;
    if (!last) { this.stats.streak = 1; this.stats.lastDay = t; this.stats.frozeOn = null; return; }
    const gap = Math.round((new Date(t) - new Date(last)) / 86400000);
    if (gap <= 2) {
      // вчера (gap=1) или один пропущенный день (gap=2) — стрик продолжается
      this.stats.streak = (this.stats.streak || 0) + 1;
      this.stats.frozeOn = gap === 2 ? t : (this.stats.frozeOn || null);
    } else {
      this.stats.streak = 1;
      this.stats.frozeOn = null;
    }
    this.stats.lastDay = t;
  },

  // Сводка прогресса
  summary(words) {
    let learned = 0, mature = 0;
    words.forEach((w) => {
      const c = this.data[w.id];
      if (c) {
        learned++;
        if (c.interval >= 7) mature++;
      }
    });
    return {
      total: words.length,
      learned,
      mature,
      due: this.dueCards(words).length,
      newToday: this.stats.learnedDates[this.today()] || 0,
      newPerDay: NEW_PER_DAY,
      streak: this.stats.streak || 0,
      totalReviews: this.stats.totalReviews || 0,
    };
  },

  reset() {
    localStorage.removeItem(SRS_KEY);
    localStorage.removeItem(STATS_KEY);
    this.data = {};
    this.stats = { learnedDates: {}, totalReviews: 0 };
  },
};

SRS.load();
window.SRS = SRS; // для облачной синхронизации (js/cloud.js)
