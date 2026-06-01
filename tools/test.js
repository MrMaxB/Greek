/* Прежний самописный сьют заменён на node:test.
   Запуск: npm test   (или: node --test tests/*.test.js)
   Файлы тестов: tests/content.test.js, tests/logic.test.js, tests/gloss.test.js */
const { spawnSync } = require("child_process");
const path = require("path");
const r = spawnSync(process.execPath, ["--test", "tests/content.test.js", "tests/logic.test.js", "tests/gloss.test.js"],
  { cwd: path.dirname(__dirname), stdio: "inherit" });
process.exit(r.status || 0);
