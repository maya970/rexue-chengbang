import { useEffect, useState } from "react";

const Q = "(max-width: 980px)";

export function usePhone() {
  const [phone, setPhone] = useState(() => window.matchMedia(Q).matches);
  useEffect(() => {
    const mq = window.matchMedia(Q);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
