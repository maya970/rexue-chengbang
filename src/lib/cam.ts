export type CamAction = "in" | "out" | "rotate" | "reset" | "terrain" | "claims" | "realm";

const EVT = "rexue-cam";

export function sendCam(action: CamAction) {
  window.dispatchEvent(new CustomEvent<CamAction>(EVT, { detail: action }));
}

export function listenCam(fn: (action: CamAction) => void) {
  const on = (e: Event) => fn((e as CustomEvent<CamAction>).detail);
  window.addEventListener(EVT, on);
  return () => window.removeEventListener(EVT, on);
}
