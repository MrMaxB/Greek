/* ============================================================
   Ελληνικά A1 — алфавит и буквосочетания.
   ============================================================ */
/* ---------- 1. АЛФАВИТ ---------- */
// sound — упрощённое описание звука для русскоязычного.
const ALPHABET = [
  { upper: "Α", lower: "α", name: "άλφα",    translit: "a",  sound: "как «а» в «дам»",                 example: "αγάπη",   exTr: "любовь" },
  { upper: "Β", lower: "β", name: "βήτα",    translit: "v",  sound: "как «в»",                          example: "βιβλίο",  exTr: "книга" },
  { upper: "Γ", lower: "γ", name: "γάμα",    translit: "γ",  sound: "мягкое «г» (укр. «г»/«й»)",         example: "γάλα",    exTr: "молоко" },
  { upper: "Δ", lower: "δ", name: "δέλτα",   translit: "ð",  sound: "звонкое «th» (англ. this)",        example: "δέντρο",  exTr: "дерево" },
  { upper: "Ε", lower: "ε", name: "έψιλον",  translit: "e",  sound: "как «э»",                          example: "ελιά",    exTr: "оливка" },
  { upper: "Ζ", lower: "ζ", name: "ζήτα",    translit: "z",  sound: "как «з»",                          example: "ζάχαρη",  exTr: "сахар" },
  { upper: "Η", lower: "η", name: "ήτα",     translit: "i",  sound: "как «и»",                          example: "ήλιος",   exTr: "солнце" },
  { upper: "Θ", lower: "θ", name: "θήτα",    translit: "θ",  sound: "глухое «th» (англ. think)",        example: "θάλασσα", exTr: "море" },
  { upper: "Ι", lower: "ι", name: "γιώτα",   translit: "i",  sound: "как «и»",                          example: "ιστορία", exTr: "история" },
  { upper: "Κ", lower: "κ", name: "κάπα",    translit: "k",  sound: "как «к»",                          example: "καφές",   exTr: "кофе" },
  { upper: "Λ", lower: "λ", name: "λάμδα",   translit: "l",  sound: "как «л»",                          example: "λεμόνι",  exTr: "лимон" },
  { upper: "Μ", lower: "μ", name: "μι",      translit: "m",  sound: "как «м»",                          example: "μήλο",    exTr: "яблоко" },
  { upper: "Ν", lower: "ν", name: "νι",      translit: "n",  sound: "как «н»",                          example: "νερό",    exTr: "вода" },
  { upper: "Ξ", lower: "ξ", name: "ξι",      translit: "ks", sound: "как «кс»",                         example: "ξύλο",    exTr: "дерево (материал)" },
  { upper: "Ο", lower: "ο", name: "όμικρον", translit: "o",  sound: "как «о»",                          example: "όνομα",   exTr: "имя" },
  { upper: "Π", lower: "π", name: "πι",      translit: "p",  sound: "как «п»",                          example: "πόρτα",   exTr: "дверь" },
  { upper: "Ρ", lower: "ρ", name: "ρο",      translit: "r",  sound: "раскатистое «р»",                  example: "ρολόι",   exTr: "часы" },
  { upper: "Σ", lower: "σ/ς", name: "σίγμα", translit: "s",  sound: "как «с» (ς — только в конце слова)", example: "σπίτι", exTr: "дом" },
  { upper: "Τ", lower: "τ", name: "ταυ",     translit: "t",  sound: "как «т»",                          example: "τυρί",    exTr: "сыр" },
  { upper: "Υ", lower: "υ", name: "ύψιλον",  translit: "i",  sound: "как «и»",                          example: "ύπνος",   exTr: "сон" },
  { upper: "Φ", lower: "φ", name: "φι",      translit: "f",  sound: "как «ф»",                          example: "φως",     exTr: "свет" },
  { upper: "Χ", lower: "χ", name: "χι",      translit: "x",  sound: "как «х»",                          example: "χέρι",    exTr: "рука" },
  { upper: "Ψ", lower: "ψ", name: "ψι",      translit: "ps", sound: "как «пс»",                         example: "ψωμί",    exTr: "хлеб" },
  { upper: "Ω", lower: "ω", name: "ωμέγα",   translit: "o",  sound: "как «о»",                          example: "ώρα",     exTr: "час, время" },
];

/* Буквосочетания — без них не прочитать ни слова */
const DIGRAPHS = [
  { gr: "ου", translit: "у",     note: "как русское «у»",                       example: "ούζο",     exTr: "узо" },
  { gr: "αι", translit: "э",     note: "звучит как «э»",                        example: "παιδί",    exTr: "ребёнок" },
  { gr: "ει", translit: "и",     note: "звучит как «и»",                        example: "είμαι",    exTr: "я есть" },
  { gr: "οι", translit: "и",     note: "звучит как «и»",                        example: "σπίτια",   exTr: "дома" },
  { gr: "αυ", translit: "ав/аф", note: "«ав» перед звонкими, «аф» перед глухими", example: "αύριο",   exTr: "завтра" },
  { gr: "ευ", translit: "эв/эф", note: "«эв» перед звонкими, «эф» перед глухими", example: "ευχαριστώ", exTr: "спасибо" },
  { gr: "μπ", translit: "б/мб",  note: "«б» в начале слова",                    example: "μπύρα",    exTr: "пиво" },
  { gr: "ντ", translit: "д/нд",  note: "«д» в начале слова",                    example: "ντομάτα",  exTr: "помидор" },
  { gr: "γκ", translit: "г/нг",  note: "«г» в начале слова",                    example: "γκολ",     exTr: "гол" },
  { gr: "γγ", translit: "нг",    note: "как «нг»",                              example: "αγγλικά",  exTr: "английский" },
  { gr: "τσ", translit: "ц",     note: "как «ц»",                               example: "τσάι",     exTr: "чай" },
  { gr: "τζ", translit: "дз",    note: "как «дз»",                              example: "τζατζίκι", exTr: "дзадзики" },
];
