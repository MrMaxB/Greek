/* ============================================================
   Облачная синхронизация прогресса (Firebase Auth + Firestore).
   ES-модуль, грузится только онлайн (на сайте). Если конфига нет
   или нет сети — приложение работает локально, без облака.

   Слияние: прогресс с разных устройств объединяется (берётся более
   продвинутое состояние по каждой карточке/экзамену), поэтому ничего
   не теряется и кэш можно спокойно чистить.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const EXAM_KEY = "greekA1_exam_best";
const READ_KEY = "greekA1_reading_done";
const TRACK_KEY = "greekA1_track";

const Cloud = { enabled: false, ready: false, user: null, status: "" };
window.Cloud = Cloud;

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function localState() {
  const S = window.SRS;
  return {
    srs: S ? S.data : JSON.parse(localStorage.getItem("greekA1_srs_v1") || "{}"),
    stats: S ? S.stats : JSON.parse(localStorage.getItem("greekA1_stats_v1") || "{}"),
    exams: JSON.parse(localStorage.getItem(EXAM_KEY) || "{}"),
    reading: JSON.parse(localStorage.getItem(READ_KEY) || "{}"),
    track: JSON.parse(localStorage.getItem(TRACK_KEY) || "null"),
    _v: 1, _ts: Date.now(),
  };
}

function applyState(state) {
  if (!state) return;
  Cloud._applying = true;
  const S = window.SRS;
  if (S) {
    S.data = state.srs || {};
    S.stats = state.stats || { learnedDates: {}, totalReviews: 0 };
    if (!S.stats.learnedDates) S.stats.learnedDates = {};
    if (S.stats.totalReviews == null) S.stats.totalReviews = 0;
    S.save();
  } else {
    localStorage.setItem("greekA1_srs_v1", JSON.stringify(state.srs || {}));
    localStorage.setItem("greekA1_stats_v1", JSON.stringify(state.stats || {}));
  }
  localStorage.setItem(EXAM_KEY, JSON.stringify(state.exams || {}));
  localStorage.setItem(READ_KEY, JSON.stringify(state.reading || {}));
  if (state.track) localStorage.setItem(TRACK_KEY, JSON.stringify(state.track));
  if (window.App) window.App._ts = null; // сбросить кэш состояния трека
  Cloud._applying = false;
}

// Объединяем два состояния так, чтобы сохранить максимум прогресса.
function mergeState(a, b) {
  a = a || {}; b = b || {};
  const srsA = a.srs || {}, srsB = b.srs || {};
  const srs = {};
  new Set([...Object.keys(srsA), ...Object.keys(srsB)]).forEach((id) => {
    const x = srsA[id], y = srsB[id];
    if (!x) { srs[id] = y; return; }
    if (!y) { srs[id] = x; return; }
    if ((y.reps || 0) > (x.reps || 0)) srs[id] = y;
    else if ((x.reps || 0) > (y.reps || 0)) srs[id] = x;
    else srs[id] = (y.due || "") > (x.due || "") ? y : x;
  });
  const sa = a.stats || {}, sb = b.stats || {};
  const ld1 = sa.learnedDates || {}, ld2 = sb.learnedDates || {};
  const learnedDates = {};
  new Set([...Object.keys(ld1), ...Object.keys(ld2)]).forEach((d) => {
    learnedDates[d] = Math.max(ld1[d] || 0, ld2[d] || 0);
  });
  const stats = {
    streak: Math.max(sa.streak || 0, sb.streak || 0),
    lastDay: (sa.lastDay || "") > (sb.lastDay || "") ? sa.lastDay : (sb.lastDay || ""),
    totalReviews: Math.max(sa.totalReviews || 0, sb.totalReviews || 0),
    learnedDates,
  };
  const ea = a.exams || {}, eb = b.exams || {};
  const exams = {};
  new Set([...Object.keys(ea), ...Object.keys(eb)]).forEach((n) => {
    exams[n] = Math.max(ea[n] || 0, eb[n] || 0);
  });
  const ra = a.reading || {}, rb = b.reading || {};
  const reading = {};
  new Set([...Object.keys(ra), ...Object.keys(rb)]).forEach((k) => {
    reading[k] = ra[k] || rb[k] || false;
  });
  // Трек: берём более продвинутый день; отметки задач объединяем
  const ta = a.track, tb = b.track;
  let track = ta || tb || null;
  if (ta && tb) {
    const done = {};
    new Set([...Object.keys(ta.done || {}), ...Object.keys(tb.done || {})]).forEach((d) => {
      done[d] = [...new Set([...((ta.done || {})[d] || []), ...((tb.done || {})[d] || [])])];
    });
    track = { day: Math.max(ta.day || 1, tb.day || 1), done };
  }
  return { srs, stats, exams, reading, track, _v: 1, _ts: Date.now() };
}

const cfg = window.FIREBASE_CONFIG;
if (cfg && cfg.apiKey) {
  try {
    const app = initializeApp(cfg);
    const auth = getAuth(app);
    const db = getFirestore(app);
    Cloud.enabled = true;

    const rerender = () => { if (window.App && window.App.root) window.App.render(); };

    Cloud.push = debounce(async () => {
      if (!Cloud.user || Cloud._applying) return;
      try { await setDoc(doc(db, "progress", Cloud.user.uid), localState()); }
      catch (e) { console.warn("Cloud push error", e); }
    }, 1500);

    Cloud.login = async () => {
      const provider = new GoogleAuthProvider();
      try { await signInWithPopup(auth, provider); }
      catch (e) {
        // На мобильных попап часто блокируется — уходим в redirect
        if (["auth/popup-blocked", "auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/operation-not-supported-in-this-environment"].includes(e.code)) {
          await signInWithRedirect(auth, provider);
        } else {
          Cloud.status = "Ошибка входа: " + (e.code || e.message);
          rerender();
        }
      }
    };
    Cloud.logout = () => signOut(auth);
    // Полный сброс облачного прогресса (перезапись пустым, минуя merge)
    Cloud.reset = async () => {
      if (!Cloud.user) return;
      Cloud._applying = true;
      try { await setDoc(doc(db, "progress", Cloud.user.uid), { srs: {}, stats: { learnedDates: {}, totalReviews: 0 }, exams: {}, reading: {}, track: { day: 1, done: {} }, _v: 1, _ts: Date.now() }); }
      catch (e) { console.warn("Cloud reset error", e); }
      Cloud._applying = false;
    };

    getRedirectResult(auth).catch(() => {});

    onAuthStateChanged(auth, async (user) => {
      Cloud.user = user;
      Cloud.ready = true;
      Cloud.status = "";
      if (Cloud._unsub) { Cloud._unsub(); Cloud._unsub = null; }
      if (user) {
        try {
          const ref = doc(db, "progress", user.uid);
          const snap = await getDoc(ref);
          const merged = mergeState(snap.exists() ? snap.data() : null, localState());
          applyState(merged);
          await setDoc(ref, merged);
          // Живая синхронизация с других устройств
          Cloud._unsub = onSnapshot(ref, (s) => {
            if (s.metadata.hasPendingWrites || !s.exists()) return;
            applyState(mergeState(s.data(), localState()));
            rerender();
          });
        } catch (e) {
          console.warn("Cloud sync error", e);
          Cloud.status = "Нет доступа к базе. Включи Firestore и правила (см. инструкцию).";
        }
      }
      rerender();
    });
  } catch (e) {
    console.warn("Firebase init failed", e);
    Cloud.enabled = false;
  }
}
