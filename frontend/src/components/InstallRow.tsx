import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { isIos, isStandalone } from "../lib/pwa";

type InstallEvent = Event & { prompt: () => Promise<void> };

function deferred(): InstallEvent | null {
  return (window as unknown as { deferredInstallPrompt?: InstallEvent }).deferredInstallPrompt ?? null;
}

export default function InstallRow() {
  const [installed, setInstalled] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());
    setPrompt(deferred());
    const onReady = () => setPrompt(deferred());
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("studily:install-ready", onReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("studily:install-ready", onReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ios = isIos();
  if (!installed && !prompt && !ios) return null;

  return (
    <>
      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wider text-fg-3">App</h2>
      <div className="card mt-3 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[14px] font-medium text-fg">Install Studily</div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              {installed
                ? "Installed. You're using the app."
                : "Opens full screen from your home screen or desktop"}
            </div>
          </div>
          {!installed && prompt && (
            <button
              type="button"
              className="btn btn-primary min-h-[44px] shrink-0"
              onClick={() => void prompt.prompt()}
            >
              <Download size={13} />
              Install
            </button>
          )}
        </div>
        {!installed && !prompt && ios && (
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-fg-2">
            <li>
              Tap Share <Share size={13} className="inline align-[-2px]" /> in Safari.
            </li>
            <li>Scroll and tap Add to Home Screen.</li>
            <li>Tap Add.</li>
          </ol>
        )}
      </div>
    </>
  );
}
