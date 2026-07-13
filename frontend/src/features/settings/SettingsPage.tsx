import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
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
import type { NotificationPrefs } from "../../types";

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
    </div>
  );
}
