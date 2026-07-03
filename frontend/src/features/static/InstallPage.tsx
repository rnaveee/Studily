import { useEffect, useState } from "react";
import { CheckCircle2, Download, MonitorDown, Share, Smartphone } from "lucide-react";
import { Page, Section } from "./shell";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallPage() {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(
    () => (window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt ?? null,
  );
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onReady = () =>
      setInstallPrompt(
        (window as unknown as { deferredInstallPrompt?: Event }).deferredInstallPrompt ?? null,
      );
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };
    window.addEventListener("studily:install-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("studily:install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const prompt = installPrompt as (Event & { prompt: () => Promise<void> }) | null;
    if (!prompt) return;
    await prompt.prompt();
  }

  return (
    <Page
      title="Install"
      intro="Studily works as an app — add it to your home screen and it opens full-screen, just like a native app."
    >
      {installed && (
        <Section>
          <p className="flex items-center gap-2 font-medium text-green">
            <CheckCircle2 size={16} />
            You're already using Studily as an installed app. Nice.
          </p>
        </Section>
      )}

      {!installed && installPrompt && (
        <Section title="Install now">
          <p>Your browser supports one-click install:</p>
          <button onClick={install} className="btn btn-primary">
            <Download size={13} />
            Install Studily
          </button>
        </Section>
      )}

      <Section title="iPhone & iPad (Safari)">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Open Studily in <span className="font-medium text-fg">Safari</span>.</li>
          <li>
            Tap the <span className="font-medium text-fg">Share</span> button{" "}
            <Share size={13} className="inline align-[-2px]" /> at the bottom of the screen.
          </li>
          <li>Scroll down and tap <span className="font-medium text-fg">Add to Home Screen</span>.</li>
          <li>Tap <span className="font-medium text-fg">Add</span>. Studily now opens from your home screen like any other app.</li>
        </ol>
      </Section>

      <Section title="Android (Chrome)">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Open Studily in <span className="font-medium text-fg">Chrome</span>.</li>
          <li>
            Tap the <span className="font-medium text-fg">⋮ menu</span> in the top-right corner.
            <Smartphone size={13} className="ml-1 inline align-[-2px]" />
          </li>
          <li>Tap <span className="font-medium text-fg">Add to Home screen</span> (or <span className="font-medium text-fg">Install app</span>).</li>
          <li>Confirm, and Studily is added to your home screen and app drawer.</li>
        </ol>
      </Section>

      <Section title="Desktop (Chrome & Edge)">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Look for the <span className="font-medium text-fg">install icon</span>{" "}
            <MonitorDown size={13} className="inline align-[-2px]" /> on the right side of the
            address bar.
          </li>
          <li>Click it and choose <span className="font-medium text-fg">Install</span>.</li>
          <li>Studily opens in its own window and appears with your other apps.</li>
        </ol>
      </Section>
    </Page>
  );
}
