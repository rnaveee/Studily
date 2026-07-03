import { useState } from "react";
import { Link } from "react-router-dom";
import { Megaphone, Smartphone, X } from "lucide-react";

const BETA_KEY = "studily.banner.beta";
const INSTALL_KEY = "studily.banner.install";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function Banners() {
  const [betaDismissed, setBetaDismissed] = useState(
    () => localStorage.getItem(BETA_KEY) === "1",
  );
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem(INSTALL_KEY) === "1" || isStandalone(),
  );

  function dismiss(key: string, set: (v: boolean) => void) {
    localStorage.setItem(key, "1");
    set(true);
  }

  if (betaDismissed && installDismissed) return null;

  return (
    <div className="shrink-0">
      {!betaDismissed && (
        <Banner
          icon={<Megaphone size={13} className="shrink-0" />}
          onDismiss={() => dismiss(BETA_KEY, setBetaDismissed)}
        >
          Studily is in beta! Found a bug?{" "}
          <Link to="/support" className="font-medium underline underline-offset-2">
            Send it our way
          </Link>
          .
        </Banner>
      )}
      {!installDismissed && (
        <Banner
          icon={<Smartphone size={13} className="shrink-0" />}
          onDismiss={() => dismiss(INSTALL_KEY, setInstallDismissed)}
        >
          Get Studily as an app!{" "}
          <Link to="/install" className="font-medium underline underline-offset-2">
            See how to install it
          </Link>
          .
        </Banner>
      )}
    </div>
  );
}

function Banner({
  icon,
  onDismiss,
  children,
}: {
  icon: React.ReactNode;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 text-[12px] text-accent animate-slide"
      style={{
        background: "color-mix(in srgb, var(--accent) 9%, var(--surface))",
        borderBottom: "1px solid var(--line)",
      }}
    >
      {icon}
      <p className="flex-1 truncate">{children}</p>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-0.5 transition-colors hover:bg-surface-hi"
      >
        <X size={13} />
      </button>
    </div>
  );
}
