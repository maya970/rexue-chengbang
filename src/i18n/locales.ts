export const LOCALES = [
  { id: "zh-CN", native: "简体中文" },
  { id: "zh-TW", native: "繁體中文" },
  { id: "en", native: "English" },
  { id: "es", native: "Español" },
  { id: "ar", native: "العربية" },
  { id: "hi", native: "हिन्दी" },
  { id: "fr", native: "Français" },
  { id: "pt", native: "Português" },
  { id: "ru", native: "Русский" },
  { id: "bn", native: "বাংলা" },
  { id: "ja", native: "日本語" },
  { id: "de", native: "Deutsch" },
  { id: "id", native: "Bahasa Indonesia" },
  { id: "ur", native: "اردو" },
  { id: "sw", native: "Kiswahili" },
  { id: "tr", native: "Türkçe" },
  { id: "ko", native: "한국어" },
  { id: "vi", native: "Tiếng Việt" },
  { id: "it", native: "Italiano" },
  { id: "th", native: "ไทย" },
  { id: "pl", native: "Polski" },
  { id: "uk", native: "Українська" },
  { id: "nl", native: "Nederlands" },
  { id: "fa", native: "فارسی" },
  { id: "ms", native: "Bahasa Melayu" },
  { id: "ro", native: "Română" },
  { id: "el", native: "Ελληνικά" },
  { id: "cs", native: "Čeština" },
  { id: "sv", native: "Svenska" },
  { id: "hu", native: "Magyar" },
  { id: "fi", native: "Suomi" },
  { id: "he", native: "עברית" },
  { id: "da", native: "Dansk" },
  { id: "no", native: "Norsk" },
  { id: "sk", native: "Slovenčina" },
  { id: "bg", native: "Български" },
  { id: "hr", native: "Hrvatski" },
  { id: "sr", native: "Српски" },
  { id: "sl", native: "Slovenščina" },
  { id: "lt", native: "Lietuvių" },
  { id: "lv", native: "Latviešu" },
  { id: "et", native: "Eesti" },
  { id: "ca", native: "Català" },
  { id: "fil", native: "Filipino" },
  { id: "am", native: "አማርኛ" },
  { id: "ha", native: "Hausa" },
  { id: "yo", native: "Yorùbá" },
  { id: "ig", native: "Igbo" },
  { id: "zu", native: "isiZulu" },
  { id: "kk", native: "Қазақша" },
  { id: "uz", native: "Oʻzbekcha" },
  { id: "az", native: "Azərbaycan" },
  { id: "ka", native: "ქართული" },
  { id: "hy", native: "Հայերեն" },
  { id: "mn", native: "Монгол" },
  { id: "km", native: "ខ្មែរ" },
  { id: "lo", native: "ລາວ" },
  { id: "my", native: "မြန်မာ" },
  { id: "ne", native: "नेपाली" },
  { id: "si", native: "සිංහල" },
  { id: "ta", native: "தமிழ்" },
  { id: "te", native: "తెలుగు" },
  { id: "ml", native: "മലയാളം" },
  { id: "kn", native: "ಕನ್ನಡ" },
  { id: "gu", native: "ગુજરાતી" },
  { id: "pa", native: "ਪੰਜਾਬੀ" },
  { id: "mr", native: "मराठी" },
] as const;

export type LocaleId = (typeof LOCALES)[number]["id"];

export const LOCALE_IDS: LocaleId[] = LOCALES.map((l) => l.id);

export const RTL_LOCALES = new Set<LocaleId>(["ar", "ur", "fa", "he"]);

export const STORAGE_KEY = "rexue-chengbang-locale";

const ALIAS: Record<string, LocaleId> = {
  zh: "zh-CN",
  "zh-hans": "zh-CN",
  "zh-cn": "zh-CN",
  "zh-sg": "zh-CN",
  "zh-hant": "zh-TW",
  "zh-tw": "zh-TW",
  "zh-hk": "zh-TW",
  "zh-mo": "zh-TW",
  iw: "he",
  in: "id",
  tl: "fil",
  fil: "fil",
  nb: "no",
  nn: "no",
  "pt-br": "pt",
  "pt-pt": "pt",
  ckb: "fa",
  "sw-ke": "sw",
  "sw-tz": "sw",
  "sw-cd": "sw",
};

export function matchLocale(tag?: string | null): LocaleId | null {
  if (!tag) return null;
  const raw = tag.trim().replace(/_/g, "-");
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const exact = LOCALE_IDS.find((id) => id.toLowerCase() === lower);
  if (exact) return exact;
  if (ALIAS[lower]) return ALIAS[lower];
  const base = lower.split("-")[0];
  if (ALIAS[base]) return ALIAS[base];
  const byBase = LOCALE_IDS.find((id) => id.toLowerCase() === base || id.toLowerCase().startsWith(`${base}-`));
  return byBase || null;
}

export function detectLocale(): LocaleId {
  try {
    const saved = matchLocale(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch { /* ignore */ }
  const nav = typeof navigator === "undefined"
    ? []
    : [navigator.language, ...(navigator.languages || [])];
  for (const tag of nav) {
    const hit = matchLocale(tag);
    if (hit) return hit;
  }
  return "zh-CN";
}

export function persistLocale(id: LocaleId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
}

export function applyDocumentLocale(id: LocaleId) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = id;
  document.documentElement.dir = RTL_LOCALES.has(id) ? "rtl" : "ltr";
}
