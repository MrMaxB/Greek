/* Сборка офлайн-файла: dist собирается, скрипты инлайнятся, online-only
   код не попадает. Гоняет реальный build.py. node:test. */
const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.dirname(__dirname);

test("build.py собирает автономный dist без висящих <script src> и online-кода", () => {
  // build.py сам падает (assert) при проблемах — нам важно, что он отработал
  execFileSync("python3", ["build.py"], { cwd: ROOT, stdio: "pipe" });
  const html = fs.readFileSync(path.join(ROOT, "dist", "greek-a1.html"), "utf8");
  assert.ok(html.length > 100000, "dist подозрительно маленький");
  // нет неинлайненных локальных скриптов
  const noInline = html.replace(/<script>[\s\S]*?<\/script>/g, "");
  assert.ok(!/<script[^>]*\bsrc="js\//.test(noInline), "остались <script src=js/...>");
  // ядро и фичи на месте
  ["const App", "buildTrack", "GRAMMAR_LESSONS", "ALL_WORDS"].forEach((s) =>
    assert.ok(html.includes(s), `в сборке нет: ${s}`));
  // online-only не подключён тегом
  assert.ok(!/src="js\/(firebase-config|cloud)/.test(html), "подключён online-only скрипт");
});
