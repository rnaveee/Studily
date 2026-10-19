import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Modal from "../../components/Modal";
import DeleteAccountForm from "../../components/DeleteAccountForm";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import { formatCountdown, formatReasons } from "../../lib/moderation";
import { SUPPORT_EMAIL } from "../../lib/support";
import type { MeModeration } from "../../types";

const RETRY_MS = 30_000;

export default function SuspendedScreen() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [now, setNow] = useState(() => Date.now());
  const [deleting, setDeleting] = useState(false);
  const refreshing = useRef(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const { data } = useQuery({
    queryKey: ["me", "moderation"],
    queryFn: () => api.get<MeModeration>("/me/moderation"),
  });

  const banned = data?.banned ?? user?.banned ?? false;
  const until = data?.suspendedUntil ?? user?.suspendedUntil ?? null;
  const untilMs = until ? new Date(until).getTime() : null;
  const remaining = untilMs != null ? untilMs - now : null;
  const expired = !banned && remaining != null && remaining <= 0;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function run() {
      if (refreshing.current) return;
      refreshing.current = true;
      refreshRef.current().catch(() => {}).finally(() => {
        refreshing.current = false;
      });
    }
    window.addEventListener("focus", run);
    if (!expired) return () => window.removeEventListener("focus", run);
    run();
    const id = window.setInterval(run, RETRY_MS);
    return () => {
      window.removeEventListener("focus", run);
      window.clearInterval(id);
    };
  }, [expired]);

  async function deleteAccount(password: string) {
    const ok = await confirm({
      title: "Delete your account?",
      message:
        "This permanently erases your courses, schedule, messages, friendships, and everything else. There is no undo.",
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    await api.post<void>("/me/delete", { password });
    toast.success("Your account has been deleted");
    logout();
    navigate("/signup");
  }

  function signOut() {
    logout();
    navigate("/login");
  }

  const supportEmail = data?.supportEmail ?? SUPPORT_EMAIL;

  return (
    <div className="fixed inset-0 bg-bg" style={{ height: "var(--app-height)" }}>
      <div className="flex items-center gap-1.5 px-5 py-4">
        <img src="/studily-3a.svg" alt="" className="h-8 w-8 shrink-0" />
        <div className="font-mono text-[15px] font-bold tracking-tight text-fg">Studily</div>
      </div>
      <Modal
        title="Account suspended"
        size="md"
        showClose={false}
        beforeClose={() => false}
        onClose={() => {}}
        footer={
          <>
            <button type="button" onClick={() => setDeleting((d) => !d)} className="btn btn-ghost">
              {deleting ? "Cancel" : "Delete account"}
            </button>
            <button type="button" onClick={signOut} className="btn btn-primary">
              Sign out
            </button>
          </>
        }
      >
        <div className="space-y-3 text-[14px] text-fg-2">
          {data ? (
            <p>Your account has been suspended for {formatReasons(data.reasons)}.</p>
          ) : (
            <p>Your account has been suspended.</p>
          )}
          {data?.note && (
            <p
              className="whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] text-fg-2 [overflow-wrap:anywhere]"
              style={{ background: "var(--surface-hi)" }}
            >
              {data.note}
            </p>
          )}
          {banned ? (
            <p className="font-medium text-fg">Your account is suspended indefinitely.</p>
          ) : (
            untilMs != null && (
              <div className="space-y-1">
                <p className="font-medium text-fg">Suspended until {new Date(untilMs).toLocaleString()}</p>
                <p className="tabular-nums text-fg-3">
                  Time left: {formatCountdown(Math.max(0, untilMs - now))}
                </p>
              </div>
            )
          )}
          <p className="text-[13px] text-fg-3">
            Is this a mistake? Contact our support –{" "}
            <a href={`mailto:${supportEmail}`} className="text-accent transition-colors hover:text-accent-2">
              {supportEmail}
            </a>{" "}
            or use the{" "}
            <Link to="/support?category=APPEAL" className="text-accent transition-colors hover:text-accent-2">
              support form
            </Link>
            .
          </p>
          {deleting && <DeleteAccountForm onSubmit={deleteAccount} />}
        </div>
      </Modal>
    </div>
  );
}
