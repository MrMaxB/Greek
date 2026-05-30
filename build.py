#!/usr/bin/env python3
"""Сборка автономной версии: всё (CSS + JS) в один HTML-файл.

Зачем: открыть тренажёр с телефона офлайн, без сервера и без установки.
Запуск:  python3 build.py   ->   dist/greek-a1.html
"""
import io, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
read = lambda p: io.open(os.path.join(ROOT, p), encoding="utf-8").read()

def main():
    html = read("index.html")
    css = read("css/styles.css")
    js = "\n".join(read("js/" + f) for f in ["data.js", "grammar.js", "writing.js", "exams.js", "srs.js", "speech.js", "app.js"])

    html = re.sub(r'<link rel="stylesheet" href="css/styles.css">',
                  lambda m: "<style>\n" + css + "\n</style>", html)
    html = re.sub(r'\s*<script src="js/data.js"></script>.*?<script src="js/app.js"></script>',
                  lambda m: "\n  <script>\n" + js + "\n  </script>", html, flags=re.S)

    # Облако (Firebase) работает только онлайн — в офлайн-файл не включаем
    html = "\n".join(
        ln for ln in html.split("\n")
        if not any(s in ln for s in ("firebase-config", "cloud.js", "Облачная синхронизация"))
    )

    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    out = os.path.join(ROOT, "dist", "greek-a1.html")
    io.open(out, "w", encoding="utf-8").write(html)
    print("Собрано:", out, "(%.1f КБ)" % (os.path.getsize(out) / 1024))

if __name__ == "__main__":
    main()
