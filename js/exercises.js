/* ============================================================
   Ελληνικά A1 — УПРАЖНЕНИЯ ПО ТЕМАМ ГРАММАТИКИ
   Для каждого урока — генератор заданий (выбор варианта),
   от простого к сложному. Большие темы генерируются из данных
   (DECLENSIONS/CONJUGATIONS/словарь), узкие — из банков.
   GrammarEx.gen(lessonId) -> [{q, opts:[...], ans, lvl}]
   ============================================================ */
const GrammarEx = (() => {
  const sh = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const uniq = (a) => [...new Set(a)];
  // варианты: ответ ГАРАНТИРОВАННО внутри + 2 разных дистрактора
  const mk = (ans, pool) => sh([ans, ...uniq(sh(pool).filter((x) => x !== ans)).slice(0, 2)]);
  const noun = (n) => n.f.nomS.replace(/^(ο|η|το)\s+/, ""); // слово без артикля

  // прилагательные: муж/жен/ср
  const ADJ = [
    { m: "καλός", f: "καλή", n: "καλό", ru: "хороший" },
    { m: "μεγάλος", f: "μεγάλη", n: "μεγάλο", ru: "большой" },
    { m: "μικρός", f: "μικρή", n: "μικρό", ru: "маленький" },
    { m: "ωραίος", f: "ωραία", n: "ωραίο", ru: "красивый" },
    { m: "νέος", f: "νέα", n: "νέο", ru: "новый" },
    { m: "ζεστός", f: "ζεστή", n: "ζεστό", ru: "тёплый" },
    { m: "κρύος", f: "κρύα", n: "κρύο", ru: "холодный" },
    { m: "όμορφος", f: "όμορφη", n: "όμορφο", ru: "красивый" },
    { m: "ψηλός", f: "ψηλή", n: "ψηλό", ru: "высокий" },
    { m: "καθαρός", f: "καθαρή", n: "καθαρό", ru: "чистый" },
  ];
  const G = { "м": "m", "ж": "f", "ср": "n" };

  const gens = {
    // 2. Род и артикль
    gender() {
      const out = [];
      DECLENSIONS.forEach((d) => {
        const w = noun(d), g = d.g;
        out.push({ q: `Артикль (им.п.): ___ ${w} <span class="muted small">(${d.ru})</span>`, opts: ["ο", "η", "το"], ans: { "м": "ο", "ж": "η", "ср": "το" }[g], lvl: 1 });
        out.push({ q: `Артикль (вин.п.): Βλέπω ___ ${w} <span class="muted small">(вижу ${d.ru})</span>`, opts: ["τον", "την", "το"], ans: { "м": "τον", "ж": "την", "ср": "το" }[g], lvl: 2 });
      });
      return out;
    },
    // 12. Прилагательные — согласование
    adjectives() {
      const out = [];
      DECLENSIONS.forEach((d) => {
        const a = ADJ[Math.floor(Math.random() * ADJ.length)];
        const art = { "м": "ο", "ж": "η", "ср": "το" }[d.g];
        const ans = a[G[d.g]];
        out.push({ q: `${art} ___ ${noun(d)} <span class="muted small">(${a.ru} ${d.ru})</span>`, opts: sh([a.m, a.f, a.n]), ans, lvl: d.g === "ср" ? 1 : 2 });
      });
      return out;
    },
    // 11. Притяжение
    possessive() {
      const P = [["μου", "мой"], ["σου", "твой"], ["του", "его"], ["της", "её"], ["μας", "наш"], ["σας", "ваш"], ["τους", "их"]];
      return sh(DECLENSIONS).slice(0, 30).map((d) => {
        const p = P[Math.floor(Math.random() * P.length)];
        const others = sh(P.filter((x) => x[0] !== p[0])).slice(0, 2).map((x) => x[0]);
        return { q: `${d.f.nomS} ___ <span class="muted small">(${p[1]} ${d.ru})</span>`, opts: sh([p[0], ...others]), ans: p[0], lvl: 1 };
      });
    },
    // 14. Предлоги: σε + артикль
    prepositions() {
      return sh(DECLENSIONS).slice(0, 30).map((d) => {
        const ans = { "м": "στον", "ж": "στη", "ср": "στο" }[d.g];
        return { q: `Πάω ___ ${noun(d)} <span class="muted small">(иду в/на ${d.ru})</span>`, opts: ["στον", "στη", "στο"], ans, lvl: 2 };
      });
    },
    // 16. Мне нравится
    likes() {
      const out = [];
      DECLENSIONS.forEach((d) => {
        const pl = d.f.nomP, sg = d.f.nomS;
        out.push({ q: `Μου ___ ${sg} <span class="muted small">(мне нравится ${d.ru})</span>`, opts: ["αρέσει", "αρέσουν", "αρέσω"], ans: "αρέσει", lvl: 1 });
        out.push({ q: `Μου ___ ${pl} <span class="muted small">(мне нравятся, мн.)</span>`, opts: ["αρέσουν", "αρέσει", "αρέσω"], ans: "αρέσουν", lvl: 2 });
      });
      return out;
    },
    // 15. Числа: один/одна/одно
    numbers() {
      const out = [];
      DECLENSIONS.forEach((d) => {
        const ans = { "м": "ένας", "ж": "μία", "ср": "ένα" }[d.g];
        out.push({ q: `___ ${noun(d)} <span class="muted small">(один/одна/одно ${d.ru})</span>`, opts: ["ένας", "μία", "ένα"], ans, lvl: 1 });
      });
      [["м", "τρεις"], ["ж", "τρεις"], ["ср", "τρία"]].forEach(() => {});
      return out;
    },
    // 7. είμαι / έχω
    "be-have"() { return conj(["είμαι", "έχω"]); },
    // 8. наст. время, группа А
    "verb-a"() { return conj(CONJUGATIONS.filter((v) => v.grp === "А").map((v) => v.word)); },
    // 9. наст. время, группа Б
    "verb-b"() { return conj(CONJUGATIONS.filter((v) => v.grp === "Б").map((v) => v.word)); },
    // падежи
    cases() { return decl(); },
    "decl-m"() { return decl("м"); },
    "decl-f"() { return decl("ж"); },
    "decl-n"() { return decl("ср"); },
    // 20. Прошедшее (банк неправильных)
    past() {
      const B = [["είμαι", "ήμουν", "быть"], ["έχω", "είχα", "иметь"], ["πηγαίνω", "πήγα", "идти"], ["τρώω", "έφαγα", "есть"], ["βλέπω", "είδα", "видеть"], ["λέω", "είπα", "говорить"], ["πίνω", "ήπια", "пить"], ["κάνω", "έκανα", "делать"], ["παίρνω", "πήρα", "брать"], ["δίνω", "έδωσα", "давать"], ["βρίσκω", "βρήκα", "находить"], ["έρχομαι", "ήρθα", "приходить"]];
      const all = B.map((x) => x[1]);
      return B.map(([pres, pa, ru]) => ({ q: `Прошедшее (я) от «${pres}» <span class="muted small">(${ru})</span>`, opts: sh(uniq([pa, ...sh(all.filter((x) => x !== pa)).slice(0, 2)])), ans: pa, lvl: 2 }));
    },
    // 19/21. Будущее θα
    future() {
      const B = [["πάω", "θα πάω", "пойду"], ["φάω", "θα φάω", "поем"], ["δω", "θα δω", "увижу"], ["έρθω", "θα έρθω", "приду"], ["πιω", "θα πιω", "выпью"], ["γράψω", "θα γράψω", "напишу"], ["διαβάσω", "θα διαβάσω", "почитаю"], ["αγοράσω", "θα αγοράσω", "куплю"], ["δουλέψω", "θα δουλέψω", "поработаю"], ["μείνω", "θα μείνω", "останусь"]];
      return B.map(([v, ans, ru]) => ({ q: `Завтра я ___ <span class="muted small">(${ru})</span>`, opts: sh([ans, v, "θα " + v + "ε"]).slice(0, 3), ans, lvl: 2 }));
    },
    // 22. να
    na() {
      const B = [["Θέλω ___ φάω.", "хочу поесть"], ["Πρέπει ___ πάω.", "надо идти"], ["Μπορώ ___ βοηθήσω;", "могу помочь"], ["Μου αρέσει ___ διαβάζω.", "нравится читать"], ["Θέλω ___ πιω νερό.", "хочу выпить воды"], ["Πρέπει ___ δουλέψω.", "надо работать"], ["Μπορείς ___ έρθεις;", "можешь прийти"], ["Θέλει ___ κοιμηθεί.", "хочет спать"]];
      return B.map(([q, ru]) => ({ q: `${q} <span class="muted small">(${ru})</span>`, opts: sh(["να", "θα", "δεν"]), ans: "να", lvl: 1 }));
    },
    // 23. Союзы
    conj() {
      const B = [["ψωμί ___ τυρί", "και", "и"], ["καφέ ___ τσάι;", "ή", "или"], ["μικρό ___ ωραίο", "αλλά", "но"], ["___ δεν ήρθες;", "γιατί", "почему"], ["___ πάω σπίτι, τρώω.", "όταν", "когда"], ["___ θέλεις, έλα.", "αν", "если"], ["Λέει ___ είναι καλά.", "ότι", "что"], ["ο φίλος ___ μένει εδώ", "που", "который"]];
      return B.map(([q, ans, ru]) => ({ q: `${q} <span class="muted small">(${ru})</span>`, opts: mk(ans, ["και", "αλλά", "ότι", "ή", "όταν", "αν", "που", "γιατί"]), ans, lvl: 2 }));
    },
    // 18. Повелительное
    imperative() {
      const B = [["приходи (ты)", "έλα", "ελάτε"], ["приходите (вы)", "ελάτε", "έλα"], ["скажи (ты)", "πες", "πείτε"], ["дай (ты)", "δώσε", "δώστε"], ["подожди (ты)", "περίμενε", "περιμένετε"], ["садитесь (вы)", "καθίστε", "κάτσε"]];
      return B.map(([ru, ans, other]) => ({ q: `Как сказать: «${ru}»?`, opts: sh([ans, other, "παρακαλώ"]), ans, lvl: 1 }));
    },
    // 10. Местоимения (слабые, вин.)
    pronouns() {
      const B = [["___ λένε Μαξ.", "Με", "меня зовут"], ["___ ξέρω.", "Σε", "тебя знаю"], ["___ βλέπω (его).", "Τον", "его вижу"], ["___ βλέπω (её).", "Την", "её вижу"], ["___ ευχαριστώ.", "Σας", "вас благодарю"], ["___ βοηθάει (нас).", "Μας", "нам помогает"]];
      return B.map(([q, ans, ru]) => ({ q: `${q} <span class="muted small">(${ru})</span>`, opts: mk(ans, ["Με", "Σε", "Τον", "Την", "Σας", "Μας"]), ans, lvl: 2 }));
    },
    // 17. Время (часы)
    time() {
      const B = [["3:00", "τρεις", "η ώρα"], ["3:15", "τρεις και τέταρτο", "+15"], ["3:30", "τρεις και μισή", "+30"], ["4:45", "πέντε παρά τέταρτο", "без 15 пять"], ["в 8", "στις οχτώ", "время"], ["в час", "στη μία", "1:00"]];
      return B.map(([ru, ans]) => ({ q: `Как сказать: «${ru}»?`, opts: mk(ans, ["τρεις και δέκα", "στις δέκα", "δώδεκα", "τρεις", "στη μία", "τρεις και μισή"]), ans, lvl: 2 }));
    },
    // 13. Отрицание и вопросы
    "neg-q"() {
      const B = [["___ καταλαβαίνω. (не понимаю)", "Δεν"], ["___ είσαι; (кто ты)", "Ποιος"], ["___ μένεις; (где живёшь)", "Πού"], ["___ ώρα είναι; (который час)", "Τι"], ["___ κάνεις; (как дела)", "Πώς"], ["___ κοστίζει; (сколько стоит)", "Πόσο"]];
      const pool = ["Δεν", "Ποιος", "Πού", "Τι", "Πώς", "Πόσο", "Πότε"];
      return B.map(([q, ans]) => ({ q, opts: sh(uniq([ans, ...sh(pool.filter((x) => x !== ans)).slice(0, 2)])), ans, lvl: 1 }));
    },
  };

  function conj(words) {
    const PERS = [["s2", "εσύ"], ["s3", "αυτός/-ή"], ["p1", "εμείς"], ["p2", "εσείς"], ["p3", "αυτοί"]];
    const out = [];
    words.forEach((w) => {
      const v = CONJUGATIONS.find((x) => x.word === w); if (!v) return;
      PERS.forEach(([k, lbl]) => {
        out.push({ q: `${lbl} ___ <span class="muted small">(${v.ru})</span>`, opts: mk(v.f[k], Object.values(v.f)), ans: v.f[k], lvl: 1 });
      });
    });
    return out;
  }
  function decl(gender) {
    const CASES = [
      ["genS", "Родительный ед. (кого? чего? чей?)", 2],
      ["accS", "Винительный ед. (кого? что? после предлога)", 1],
      ["nomP", "Именительный мн. (кто? что?)", 2],
      ["genP", "Родительный мн. (кого? чего?)", 3],
      ["accP", "Винительный мн. (кого? что?)", 2],
    ];
    const list = gender ? DECLENSIONS.filter((d) => d.g === gender) : DECLENSIONS;
    const out = [];
    list.forEach((d) => {
      CASES.forEach(([k, lbl, lvl]) => {
        const others = sh(uniq(Object.values(d.f)).filter((x) => x !== d.f[k]));
        if (others.length < 2) return;
        out.push({ q: `«${noun(d)}» (${d.ru}) → ${lbl}`, opts: sh([d.f[k], others[0], others[1]]), ans: d.f[k], lvl });
      });
    });
    return out;
  }

  // значки тем
  const ICON = {
    read: "🔤", gender: "🚻", cases: "🧩", "decl-m": "♂️", "decl-f": "♀️", "decl-n": "⚪",
    "be-have": "✅", "verb-a": "🅰️", "verb-b": "🅱️", pronouns: "👤", possessive: "🫳",
    adjectives: "🎨", "neg-q": "❓", prepositions: "📍", numbers: "🔢", likes: "❤️",
    time: "🕒", imperative: "❗", future: "⏩", past: "⏪", na: "🔗", conj: "➕",
  };

  return {
    icon: (id) => ICON[id] || "•",
    has: (id) => !!gens[id],
    gen(id) { try { return gens[id] ? gens[id]() : []; } catch (e) { console.warn("ex gen", id, e); return []; } },
  };
})();
