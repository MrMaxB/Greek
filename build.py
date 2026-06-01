#!/usr/bin/env python3
"""Сборка автономной версии: всё (CSS + локальный JS) в один HTML-файл.

Зачем: открыть тренажёр с телефона офлайн, без сервера и без установки.
Запуск:  python3 build.py   ->   dist/greek-a1.html

Надёжность: список и порядок скриптов берётся ИЗ index.html (единый источник).
Каждый локальный <script src="js/..."> заменяется его содержимым. Добавление/
переименование/перестановка файла в index.html подхватывается автоматически.
Firebase/cloud (online-only) и внешние CDN-скрипты в офлайн-файл не включаются.
"""
import io, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
read = lambda p: io.open(os.path.join(ROOT, p), encoding="utf-8").read()

# Скрипты, которые НЕ инлайним (работают только онлайн / внешние)
EXCLUDE = ("firebase-config", "cloud.js", "http://", "https://")


def main():
    html = read("index.html")

    # 1) CSS инлайном
    html = re.sub(r'<link rel="stylesheet" href="[^"]*styles\.css">',
                  lambda m: "<style>\n" + read("css/styles.css") + "\n</style>", html)

    # 2) каждый локальный <script src="..."> → его содержимое (или удаляем, если online-only)
    def repl(m):
        src = m.group(1)
        if any(x in src for x in EXCLUDE):
            return ""  # online-only/внешние — выкидываем из офлайн-сборки
        return "<script>\n" + read(src) + "\n</script>"

    html = re.sub(r'<script[^>]*\bsrc="([^"]+)"[^>]*></script>', repl, html)

    # 3) подчистить комментарий про облако и пустые строки от вырезанных тегов
    html = "\n".join(ln for ln in html.split("\n")
                     if "Облачная синхронизация" not in ln)

    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    out = os.path.join(ROOT, "dist", "greek-a1.html")
    io.open(out, "w", encoding="utf-8").write(html)

    # 4) самопроверка сборки: нет висящих <script src=, есть код App
    assert "<script" not in html or 'src="' not in re.sub(r"<script>.*?</script>", "", html, flags=re.S), \
        "build: остались неинлайненные <script src=...>"
    assert "const App" in html, "build: код App не попал в сборку"
    assert 'src="js/firebase-config' not in html and 'src="js/cloud' not in html, \
        "build: подключён online-only скрипт"
    print("Собрано:", out, "(%.1f КБ)" % (os.path.getsize(out) / 1024))


if __name__ == "__main__":
    main()
