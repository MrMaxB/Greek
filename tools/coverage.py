#!/usr/bin/env python3
"""Аудит покрытия и синергии. Запуск: python3 tools/coverage.py
Считает: размер словаря, покрытие официального A1 (ΚΕΓ), синергию
«материалы↔слова» и осиротевшие слова. Используется для обновления
docs/METHODOLOGY_AND_COVERAGE.md при каждом апдейте контента.
"""
import re, unicodedata, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("ς", "σ").strip()

def read(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()
def gk(t): return set(norm(m) for m in re.findall(r'[Α-Ωα-ωΆ-Ώάέήίόύώϊϋΐΰ]+', t) if len(m) >= 2)

data = read("js/data.js")
items = [(v, [norm(w) for w in re.findall(r'[Α-Ωα-ωΆ-Ώάέήίόύώϊϋΐΰ]+', v) if len(w) >= 2])
         for v in re.findall(r'\{\s*gr:\s*"([^"]+)",\s*tr:', data)]
N = len(items)
deckwords = set(w for _, ws in items for w in ws)

sections = {
    "Чтение": gk(read("js/reading.js")),
    "Экзамены": gk(read("js/exams.js")),
    "Грамматика": gk(read("js/grammar.js")),
    "Письмо": gk(read("js/writing.js")),
}
mats = set().union(*sections.values())
allc = deckwords | mats

def cov(s): return round(100 * sum(1 for _, ws in items if ws and any(w in s for w in ws)) / N)
orphans = [v for v, ws in items if ws and not any(w in mats for w in ws)]

official = set(l.strip() for l in read("docs/data/official_a1_headwords.txt").splitlines() if l.strip())
off_deck = round(100 * sum(1 for h in official if h in deckwords) / len(official))
off_all = round(100 * sum(1 for h in official if h in allc) / len(official))

themes = data.count("\n    title:")
print(f"# Покрытие (автоген tools/coverage.py)\n")
print(f"- Тем: ~{themes} · Слов в словаре (decks): **{N}**")
print(f"- Официальный A1 (ΚΕΓ, {len(official)} лемм): словарём **{off_deck}%**, со всем контентом **{off_all}%**")
print(f"- Синергия «слово в материалах»: **{cov(mats)}%** · осиротевших: **{len(orphans)}**\n")
print("| Секция | Статическое покрытие словаря |")
print("|---|---|")
for k, s in sections.items():
    print(f"| {k} | {cov(s)}% |")
if orphans:
    print(f"\nОсиротевшие ({len(orphans)}): " + ", ".join(orphans))
