import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, setToken } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { useTheme } from "../../lib/theme";
import { toast } from "../../lib/toast";
import {
  disablePush,
  enablePush,
  getSubscription,
  pushPermission,
  pushSupported,
} from "../../lib/push";
import Toggle from "../../components/Toggle";
import type { AuthResponse, NotificationPrefs } from "../../types";

const PREF_ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: "messages", label: "DMs + group chats", hint: "New messages from friends and groups" },
  { key: "classReminders", label: "Class reminders", hint: "1 hour before each class" },
  { key: "eventDayOf", label: "Day of events", hint: "The morning of a calendar event" },
  { key: "itemWeekAhead", label: "Assignments and exams", hint: "7 days before a due date" },
  { key: "examDayOf", label: "Day of exams", hint: "The morning of an exam" },
];

export default function SettingsPage() {
  const { dark, toggle } = useTheme();
  const qc = useQueryClient();
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const supported = pushSupported();
  const denied = pushPermission() === "denied";

  useEffect(() => {
    getSubscription().then((sub) => setSubscribed(!!sub));
  }, []);

  const prefsQ = useQuery({
    queryKey: ["settings", "notifications"],
    queryFn: () => api.get<NotificationPrefs>("/settings/notifications"),
  });

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) => api.put<NotificationPrefs>("/settings/notifications", next),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["settings", "notifications"] });
      const prev = qc.getQueryData<NotificationPrefs>(["settings", "notifications"]);
      qc.setQueryData(["settings", "notifications"], next);
      return { prev };
    },
    onError: (_e, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["settings", "notifications"], ctx.prev);
      toast.error("Couldn't save settings");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["settings", "notifications"] }),
  });

  async function handleDeviceToggle(next: boolean) {
    setBusy(true);
    try {
      if (next) {
        const result = await enablePush();
        if (result === "ok") {
          setSubscribed(true);
        } else if (result === "denied") {
          toast.error("Notifications are blocked. Allow them in iOS Settings → Studily.");
        } else if (result === "unavailable") {
          toast.error("Push isn't configured on the server yet");
        } else {
          toast.error("Push isn't supported here — install the app first");
        }
      } else {
        await disablePush();
        setSubscribed(false);
      }
    } catch {
      toast.error("Something went wrong enabling notifications");
    } finally {
      setBusy(false);
    }
  }

  function setPref(key: keyof NotificationPrefs, value: boolean) {
    if (!prefsQ.data) return;
    save.mutate({ ...prefsQ.data, [key]: value });
    if (value && subscribed === false && supported && !denied) {
      handleDeviceToggle(true);
    }
  }

  return (
    <div className="animate-in">
      <h1 className="text-xl font-semibold text-fg">Settings</h1>

      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
        Notifications
      </h2>

      {!supported && (
        <div className="card mt-3 p-4 text-[13px] text-fg-2">
          Push notifications work in the installed app.{" "}
          <Link to="/install" className="font-medium text-accent">
            Install Studily
          </Link>{" "}
          from Safari to enable them.
        </div>
      )}

      {supported && (
        <div className="card mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-[14px] font-medium text-fg">Notifications on this device</div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                {denied
                  ? "Blocked — allow notifications in iOS Settings → Studily"
                  : "Allow Studily to send push notifications here"}
              </div>
            </div>
            <Toggle
              checked={!!subscribed}
              onChange={handleDeviceToggle}
              disabled={busy || denied || subscribed === null}
            />
          </div>
        </div>
      )}

      <div className="card mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
        {PREF_ROWS.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-4 p-4">
            <div>
              <div className="text-[14px] font-medium text-fg">{label}</div>
              <div className="mt-0.5 text-[12px] text-fg-3">{hint}</div>
            </div>
            <Toggle
              checked={prefsQ.data?.[key] ?? true}
              onChange={(v) => setPref(key, v)}
              disabled={prefsQ.isLoading}
            />
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
        Preferences
      </h2>

      <div className="card mt-3">
        <div className="flex items-center justify-between gap-4 p-4">
          <div>
            <div className="text-[14px] font-medium text-fg">Dark mode</div>
            <div className="mt-0.5 text-[12px] text-fg-3">Switch between light and dark themes</div>
          </div>
          <Toggle checked={dark} onChange={() => toggle()} />
        </div>
      </div>

      <AccountSection />
    </div>
  );
}

function AccountSection() {
  const { user, logout, refresh } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [openForm, setOpenForm] = useState<"password" | "delete" | null>(null);

  useEffect(() => {
    if (user && !user.emailVerified) {
      const onFocus = () => refresh().catch(() => {});
      window.addEventListener("focus", onFocus);
      return () => window.removeEventListener("focus", onFocus);
    }
  }, [user, refresh]);

  const resend = useMutation({
    mutationFn: () => api.post<void>("/me/verification-email"),
    onSuccess: () => toast.success(`Verification link sent to ${user?.email}`),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Couldn't send the email"),
  });

  async function deleteAccount(password: string) {
    const ok = await confirm({
      title: "Delete your account?",
      message:
        "This permanently erases your courses, schedule, messages, friendships — everything. There is no undo.",
      confirmLabel: "Delete forever",
      danger: true,
    });
    if (!ok) return;
    await api.post<void>("/me/delete", { password });
    toast.success("Your account has been deleted");
    logout();
    navigate("/signup");
  }

  if (!user) return null;

  return (
    <>
      <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wider text-fg-3">
        Account
      </h2>

      <div className="card mt-3 divide-y" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium text-fg">{user.email}</div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              {user.emailVerified
                ? "Verified — messaging and friends are unlocked"
                : "Unverified — messaging and friends are locked"}
            </div>
          </div>
          {user.emailVerified ? (
            <span className="badge badge-accent shrink-0">Verified</span>
          ) : (
            <button
              onClick={() => resend.mutate()}
              disabled={resend.isPending}
              className="btn btn-primary shrink-0"
            >
              {resend.isPending ? "Sending…" : "Send link"}
            </button>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-medium text-fg">Password</div>
              <div className="mt-0.5 text-[12px] text-fg-3">Change your account password</div>
            </div>
            <button
              onClick={() => setOpenForm((f) => (f === "password" ? null : "password"))}
              className="btn btn-ghost shrink-0"
            >
              {openForm === "password" ? "Cancel" : "Change"}
            </button>
          </div>
          {openForm === "password" && (
            <ChangePasswordForm onDone={() => setOpenForm(null)} />
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-medium text-fg">Delete account</div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                Permanently erase your account and all data
              </div>
            </div>
            <button
              onClick={() => setOpenForm((f) => (f === "delete" ? null : "delete"))}
              className="btn btn-danger shrink-0"
            >
              {openForm === "delete" ? "Cancel" : "Delete"}
            </button>
          </div>
          {openForm === "delete" && <DeleteAccountForm onSubmit={deleteAccount} />}
        </div>
      </div>
    </>
  );
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirmPw) {
      setError("New passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const res = await api.put<AuthResponse>("/me/password", {
        currentPassword: current,
        newPassword: next,
      });
      setToken(res.token);
      toast.success("Password updated");
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 animate-slide">
      <div>
        <label className="field-label">Current password</label>
        <input
          className="input"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">New password</label>
          <input
            className="input"
            type="password"
            placeholder="min 8 characters"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div>
          <label className="field-label">Confirm</label>
          <input
            className="input"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            required
            minLength={8}
          />
        </div>
      </div>
      {error && <p className="text-xs text-red animate-fade">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-primary">
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

function DeleteAccountForm({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 animate-slide">
      <div>
        <label className="field-label">Confirm with your password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      </div>
      {error && <p className="text-xs text-red animate-fade">{error}</p>}
      <button type="submit" disabled={busy} className="btn btn-danger">
        {busy ? "Deleting…" : "Permanently delete my account"}
      </button>
    </form>
  );
}
