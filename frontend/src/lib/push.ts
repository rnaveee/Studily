import { api } from "./api";

export type PushEnableResult = "ok" | "denied" | "unsupported" | "unavailable";

export function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function pushPermission(): NotificationPermission | null {
  return pushSupported() ? Notification.permission : null;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function registration() {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function getSubscription() {
  const reg = await registration();
  return reg ? await reg.pushManager.getSubscription() : null;
}

export async function enablePush(): Promise<PushEnableResult> {
  const reg = await registration();
  if (!reg) return "unsupported";
  const { publicKey } = await api.get<{ publicKey: string | null }>("/push/public-key");
  if (!publicKey) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) return "unavailable";
  await api.post<void>("/push/subscribe", {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
  return "ok";
}

export async function disablePush() {
  const sub = await getSubscription();
  if (!sub) return;
  await api.post<void>("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
