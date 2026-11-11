import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { MarketPage } from "./MarketPage";
import { LocaleProvider } from "./i18n";
import "./styles.css";

function routeOf() {
  const h = (window.location.hash || "").replace(/^#\/?/, "").toLowerCase();
  if (h === "market" || h.startsWith("market?") || h === "bazaar") return "market";
  return "game";
}

function Root() {
  const [route, setRoute] = useState(routeOf);
  useEffect(() => {
    const onHash = () => setRoute(routeOf());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route === "market" ? <MarketPage /> : <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <Root />
    </LocaleProvider>
  </React.StrictMode>,
);
