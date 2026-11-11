import { useRef, useState, type ChangeEvent } from "react";
import { LangSelect } from "../i18n";

export function Gate(props: {
  booting?: boolean;
  error?: string;
  onCreate: () => Promise<void> | void;
  onImport: (text: string) => Promise<void> | void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState("");

  async function create() {
    setWorking("铸印中…");
    try {
      await props.onCreate();
    } finally {
      setWorking("");
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setWorking("验印…");
    try {
      await props.onImport(await f.text());
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="gate-kicker">REXUE CHENGBANG</p>
        <h1>热血城邦</h1>
        {props.booting ? <p className="muted">唤印…</p> : (
          <>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onFile} />
            <div className="gate-actions">
              <button className="btn primary" disabled={Boolean(working)} onClick={() => void create()}>创建</button>
              <button className="btn" disabled={Boolean(working)} onClick={() => fileRef.current?.click()}>导入</button>
            </div>
            <div className="gate-lang"><LangSelect /></div>
          </>
        )}
        {working ? <p className="busy">{working}</p> : null}
        {props.error ? <p className="err">{props.error}</p> : null}
      </div>
    </div>
  );
}
