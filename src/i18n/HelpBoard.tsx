import { useEffect, useMemo, useState } from "react";
import { LangSelect, useI18n } from "./index";

export function HelpBoard({ q, onQ }: { q: string; onQ: (v: string) => void }) {
  const { t, help, locale } = useI18n();
  const [cat, setCat] = useState("all");

  useEffect(() => {
    setCat("all");
  }, [locale]);

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return help.filter((s) => {
      if (cat !== "all" && s.id !== cat) return false;
      if (!needle) return true;
      return `${s.title} ${s.body}`.toLowerCase().includes(needle);
    });
  }, [help, q, cat]);

  return (
    <>
      <h3>{t("helpTitle")}</h3>
      <p className="muted">{t("helpHint")}</p>
      <div className="row help-lang-row">
        <LangSelect />
        <span className="muted">{t("helpNamesNote")}</span>
      </div>
      <input
        className="board-search"
        value={q}
        onChange={(e) => onQ(e.target.value)}
        placeholder={t("helpSearch")}
      />
      <div className="board-cats">
        <button className={`btn tiny${cat === "all" ? " primary" : ""}`} onClick={() => setCat("all")}>
          {t("catAll")}
        </button>
        {help.map((s) => (
          <button
            key={s.id}
            className={`btn tiny${cat === s.id ? " primary" : ""}`}
            onClick={() => setCat(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      <div className="board-body">
        {sections.length ? sections.map((s) => (
          <article key={s.id} className="help-sec">
            <h4>{s.title}</h4>
            {s.body.split("\n").map((p, i) => <p key={i}>{p}</p>)}
          </article>
        )) : <p className="muted">{t("emptyReports")}</p>}
      </div>
    </>
  );
}
