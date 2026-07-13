import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { MailWarning } from "lucide-react";
import { useAuth } from "../lib/auth";

export default function VerifyGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user || user.emailVerified) return <>{children}</>;

  return (
    <div className="animate-in">
      <div className="card mx-auto mt-8 max-w-md p-8 text-center">
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <MailWarning size={20} className="text-accent" />
        </span>
        <h1 className="mt-4 text-[15px] font-semibold text-fg">Verify your email first</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-3">
          Messaging and friends are locked until you confirm{" "}
          <span className="font-medium text-fg-2">{user.email}</span>. Planning features still work
          without it.
        </p>
        <Link to="/settings" className="btn btn-primary mt-5">
          Verify in Settings
        </Link>
      </div>
    </div>
  );
}
